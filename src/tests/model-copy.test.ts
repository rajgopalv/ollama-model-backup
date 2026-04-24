import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { copyModel } from '../lib/model-copy.js';
import { listModels } from '../lib/ollama.js';
import { setupTestEnv, cleanupTestEnv } from './test-utils.js';

test('copyModel should copy a real fixture model', async (t) => {
  const srcDir = await setupTestEnv();
  const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-dest-env-'));

  const mockSpinner = {
    start: () => mockSpinner,
    succeed: () => mockSpinner,
    fail: () => mockSpinner,
    info: () => mockSpinner,
    text: '',
    suffixText: ''
  };

  try {
    const models = await listModels(srcDir);
    const llama3 = models.find(m => m.name === 'library/llama3:latest')!;
    assert.ok(llama3);

    // Act
    await copyModel(llama3, {
      srcBase: srcDir,
      destBase: destDir,
      modelIndex: 1,
      totalModels: 1,
      spinner: mockSpinner as any
    });

    // Assert
    const destManifestPath = path.join(destDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', 'latest');
    assert.ok(fs.existsSync(destManifestPath), 'Manifest should be copied');
    
    assert.ok(fs.existsSync(path.join(destDir, 'blobs', 'sha256-b84646922b69157e621035fe6f0be3a21b1289ac4f81a9c66c6b33e26be78d8b')), 'Config blob should be copied');
    assert.ok(fs.existsSync(path.join(destDir, 'blobs', 'sha256-c26114669fabd7147fb9e2d9af4e68fa3600449e6ce0fe906d4def139c6a3847')), 'Layer blob should be copied');

  } finally {
    cleanupTestEnv(srcDir);
    if (destDir) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
  }
});

test('copyModel should throw error if blob is missing and checkBlobExists is true', async (t) => {
  const srcDir = await setupTestEnv();
  const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-dest-err-'));

  try {
    const models = await listModels(srcDir);
    const llama3 = models.find(m => m.name === 'library/llama3:latest')!;
    
    // Delete a real blob from fixture
    const blobToDelete = path.join(srcDir, 'blobs', 'sha256-c26114669fabd7147fb9e2d9af4e68fa3600449e6ce0fe906d4def139c6a3847');
    fs.unlinkSync(blobToDelete);

    await assert.rejects(
      copyModel(llama3, {
        srcBase: srcDir,
        destBase: destDir,
        modelIndex: 1,
        totalModels: 1,
        checkBlobExists: true,
        spinner: { start: () => {}, succeed: () => {}, fail: () => {}, text: '', suffixText: '' } as any
      }),
      /Blob file not found/
    );
  } finally {
    cleanupTestEnv(srcDir);
    fs.rmSync(destDir, { recursive: true, force: true });
  }
});

test('copyModel should handle permissions error on destination', async (t) => {
  if (os.platform() === 'win32') return;

  const srcDir = await setupTestEnv();
  const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-dest-perm-'));

  try {
    const models = await listModels(srcDir);
    const llama3 = models.find(m => m.name === 'library/llama3:latest')!;
    
    fs.chmodSync(destDir, 0o555);

    await assert.rejects(
      copyModel(llama3, {
        srcBase: srcDir,
        destBase: destDir,
        modelIndex: 1,
        totalModels: 1,
        spinner: { start: () => {}, succeed: () => {}, fail: () => {}, text: '', suffixText: '' } as any
      })
    );
  } finally {
    fs.chmodSync(destDir, 0o777);
    cleanupTestEnv(srcDir);
    fs.rmSync(destDir, { recursive: true, force: true });
  }
});
