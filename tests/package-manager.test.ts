import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  detectPackageManager,
  getPackageManagerAdapter,
  PACKAGE_MANAGERS
} from '../src/adapters/package-manager.js';

describe('Package Manager Adapter & Detection', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aginit-pm-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects pnpm from pnpm-lock.yaml', () => {
    fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), '');
    expect(detectPackageManager(tmpDir)).toBe('pnpm');
  });

  it('detects bun from bun.lockb or bun.lock', () => {
    fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
    expect(detectPackageManager(tmpDir)).toBe('bun');

    fs.rmSync(path.join(tmpDir, 'bun.lockb'));
    fs.writeFileSync(path.join(tmpDir, 'bun.lock'), '');
    expect(detectPackageManager(tmpDir)).toBe('bun');
  });

  it('detects yarn from yarn.lock', () => {
    fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
    expect(detectPackageManager(tmpDir)).toBe('yarn');
  });

  it('detects npm from package-lock.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '');
    expect(detectPackageManager(tmpDir)).toBe('npm');
  });

  it('returns null when no lockfile exists', () => {
    expect(detectPackageManager(tmpDir)).toBeNull();
  });

  it('provides correct execution commands for pnpm', () => {
    const pm = getPackageManagerAdapter('pnpm');
    expect(pm.name).toBe('pnpm');
    expect(pm.installCmd).toBe('pnpm install');
    expect(pm.runCmd('build')).toBe('pnpm build');
    expect(pm.execCmd('skills', ['add', 'tdd'])).toBe('pnpm dlx skills add tdd');
    expect(pm.scaffoldViteCmd()).toContain('pnpm create vite');
    expect(pm.scaffoldNextCmd()).toContain('--use-pnpm');
  });

  it('provides correct execution commands for npm', () => {
    const pm = getPackageManagerAdapter('npm');
    expect(pm.name).toBe('npm');
    expect(pm.installCmd).toBe('npm install');
    expect(pm.runCmd('test')).toBe('npm run test');
    expect(pm.execCmd('skills', ['add', 'tdd'])).toBe('npx -y skills add tdd');
    expect(pm.scaffoldViteCmd()).toContain('npm create vite@latest');
    expect(pm.scaffoldNextCmd()).toContain('--use-npm');
  });

  it('provides correct execution commands for yarn', () => {
    const pm = getPackageManagerAdapter('yarn');
    expect(pm.name).toBe('yarn');
    expect(pm.installCmd).toBe('yarn install');
    expect(pm.runCmd('dev')).toBe('yarn dev');
    expect(pm.execCmd('skills')).toBe('yarn dlx skills');
    expect(pm.scaffoldViteCmd()).toContain('yarn create vite');
    expect(pm.scaffoldNextCmd()).toContain('--use-yarn');
  });

  it('provides correct execution commands for bun', () => {
    const pm = getPackageManagerAdapter('bun');
    expect(pm.name).toBe('bun');
    expect(pm.installCmd).toBe('bun install');
    expect(pm.runCmd('test')).toBe('bun run test');
    expect(pm.execCmd('skills')).toBe('bunx skills');
    expect(pm.scaffoldViteCmd()).toContain('bun create vite');
    expect(pm.scaffoldNextCmd()).toContain('--use-bun');
  });
});
