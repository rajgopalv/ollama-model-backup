import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';
import { getBlobPath } from './ollama.js';
import { copyFileWithProgress, formatBytes } from './fs.js';
import { DEFAULT_MANIFESTS_DIR } from '../constants.js';
import type { ModelInfo } from '../types.js';

export interface CopyModelOptions {
  srcBase: string;
  destBase: string;
  modelIndex: number;
  totalModels: number;
  checkBlobExists?: boolean;
}

export async function copyModel(
  model: ModelInfo,
  options: CopyModelOptions
): Promise<void> {
  let modelBytesCopied = 0;

  const modelSpinner = ora({
    text: `[${options.modelIndex}/${options.totalModels}] ${model.name}`,
    suffixText: () => modelBytesCopied !== 0 ? `${formatBytes(modelBytesCopied)} / ${formatBytes(model.totalSize)}` : ''
  }).start();

  try {
    // Copy manifest
    const manifestDest = path.join(
      options.destBase,
      DEFAULT_MANIFESTS_DIR,
      model.manifestPath
        .replace(path.join(options.srcBase, DEFAULT_MANIFESTS_DIR), '')
        .slice(1)
    );

    await copyFileWithProgress(model.manifestPath, manifestDest, (p) => {
      modelBytesCopied = p.bytesCopied;
    });

    // Copy blobs
    for (const blob of model.blobs) {
      const blobSrc = getBlobPath(options.srcBase, blob);
      const blobDest = getBlobPath(options.destBase, blob);

      if (options.checkBlobExists && !fs.existsSync(blobSrc)) {
        throw new Error(`Blob file not found: ${blobSrc}`);
      }

      if (fs.existsSync(blobSrc)) {
        await copyFileWithProgress(blobSrc, blobDest, (p) => {
          modelBytesCopied = p.bytesCopied;
        });
      }
    }

    modelBytesCopied = 0;
    modelSpinner.succeed(`${model.name} (${formatBytes(model.totalSize)})`);
  } catch (err) {
    modelSpinner.fail(`Failed to copy ${model.name}: ${err}`);
    throw err;
  }
}
