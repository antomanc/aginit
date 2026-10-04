import fs from 'node:fs';
import path from 'node:path';
import { logger } from './logger.js';

export interface WriteFileOptions {
  overwrite?: boolean;
  dryRun?: boolean;
  silent?: boolean;
}

export function ensureDir(dirPath: string, dryRun = false): void {
  if (dryRun) {
    logger.dim(`[dry-run] Would create directory: ${dirPath}`);
    return;
  }
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function safeWriteFile(
  filePath: string,
  content: string,
  options: WriteFileOptions = {}
): boolean {
  const { overwrite = false, dryRun = false, silent = false } = options;

  if (fileExists(filePath) && !overwrite) {
    if (!silent) {
      logger.dim(`Skipping existing file: ${path.basename(filePath)}`);
    }
    return false;
  }

  if (dryRun) {
    logger.dim(`[dry-run] Would write file: ${filePath}`);
    return true;
  }

  ensureDir(path.dirname(filePath), false);
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
}

export function readTextFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

export function readJsonFile<T>(filePath: string): T | null {
  const text = readTextFile(filePath);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function writeJsonFile(
  filePath: string,
  data: unknown,
  options: WriteFileOptions = {}
): boolean {
  const content = JSON.stringify(data, null, 2) + '\n';
  return safeWriteFile(filePath, content, options);
}
