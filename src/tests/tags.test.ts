import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { backup } from '../commands/backup.js';
import { setupTestEnv, cleanupTestEnv } from './test-utils.js';

test('tags: providing model name without tag should backup ALL tags for that model', async (t) => {
  const modelDir = await setupTestEnv();
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-tag-all-'));

  try {
    await backup({
      modelLocation: modelDir,
      backupLocation: backupDir,
      models: ['llama3'] // No tag specified
    });

    // Should find both llama3 tags
    assert.ok(fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', 'latest')));
    assert.ok(fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', '8b')));
    // Should NOT find mistral
    assert.ok(!fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'mistral', 'latest')));
  } finally {
    cleanupTestEnv(modelDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test('tags: providing specific tag should ONLY backup that tag', async (t) => {
  const modelDir = await setupTestEnv();
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-tag-specific-'));

  try {
    await backup({
      modelLocation: modelDir,
      backupLocation: backupDir,
      models: ['llama3:8b'] // Specific tag
    });

    // Should find only the 8b tag
    assert.ok(fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', '8b')));
    assert.ok(!fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', 'latest')));
  } finally {
    cleanupTestEnv(modelDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test('tags: providing multiple specific tags', async (t) => {
  const modelDir = await setupTestEnv();
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-tag-multiple-'));

  try {
    await backup({
      modelLocation: modelDir,
      backupLocation: backupDir,
      models: ['llama3:8b', 'mistral:latest']
    });

    assert.ok(fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', '8b')));
    assert.ok(fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'mistral', 'latest')));
    assert.ok(!fs.existsSync(path.join(backupDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', 'latest')));
  } finally {
    cleanupTestEnv(modelDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});
