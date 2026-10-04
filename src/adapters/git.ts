import path from 'node:path';
import { fileExists, readTextFile, safeWriteFile } from '../utils/fs.js';
import { runExecutable } from '../utils/shell.js';
import { logger } from '../utils/logger.js';

const DEFAULT_GITIGNORE = `# Dependencies
node_modules/
.pnpm-store/

# Build artifacts
dist/
build/
.next/
out/

# Environment
.env
.env.*
!.env.example
!.env.*.example
*.local

# Logs & temp
*.log
.DS_Store
*.tsbuildinfo

# Testing & Coverage
coverage/
test-results/
playwright-report/
blob-report/

# Codebase intelligence cache (graft builds locally, git-ignored)
/graft/
`;

export async function setupGit(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): Promise<boolean> {
  const { dryRun = false, silent = false } = options;
  const gitDir = path.join(targetDir, '.git');
  const gitignorePath = path.join(targetDir, '.gitignore');

  if (!fileExists(gitDir)) {
    if (!silent) logger.dim('Initializing git repository...');
    const res = await runExecutable('git', ['init'], { cwd: targetDir, dryRun, silent: true });
    if (!res.ok) {
      logger.warn(`Failed to initialize git repository: ${res.stderr}`);
      return false;
    }
  }

  // Ensure .gitignore exists or append essential rules
  if (!fileExists(gitignorePath)) {
    safeWriteFile(gitignorePath, DEFAULT_GITIGNORE, { dryRun, silent });
  } else {
    const existing = readTextFile(gitignorePath) || '';
    const toAppend: string[] = [];

    const essentialRules = [
      'node_modules/',
      '/graft/',
      '.DS_Store',
      'dist/',
      '.env',
      '.env.*',
      '!.env.example',
      '!.env.*.example'
    ];
    for (const rule of essentialRules) {
      if (!existing.split(/\r?\n/).includes(rule)) {
        toAppend.push(rule);
      }
    }

    if (toAppend.length > 0) {
      const updated =
        existing.trimEnd() + '\n\n# AI & Project rules\n' + toAppend.join('\n') + '\n';
      safeWriteFile(gitignorePath, updated, { overwrite: true, dryRun, silent });
    }
  }

  return true;
}
