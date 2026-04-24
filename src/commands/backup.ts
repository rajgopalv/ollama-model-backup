import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';
import { listModels } from '../lib/ollama.js';
import { formatBytes } from '../lib/fs.js';
import { copyModel } from '../lib/model-copy.js';
import { DEFAULT_MODEL_LOCATION, ENV_VARS } from '../constants.js';

export interface BackupOptions {
  modelLocation?: string;
  backupLocation?: string;
  models?: string[];
  dryRun?: boolean;
}

export async function backup(options: BackupOptions): Promise<void> {
  const usingDefaultModelLocation = !options.modelLocation && !process.env[ENV_VARS.MODEL_LOCATION];
  const modelLocation = options.modelLocation || process.env[ENV_VARS.MODEL_LOCATION] || DEFAULT_MODEL_LOCATION;
  const backupLocation = options.backupLocation || process.env[ENV_VARS.BACKUP_LOCATION];

  if (!modelLocation) {
    throw new Error(`Model location required. Set --model-location or ${ENV_VARS.MODEL_LOCATION}`);
  }

  if (!backupLocation) {
    throw new Error(`Backup location required. Set --backup-location or ${ENV_VARS.BACKUP_LOCATION}`);
  }

  if (usingDefaultModelLocation && !fs.existsSync(modelLocation)) {
    throw new Error(`Default Ollama model directory not found: ${modelLocation}. Set --model-location or ${ENV_VARS.MODEL_LOCATION} to specify a custom location.`);
  }

  if (usingDefaultModelLocation) {
    console.log(`Using default Ollama model directory: ${modelLocation}`);
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

    let currentModelIndex = 0;
    let failedCount = 0;

    for (const model of modelsToBackup) {
      currentModelIndex++;

      if (options.dryRun) {
        const dryRunSpinner = ora(`[${currentModelIndex}/${modelsToBackup.length}] ${model.name}`).start();
        dryRunSpinner.info(`Would copy ${model.blobs.length} blobs + manifest (${formatBytes(model.totalSize)})`);
        continue;
      }

      try {
        await copyModel(model, {
          srcBase: modelLocation,
          destBase: backupLocation,
          modelIndex: currentModelIndex,
          totalModels: modelsToBackup.length,
          checkBlobExists: true,
        });
      } catch {
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
