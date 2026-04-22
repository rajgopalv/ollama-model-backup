import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_MANIFESTS_DIR, DEFAULT_BLOBS_DIR } from '../constants.js';
import type { Manifest, ModelInfo } from '../types.js';

export async function listModels(modelDir: string): Promise<ModelInfo[]> {
  const manifestsDir = path.join(modelDir, DEFAULT_MANIFESTS_DIR);
  const models: ModelInfo[] = [];

  if (!fs.existsSync(manifestsDir)) {
    return models;
  }

  const hosts = await fs.promises.readdir(manifestsDir);

  for (const host of hosts) {
    const hostPath = path.join(manifestsDir, host);
    const stat = await fs.promises.stat(hostPath);
    if (!stat.isDirectory()) continue;

    const namespaces = await fs.promises.readdir(hostPath);
    for (const namespace of namespaces) {
      const namespacePath = path.join(hostPath, namespace);
      const stat = await fs.promises.stat(namespacePath);
      if (!stat.isDirectory()) continue;

      const modelNames = await fs.promises.readdir(namespacePath);
      for (const modelName of modelNames) {
        const modelPath = path.join(namespacePath, modelName);
        const stat = await fs.promises.stat(modelPath);
        if (!stat.isDirectory()) continue;

        const tags = await fs.promises.readdir(modelPath);
        for (const tag of tags) {
          const manifestPath = path.join(modelPath, tag);
          const stat = await fs.promises.stat(manifestPath);
          if (!stat.isFile()) continue;

          try {
            const content = await fs.promises.readFile(manifestPath, 'utf-8');
            const manifest: Manifest = JSON.parse(content);
            const blobs = resolveBlobs(manifest);

            const totalSize = calculateTotalSize(manifest);

            models.push({
              name: `${namespace}/${modelName}:${tag}`,
              manifestPath,
              manifest,
              blobs,
              totalSize,
            });
          } catch {
            // Skip invalid manifests
          }
        }
      }
    }
  }

  return models;
}

export function resolveBlobs(manifest: Manifest): string[] {
  const blobs = new Set<string>();

  // Config blob
  blobs.add(manifest.config.digest);

  // Layer blobs
  for (const layer of manifest.layers) {
    blobs.add(layer.digest);
  }

  return Array.from(blobs);
}

export function calculateTotalSize(manifest: Manifest): number {
  let total = manifest.config.size;
  for (const layer of manifest.layers) {
    total += layer.size;
  }
  return total;
}

export function getBlobPath(modelDir: string, digest: string): string {
  return path.join(modelDir, DEFAULT_BLOBS_DIR, digest);
}
