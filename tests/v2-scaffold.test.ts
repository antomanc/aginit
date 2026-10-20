import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectProject, projectCommands } from '../src/detect/index.js';
import { GENERATED_MARKER, LEGACY_GENERATED_MARKER } from '../src/adapters/agent-docs.js';
import { AGINIT_BLOCK_START } from '../src/adapters/agents-md.js';
import type { ProfileFlags } from '../src/registry/index.js';

const shell = vi.hoisted(() => ({ runExecutable: vi.fn(), commandExists: vi.fn() }));
vi.mock('../src/utils/shell.js', async (original) => ({
  ...(await original<typeof import('../src/utils/shell.js')>()),
  ...shell
}));

const { createProject } = await import('../src/cli/new.js');
const { changeCapabilities } = await import('../src/cli/capabilities.js');

let dir: string;
const options = { git: false, silent: true };
const file = (name: string) => path.join(dir, name);
const read = (name: string) => fs.readFileSync(file(name), 'utf8');
const config = () => JSON.parse(read('aginit.config.json'));
const calls = () => shell.runExecutable.mock.calls.map(([bin, args]) => [bin, ...args].join(' '));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aginit-v2-'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  shell.commandExists.mockResolvedValue(true);
  shell.runExecutable.mockReset().mockResolvedValue({ ok: true, exitCode: 0, stdout: '1.0.0', stderr: '' });
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('stack detection', () => {
  const detect = (files: Record<string, string>) => {
    for (const [name, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(file(name)), { recursive: true });
      fs.writeFileSync(file(name), content);
    }
    return detectProject(dir);
  };

  it.each([
    [{ 'pubspec.yaml': 'name: app' }, 'mobile-native', 'flutter'],
    [{ 'Package.swift': 'platforms: [.iOS(.v17)]' }, 'mobile-native', 'swift'],
    [{ 'Package.swift': 'let package = Package(name: "tool")' }, 'cli', 'swift'],
    [{ 'android/build.gradle.kts': 'plugins {}' }, 'mobile-native', 'kotlin'],
    [{ 'settings.gradle.kts': 'rootProject.name = "api"' }, 'backend', 'kotlin'],
    [{ 'package.json': '{"dependencies":{"react-native":"1"}}', 'ios/App.xcodeproj/x': '' }, 'mobile-rn', 'react-native'],
    [{ 'app.json': '{"expo":{}}', 'package.json': '{}' }, 'mobile-rn', 'react-native'],
    [{ 'package.json': '{"devDependencies":{"vite":"7"}}' }, 'web', 'node'],
    [{ 'package.json': '{"bin":{"x":"x.js"}}' }, 'cli', 'node'],
    [{ 'Cargo.toml': '[package]' }, 'cli', 'rust'],
    [{ 'go.mod': 'module x' }, 'backend', 'go'],
    [{ 'pyproject.toml': '[project]' }, 'backend', 'python'],
    [{}, null, 'unknown']
  ])('%o → %s / %s', (files, platform, stack) => {
    expect(detect(files)).toEqual({ platform, stack });
  });

  it('uses the host toolchain commands for non-Node stacks', () => {
    expect(projectCommands(dir, 'flutter')).toEqual({ lint: 'flutter analyze', test: 'flutter test' });
    expect(projectCommands(dir, 'rust').test).toBe('cargo test');
  });

  it('detects pytest and ruff for Python, through uv when locked', () => {
    expect(projectCommands(dir, 'python')).toEqual({ test: 'pytest' });
    fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[tool.ruff.lint]\nselect = ["E"]\n');
    expect(projectCommands(dir, 'python')).toEqual({
      lint: 'ruff check . && ruff format --check .',
      test: 'pytest'
    });
    fs.writeFileSync(path.join(dir, 'uv.lock'), '');
    expect(projectCommands(dir, 'python')).toEqual({
      lint: 'uv run ruff check . && uv run ruff format --check .',
      test: 'uv run pytest'
    });
  });
});

describe('web project (agent-browser + impeccable + e2e)', () => {
  it('configures the web UI stack and runs e2e init at the project root', async () => {
    expect(
      await createProject('web-app', {
        ...options,
        targetDir: dir,
        preset: 'web',
        graft: false,
        profile: { testing: 'e2e' }
      })
    ).toBe(true);
    const saved = config();
    expect(saved.platform).toBe('web');
    expect(saved.capabilities).toEqual(
      expect.arrayContaining(['agent-browser', 'impeccable', 'vitest', 'e2e'])
    );
    expect(saved.skills.sources.map((s: any) => s.package)).toEqual(
      expect.arrayContaining(['vercel-labs/agent-browser', 'pbakaus/impeccable', 'tester-army/e2e'])
    );
    const init = calls().find((c) => c.includes('e2e@latest init'))!;
    expect(init).toContain('--engine web');
    expect(init).not.toContain('.agents/e2e');
    expect(calls().some((c) => c.includes('agent-browser install'))).toBe(true);
    expect(JSON.parse(read('package.json')).scripts.test).toBe('vitest run');

    const agents = read('AGENTS.md');
    expect(agents).toContain('| Live UI verification (Web / Mobile) | `docs/agents/ui-verification.md` |');
    expect(agents).toContain('`DESIGN.md` + `.agents/skills/impeccable`');
    expect(read('docs/agents/ui-verification.md')).toContain('agent-browser snapshot -i');
    expect(read('docs/agents/testing.md')).toContain('node_modules/e2e/docs');
  });
});

describe('Flutter project (native mobile, no Node at the root)', () => {
  beforeEach(() => fs.writeFileSync(file('pubspec.yaml'), 'name: flutter_app\n'));

  it('keeps the root free of package.json and isolates e2e in .agents/e2e', async () => {
    expect(
      await createProject('flutter-app', { ...options, targetDir: dir, profile: { testing: 'e2e' } })
    ).toBe(true);
    for (const name of ['package.json', 'tsconfig.json', 'vitest.config.mts', 'pnpm-workspace.yaml'])
      expect(fs.existsSync(file(name)), name).toBe(false);

    const saved = config();
    expect(saved).toMatchObject({ preset: 'generic', platform: 'mobile-native', stack: 'flutter' });
    expect(saved.packageManager).toBeUndefined();
    expect(saved.capabilities).toEqual(
      expect.arrayContaining(['agent-device', 'impeccable', 'native', 'e2e'])
    );
    expect(saved.capabilities).not.toContain('vitest');
    expect(saved.capabilities).not.toContain('agent-browser');

    const init = calls().find((c) => c.includes('e2e@latest init'))!;
    expect(init).toContain('init .agents/e2e --yes --engine mobile --skills none --mcp none');
    expect(calls().some((c) => c.startsWith('npm install -g'))).toBe(false);

    expect(read('AGENTS.md')).toContain('- Test: `flutter test`');
    expect(read('AGENTS.md')).not.toContain('Package Manager');
    expect(read('docs/agents/testing.md')).toContain('cd .agents/e2e && npx e2e run');
    const ui = read('docs/agents/ui-verification.md');
    expect(ui).toContain('agent-device snapshot -i');
    expect(ui).toContain('/impeccable audit');
    expect(ui.indexOf('agent-device loop')).toBeLessThan(ui.indexOf('Impeccable'));
  });

  it('still scaffolds e2e when skills are skipped (its skill is optional)', async () => {
    await createProject('flutter-app', {
      ...options,
      targetDir: dir,
      skills: false,
      graft: false,
      profile: { testing: 'e2e' }
    });
    expect(calls().some((c) => c.includes('e2e@latest init .agents/e2e'))).toBe(true);
    expect(calls().some((c) => c.includes('skills add'))).toBe(false);
  });

  it('refuses Node-only test tooling before writing anything', async () => {
    await expect(
      createProject('flutter-app', { ...options, targetDir: dir, profile: { testing: 'vitest' } })
    ).rejects.toThrow(/package\.json at the project root/);
    await expect(
      createProject('flutter-app', { ...options, targetDir: dir, preset: 'cli' })
    ).rejects.toThrow(/--preset generic/);
    expect(fs.readdirSync(dir)).toEqual(['pubspec.yaml']);
  });
});

describe('existing Python project (scalebridge)', () => {
  const profile: ProfileFlags = { platform: 'backend', design: 'none', testing: 'native', uiDriver: 'none' };
  beforeEach(() => {
    fs.writeFileSync(file('pyproject.toml'), '[project]\nname = "app"\n\n[tool.ruff]\nline-length = 100\n');
    fs.writeFileSync(file('uv.lock'), '');
    fs.mkdirSync(file('tests'));
    fs.writeFileSync(file('AGENTS.md'), '# app\n\nHand-written notes.\n');
  });

  it('documents uv, pytest, ruff and the tests/ layout without Node tooling', async () => {
    await createProject('app', { ...options, targetDir: dir, graft: false, profile });
    const testing = read('docs/agents/testing.md');
    expect(testing).toContain('- Run: `uv run pytest`');
    expect(testing).toContain('- Static checks: `uv run ruff check . && uv run ruff format --check .`');
    expect(testing).toContain('Put tests in `tests/`, mirroring the module they cover.');
    expect(testing).not.toContain('vitest');
    expect(read('pyproject.toml')).toContain('extend-exclude = [".agents", ".claude"]');
    expect(fs.existsSync(file('package.json'))).toBe(false);
  });
});

describe('CLI / Node project (--platform cli --design none)', () => {
  it('skips design and UI tooling and keeps Vitest', async () => {
    await createProject('my-cli', {
      ...options,
      targetDir: dir,
      preset: 'cli',
      graft: false,
      profile: { platform: 'cli', design: 'none' }
    });
    const saved = config();
    expect(saved.capabilities).toEqual(
      expect.arrayContaining(['pocock', 'ponytail', 'karpathy-guidelines', 'humanizer', 'vitest'])
    );
    for (const id of ['impeccable', 'agent-browser', 'agent-device', 'e2e'])
      expect(saved.capabilities).not.toContain(id);
    expect(fs.existsSync(file('docs/agents/ui-verification.md'))).toBe(false);
    expect(read('AGENTS.md')).not.toContain('agent-browser');
    expect(read('AGENTS.md')).toContain('## Guardrails (karpathy-guidelines)');
  });

  it('reruns without changing the saved config or the generated docs', async () => {
    const run = () => createProject('my-cli', { ...options, targetDir: dir, preset: 'cli', graft: false });
    await run();
    const snapshot = ['aginit.config.json', 'AGENTS.md', 'docs/agents/testing.md', 'docs/agents/workflows.md'].map(read);
    await run();
    expect(['aginit.config.json', 'AGENTS.md', 'docs/agents/testing.md', 'docs/agents/workflows.md'].map(read)).toEqual(snapshot);
  });
});

describe('aginit add / remove', () => {
  beforeEach(async () => {
    await createProject('web-app', { ...options, targetDir: dir, preset: 'web', graft: false });
    shell.runExecutable.mockClear();
  });

  it('removes a capability, its skills and its AGENTS.md routing', async () => {
    expect(await changeCapabilities(dir, { remove: ['impeccable'] }, { silent: true })).toBe(true);
    expect(calls()).toContain('npx -y skills remove impeccable -y');
    const saved = config();
    expect(saved.capabilities).not.toContain('impeccable');
    expect(saved.disabledCapabilities).toEqual(['impeccable']);
    expect(saved.skills.sources.map((s: any) => s.package)).not.toContain('pbakaus/impeccable');
    expect(read('AGENTS.md')).not.toContain('DESIGN.md` +');
  });

  it('swaps the methodology and adds custom skill repositories', async () => {
    await changeCapabilities(dir, { add: ['superpowers', 'acme/agent-skills'] }, { silent: true });
    const saved = config();
    expect(saved.capabilities).toContain('superpowers');
    expect(saved.capabilities).not.toContain('pocock');
    expect(saved.customCapabilities).toEqual([{ id: 'acme/agent-skills', repo: 'acme/agent-skills' }]);
    expect(calls().some((c) => c.startsWith('npx -y skills remove ask-matt'))).toBe(true);
    expect(calls().some((c) => c.includes('skills add obra/superpowers'))).toBe(true);
    expect(calls().some((c) => c.includes('skills add acme/agent-skills --skill *'))).toBe(true);
    expect(read('docs/agents/workflows.md')).toContain('## Methodology: Superpowers');
  });

  it('re-enables a removed capability with add', async () => {
    await changeCapabilities(dir, { remove: ['humanizer'] }, { silent: true });
    await changeCapabilities(dir, { add: ['humanizer'] }, { silent: true });
    expect(config().disabledCapabilities).toBeUndefined();
    expect(config().capabilities).toContain('humanizer');
  });
});

describe('AGENTS.md and docs/agents merge safety', () => {
  it('inserts the aginit block above Graft and refreshes it in place', async () => {
    fs.writeFileSync(
      file('AGENTS.md'),
      '# Mine\n\nKeep this.\n\n<!-- graft:start -->\ngraft stuff\n<!-- graft:end -->\n'
    );
    await createProject('merge', { ...options, targetDir: dir, graft: false });
    const first = read('AGENTS.md');
    expect(first.startsWith('# Mine\n\nKeep this.\n\n' + AGINIT_BLOCK_START)).toBe(true);
    expect(first.indexOf('<!-- aginit:end -->')).toBeLessThan(first.indexOf('<!-- graft:start -->'));
    await createProject('merge', { ...options, targetDir: dir, graft: false });
    expect(read('AGENTS.md')).toBe(first);
  });

  it('updates legacy markers in-place in AGENTS.md and docs/agents/*.md without duplicating blocks', async () => {
    fs.writeFileSync(
      file('AGENTS.md'),
      '# Mine\n\nKeep this.\n\n<!-- aginit:start -->\nlegacy block\n<!-- aginit:end -->\n\n<!-- graft:start -->\ngraft stuff\n<!-- graft:end -->\n'
    );
    fs.mkdirSync(path.join(dir, 'docs', 'agents'), { recursive: true });
    fs.writeFileSync(
      file('docs/agents/testing.md'),
      `${LEGACY_GENERATED_MARKER}\n# Testing\nold\n`
    );
    await createProject('upgrade', { ...options, targetDir: dir, graft: false });
    const agents = read('AGENTS.md');
    expect(agents.startsWith('# Mine\n\nKeep this.\n\n' + AGINIT_BLOCK_START)).toBe(true);
    expect(agents).not.toContain('<!-- aginit:start -->');
    expect(agents.match(/<!--\s*aginit:start/g)?.length).toBe(1);

    const testing = read('docs/agents/testing.md');
    expect(testing.startsWith(GENERATED_MARKER)).toBe(true);
    expect(testing).not.toContain(LEGACY_GENERATED_MARKER);
  });

  it('never rewrites a micro-doc the user took over', async () => {
    await createProject('owned', { ...options, targetDir: dir, graft: false });
    const edited = read('docs/agents/testing.md').replace(GENERATED_MARKER + '\n', '') + '\nmine\n';
    fs.writeFileSync(file('docs/agents/testing.md'), edited);
    await createProject('owned', { ...options, targetDir: dir, graft: false, profile: { testing: 'e2e' } });
    expect(read('docs/agents/testing.md')).toBe(edited);
  });

  it('keeps the root AGENTS.md within 85 lines outside the Graft block', async () => {
    const cases: Array<[string, ProfileFlags]> = [
      ['pubspec.yaml', { testing: 'e2e', addons: ['context-mode', 'worktrunk'] }],
      ['package.json', { testing: 'e2e', addons: ['chrome-devtools-mcp', 'browserskill'] }]
    ];
    for (const [marker, extra] of cases) {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir);
      fs.writeFileSync(file(marker), marker === 'package.json' ? '{"dependencies":{"next":"16"}}' : 'name: x');
      await createProject('budget', { ...options, targetDir: dir, profile: extra });
      const lines = read('AGENTS.md').replace(/<!-- graft:start -->[\s\S]*<!-- graft:end -->/, '').split('\n');
      expect(lines.length).toBeLessThanOrEqual(85);
    }
  });
});

it('adds no placeholder test to a project that already has tests', async () => {
  fs.mkdirSync(file('tests'));
  fs.writeFileSync(file('tests/app.test.ts'), "it('works', () => {});\n");
  fs.writeFileSync(file('package.json'), JSON.stringify({ name: 'has-tests', type: 'module' }));
  await createProject('has-tests', { ...options, targetDir: dir, preset: 'cli', graft: false });
  expect(fs.readdirSync(file('tests'))).toEqual(['app.test.ts']);
});
