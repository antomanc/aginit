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

  it('scaffolds web preset decoupled from Vite by default (framework=none)', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-web-none-'));
    try {
      const ok = await createProject('test-web-none', {
        preset: 'web',
        skills: false,
        graft: false,
        targetDir: tempDir,
        silent: true
      });

      expect(ok).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'));
      // By default, framework is 'none' so vite is NOT added
      expect(pkg.devDependencies.vite).toBeUndefined();
      expect(pkg.scripts.build).toBe('tsc');
      expect(pkg.scripts.test).toBe('vitest run');
      expect(pkg.scripts['test:e2e']).toBe('playwright test');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('scaffolds web preset with framework=vite when explicitly requested', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-web-vite-'));
    try {
      const ok = await createProject('test-web-vite', {
        preset: 'web',
        framework: 'vite',
        skills: false,
        graft: false,
        targetDir: tempDir,
        silent: true
      });

      expect(ok).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'));
      expect(pkg.devDependencies.vite).toBeDefined();
      expect(pkg.scripts.dev).toBe('vite');
      expect(pkg.scripts.build).toBe('tsc && vite build');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
