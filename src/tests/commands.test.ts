import { test, mock } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { backup } from '../commands/backup.js';
import { restore } from '../commands/restore.js';
import { list } from '../commands/list.js';
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

test('list command: displays correct statuses', async (t) => {
  const modelDir = await setupTestEnv(); // llama3, mistral
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-list-test-'));

  try {
    // 1. mistral will be synced
    // 2. llama3 will be mismatch
    // 3. gemma will be backup only
    
    // Copy all to backup first
    await backup({ modelLocation: modelDir, backupLocation: backupDir });
    
    // Create mismatch for llama3
    const llama3BackupManifest = path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', 'latest');
    const manifest = JSON.parse(fs.readFileSync(llama3BackupManifest, 'utf-8'));
    manifest.config.digest = 'sha256:different-id';
    fs.writeFileSync(llama3BackupManifest, JSON.stringify(manifest));

    // Create "Backup Only" model
    const gemmaPath = path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'gemma', 'latest');
    fs.mkdirSync(path.dirname(gemmaPath), { recursive: true });
    fs.writeFileSync(gemmaPath, JSON.stringify(manifest));

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await list({ modelLocation: modelDir, backupLocation: backupDir });
      
      const output = logs.join('\n');
      
      // mistral: ✓ ✓
      assert.match(output, /library\/mistral:latest.*✓.*✓/);
      // llama3: ✓ ?
      assert.match(output, /library\/llama3:latest.*✓.*\?/);
      // gemma: - ✓
      assert.match(output, /library\/gemma:latest.*-.*✓/);

    } finally {
      console.log = originalLog;
    }

  } finally {
    cleanupTestEnv(modelDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test('command logic: missing locations should throw error', async (t) => {
  await assert.rejects(
    backup({ modelLocation: 'non-existent' }),
    /Backup location required/
  );
});
