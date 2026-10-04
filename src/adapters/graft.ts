import path from 'node:path';
import { fileExists, readTextFile, safeWriteFile } from '../utils/fs.js';
import { commandExists, runCommand } from '../utils/shell.js';
import { logger } from '../utils/logger.js';

export async function isGraftInstalled(): Promise<boolean> {
  return await commandExists('graft');
}

export async function initGraft(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): Promise<boolean> {
  const { dryRun = false, silent = false } = options;

  const installed = await isGraftInstalled();
  if (!installed) {
    if (!silent) {
      logger.warn(
        'Graft CLI is not installed globally. To install: `npm install -g graft` or check https://github.com/...'
      );
    }
    return false;
  }

  if (!silent) logger.dim('Initializing Graft context graph...');

  // Run graft init with antigravity and agents, without touching global system files (--no-global)
  const res = await runCommand('graft init --no-global --agents antigravity agents -y', {
    cwd: targetDir,
    dryRun,
    silent: true
  });

  if (!res.ok) {
    logger.warn(`Graft initialization warning: ${res.stderr || res.stdout}`);
    return false;
  }

  return true;
}

export async function buildGraft(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): Promise<boolean> {
  const { dryRun = false } = options;
  const installed = await isGraftInstalled();
  if (!installed) return false;

  const res = await runCommand('graft build', { cwd: targetDir, dryRun, silent: true });
  return res.ok;
}

export async function uninstallGraft(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): Promise<boolean> {
  const { dryRun = false } = options;
  const installed = await isGraftInstalled();
  if (installed) {
    await runCommand('graft uninstall', { cwd: targetDir, dryRun, silent: true });
  }

  // Also clean up AGENTS.md fenced section if any remain
  const agentsPath = path.join(targetDir, 'AGENTS.md');
  if (fileExists(agentsPath)) {
    const content = readTextFile(agentsPath) || '';
    const cleaned = content.replace(/<!-- graft:start -->[\s\S]*?<!-- graft:end -->\n?/g, '').trim();
    safeWriteFile(agentsPath, cleaned + '\n', { overwrite: true, dryRun });
  }

  return true;
}
