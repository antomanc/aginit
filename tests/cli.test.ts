import { describe, it, expect, vi } from 'vitest';
import { createProject } from '../src/cli/new.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('../src/utils/shell.js', async (original) => ({
  ...(await original<typeof import('../src/utils/shell.js')>()),
  runExecutable: vi.fn(async (bin, args, options) => {
    if (args.some((arg: string) => arg.includes('create-vite'))) {
      fs.mkdirSync(path.join(options.cwd, 'src'), { recursive: true });
      fs.writeFileSync(path.join(options.cwd, 'index.html'), '<div id="root"></div>');
      fs.writeFileSync(path.join(options.cwd, 'src/main.tsx'), 'export const app = true;');
      fs.writeFileSync(
        path.join(options.cwd, 'package.json'),
        JSON.stringify({
          name: 'test-web-vite',
          type: 'module',
          scripts: { dev: 'vite', build: 'tsc -b && vite build' },
          devDependencies: { vite: '^6.0.0' }
        })
      );
      return { ok: true, exitCode: 0, stdout: '', stderr: '' };
    }
    const actual =
      await vi.importActual<typeof import('../src/utils/shell.js')>('../src/utils/shell.js');
    return actual.runExecutable(bin, args, options);
  })
}));

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
      expect(config.packageManager).toBe('pnpm');
      expect(fs.existsSync(path.join(tempDir, 'AGENTS.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.gitignore'))).toBe(true);
      expect(
        fs.existsSync(path.join(tempDir, 'docs', 'adr', '0001-record-architecture-decisions.md'))
      ).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('scaffolds with custom package-manager and stores it in aginit.config.json', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-npm-test-'));
    try {
      const ok = await createProject('test-npm-pm', {
        preset: 'cli',
        packageManager: 'npm',
        skills: false,
        graft: false,
        targetDir: tempDir,
        silent: true
      });

      expect(ok).toBe(true);
      const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'aginit.config.json'), 'utf-8'));
      expect(config.packageManager).toBe('npm');
      // For npm, pnpm-workspace.yaml must NOT be created
      expect(fs.existsSync(path.join(tempDir, 'pnpm-workspace.yaml'))).toBe(false);
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
      expect(pkg.scripts.build).toContain('vite build');
      expect(pkg.scripts['test:e2e']).toBe('playwright test');
      expect(fs.existsSync(path.join(tempDir, 'playwright.config.ts'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
