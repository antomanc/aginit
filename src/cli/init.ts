import path from 'node:path';
import { fileExists, readJsonFile } from '../utils/fs.js';
import { createProject, NewProjectOptions } from './new.js';

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

  return createProject(projectName, {
    ...options,
    targetDir: currentDir
  });
}
