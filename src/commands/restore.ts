import * as path from 'path';
import * as fs from 'fs';
import ora from 'ora';
import { listModels, getBlobPath } from '../lib/ollama.js';
import { copyFileWithProgress, formatBytes } from '../lib/fs.js';
import { DEFAULT_MANIFESTS_DIR, DEFAULT_BLOBS_DIR, DEFAULT_MODEL_LOCATION, ENV_VARS } from '../constants.js';

export interface RestoreOptions {
  modelLocation?: string;
  backupLocation?: string;
  models?: string[];
  dryRun?: boolean;
}

export async function restore(options: RestoreOptions): Promise<void> {
  const modelLocation = options.modelLocation || process.env[ENV_VARS.MODEL_LOCATION] || DEFAULT_MODEL_LOCATION;
  const backupLocation = options.backupLocation || process.env[ENV_VARS.BACKUP_LOCATION];

  if (!modelLocation) {
    throw new Error(`Model location required. Set --model-location or ${ENV_VARS.MODEL_LOCATION}`);
  }

  if (!backupLocation) {
    throw new Error(`Backup location required. Set --backup-location or ${ENV_VARS.BACKUP_LOCATION}`);
  }

  const spinner = ora('Scanning backup...').start();

  try {
    const allModels = await listModels(backupLocation);

    const modelsToRestore = options.models && options.models.length > 0
      ? allModels.filter(m => options.models!.some(target => m.name.includes(target)))
      : allModels;

    if (modelsToRestore.length === 0) {
      spinner.warn('No models found in backup');
      return;
    }

    spinner.succeed(`Found ${modelsToRestore.length} model(s) in backup`);

    let currentModelIndex = 0;

    for (const model of modelsToRestore) {
      currentModelIndex++;
      const modelSpinner = ora(`[${currentModelIndex}/${modelsToRestore.length}] ${model.name}`).start();

      if (options.dryRun) {
        modelSpinner.info(`Would restore ${model.blobs.length} blobs + manifest (${formatBytes(model.totalSize)})`);
        continue;
      }

      try {
        // Copy manifest
        const manifestDest = path.join(
          modelLocation,
          DEFAULT_MANIFESTS_DIR,
          model.manifestPath.replace(path.join(backupLocation, DEFAULT_MANIFESTS_DIR), '').slice(1)
        );

        await copyFileWithProgress(model.manifestPath, manifestDest);

        // Copy blobs
        for (const blob of model.blobs) {
          const blobSrc = getBlobPath(backupLocation, blob);
          const blobDest = path.join(modelLocation, DEFAULT_BLOBS_DIR, blob);

          if (fs.existsSync(blobSrc)) {
            await copyFileWithProgress(blobSrc, blobDest);
          }
        }

        modelSpinner.succeed(`${model.name}`);
      } catch (err) {
        modelSpinner.fail(`Failed to restore ${model.name}: ${err}`);
      }
    }

    spinner.succeed(`Restore complete`);
  } catch (err) {
    spinner.fail(`Restore failed: ${err}`);
    process.exit(1);
  }
}
