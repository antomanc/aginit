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
      expect(fs.existsSync(path.join(tempDir, 'aginit.config.json'))).toBe(true);
      const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'aginit.config.json'), 'utf-8'));
      expect(config.schemaVersion).toBe('1.0.0');
      expect(fs.existsSync(path.join(tempDir, 'AGENTS.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.gitignore'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'docs', 'adr', '0001-record-architecture-decisions.md'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('scaffolds web preset decoupled from Vite by default (framework=none) without unusable E2E', async () => {
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
      expect(fs.existsSync(path.join(tempDir, 'aginit.config.json'))).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'));
      // By default, framework is 'none' so vite is NOT added
      expect(pkg.devDependencies.vite).toBeUndefined();
      expect(pkg.scripts.build).toBe('tsc');
      expect(pkg.scripts.test).toBe('vitest run');
      // When framework is none, no unusable Playwright E2E is scaffolded
      expect(pkg.scripts['test:e2e']).toBeUndefined();
      expect(fs.existsSync(path.join(tempDir, 'playwright.config.ts'))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, 'e2e'))).toBe(false);
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
      expect(pkg.scripts['test:e2e']).toBe('playwright test');
      expect(fs.existsSync(path.join(tempDir, 'playwright.config.ts'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
