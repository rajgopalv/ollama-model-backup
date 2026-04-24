#!/usr/bin/env node

import meow from 'meow';
import { backup } from './commands/backup.js';
import { restore } from './commands/restore.js';
import { list } from './commands/list.js';
import { ENV_VARS } from './constants.js';

const cli = meow(`
Usage
  $ ollama-model-backup <backup|restore|list> [options]

Options
  --model-location               Ollama models directory (default: ~/${ENV_VARS.MODEL_LOCATION})
  --backup-location              Backup destination
  --model                        Specific model to process (default: all)
  --dry-run                      Preview without copying
  --rm-after-backup              Remove model from Ollama after successful backup
  --ignore-checksum-verification Skip SHA-256 verification of blobs

Examples
  $ ollama-model-backup list
  $ ollama-model-backup backup --model llama3 --rm-after-backup
  $ ollama-model-backup restore --backup-location /path/to/backup --model llama3
`,

{
  importMeta: import.meta,
  allowUnknownFlags: false,
  flags: {
    modelLocation: {
      type: 'string',
      short: 'm',
    },
    backupLocation: {
      type: 'string',
      short: 'b',
    },
    model: {
      type: 'string',
      short: 'M',
      isMultiple: true,
    },
    dryRun: {
      type: 'boolean',
      short: 'd',
    },
    rmAfterBackup: {
      type: 'boolean',
    },
    ignoreChecksumVerification: {
      type: 'boolean',
    },
  },
});

async function main() {
  const [mode] = cli.input;

  if (!mode || (mode !== 'backup' && mode !== 'restore' && mode !== 'list')) {
    console.error('Error: Mode must be "backup", "restore" or "list"');
    process.exit(1);
  }

  if (!cli.flags.backupLocation && !process.env[ENV_VARS.BACKUP_LOCATION]) {
    console.error(`Error: --backup-location or ${ENV_VARS.BACKUP_LOCATION} required`);
    process.exit(1);
  }

  const models = cli.flags.model
    ? (Array.isArray(cli.flags.model) ? cli.flags.model : [cli.flags.model])
    : undefined;

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
  } else {
    await restore({
      modelLocation: cli.flags.modelLocation ?? undefined,
      backupLocation: cli.flags.backupLocation ?? undefined,
      models,
      dryRun: cli.flags.dryRun ?? undefined,
      ignoreChecksumVerification: cli.flags.ignoreChecksumVerification ?? undefined,
    });
  }
}

main();
