import * as fs from 'fs';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import type { CopyProgress } from '../types.js';

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
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
