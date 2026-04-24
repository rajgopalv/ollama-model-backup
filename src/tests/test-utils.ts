import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { copyDirRecursive } from '../lib/fs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'sample-models');

export async function setupTestEnv() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-test-env-'));
  await copyDirRecursive(FIXTURES_DIR, tempDir);
  return tempDir;
}

export function cleanupTestEnv(dir: string) {
  if (dir && dir.includes('ollama-test-env-')) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
