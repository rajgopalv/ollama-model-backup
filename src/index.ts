#!/usr/bin/env node

import meow from 'meow';
import { backup } from './commands/backup.js';
import { restore } from './commands/restore.js';
import { list } from './commands/list.js';
import { ENV_VARS } from './constants.js';
import { DEFAULT_MODEL_LOCATION } from './constants.js';

const cli = meow(`
  Usage
    $ ollama-model-backup <backup|restore|list> [options]

  Commands
    backup             Copy models from Ollama to backup location
    restore            Copy models from backup location back to Ollama
    list               Show sync status of models in both locations

  Options
    --model-location               Ollama models directory (default: ${DEFAULT_MODEL_LOCATION})
    --backup-location              Backup destination directory
    --model, -M                    Specific model to process (can be specified multiple times)
    --dry-run, -d                  Preview actions without modifying any files
    --rm-after-backup              Remove model from Ollama after a successful backup
    --ignore-checksum-verification Skip SHA-256 integrity checks (faster, less secure)
    --help                         Show this help message

  Environment Variables
    OLLAMA_MODEL_LOCATION          Path for Ollama models (or override with --model-location)
    OLLAMA_BACKUP_LOCATION         Path for backup destination (or override with --backup-location)

  Examples
    $ ollama-model-backup list
    $ ollama-model-backup backup --model llama3 --rm-after-backup
    $ ollama-model-backup restore --backup-location /path/to/backup --model gemma:2b

  Bugs & Feedback
    Please report any issues at:
    https://github.com/rajgopalv/ollama-model-backup/issues
`, {
  importMeta: import.meta,
  allowUnknownFlags: false,
  flags: {
    modelLocation: { type: 'string', short: 'm' },
    backupLocation: { type: 'string', short: 'b' },
    model: { type: 'string', short: 'M', isMultiple: true },
    dryRun: { type: 'boolean', short: 'd' },
    rmAfterBackup: { type: 'boolean' },
    ignoreChecksumVerification: { type: 'boolean' },
  },
});

async function main() {
  const [mode] = cli.input;

  // Show help if no mode is provided or mode is invalid
  if (!mode || !['backup', 'restore', 'list'].includes(mode)) {
    if (mode) console.error(`Error: Invalid command "${mode}"\n`);
    cli.showHelp();
    return;
  }

  // Common requirement for all modes: backup location
  if (!cli.flags.backupLocation && !process.env[ENV_VARS.BACKUP_LOCATION]) {
    console.error(`Error: --backup-location or ${ENV_VARS.BACKUP_LOCATION} env var is required\n`);
    cli.showHelp();
    return;
  }

  const models = cli.flags.model
    ? (Array.isArray(cli.flags.model) ? cli.flags.model : [cli.flags.model])
    : undefined;

  try {
    if (mode === 'list') {
      await list({
        modelLocation: cli.flags.modelLocation ?? undefined,
        backupLocation: cli.flags.backupLocation ?? undefined,
      });
    } else if (mode === 'backup') {
      await backup({
        modelLocation: cli.flags.modelLocation ?? undefined,
        backupLocation: cli.flags.backupLocation ?? undefined,
        models,
        dryRun: cli.flags.dryRun ?? undefined,
        rmAfterBackup: cli.flags.rmAfterBackup ?? undefined,
        ignoreChecksumVerification: cli.flags.ignoreChecksumVerification ?? undefined,
      });
    } else if (mode === 'restore') {
      await restore({
        modelLocation: cli.flags.modelLocation ?? undefined,
        backupLocation: cli.flags.backupLocation ?? undefined,
        models,
        dryRun: cli.flags.dryRun ?? undefined,
        ignoreChecksumVerification: cli.flags.ignoreChecksumVerification ?? undefined,
      });
    }
  } catch (err) {
    console.error(`\nUnexpected error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
