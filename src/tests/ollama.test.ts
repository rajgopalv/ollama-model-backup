import { test } from 'node:test';
import assert from 'node:assert';
import { listModels } from '../lib/ollama.js';
import { setupTestEnv, cleanupTestEnv } from './test-utils.js';

test('listModels should find all models in the fixture', async (t) => {
  const tempDir = await setupTestEnv();
  
  try {
    const models = await listModels(tempDir);

    // Assert
    assert.strictEqual(models.length, 2, 'Should find exactly 2 models');
    
    const llama3 = models.find(m => m.name === 'library/llama3:latest');
    assert.ok(llama3, 'llama3 should exist');
    assert.strictEqual(llama3.totalSize, 110, 'llama3 size should match (10 + 100)');
    
    const mistral = models.find(m => m.name === 'library/mistral:latest');
    assert.ok(mistral, 'mistral should exist');
    assert.strictEqual(mistral.totalSize, 160, 'mistral size should match (10 + 150)');
    
  } finally {
    cleanupTestEnv(tempDir);
  }
});
