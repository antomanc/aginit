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

  async function scaffoldExisting(pkg: Record<string, any>, tsconfig: object = {}) {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg));
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify(tsconfig));
    await getPreset('web').scaffold({
      targetDir: tmpDir,
      projectName: 'existing',
      config: getDefaultConfig('existing', 'web', { packageManager: 'bun' }),
      silent: true
    });
    return JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
  }

  it.each([
    [{ astro: '^5.0.0' }, 'astro check', '@astrojs/check'],
    [{ nuxt: '^4.0.0' }, 'nuxi typecheck', 'vue-tsc'],
    [
      { '@sveltejs/kit': '^2.0.0', svelte: '^5.0.0' },
      'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',
      'svelte-check'
    ],
    [{ svelte: '^5.0.0' }, 'svelte-check', 'svelte-check'],
    [{ vue: '^3.0.0' }, 'vue-tsc --noEmit', 'vue-tsc']
  ])('types an existing %o project with its framework checker', async (deps, script, checker) => {
    const pkg = await scaffoldExisting({ name: 'existing', scripts: {}, dependencies: deps });
    expect(pkg.scripts.typecheck).toBe(script);
    expect(pkg.devDependencies[checker]).toBeTruthy();
  });

  it('keeps an existing typecheck script and the checker the project already pins', async () => {
    const pkg = await scaffoldExisting({
      name: 'existing',
      scripts: { typecheck: 'astro check --minimumSeverity warning' },
      dependencies: { astro: '^5.0.0', '@astrojs/check': '0.9.4' }
    });
    expect(pkg.scripts.typecheck).toBe('astro check --minimumSeverity warning');
    expect(pkg.dependencies['@astrojs/check']).toBe('0.9.4');
    expect(pkg.devDependencies['@astrojs/check']).toBeUndefined();
  });

  it('typechecks referenced projects of a solution-style tsconfig in build mode', async () => {
    const pkg = await scaffoldExisting(
      { name: 'existing', scripts: {}, dependencies: { react: '^19.0.0' } },
      { files: [], references: [{ path: './tsconfig.app.json' }] }
    );
    expect(pkg.scripts.typecheck).toBe('tsc -b --noEmit');
  });

  it('keeps plain tsc for projects without a framework checker', async () => {
    const pkg = await scaffoldExisting({ name: 'existing', scripts: {} });
    expect(pkg.scripts.typecheck).toBe('tsc --noEmit');
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
