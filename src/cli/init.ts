import path from 'node:path';
import { readPackageManifest, readProjectConfig } from '../config/validation.js';
import { createProject, NewProjectOptions } from './new.js';
import { detectPackageManager } from '../adapters/package-manager.js';

export async function initCurrentDirectory(options: NewProjectOptions = {}): Promise<boolean> {
  const currentDir = process.cwd();
  let projectName = path.basename(currentDir);

  const saved = readProjectConfig(currentDir);
  const pkg = readPackageManifest(currentDir);
  if (pkg?.name) projectName = pkg.name;
  else if (saved?.name) projectName = saved.name;
  const packageManager =
    options.packageManager ?? saved?.packageManager ?? detectPackageManager(currentDir) ?? 'pnpm';

  return createProject(projectName, {
    ...options,
    packageManager,
    targetDir: currentDir
  });
}
