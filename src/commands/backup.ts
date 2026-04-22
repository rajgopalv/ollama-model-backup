import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';
import { listModels, getBlobPath, resolveBlobs } from '../lib/ollama.js';
import { copyFileWithProgress, formatBytes } from '../lib/fs.js';
import { DEFAULT_MANIFESTS_DIR, DEFAULT_BLOBS_DIR, DEFAULT_MODEL_LOCATION, ENV_VARS } from '../constants.js';
import type { CopyProgress } from '../types.js';

export interface BackupOptions {
  modelLocation?: string;
  backupLocation?: string;
  models?: string[];
  dryRun?: boolean;
}

export async function backup(options: BackupOptions): Promise<void> {
  const modelLocation = options.modelLocation || process.env[ENV_VARS.MODEL_LOCATION] || DEFAULT_MODEL_LOCATION;
  const backupLocation = options.backupLocation || process.env[ENV_VARS.BACKUP_LOCATION];

  if (!modelLocation) {
    throw new Error(`Model location required. Set --model-location or ${ENV_VARS.MODEL_LOCATION}`);
  }

  if (!backupLocation) {
    throw new Error(`Backup location required. Set --backup-location or ${ENV_VARS.BACKUP_LOCATION}`);
  }

  const spinner = ora('Scanning models...').start();

  try {
    const allModels = await listModels(modelLocation);

    const modelsToBackup = options.models && options.models.length > 0
      ? allModels.filter(m => options.models!.some(target => m.name.includes(target)))
      : allModels;

    if (modelsToBackup.length === 0) {
      spinner.warn('No models found');
      return;
    }

    spinner.succeed(`Found ${modelsToBackup.length} model(s)`);

    let totalBytes = 0;
    for (const model of modelsToBackup) {
      totalBytes += model.totalSize;
    }

    let bytesCopied = 0;
    let currentFile = '';

    const updateProgress = (progress: CopyProgress) => {
      bytesCopied = progress.bytesCopied;
      currentFile = progress.filename;
    };

    let currentModelIndex = 0;
    let failedCount = 0;

    for (const model of modelsToBackup) {
      currentModelIndex++;
      const modelSpinner = ora(`[${currentModelIndex}/${modelsToBackup.length}] ${model.name}`).start();

      if (options.dryRun) {
        modelSpinner.info(`Would copy ${model.blobs.length} blobs + manifest (${formatBytes(model.totalSize)})`);
        continue;
      }

      try {
        // Copy manifest
        const manifestDest = path.join(
          backupLocation,
          DEFAULT_MANIFESTS_DIR,
          model.manifestPath.replace(path.join(modelLocation, DEFAULT_MANIFESTS_DIR), '').slice(1)
        );

        currentFile = path.basename(manifestDest);
        await copyFileWithProgress(model.manifestPath, manifestDest, updateProgress);

        // Copy blobs
        for (const blob of model.blobs) {
          const blobSrc = getBlobPath(modelLocation, blob);
          const blobDest = getBlobPath(backupLocation, blob);

          if (!fs.existsSync(blobSrc)) {
            throw new Error(`Blob file not found: ${blobSrc}`);
          }
          currentFile = blob;
          await copyFileWithProgress(blobSrc, blobDest, updateProgress);
        }

        modelSpinner.succeed(`${model.name} (${formatBytes(model.totalSize)})`);
      } catch (err) {
        modelSpinner.fail(`Failed to backup ${model.name}: ${err}`);
        failedCount++;
      }
    }

    if (failedCount > 0) {
      spinner.fail(`${failedCount} model(s) failed`);
      process.exit(1);
    } else {
      spinner.succeed(`Backup complete: ${formatBytes(totalBytes)} copied`);
    }
  } catch (err) {
    spinner.fail(`Backup failed: ${err}`);
    process.exit(1);
  }
}
