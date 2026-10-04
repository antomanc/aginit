import path from 'node:path';
import { fileExists, readTextFile, safeWriteFile } from '../utils/fs.js';
import { commandExists, runExecutable } from '../utils/shell.js';
import { logger } from '../utils/logger.js';

export async function isGraftInstalled(): Promise<boolean> {
  return await commandExists('graft');
}

export async function initGraft(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): Promise<boolean> {
  const { dryRun = false, silent = false } = options;

  const installed = dryRun || (await isGraftInstalled());
  if (!installed) {
    if (!silent) {
      logger.warn(
        'Graft CLI is not installed. Install it with `npm install -g @nanonets/graft`, then rerun aginit init.'
      );
    }
    return false;
  }

  if (!silent) logger.dim('Initializing Graft context graph...');

  // Run graft init with antigravity and agents, without touching global system files (--no-global)
  const res = await runExecutable(
    'graft',
    ['init', '--no-global', '--agents', 'antigravity', 'agents', '-y'],
    {
      cwd: targetDir,
      dryRun,
      silent: true
    }
  );

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
  const installed = dryRun || (await isGraftInstalled());
  if (!installed) return false;

  const res = await runExecutable('graft', ['build'], { cwd: targetDir, dryRun, silent: true });
  return res.ok;
}

export async function uninstallGraft(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): Promise<boolean> {
  const { dryRun = false } = options;
  const installed = dryRun || (await isGraftInstalled());
  if (installed) {
    await runExecutable('graft', ['uninstall'], { cwd: targetDir, dryRun, silent: true });
  }

  // Also clean up AGENTS.md fenced section if any remain
  const agentsPath = path.join(targetDir, 'AGENTS.md');
  if (fileExists(agentsPath)) {
    const content = readTextFile(agentsPath) || '';
    const cleaned = content
      .replace(/<!-- graft:start -->[\s\S]*?<!-- graft:end -->\n?/g, '')
      .trim();
    safeWriteFile(agentsPath, cleaned + '\n', { overwrite: true, dryRun });
  }

  return true;
}
