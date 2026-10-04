import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createProject } from '../src/cli/new.js';
import { initCurrentDirectory } from '../src/cli/init.js';
import { createCliProgram } from '../src/cli/main.js';
import { runDoctor } from '../src/cli/doctor.js';
import { installSkillSource } from '../src/adapters/skills.js';
import { setupGit } from '../src/adapters/git.js';
import { getDefaultConfig } from '../src/config/defaults.js';

const shell = vi.hoisted(() => ({ runExecutable: vi.fn(), commandExists: vi.fn() }));
vi.mock('../src/utils/shell.js', async (original) => ({
  ...(await original<typeof import('../src/utils/shell.js')>()),
  ...shell
}));

const success = { ok: true, exitCode: 0, stdout: '1.0.0', stderr: '' };
let dir: string;
let cwd: string;
let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aginit-release-'));
  cwd = process.cwd();
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  shell.commandExists.mockResolvedValue(false);
  shell.runExecutable.mockReset().mockResolvedValue(success);
});
afterEach(() => {
  process.chdir(cwd);
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});
const options = { skills: false, graft: false, git: false, silent: true };
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));

it('persists missing web scripts/dependencies while retaining custom manifest fields', async () => {
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'existing',
      type: 'module',
      scripts: { dev: 'custom-dev', build: 'custom-build' },
      dependencies: { vitest: '^4.1.11' },
      custom: 42
    })
  );
  await createProject('existing', {
    ...options,
    targetDir: dir,
    preset: 'web',
    framework: 'existing'
  });
  const pkg = read('package.json');
  expect(pkg.scripts.test).toBe('vitest run');
  expect(pkg.scripts.build).toBe('custom-build');
  expect(pkg.devDependencies?.vitest).toBeUndefined();
  expect(pkg.custom).toBe(42);
  expect(fs.existsSync(path.join(dir, 'src/index.ts'))).toBe(false);
});
it('does not generate tests depending on existing application exports', async () => {
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src/index.ts'), 'export const existing = true;');
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'existing', type: 'module' })
  );
  for (const preset of ['web', 'cli'] as const) {
    await createProject('existing', { ...options, targetDir: dir, preset });
    const tests = fs
      .readdirSync(path.join(dir, 'tests'))
      .map((f) => fs.readFileSync(path.join(dir, 'tests', f), 'utf8'))
      .join('\n');
    expect(tests).not.toContain('../src/index');
  }
  expect(fs.readFileSync(path.join(dir, 'src/index.ts'), 'utf8')).toBe(
    'export const existing = true;'
  );
});
it('preserves saved config and extension fields through the actual init CLI', async () => {
  const config = {
    ...getDefaultConfig('existing', 'web', {
      framework: 'vite',
      packageManager: 'npm',
      specWorkflow: true
    }),
    extension: { custom: true }
  };
  config.codebase.graft = false;
  fs.writeFileSync(path.join(dir, 'aginit.config.json'), JSON.stringify(config));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'existing', type: 'module', scripts: {} })
  );
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src/main.tsx'), 'export const app=true;');
  process.chdir(dir);
  await createCliProgram().parseAsync(['node', 'aginit', 'init', '--no-skills', '--no-git']);
  expect(read('aginit.config.json')).toEqual(config);
});
it('applies explicit init overrides without dropping extensions', async () => {
  const config = {
    ...getDefaultConfig('existing', 'web', { framework: 'none', packageManager: 'npm' }),
    extension: 42
  };
  config.codebase.graft = false;
  fs.writeFileSync(path.join(dir, 'aginit.config.json'), JSON.stringify(config));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'existing', type: 'module' })
  );
  process.chdir(dir);
  await initCurrentDirectory({ ...options, packageManager: 'bun', specWorkflow: true });
  expect(read('aginit.config.json')).toMatchObject({
    preset: 'web',
    packageManager: 'bun',
    extension: 42,
    skills: { workflow: 'spec' }
  });
});
it('rejects invalid existing configuration before changing any files', async () => {
  fs.writeFileSync(path.join(dir, 'aginit.config.json'), '{}');
  process.chdir(dir);
  await expect(initCurrentDirectory(options)).rejects.toThrow(/config/i);
  expect(fs.readdirSync(dir)).toEqual(['aginit.config.json']);
});
it('rejects malformed existing package manifests without overwriting them', async () => {
  fs.writeFileSync(path.join(dir, 'package.json'), 'not json');
  await expect(
    createProject('existing', { ...options, targetDir: dir, preset: 'web' })
  ).rejects.toThrow(/package.json/);
  expect(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).toBe('not json');
});
it('rejects unsafe names and enum options before creating directories', async () => {
  for (const [name, extra] of [
    ["owner's-app", {}],
    ['..', {}],
    ['app', { framework: 'bogus' }],
    ['app', { packageManager: 'npm; echo bad' }],
    ['app', { preset: 'bogus' }]
  ] as const) {
    const targetDir = path.join(dir, 'untouched');
    await expect(createProject(name, { ...options, ...extra, targetDir } as any)).rejects.toThrow();
    expect(fs.existsSync(targetDir)).toBe(false);
  }
});
it('runs framework scaffolding before Git and persists testing additions', async () => {
  shell.runExecutable.mockImplementation(async (_bin, args, opts) => {
    if (args.some((v: string) => v.includes('create-vite'))) {
      expect(fs.existsSync(path.join(opts.cwd, '.gitignore'))).toBe(false);
      fs.mkdirSync(path.join(opts.cwd, 'src'), { recursive: true });
      fs.writeFileSync(path.join(opts.cwd, 'src/main.tsx'), 'export const app=true;');
      fs.writeFileSync(path.join(opts.cwd, 'index.html'), '<div id="root"></div>');
      fs.writeFileSync(
        path.join(opts.cwd, 'package.json'),
        JSON.stringify({
          name: 'app',
          type: 'module',
          scripts: { dev: 'vite', build: 'vite build' }
        })
      );
    }
    return success;
  });
  await createProject('app', {
    ...options,
    targetDir: dir,
    preset: 'web',
    framework: 'vite',
    git: true
  });
  expect(read('package.json').scripts['test:e2e']).toBe('playwright test');
  expect(read('package.json').devDependencies.vitest).toBeTruthy();
  expect(fs.existsSync(path.join(dir, '.gitignore'))).toBe(true);
});
it('rejects both failed and cancelled upstream scaffolding instead of producing fake apps', async () => {
  for (const response of [{ ...success, ok: false, stderr: 'offline' }, success]) {
    shell.runExecutable.mockResolvedValue(response);
    await expect(
      createProject('app', { ...options, targetDir: dir, preset: 'web', framework: 'vite' })
    ).rejects.toThrow(/scaffold/i);
    expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(false);
  }
});
it('gives new generic projects a runnable test harness', async () => {
  await createProject('generic', { ...options, targetDir: dir });
  expect(read('package.json').devDependencies.vitest).toBeTruthy();
  expect(fs.readdirSync(path.join(dir, 'tests')).length).toBeGreaterThan(0);
  const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  expect(agents).not.toContain('pnpm build');
  expect(agents).not.toContain('pnpm typecheck');
});
it('diagnoses malformed and hostile config without executing its contents', async () => {
  for (const config of [
    {},
    { ...getDefaultConfig('app', 'generic'), packageManager: 'node; echo injected' }
  ]) {
    fs.writeFileSync(path.join(dir, 'aginit.config.json'), JSON.stringify(config));
    await expect(runDoctor(dir)).resolves.not.toThrow();
    expect(log.mock.calls.flat().join('\n')).toMatch(/invalid.*config|config.*invalid/i);
  }
  expect(shell.runExecutable.mock.calls.every(([bin]) => !bin.includes(';'))).toBe(true);
});
it('passes wildcard and metacharacters literally to the skill installer', async () => {
  await installSkillSource(dir, { package: 'owner/repo', skills: [] });
  expect(shell.runExecutable).toHaveBeenCalledWith(
    'npx',
    expect.arrayContaining(['--skill', '*']),
    expect.anything()
  );
  await expect(installSkillSource(dir, { package: '--global', skills: ['tdd'] })).rejects.toThrow();
});
it('warns when Graft is unavailable and does not announce complete readiness', async () => {
  await createProject('app', { ...options, targetDir: dir, graft: true, silent: false });
  expect(log.mock.calls.flat().join('\n')).toMatch(/Graft.*not.*install/i);
  expect(log.mock.calls.flat().join('\n')).not.toContain('is ready for development');
});
it('adds environment exclusions to upstream gitignore files', async () => {
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n');
  await setupGit(dir, { silent: true });
  expect(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8')).toContain('.env');
});

it('separates Vitest discovery from generated Playwright suites even with a Vite config', async () => {
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'app', type: 'module', scripts: { dev: 'vite' } })
  );
  fs.writeFileSync(path.join(dir, 'vite.config.ts'), 'export default { plugins: [] };\n');
  await createProject('app', { ...options, targetDir: dir, preset: 'web', framework: 'vite' });
  expect(fs.readFileSync(path.join(dir, 'vitest.config.mts'), 'utf8')).toContain(
    'tests/**/*.test.'
  );
  expect(fs.readFileSync(path.join(dir, 'vite.config.ts'), 'utf8')).toBe(
    'export default { plugins: [] };\n'
  );
});

it('rejects an existing-framework selection when no project manifest exists', async () => {
  const target = path.join(dir, 'missing');
  await expect(
    createProject('app', { ...options, targetDir: target, preset: 'web', framework: 'existing' })
  ).rejects.toThrow(/existing.*package.json/i);
  expect(fs.existsSync(target)).toBe(false);
});
it('reports an all-skills source failure as an incomplete setup', async () => {
  const config = getDefaultConfig('app', 'generic');
  config.codebase.graft = false;
  config.skills.sources = [{ package: 'owner/repo', skills: [] }];
  fs.writeFileSync(path.join(dir, 'aginit.config.json'), JSON.stringify(config));
  shell.runExecutable.mockResolvedValue({ ...success, ok: false, stderr: 'offline' });
  await expect(createProject('app', { targetDir: dir, git: false, silent: true })).resolves.toBe(
    false
  );
});
it('preserves an existing Vitest configuration held inside Vite config', async () => {
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'app', type: 'module', scripts: { test: 'vitest run' } })
  );
  const config = "export default { test: { include: ['src/**/*.test.ts'] } };\n";
  fs.writeFileSync(path.join(dir, 'vite.config.ts'), config);
  await createProject('app', { ...options, targetDir: dir, preset: 'web', framework: 'existing' });
  expect(fs.existsSync(path.join(dir, 'vitest.config.mts'))).toBe(false);
  expect(fs.readFileSync(path.join(dir, 'vite.config.ts'), 'utf8')).toBe(config);
});

it('returns a failing CLI status when upstream updates fail', async () => {
  const before = process.exitCode;
  process.chdir(dir);
  shell.runExecutable.mockResolvedValue({ ...success, ok: false, stderr: 'offline' });
  try {
    await createCliProgram().parseAsync(['node', 'aginit', 'update']);
    expect(process.exitCode).toBe(1);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Update finished.');
  } finally {
    process.exitCode = before;
  }
});
it('skips disabled integrations during updates', async () => {
  const config = getDefaultConfig('app', 'generic');
  config.codebase.graft = false;
  config.skills.sources = [];
  fs.writeFileSync(path.join(dir, 'aginit.config.json'), JSON.stringify(config));
  process.chdir(dir);
  await createCliProgram().parseAsync(['node', 'aginit', 'update']);
  expect(shell.runExecutable).not.toHaveBeenCalled();
  expect(log.mock.calls.flat().join('\n')).toContain('Update finished.');
});
it('uses Next type generation before a fresh app typecheck', async () => {
  shell.runExecutable.mockImplementation(async (_bin, args, opts) => {
    if (args.some((arg: string) => arg.includes('create-next-app'))) {
      fs.mkdirSync(path.join(opts.cwd, 'src/app'), { recursive: true });
      fs.writeFileSync(
        path.join(opts.cwd, 'src/app/page.tsx'),
        'export default function Page() { return null; }'
      );
      fs.writeFileSync(path.join(opts.cwd, 'tsconfig.json'), '{}');
      fs.writeFileSync(
        path.join(opts.cwd, 'package.json'),
        JSON.stringify({
          name: 'app',
          scripts: { build: 'next build' },
          dependencies: { next: '16.3.8' }
        })
      );
    }
    return success;
  });
  await createProject('app', { ...options, targetDir: dir, preset: 'web', framework: 'next' });
  expect(read('package.json').scripts.typecheck).toBe('next typegen && tsc --noEmit');
});

it('diagnoses unsupported Node versions below required engine in doctor', async () => {
  shell.runExecutable.mockImplementation(async (bin, args) => {
    if (bin === 'node' && args.includes('-v')) {
      return { ok: true, exitCode: 0, stdout: 'v20.18.0', stderr: '' };
    }
    return success;
  });
  await runDoctor(dir);
  const output = log.mock.calls.flat().join('\n');
  expect(output).toContain('requires Node.js >= 22.12.0');
});

it('defaults scoped project names to package basename directory while keeping scoped manifest', async () => {
  process.chdir(dir);
  await createProject('@scope/scoped-app', { ...options });
  const expectedDir = path.join(dir, 'scoped-app');
  expect(fs.existsSync(expectedDir)).toBe(true);
  const pkg = JSON.parse(fs.readFileSync(path.join(expectedDir, 'package.json'), 'utf8'));
  expect(pkg.name).toBe('@scope/scoped-app');
  const config = JSON.parse(fs.readFileSync(path.join(expectedDir, 'aginit.config.json'), 'utf8'));
  expect(config.name).toBe('@scope/scoped-app');
});

it('sanitizes non-compliant directory names when running init without manifest', async () => {
  const customSubDir = path.join(dir, 'My Uppercase App');
  fs.mkdirSync(customSubDir);
  process.chdir(customSubDir);
  await initCurrentDirectory({ ...options });
  const config = JSON.parse(fs.readFileSync(path.join(customSubDir, 'aginit.config.json'), 'utf8'));
  expect(config.name).toBe('my-uppercase-app');
});
