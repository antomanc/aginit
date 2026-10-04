import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from './logger.js';

const execFileAsync = promisify(execFile);

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
  timeout?: number;
}

function resolveExecutable(binName: string): { executable: string; isBatch: boolean } {
  if (process.platform !== 'win32') {
    return { executable: binName, isBatch: false };
  }
  const isBatch = (file: string) => /\.(cmd|bat)$/i.test(file);
  if (path.extname(binName)) {
    return { executable: binName, isBatch: isBatch(binName) };
  }
  const pathExts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const ext of pathExts) {
      const candidate = path.join(dir, `${binName}${ext}`);
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return { executable: candidate, isBatch: isBatch(candidate) };
        }
      } catch {
        // continue
      }
    }
  }
  return { executable: binName, isBatch: false };
}

/** Execute a program with literal arguments. No shell expansion or interpolation. */
export async function runExecutable(
  executable: string,
  args: string[] = [],
  options: RunOptions = {}
): Promise<ShellResult> {
  const {
    cwd = process.cwd(),
    env = process.env,
    dryRun = false,
    silent = false,
    timeout = 300_000
  } = options;

  if (dryRun) {
    logger.dim(
      `[dry-run] Would execute: ${[executable, ...args].map((a) => JSON.stringify(a)).join(' ')} (in ${cwd})`
    );
    return { stdout: '', stderr: '', exitCode: 0, ok: true };
  }

  try {
    const { executable: targetExe, isBatch } = resolveExecutable(executable);
    const { stdout, stderr } = await execFileAsync(targetExe, args, {
      cwd,
      env: { ...process.env, ...env },
      maxBuffer: 10 * 1024 * 1024,
      timeout,
      shell: isBatch
    });
    if (!silent && stdout.trim()) logger.dim(stdout.trim());
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0, ok: true };
  } catch (error: any) {
    return {
      stdout: String(error.stdout || '').trim(),
      stderr: String(error.stderr || error.message || '').trim(),
      exitCode: typeof error.code === 'number' ? error.code : 1,
      ok: false
    };
  }
}

export async function commandExists(binName: string): Promise<boolean> {
  if (!/^[a-zA-Z0-9._-]+$/.test(binName)) return false;
  const isWindows = process.platform === 'win32';
  const pathExts = isWindows
    ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];

  return (process.env.PATH || '').split(path.delimiter).some((dir) => {
    if (!dir) return false;
    for (const ext of pathExts) {
      try {
        const file = path.join(
          dir,
          isWindows && !path.extname(binName) ? `${binName}${ext}` : binName
        );
        fs.accessSync(file, isWindows ? fs.constants.F_OK : fs.constants.X_OK);
        if (fs.statSync(file).isFile()) return true;
      } catch {
        // continue
      }
    }
    return false;
  });
}
