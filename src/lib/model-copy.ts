import * as fs from 'node:fs';
import * as path from 'node:path';
import ora from 'ora';
import { getBlobPath } from './ollama.js';
import { copyFileWithProgress, formatBytes, calculateChecksum } from './fs.js';
import { DEFAULT_MANIFESTS_DIR } from '../constants.js';
import type { ModelInfo } from '../types.js';

export interface CopyModelOptions {
  srcBase: string;
  destBase: string;
  modelIndex: number;
  totalModels: number;
  checkBlobExists?: boolean;
  ignoreChecksumVerification?: boolean;
  spinner?: {
    start: () => any;
    succeed: (text?: string) => any;
    fail: (text?: string) => any;
    info: (text?: string) => any;
    text: string;
    suffixText: string | (() => string);
  };
}

export async function copyModel(
  model: ModelInfo,
  options: CopyModelOptions
): Promise<void> {
  let modelBytesCopied = 0;

  const modelSpinner = options.spinner || ora({
    text: `[${options.modelIndex}/${options.totalModels}] ${model.name}`,
    suffixText: () => modelBytesCopied !== 0 ? `${formatBytes(modelBytesCopied)} / ${formatBytes(model.totalSize)}` : ''
  });
  
  const baseText = `[${options.modelIndex}/${options.totalModels}] ${model.name}`;
  modelSpinner.start();

  try {
    // 1. Copy Manifest (Atomic)
    modelSpinner.text = `${baseText} (Copying manifest...)`;
    const manifestDest = path.join(
      options.destBase,
      DEFAULT_MANIFESTS_DIR,
      model.manifestPath
        .replace(path.join(options.srcBase, DEFAULT_MANIFESTS_DIR), '')
        .slice(1)
    );
    const tempManifest = `${manifestDest}.tmp`;
    await copyFileWithProgress(model.manifestPath, tempManifest);
    await fs.promises.rename(tempManifest, manifestDest);

    // 2. Copy Blobs (Atomic + Verification Step)
    for (const blob of model.blobs) {
      const blobSrc = getBlobPath(options.srcBase, blob);
      const blobDest = getBlobPath(options.destBase, blob);
      const shortHash = blob.slice(0, 12);

      if (options.checkBlobExists && !fs.existsSync(blobSrc)) {
        throw new Error(`Blob file not found: ${blobSrc}`);
      }

      if (fs.existsSync(blobSrc)) {
        // A. Deduplication logic
        if (fs.existsSync(blobDest)) {
          const srcStat = fs.statSync(blobSrc);
          const destStat = fs.statSync(blobDest);
          
          if (srcStat.size === destStat.size) {
            if (options.ignoreChecksumVerification) {
              modelBytesCopied += srcStat.size;
              continue;
            } else {
              modelSpinner.text = `${baseText} (Verifying existing blob ${shortHash}...)`;
              const destHash = await calculateChecksum(blobDest);
              if (destHash === blob) {
                modelBytesCopied += srcStat.size;
                continue;
              }
              // If hash mismatch, we'll proceed to re-copy
              modelSpinner.info(`${baseText} (Existing blob ${shortHash} corrupted, re-copying...)`);
              modelSpinner.start();
            }
          }
        }

        // B. Perform the copy to a .tmp file
        const tempBlobDest = `${blobDest}.tmp`;
        modelSpinner.text = `${baseText} (Copying ${shortHash}...)`;
        await copyFileWithProgress(blobSrc, tempBlobDest, (p) => {
          modelBytesCopied = p.bytesCopied;
        });

        // C. Verification step
        if (!options.ignoreChecksumVerification) {
          modelSpinner.text = `${baseText} (Verifying integrity of ${shortHash}...)`;
          const destHash = await calculateChecksum(tempBlobDest);
          if (destHash !== blob) {
            if (fs.existsSync(tempBlobDest)) fs.unlinkSync(tempBlobDest);
            throw new Error(`Checksum verification failed for ${blob}. Expected ${blob}, got ${destHash}`);
          }
        }

        // D. Finalize (Rename)
        await fs.promises.rename(tempBlobDest, blobDest);
      }
    }

    modelBytesCopied = 0;
    modelSpinner.text = baseText;
    modelSpinner.succeed(`${model.name} (${formatBytes(model.totalSize)})`);
  } catch (err) {
    modelSpinner.fail(`Failed to copy ${model.name}: ${err}`);
    throw err;
  }
}
