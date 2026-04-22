export interface ManifestLayer {
  mediaType: string;
  digest: string;
  size: number;
}

export interface Manifest {
  schemaVersion: number;
  config: {
    digest: string;
    size: number;
  };
  layers: ManifestLayer[];
}

export interface ModelInfo {
  name: string;
  manifestPath: string;
  manifest: Manifest;
  blobs: string[];
  totalSize: number;
}

export interface CopyProgress {
  filename: string;
  bytesCopied: number;
  totalBytes: number;
}

export interface TotalProgress {
  bytesCopied: number;
  totalBytes: number;
  currentFile: string;
}
