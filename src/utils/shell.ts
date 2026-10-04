import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pc from 'picocolors';
import { logger } from './logger.js';

const execAsync = promisify(exec);

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  ok: boolean;
}

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  dryRun?: boolean;
  silent?: boolean;
  stdio?: 'inherit' | 'pipe';
}

export async function runCommand(
  cmd: string,
  options: RunOptions = {}
): Promise<ShellResult> {
  const { cwd = process.cwd(), env = process.env, dryRun = false, silent = false } = options;

  if (dryRun) {
    logger.dim(`[dry-run] Would execute: ${cmd} (in ${cwd})`);
    return { stdout: '', stderr: '', exitCode: 0, ok: true };
  }

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd,
      env: { ...process.env, ...env },
      maxBuffer: 10 * 1024 * 1024
    });

    if (!silent && stdout.trim()) {
      // logger.dim(stdout.trim());
    }

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
      ok: true
    };
  } catch (error: any) {
    return {
      stdout: error.stdout ? String(error.stdout).trim() : '',
      stderr: error.stderr ? String(error.stderr).trim() : (error.message || ''),
      exitCode: typeof error.code === 'number' ? error.code : 1,
      ok: false
    };
  }
}

export async function commandExists(binName: string): Promise<boolean> {
  const res = await runCommand(`which ${binName}`, { silent: true });
  return res.ok && res.stdout.length > 0;
}
