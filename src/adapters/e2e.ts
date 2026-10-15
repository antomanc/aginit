import path from 'node:path';
import { fileExists } from '../utils/fs.js';
import { runExecutable } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import { e2eDirFor, Platform, Stack } from '../registry/index.js';

const E2E_CONFIGS = ['e2e.config.ts', 'e2e.config.mts', 'e2e.config.js', 'e2e.config.mjs'];

export function e2eConfigured(targetDir: string, stack: Stack): boolean {
  const dir = path.join(targetDir, e2eDirFor(stack));
  return E2E_CONFIGS.some((name) => fileExists(path.join(dir, name)));
}

/**
 * Scaffold tester-army/e2e with its own `e2e init`: at the project root for
 * Node projects, in an isolated `.agents/e2e/` workspace otherwise so the root
 * never gets a package.json. The e2e skill comes from the Skills CLI, so init
 * installs no skill or MCP entry; dependencies are installed by the user.
 */
export async function setupE2e(
  targetDir: string,
  options: { stack: Stack; platform: Platform; dryRun?: boolean; silent?: boolean }
): Promise<boolean> {
  const { stack, platform, dryRun = false, silent = false } = options;
  if (e2eConfigured(targetDir, stack)) {
    if (!silent) logger.dim('e2e is already configured, preserving it.');
    return true;
  }
  const dir = e2eDirFor(stack);
  const engine = platform === 'mobile-native' || platform === 'mobile-rn' ? 'mobile' : 'web';
  const args = [
    '-y',
    'e2e@latest',
    'init',
    ...(dir ? [dir] : []),
    '--yes',
    '--engine',
    engine,
    '--skills',
    'none',
    '--mcp',
    'none',
    '--no-install'
  ];
  if (!silent) logger.dim(`Scaffolding e2e (${engine} engine) in ${dir || 'the project root'}...`);
  const res = await runExecutable('npx', args, {
    cwd: targetDir,
    dryRun,
    silent: true,
    timeout: 600_000
  });
  if (!res.ok) {
    logger.warn(`e2e init failed: ${res.stderr || res.stdout}`);
    logger.dim(`  Retry manually: npx e2e init ${dir} --engine ${engine}`.replace(/\s+/g, ' '));
    return false;
  }
  return true;
}
