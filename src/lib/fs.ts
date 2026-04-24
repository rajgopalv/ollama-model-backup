import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import type { CopyProgress } from '../types.js';

export async function calculateChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(`sha256:${hash.digest('hex')}`));
    stream.on('error', reject);
  });
}

/**
 * Copies a file from src to dest. 
 * Note: Caller is responsible for any temporary file logic or cleanup.
 */
export async function copyFileWithProgress(
  src: string,
  dest: string,
  onProgress?: (progress: CopyProgress) => void
): Promise<void> {
  const stats = await fs.promises.stat(src);
  const totalBytes = stats.size;
  let bytesCopied = 0;

  await fs.promises.mkdir(path.dirname(dest), { recursive: true });

  return new Promise((resolve, reject) => {
    const readStream = createReadStream(src);
    const writeStream = createWriteStream(dest);

    readStream.on('data', (chunk: Buffer) => {
      bytesCopied += chunk.length;
      if (onProgress) {
        onProgress({
          filename: path.basename(src),
          bytesCopied,
          totalBytes,
        });
      }
    });

    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);

    readStream.pipe(writeStream);
  });
}

export async function copyDirRecursive(
  src: string,
  dest: string,
  onFileProgress?: (progress: CopyProgress) => void
): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath, onFileProgress);
    } else {
      await copyFileWithProgress(srcPath, destPath, onFileProgress);
    }
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`.trim();
}
