import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { listModels } from '../lib/ollama.js';
import { setupTestEnv, cleanupTestEnv } from './test-utils.js';

test('listModels should find all models in the fixture', async (t) => {
  const tempDir = await setupTestEnv();
  try {
    const models = await listModels(tempDir);
    // Fixture has llama3:latest, llama3:8b, and mistral:latest
    assert.strictEqual(models.length, 3);
    assert.ok(models.find(m => m.name === 'library/llama3:latest'));
    assert.ok(models.find(m => m.name === 'library/llama3:8b'));
    assert.ok(models.find(m => m.name === 'library/mistral:latest'));
  } finally {
    cleanupTestEnv(tempDir);
  }
});

test('listModels should return empty array when manifests dir is missing', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-empty-'));
  try {
    const models = await listModels(tempDir);
    assert.strictEqual(models.length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('listModels should skip invalid manifest JSON', async (t) => {
  const tempDir = await setupTestEnv();
  try {
    const invalidPath = path.join(tempDir, 'manifests', 'registry.ollama.ai', 'library', 'broken', 'latest');
    fs.mkdirSync(path.dirname(invalidPath), { recursive: true });
    fs.writeFileSync(invalidPath, '{ invalid json }');

    const models = await listModels(tempDir);
    // Should still only have the 3 good ones
    assert.strictEqual(models.length, 3);
    assert.ok(!models.find(m => m.name.includes('broken')));
  } finally {
    cleanupTestEnv(tempDir);
  }
});

test('listModels should support custom namespaces', async (t) => {
  const tempDir = await setupTestEnv();
  try {
    const customPath = path.join(tempDir, 'manifests', 'registry.ollama.ai', 'user123', 'my-model', 'v1');
    fs.mkdirSync(path.dirname(customPath), { recursive: true });
    const mockManifest = {
      config: { digest: 'sha256:c1', size: 10 },
      layers: [{ digest: 'sha256:l1', size: 20 }]
    };
    fs.writeFileSync(customPath, JSON.stringify(mockManifest));

    const models = await listModels(tempDir);
    assert.ok(models.find(m => m.name === 'user123/my-model:v1'));
  } finally {
    cleanupTestEnv(tempDir);
  }
});

test('listModels should skip if tag is a directory instead of a file', async (t) => {
  const tempDir = await setupTestEnv();
  try {
    const dirAsTag = path.join(tempDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', 'wrong-tag');
    fs.mkdirSync(dirAsTag, { recursive: true });

    const models = await listModels(tempDir);
    assert.strictEqual(models.length, 3); // Should not count the directory
  } finally {
    cleanupTestEnv(tempDir);
  }
});
