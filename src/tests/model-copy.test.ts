import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { copyModel } from '../lib/model-copy.js';
import { listModels } from '../lib/ollama.js';
import { setupTestEnv, cleanupTestEnv } from './test-utils.js';

const mockSpinner = {
  start: () => mockSpinner,
  succeed: () => mockSpinner,
  fail: () => mockSpinner,
  text: '',
  suffixText: ''
};

test('copyModel should copy a real fixture model', async (t) => {
  const srcDir = await setupTestEnv();
  const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-dest-env-'));

  try {
    const models = await listModels(srcDir);
    const llama3 = models.find(m => m.name === 'library/llama3:latest')!;

    await copyModel(llama3, {
      srcBase: srcDir,
      destBase: destDir,
      modelIndex: 1,
      totalModels: 1,
      spinner: mockSpinner as any
    });

    const destManifestPath = path.join(destDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', 'latest');
    assert.ok(fs.existsSync(destManifestPath));
    assert.ok(fs.existsSync(path.join(destDir, 'blobs', 'sha256-llama3-config')));
  } finally {
    cleanupTestEnv(srcDir);
    fs.rmSync(destDir, { recursive: true, force: true });
  }
});

test('copyModel should throw error if blob is missing and checkBlobExists is true', async (t) => {
  const srcDir = await setupTestEnv();
  const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-dest-err-'));

  try {
    const models = await listModels(srcDir);
    const llama3 = models.find(m => m.name === 'library/llama3:latest')!;
    
    // Delete a blob
    fs.unlinkSync(path.join(srcDir, 'blobs', 'sha256-llama3-layer'));

    await assert.rejects(
      copyModel(llama3, {
        srcBase: srcDir,
        destBase: destDir,
        modelIndex: 1,
        totalModels: 1,
        checkBlobExists: true,
        spinner: mockSpinner as any
      }),
      /Blob file not found/
    );
  } finally {
    cleanupTestEnv(srcDir);
    fs.rmSync(destDir, { recursive: true, force: true });
  }
});

test('copyModel should handle permissions error on destination', async (t) => {
  // Only run this test on non-Windows for simpler permission handling
  if (os.platform() === 'win32') return;

  const srcDir = await setupTestEnv();
  const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-dest-perm-'));

  try {
    const models = await listModels(srcDir);
    const llama3 = models.find(m => m.name === 'library/llama3:latest')!;
    
    // Make destDir read-only
    fs.chmodSync(destDir, 0o555);

    await assert.rejects(
      copyModel(llama3, {
        srcBase: srcDir,
        destBase: destDir,
        modelIndex: 1,
        totalModels: 1,
        spinner: mockSpinner as any
      })
    );
  } finally {
    fs.chmodSync(destDir, 0o777); // Restore for cleanup
    cleanupTestEnv(srcDir);
    fs.rmSync(destDir, { recursive: true, force: true });
  }
});
