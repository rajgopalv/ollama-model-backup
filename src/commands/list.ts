import * as fs from 'fs';
import { listModels } from '../lib/ollama.js';
import { formatBytes } from '../lib/fs.js';
import { DEFAULT_MODEL_LOCATION, ENV_VARS } from '../constants.js';
import type { ModelInfo } from '../types.js';

export interface ListOptions {
  modelLocation?: string;
  backupLocation?: string;
}

interface ComparisonRow {
  name: string;
  id: string;
  size: number;
  inOllama: boolean;
  inBackup: boolean;
  mismatch: boolean;
}

export async function list(options: ListOptions): Promise<void> {
  const modelLocation = options.modelLocation || process.env[ENV_VARS.MODEL_LOCATION] || DEFAULT_MODEL_LOCATION;
  const backupLocation = options.backupLocation || process.env[ENV_VARS.BACKUP_LOCATION];

  if (!modelLocation) {
    throw new Error(`Model location required. Set --model-location or ${ENV_VARS.MODEL_LOCATION}`);
  }

  if (!backupLocation) {
    throw new Error(`Backup location required. Set --backup-location or ${ENV_VARS.BACKUP_LOCATION}`);
  }

  const ollamaModels = fs.existsSync(modelLocation) ? await listModels(modelLocation) : [];
  const backupModels = fs.existsSync(backupLocation) ? await listModels(backupLocation) : [];

  const comparison = compareModels(ollamaModels, backupModels);

  printTable(comparison);
}

function compareModels(ollamaModels: ModelInfo[], backupModels: ModelInfo[]): ComparisonRow[] {
  const rows = new Map<string, ComparisonRow>();

  // Process Ollama models
  for (const m of ollamaModels) {
    rows.set(m.name, {
      name: m.name,
      id: m.manifest.config.digest.replace('sha256:', '').slice(0, 12),
      size: m.totalSize,
      inOllama: true,
      inBackup: false,
      mismatch: false,
    });
  }

  // Process Backup models
  for (const m of backupModels) {
    const existing = rows.get(m.name);
    const backupId = m.manifest.config.digest.replace('sha256:', '').slice(0, 12);

    if (existing) {
      existing.inBackup = true;
      if (existing.id !== backupId) {
        existing.mismatch = true;
      }
    } else {
      rows.set(m.name, {
        name: m.name,
        id: backupId,
        size: m.totalSize,
        inOllama: false,
        inBackup: true,
        mismatch: false,
      });
    }
  }

  return Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function printTable(rows: ComparisonRow[]) {
  if (rows.length === 0) {
    console.log('No models found.');
    return;
  }

  const headers = ['NAME', 'ID', 'SIZE', 'OLLAMA', 'BACKUP'];
  const colWidths = [30, 15, 12, 10, 10];

  // Calculate actual widths needed for name
  for (const row of rows) {
    colWidths[0] = Math.max(colWidths[0], row.name.length + 4);
  }

  const headerRow = 
    headers[0].padEnd(colWidths[0]) +
    headers[1].padEnd(colWidths[1]) +
    headers[2].padEnd(colWidths[2]) +
    headers[3].padEnd(colWidths[3]) +
    headers[4].padEnd(colWidths[4]);

  console.log(headerRow);

  for (const row of rows) {
    const ollamaStatus = row.inOllama ? '✓' : '-';
    let backupStatus = '-';
    if (row.inBackup) {
      backupStatus = row.mismatch ? '?' : '✓';
    }

    const line = 
      row.name.padEnd(colWidths[0]) +
      row.id.padEnd(colWidths[1]) +
      formatBytes(row.size).padEnd(colWidths[2]) +
      ollamaStatus.padEnd(colWidths[3]) +
      backupStatus.padEnd(colWidths[4]);
    
    console.log(line);
  }
}
