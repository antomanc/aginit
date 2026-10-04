import { describe, it, expect } from 'vitest';
import { setupGit } from '../src/adapters/git.js';
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
});
