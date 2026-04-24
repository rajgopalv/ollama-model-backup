import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { formatBytes, copyDirRecursive } from '../lib/fs.js';

test('formatBytes should format correctly', (t) => {
  assert.strictEqual(formatBytes(0), '0 B');
  assert.strictEqual(formatBytes(1024), '1 KB');
  assert.strictEqual(formatBytes(1048576), '1 MB');
  assert.strictEqual(formatBytes(1073741824), '1 GB');
  assert.strictEqual(formatBytes(1099511627776), '1 TB');
  assert.strictEqual(formatBytes(1536), '1.5 KB');
});

test('copyDirRecursive should copy nested directories', async (t) => {
  const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-test-src-'));
  const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-test-dest-'));

  try {
    // Create nested structure
    const nestedPath = path.join(srcDir, 'a', 'b', 'c');
    fs.mkdirSync(nestedPath, { recursive: true });
    fs.writeFileSync(path.join(nestedPath, 'file.txt'), 'hello');
    fs.writeFileSync(path.join(srcDir, 'root.txt'), 'world');

    await copyDirRecursive(srcDir, destDir);

    assert.ok(fs.existsSync(path.join(destDir, 'a', 'b', 'c', 'file.txt')));
    assert.strictEqual(fs.readFileSync(path.join(destDir, 'a', 'b', 'c', 'file.txt'), 'utf-8'), 'hello');
    assert.ok(fs.existsSync(path.join(destDir, 'root.txt')));
  } finally {
    fs.rmSync(srcDir, { recursive: true, force: true });
    fs.rmSync(destDir, { recursive: true, force: true });
  }
});
