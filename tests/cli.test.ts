import { describe, it, expect } from 'vitest';
import { createProject } from '../src/cli/new.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('CLI Project Creation', () => {
  it('supports dry-run without writing any files', async () => {
    const tempDir = path.join(os.tmpdir(), `dry-run-${Date.now()}`);
    const ok = await createProject('test-dry-run', {
      preset: 'web',
      dryRun: true,
      targetDir: tempDir,
      silent: true
    });

    expect(ok).toBe(true);
    expect(fs.existsSync(tempDir)).toBe(false);
  });

  it('scaffolds project structure with generic preset', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-test-'));
    try {
      const ok = await createProject('test-generic', {
        preset: 'generic',
        skills: false,
        graft: false,
        targetDir: tempDir,
        silent: true
      });

      expect(ok).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'ai.config.json'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'AGENTS.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.gitignore'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'docs', 'adr', '0001-record-architecture-decisions.md'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('scaffolds web preset with playwright and vitest', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-web-test-'));
    try {
      const ok = await createProject('test-web', {
        preset: 'web',
        skills: false,
        graft: false,
        targetDir: tempDir,
        silent: true
      });

      expect(ok).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'tsconfig.json'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'vitest.config.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'playwright.config.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'src', 'index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'tests', 'index.test.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'e2e', 'smoke.spec.ts'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
