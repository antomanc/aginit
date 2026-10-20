import fs from 'node:fs';
import path from 'node:path';
import { fileExists, readTextFile, safeWriteFile } from '../utils/fs.js';
import { commandExists, runExecutable } from '../utils/shell.js';
import { logger } from '../utils/logger.js';

// The ripgrep hint graft wrote at the repo root; trail keeps its graph in .trail/cache.
const GRAFT_RIPGREP_HINT =
  "# graft's cards are gitignored but should stay greppable: ripgrep reads\n" +
  '# .ignore before .gitignore, so this re-admits the tree to search only.\n' +
  '!graft/\ngraft/.cache/\ngraft/.graph/\n';

export async function isTrailInstalled(): Promise<boolean> {
  return await commandExists('trail');
}

export async function initTrail(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean; claude?: boolean } = {}
): Promise<boolean> {
  const { dryRun = false, silent = false, claude = true } = options;

  const installed = dryRun || (await isTrailInstalled());
  if (!installed) {
    if (!silent) {
      logger.warn(
        'Trail CLI is not installed. Install it with `npm install -g @trailhq/trail-code`, then rerun aginit init.'
      );
    }
    return false;
  }

  if (!silent) logger.dim('Initializing Trail context graph...');

  // Wire Antigravity, AGENTS.md readers and (optionally) Claude Code's in-repo
  // .claude/ + .trail/, without touching global system files (--no-global).
  // trail init also migrates a repo graft wired before.
  const agents = ['antigravity', 'agents', ...(claude ? ['claude'] : [])];
  const res = await runExecutable(
    'trail',
    ['init', '--no-global', '--agents', ...agents, '-y'],
    {
      cwd: targetDir,
      dryRun,
      silent: true
    }
  );

  if (!res.ok) {
    logger.warn(`Trail initialization warning: ${res.stderr || res.stdout}`);
    return false;
  }

  // trail init leaves graft's ripgrep hint behind; drop it when unedited.
  const hint = path.join(targetDir, '.ignore');
  if (!dryRun && readTextFile(hint) === GRAFT_RIPGREP_HINT) fs.rmSync(hint);

  return true;
}

export async function buildTrail(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): Promise<boolean> {
  const { dryRun = false } = options;
  const installed = dryRun || (await isTrailInstalled());
  if (!installed) return false;

  const res = await runExecutable('trail', ['build'], { cwd: targetDir, dryRun, silent: true });
  return res.ok;
}

export async function uninstallTrail(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): Promise<boolean> {
  const { dryRun = false } = options;
  const installed = dryRun || (await isTrailInstalled());
  if (installed) {
    await runExecutable('trail', ['uninstall'], { cwd: targetDir, dryRun, silent: true });
  }

  // Also clean up AGENTS.md fenced section if any remain (graft's included)
  const agentsPath = path.join(targetDir, 'AGENTS.md');
  if (fileExists(agentsPath)) {
    const content = readTextFile(agentsPath) || '';
    const cleaned = content
      .replace(/<!-- (trail|graft):start -->[\s\S]*?<!-- \1:end -->\n?/g, '')
      .trim();
    safeWriteFile(agentsPath, cleaned + '\n', { overwrite: true, dryRun });
  }

  return true;
}
