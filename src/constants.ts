export const DEFAULT_MODEL_LOCATION = `${process.env.HOME}/.ollama/models`;
export const DEFAULT_MANIFESTS_DIR = 'manifests';
export const DEFAULT_BLOBS_DIR = 'blobs';

export const ENV_VARS = {
  MODEL_LOCATION: 'OLLAMA_MODEL_LOCATION',
  BACKUP_LOCATION: 'OLLAMA_BACKUP_LOCATION',
} as const;
