import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { backup } from '../commands/backup.js';
import { setupTestEnv, cleanupTestEnv } from './test-utils.js';
import { copyFileWithProgress, calculateChecksum } from '../lib/fs.js';

const LLAMA3_CONFIG_HASH = 'sha256-b84646922b69157e621035fe6f0be3a21b1289ac4f81a9c66c6b33e26be78d8b';

test('integrity: blob deduplication skips existing blobs with same SHA', async (t) => {
  const modelDir = await setupTestEnv();
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-dedup-sha-'));

  try {
    await backup({ modelLocation: modelDir, backupLocation: backupDir });
    
    const blobPath = path.join(backupDir, 'blobs', LLAMA3_CONFIG_HASH);
    const firstStat = fs.statSync(blobPath);
    
    await new Promise(resolve => setTimeout(resolve, 100));

    await backup({ modelLocation: modelDir, backupLocation: backupDir });
    
    const secondStat = fs.statSync(blobPath);
    assert.strictEqual(firstStat.mtimeMs, secondStat.mtimeMs, 'Blob should not have been rewritten when SHA matches');
  } finally {
    cleanupTestEnv(modelDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test('integrity: should re-copy if SHA differs even if size matches', async (t) => {
  const modelDir = await setupTestEnv();
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-sha-mismatch-'));

  try {
    await backup({ modelLocation: modelDir, backupLocation: backupDir });
    
    const blobPath = path.join(backupDir, 'blobs', LLAMA3_CONFIG_HASH);
    
    // Original content is 21 bytes
    const originalContent = 'llama3 config content';
    assert.strictEqual(fs.readFileSync(blobPath, 'utf-8'), originalContent);

    // Corrupt the blob but keep same size (21 bytes)
    const corruptedContent = 'corrupted data 123456'; 
    fs.writeFileSync(blobPath, corruptedContent); 
    
    const firstStat = fs.statSync(blobPath);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second backup - should re-copy because SHA differs (even if size is same)
    await backup({ modelLocation: modelDir, backupLocation: backupDir });
    
    const secondStat = fs.statSync(blobPath);
    assert.notStrictEqual(firstStat.mtimeMs, secondStat.mtimeMs, 'Blob SHOULD have been rewritten when SHA differs');
    
    const restoredContent = fs.readFileSync(blobPath, 'utf-8');
    assert.strictEqual(restoredContent, originalContent, 'Content should be restored from source');
  } finally {
    cleanupTestEnv(modelDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test('integrity: atomic writes should not leave partial files on failure', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-atomic-test-'));
  const srcFile = path.join(tempDir, 'src.txt');
  const destFile = path.join(tempDir, 'dest.txt');
  
  fs.writeFileSync(srcFile, 'some data');

  await copyFileWithProgress(srcFile, destFile);
  assert.ok(fs.existsSync(destFile));
  
  fs.rmSync(tempDir, { recursive: true, force: true });
});
