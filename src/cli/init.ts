import path from 'node:path';
import { readPackageManifest, readProjectConfig } from '../config/validation.js';
import { createProject, NewProjectOptions } from './new.js';
import { detectPackageManager } from '../adapters/package-manager.js';

function sanitizeProjectName(rawName: string): string {
  const sanitized = rawName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[^a-z0-9]+/, '');
  return sanitized || 'ai-project';
}

export async function initCurrentDirectory(options: NewProjectOptions = {}): Promise<boolean> {
  const currentDir = process.cwd();
  let projectName = path.basename(currentDir);

  const saved = readProjectConfig(currentDir);
  const pkg = readPackageManifest(currentDir);
  if (pkg?.name) projectName = pkg.name;
  else if (saved?.name) projectName = saved.name;
  else projectName = sanitizeProjectName(projectName);

  const packageManager =
    options.packageManager ?? saved?.packageManager ?? detectPackageManager(currentDir) ?? 'pnpm';

  return createProject(projectName, {
    ...options,
    packageManager,
    targetDir: currentDir
  });
}
