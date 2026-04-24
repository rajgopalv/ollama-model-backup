import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';
import { listModels } from '../lib/ollama.js';
import { formatBytes } from '../lib/fs.js';
import { copyModel } from '../lib/model-copy.js';
import { DEFAULT_MODEL_LOCATION, ENV_VARS } from '../constants.js';

export interface RestoreOptions {
  modelLocation?: string;
  backupLocation?: string;
  models?: string[];
  dryRun?: boolean;
  ignoreChecksumVerification?: boolean;
}

export async function restore(options: RestoreOptions): Promise<void> {
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

  const spinner = ora('Scanning backup...').start();

  try {
    const allModels = await listModels(backupLocation);

    const modelsToRestore = options.models && options.models.length > 0
      ? allModels.filter(m => options.models!.some(target => {
          return m.name === target || 
                 m.name.includes(`/${target}:`) || 
                 m.name.endsWith(`/${target}`) ||
                 m.name === `library/${target}:latest`;
        }))
      : allModels;

    if (modelsToRestore.length === 0) {
      spinner.warn('No models found in backup');
      return;
    }

    spinner.succeed(`Found ${modelsToRestore.length} model(s) in backup`);

    let currentModelIndex = 0;

    for (const model of modelsToRestore) {
      currentModelIndex++;

      if (options.dryRun) {
        const dryRunSpinner = ora(`[${currentModelIndex}/${modelsToRestore.length}] ${model.name}`).start();
        dryRunSpinner.info(`Would restore ${model.blobs.length} blobs + manifest (${formatBytes(model.totalSize)})`);
        continue;
      }

      try {
        await copyModel(model, {
          srcBase: backupLocation,
          destBase: modelLocation,
          modelIndex: currentModelIndex,
          totalModels: modelsToRestore.length,
          checkBlobExists: false,
          ignoreChecksumVerification: options.ignoreChecksumVerification,
        });
      } catch (err) {
        // Error already logged by copyModel, continue to next model
      }
    }

    spinner.succeed(`Restore complete`);
  } catch (err) {
    spinner.fail(`Restore failed: ${err}`);
    process.exit(1);
  }
}
