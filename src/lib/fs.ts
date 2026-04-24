import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import type { CopyProgress } from '../types.js';

export async function calculateChecksum(filePath: string, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();

  const hash = crypto.createHash('sha256');
  
  // Custom writable to update hash
  const hashStream = new Writable({
    write(chunk, encoding, callback) {
      hash.update(chunk);
      callback();
    }
  });

  try {
    await pipeline(
      fs.createReadStream(filePath),
      hashStream,
      { signal }
    );
    return `sha256:${hash.digest('hex')}`;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('AbortError');
    }
    throw err;
  }
}

/**
 * Copies a file from src to dest. 
 * Note: Caller is responsible for any temporary file logic or cleanup.
 */
export async function copyFileWithProgress(
  src: string,
  dest: string,
  onProgress?: (progress: CopyProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  signal?.throwIfAborted();

  const stats = await fs.promises.stat(src);
  const totalBytes = stats.size;
  let bytesCopied = 0;

  await fs.promises.mkdir(path.dirname(dest), { recursive: true });

  try {
    // Pipeline manages the stream lifecycle and signal
    await pipeline(
      fs.createReadStream(src),
      // We pass the data through to write stream while tracking progress
      async function* (source) {
        for await (const chunk of source) {
          bytesCopied += chunk.length;
          if (onProgress) {
            onProgress({
              filename: path.basename(src),
              bytesCopied,
              totalBytes,
            });
          }
          yield chunk;
        }
      },
      fs.createWriteStream(dest),
      { signal }
    );
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('AbortError');
    }
    throw err;
  }
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
