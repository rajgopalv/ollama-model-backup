import * as fs from 'node:fs';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import ora from 'ora';
import { listModels } from '../lib/ollama.js';
import { formatBytes } from '../lib/fs.js';
import { copyModel } from '../lib/model-copy.js';
import { DEFAULT_MODEL_LOCATION, ENV_VARS } from '../constants.js';

const execAsync = promisify(exec);

export interface BackupOptions {
  modelLocation?: string;
  backupLocation?: string;
  models?: string[];
  dryRun?: boolean;
  rmAfterBackup?: boolean;
  ignoreChecksumVerification?: boolean;
  execFn?: (command: string) => Promise<{ stdout: string, stderr: string }>;
}

export async function backup(options: BackupOptions): Promise<void> {
  const executor = options.execFn || execAsync;
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
      ? allModels.filter(m => options.models!.some(target => {
          return m.name === target || 
                 m.name.includes(`/${target}:`) || 
                 m.name.endsWith(`/${target}`) ||
                 m.name === `library/${target}:latest`;
        }))
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
    const successfulModelNames: string[] = [];

    for (const model of modelsToBackup) {
      currentModelIndex++;

      if (options.dryRun) {
        const dryRunSpinner = ora(`[${currentModelIndex}/${modelsToBackup.length}] ${model.name}`).start();
        dryRunSpinner.info(`Would copy ${model.blobs.length} blobs + manifest (${formatBytes(model.totalSize)})`);
        if (options.rmAfterBackup) {
          dryRunSpinner.info(`Would execute: ollama rm ${model.name}`);
        }
        continue;
      }

      try {
        await copyModel(model, {
          srcBase: modelLocation,
          destBase: backupLocation,
          modelIndex: currentModelIndex,
          totalModels: modelsToBackup.length,
          checkBlobExists: true,
          ignoreChecksumVerification: options.ignoreChecksumVerification,
        });

        successfulModelNames.push(model.name);

        if (options.rmAfterBackup) {
          const rmSpinner = ora(`Removing ${model.name} from Ollama...`).start();
          try {
            await executor(`ollama rm ${model.name}`);
            rmSpinner.succeed(`Removed ${model.name} from Ollama`);
          } catch (err) {
            rmSpinner.fail(`Failed to remove ${model.name}: ${err}`);
          }
        }
      } catch (err) {
        failedCount++;
      }
    }

    if (failedCount > 0) {
      spinner.fail(`${failedCount} model(s) failed`);
      process.exit(1);
    } else {
      spinner.succeed(`Backup complete: ${formatBytes(totalBytes)} copied`);
      
      if (!options.rmAfterBackup && !options.dryRun && successfulModelNames.length > 0) {
        console.log('\nTo reclaim space, you can manually remove the backed-up models:\n');
        console.log(`    $ ollama rm ${successfulModelNames.join(' ')}\n`);
      }
    }
  } catch (err) {
    spinner.fail(`Backup failed: ${err}`);
    process.exit(1);
  }
}
