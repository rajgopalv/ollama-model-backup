import { test, mock } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { backup } from '../commands/backup.js';
import { setupTestEnv, cleanupTestEnv } from './test-utils.js';

test('purge logic: should call ollama rm after successful backup', async (t) => {
  const modelDir = await setupTestEnv();
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-purge-test-'));

  const calledCommands: string[] = [];
  const mockExec = async (cmd: string) => {
    calledCommands.push(cmd);
    return { stdout: '', stderr: '' };
  };

  try {
    await backup({
      modelLocation: modelDir,
      backupLocation: backupDir,
      models: ['mistral'], // Only backup mistral
      rmAfterBackup: true,
      execFn: mockExec
    });

    // Check if backup succeeded
    assert.ok(fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'mistral', 'latest')));
    
    // Check if ollama rm was called
    assert.strictEqual(calledCommands.length, 1);
    assert.strictEqual(calledCommands[0], 'ollama rm library/mistral:latest');

  } finally {
    cleanupTestEnv(modelDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test('purge logic: should NOT call ollama rm during dry-run', async (t) => {
  const modelDir = await setupTestEnv();
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-purge-dry-'));

  const calledCommands: string[] = [];
  const mockExec = async (cmd: string) => {
    calledCommands.push(cmd);
    return { stdout: '', stderr: '' };
  };

  try {
    await backup({
      modelLocation: modelDir,
      backupLocation: backupDir,
      rmAfterBackup: true,
      dryRun: true,
      execFn: mockExec
    });

    assert.strictEqual(calledCommands.length, 0, 'No commands should be executed during dry-run');
  } finally {
    cleanupTestEnv(modelDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test('purge logic: should NOT fail the backup if ollama rm fails', async (t) => {
  const modelDir = await setupTestEnv();
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-purge-fail-'));

  const mockExec = async (cmd: string) => {
    throw new Error('Ollama not running');
  };

  try {
    // Should NOT throw
    await backup({
      modelLocation: modelDir,
      backupLocation: backupDir,
      models: ['mistral'],
      rmAfterBackup: true,
      execFn: mockExec
    });

    // Verification: Backup still exists
    assert.ok(fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'mistral', 'latest')));
  } finally {
    cleanupTestEnv(modelDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test('purge logic: should show manual cleanup instruction when rmAfterBackup is false', async (t) => {
  const modelDir = await setupTestEnv();
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-manual-purge-'));

  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (msg: string) => logs.push(msg);

  try {
    await backup({
      modelLocation: modelDir,
      backupLocation: backupDir,
      models: ['mistral'],
      rmAfterBackup: false
    });

    const output = logs.join('\n');
    assert.ok(output.includes('To reclaim space, you can manually remove'), 'Should suggest manual removal');
    assert.ok(output.includes('$ ollama rm library/mistral:latest'), 'Should show correctly formatted command with $');
    assert.match(output, /    \$ ollama rm/, 'Should have leading indentation');

  } finally {
    console.log = originalLog;
    cleanupTestEnv(modelDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});
