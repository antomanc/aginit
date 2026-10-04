import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getPreset, listPresets } from '../src/presets/registry.js';
import { getDefaultConfig } from '../src/config/defaults.js';

describe('Preset Registry', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aginit-preset-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('lists all supported presets', () => {
    const list = listPresets();
    const names = list.map((p) => p.name);
    expect(names).toContain('web');
    expect(names).toContain('cli');
    expect(names).toContain('generic');
  });

  it('retrieves existing preset handlers', () => {
    const web = getPreset('web');
    expect(web.name).toBe('web');
    expect(web.description).toBeTruthy();

    const cli = getPreset('cli');
    expect(cli.name).toBe('cli');

    const generic = getPreset('generic');
    expect(generic.name).toBe('generic');
  });

  it('throws an error for unknown preset', () => {
    expect(() => getPreset('non-existent' as any)).toThrowError(/Unknown preset/);
  });

  it('generates pnpm-workspace.yaml only when packageManager is pnpm for web preset', async () => {
    const web = getPreset('web');

    // Test with pnpm
    const pnpmDir = path.join(tmpDir, 'pnpm-test');
    fs.mkdirSync(pnpmDir);
    const pnpmConfig = getDefaultConfig('pnpm-test', 'web', { packageManager: 'pnpm' });
    await web.scaffold({
      targetDir: pnpmDir,
      projectName: 'pnpm-test',
      config: pnpmConfig,
      silent: true
    });
    expect(fs.existsSync(path.join(pnpmDir, 'pnpm-workspace.yaml'))).toBe(true);

    // Test with npm
    const npmDir = path.join(tmpDir, 'npm-test');
    fs.mkdirSync(npmDir);
    const npmConfig = getDefaultConfig('npm-test', 'web', { packageManager: 'npm' });
    await web.scaffold({
      targetDir: npmDir,
      projectName: 'npm-test',
      config: npmConfig,
      silent: true
    });
    expect(fs.existsSync(path.join(npmDir, 'pnpm-workspace.yaml'))).toBe(false);
  });

  it('generates pnpm-workspace.yaml only when packageManager is pnpm for cli preset', async () => {
    const cli = getPreset('cli');

    // Test with pnpm
    const pnpmDir = path.join(tmpDir, 'pnpm-cli-test');
    fs.mkdirSync(pnpmDir);
    const pnpmConfig = getDefaultConfig('pnpm-cli-test', 'cli', { packageManager: 'pnpm' });
    await cli.scaffold({
      targetDir: pnpmDir,
      projectName: 'pnpm-cli-test',
      config: pnpmConfig,
      silent: true
    });
    expect(fs.existsSync(path.join(pnpmDir, 'pnpm-workspace.yaml'))).toBe(true);

    const binFile = path.join(pnpmDir, 'bin', 'cli.js');
    expect(fs.existsSync(binFile)).toBe(true);
    if (process.platform !== 'win32') {
      const mode = fs.statSync(binFile).mode & 0o777;
      expect(mode & 0o111).toBeTruthy();
    }

    // Test with bun
    const bunDir = path.join(tmpDir, 'bun-cli-test');
    fs.mkdirSync(bunDir);
    const bunConfig = getDefaultConfig('bun-cli-test', 'cli', { packageManager: 'bun' });
    await cli.scaffold({
      targetDir: bunDir,
      projectName: 'bun-cli-test',
      config: bunConfig,
      silent: true
    });
    expect(fs.existsSync(path.join(bunDir, 'pnpm-workspace.yaml'))).toBe(false);
  });
});
