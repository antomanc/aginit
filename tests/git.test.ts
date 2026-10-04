import { describe, it, expect, vi } from 'vitest';
import { setupGit } from '../src/adapters/git.js';
import * as shell from '../src/utils/shell.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Git Adapter', () => {
  it('creates git repo and sets up .gitignore', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
    try {
      const ok = await setupGit(tempDir, { silent: true });
      expect(ok).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.git'))).toBe(true);

      const gitignore = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(gitignore).toContain('node_modules/');
      expect(gitignore).toContain('/graft/');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('preserves existing rules in .gitignore and appends missing rules', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-existing-'));
    try {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), '# Custom ignore rule\n*.custom\n');

      const ok = await setupGit(tempDir, { silent: true });
      expect(ok).toBe(true);

      const gitignore = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(gitignore).toContain('# Custom ignore rule');
      expect(gitignore).toContain('*.custom');
      expect(gitignore).toContain('/graft/');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('still generates .gitignore even if git init fails', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-fail-'));
    const spy = vi.spyOn(shell, 'runExecutable').mockImplementation(async (_cmd, args) => {
      if (args[0] === 'init') {
        return { ok: false, exitCode: 1, stdout: '', stderr: 'git init failed' };
      }
      return { ok: false, exitCode: 1, stdout: '', stderr: '' };
    });
    try {
      const ok = await setupGit(tempDir, { silent: true });
      expect(ok).toBe(false);
      expect(fs.existsSync(path.join(tempDir, '.gitignore'))).toBe(true);
      const gitignore = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(gitignore).toContain('node_modules/');
      expect(gitignore).toContain('.env');
    } finally {
      spy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('detects when directory is already inside a git work tree and avoids nested git init', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-worktree-'));
    const spy = vi.spyOn(shell, 'runExecutable').mockImplementation(async (_cmd, args) => {
      if (args.includes('--is-inside-work-tree')) {
        return { ok: true, exitCode: 0, stdout: 'true', stderr: '' };
      }
      return { ok: true, exitCode: 0, stdout: '', stderr: '' };
    });
    try {
      const ok = await setupGit(tempDir, { silent: true });
      expect(ok).toBe(true);
      // It should NOT have called git init
      expect(spy).not.toHaveBeenCalledWith(
        'git',
        ['init'],
        expect.anything()
      );
      expect(fs.existsSync(path.join(tempDir, '.gitignore'))).toBe(true);
    } finally {
      spy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
