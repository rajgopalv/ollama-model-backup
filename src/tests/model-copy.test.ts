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
    // Path: manifests/registry.ollama.ai/library/llama3/latest
    const destManifestPath = path.join(destDir, 'manifests', 'registry.ollama.ai', 'library', 'llama3', 'latest');
    assert.ok(fs.existsSync(destManifestPath), 'Manifest should be copied');
    
    assert.ok(fs.existsSync(path.join(destDir, 'blobs', 'sha256-llama3-config')), 'Config blob should be copied');
    assert.ok(fs.existsSync(path.join(destDir, 'blobs', 'sha256-llama3-layer')), 'Layer blob should be copied');

  } finally {
    cleanupTestEnv(srcDir);
    if (destDir) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
  }
});
