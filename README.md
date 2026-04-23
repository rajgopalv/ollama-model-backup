# Ollama Model Backup

A CLI tool to backup and restore Ollama models between storage locations.

## Use Case

Move models from fast SSD storage to slower/cold storage (like SATA drives) to reclaim SSD space while keeping models backed up.

## Prerequisites

- Node.js 18+
- Ollama installed with models stored locally

## Installation

```bash
npm install
npm link  # Optional: make available globally as 'ollama-model-backup'
```

## Usage

```bash
# Backup models (uses OLLAMA_MODEL_LOCATION and OLLAMA_BACKUP_LOCATION env vars if set)
ollama-model-backup backup --model llama3 --model mistral-3:9b

# Restore models
ollama-model-backup restore --model llama3

# Backup with explicit paths
ollama-model-backup backup --model-location /path/to/models --backup-location /path/to/backup --model llama3

# Backup all models (no --model flag)
ollama-model-backup backup --model-location /path/to/models --backup-location /path/to/backup

# Dry run
ollama-model-backup backup --dry-run
```

## Arguments

- `backup|restore` - Operation mode (required)

## Options

- `--model-location` - Path to Ollama models directory
- `--backup-location` - Path to backup directory
- `--model` - Specific models to backup/restore (default: all). Specify --model multiple times for more than one models.
- `--dry-run` - Show what would be copied without actually copying

## Environment Variables

Set these in your shell profile (`~/.zshrc`, `~/.bashrc`, etc.) for default paths:

```bash
export OLLAMA_MODEL_LOCATION=/path/to/ollama/models
export OLLAMA_BACKUP_LOCATION=/path/to/backup
```

- `OLLAMA_MODEL_LOCATION` - Default model location (default: `~/.ollama/models`)
- `OLLAMA_BACKUP_LOCATION` - Default backup location (required if `--backup-location` not provided)

## Examples

```bash
# Backup specific models
ollama-model-backup backup --model llama3 --model mistral

# Restore specific models
ollama-model-backup restore --model llama3

# With explicit paths (overrides env vars for this run)
ollama-model-backup backup --model-location ~/.ollama/models --backup-location /mnt/storage/backup --model llama3
```
