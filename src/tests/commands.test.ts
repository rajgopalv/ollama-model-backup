import { test, mock } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { backup } from '../commands/backup.js';
import { restore } from '../commands/restore.js';
import { setupTestEnv, cleanupTestEnv } from './test-utils.js';

// Mock process.exit to prevent tests from stopping
const originalExit = process.exit;
const mockExit = (code?: number | string | null | undefined): never => {
  throw new Error(`process.exit called with code ${code}`);
};

test('backup command: successful backup of all models', async (t) => {
  const modelDir = await setupTestEnv();
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-backup-dest-'));

  try {
    await backup({
      modelLocation: modelDir,
      backupLocation: backupDir,
    });

    // Check if both models exist in backup
    assert.ok(fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', 'latest')));
    assert.ok(fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'mistral', 'latest')));
  } finally {
    cleanupTestEnv(modelDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test('backup command: targeted backup using --model', async (t) => {
  const modelDir = await setupTestEnv();
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-backup-target-'));

  try {
    await backup({
      modelLocation: modelDir,
      backupLocation: backupDir,
      models: ['llama3']
    });

    assert.ok(fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', 'latest')));
    assert.ok(!fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'mistral', 'latest')));
  } finally {
    cleanupTestEnv(modelDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test('backup command: dry-run should not copy files', async (t) => {
  const modelDir = await setupTestEnv();
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-backup-dry-'));

  try {
    await backup({
      modelLocation: modelDir,
      backupLocation: backupDir,
      dryRun: true
    });

    const items = fs.readdirSync(backupDir);
    assert.strictEqual(items.length, 0, 'Backup directory should remain empty during dry-run');
  } finally {
    cleanupTestEnv(modelDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test('restore command: successful restore', async (t) => {
  const backupDir = await setupTestEnv();
  const modelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-restore-dest-'));

  try {
    await restore({
      modelLocation: modelDir,
      backupLocation: backupDir,
    });

    assert.ok(fs.existsSync(path.join(modelDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', 'latest')));
  } finally {
    cleanupTestEnv(backupDir);
    fs.rmSync(modelDir, { recursive: true, force: true });
  }
});

test('command logic: missing locations should throw error', async (t) => {
  await assert.rejects(
    backup({ modelLocation: 'non-existent' }),
    /Backup location required/
  );
});
