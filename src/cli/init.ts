import path from 'node:path';
import { fileExists, readJsonFile } from '../utils/fs.js';
import { createProject, NewProjectOptions } from './new.js';
import { detectPackageManager } from '../adapters/package-manager.js';

export async function initCurrentDirectory(
  options: NewProjectOptions = {}
): Promise<boolean> {
  const currentDir = process.cwd();
  let projectName = path.basename(currentDir);

  const pkgPath = path.join(currentDir, 'package.json');
  if (fileExists(pkgPath)) {
    const pkg = readJsonFile<{ name?: string }>(pkgPath);
    if (pkg && pkg.name) {
      projectName = pkg.name;
    }
  }

  // Auto-detect and preserve existing package manager if not explicitly passed
  const detectedPm = detectPackageManager(currentDir);
  const packageManager = options.packageManager || detectedPm || 'pnpm';

  return createProject(projectName, {
    ...options,
    packageManager,
    targetDir: currentDir
  });
}
