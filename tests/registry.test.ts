import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  activeCapabilities,
  CapabilityDescriptor,
  CATALOG,
  defaultCapabilities,
  inferCapabilities,
  registerCapability,
  resolveCapabilities
} from '../src/registry/index.js';
import { getDefaultConfig } from '../src/config/defaults.js';
import { validateConfig } from '../src/config/validation.js';

const shell = vi.hoisted(() => ({ runExecutable: vi.fn(), commandExists: vi.fn() }));
vi.mock('../src/utils/shell.js', async (original) => ({
  ...(await original<typeof import('../src/utils/shell.js')>()),
  ...shell
}));

const { listCapabilities } = await import('../src/cli/capabilities.js');
const { createProject } = await import('../src/cli/new.js');
const { runDoctor } = await import('../src/cli/doctor.js');

describe('catalog', () => {
  it('has unique ids, credits and well-formed install steps', () => {
    const ids = CATALOG.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CATALOG) {
      expect(c.repoUrl).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
      expect(c.license).not.toBe('');
      for (const step of c.install)
        if (step.kind === 'skills-sh') expect(step.repo).toMatch(/^[\w.-]+\/[\w.-]+$/);
    }
  });

  it('credits every upstream integration in THIRD_PARTY_NOTICES.md', () => {
    const notices = fs.readFileSync(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
    for (const c of CATALOG.filter((entry) => entry.author !== 'aginit'))
      expect(notices, `${c.id} (${c.repoUrl})`).toContain(c.repoUrl);
  });

  it('defaults to one pick per exclusive category on every platform', () => {
    for (const [platform, stack] of [
      ['web', 'node'],
      ['mobile-native', 'flutter'],
      ['mobile-rn', 'react-native'],
      ['cli', 'node'],
      ['backend', 'go']
    ] as const) {
      const ids = defaultCapabilities({ platform, stack });
      for (const category of ['methodology', 'design', 'ui-driver'])
        expect(
          ids.filter((id) => CATALOG.find((c) => c.id === id)?.category === category).length
        ).toBeLessThanOrEqual(1);
      expect(ids).toEqual(expect.arrayContaining(['trail', 'pocock', 'ponytail', 'karpathy-guidelines', 'humanizer']));
    }
  });
});

describe('platform defaults', () => {
  it('web: agent-browser, impeccable and vitest (+ playwright with a framework)', () => {
    expect(defaultCapabilities({ platform: 'web', stack: 'node' })).toEqual(
      expect.arrayContaining(['agent-browser', 'impeccable', 'vitest'])
    );
    expect(defaultCapabilities({ platform: 'web', stack: 'node', framework: 'vite' })).toContain(
      'playwright'
    );
  });

  it('native mobile: agent-device, impeccable and the host test runner, no Node tooling', () => {
    const ids = defaultCapabilities({ platform: 'mobile-native', stack: 'flutter' });
    expect(ids).toEqual(expect.arrayContaining(['agent-device', 'impeccable', 'native']));
    expect(ids).not.toContain('vitest');
    expect(ids).not.toContain('agent-browser');
  });

  it('cli and backend: no design system or UI driver', () => {
    for (const ids of [
      defaultCapabilities({ platform: 'cli', stack: 'node' }),
      defaultCapabilities({ platform: 'backend', stack: 'rust' })
    ]) {
      expect(ids).not.toContain('impeccable');
      expect(ids.some((id) => id.startsWith('agent-'))).toBe(false);
    }
  });
});

describe('design-taste', () => {
  it('is a web default that coexists with the design pick', () => {
    expect(defaultCapabilities({ platform: 'web', stack: 'node' })).toEqual(
      expect.arrayContaining(['impeccable', 'design-taste'])
    );
    for (const [platform, stack] of [
      ['mobile-native', 'flutter'],
      ['mobile-rn', 'react-native'],
      ['cli', 'node'],
      ['backend', 'go']
    ] as const)
      expect(defaultCapabilities({ platform, stack })).not.toContain('design-taste');
  });

  it('survives --design and can be added later to a saved project', () => {
    const web = { platform: 'web' as const, stack: 'node' as const };
    const { capabilities } = resolveCapabilities({ ...web, flags: { design: 'none' } });
    expect(capabilities).toContain('design-taste');
    const saved = resolveCapabilities({ ...web, flags: { without: ['design-taste'] } });
    expect(saved.capabilities).not.toContain('design-taste');
    const added = resolveCapabilities(
      { ...web, base: saved.capabilities, basePlatform: 'web', flags: { addons: ['design-taste'] } },
      saved.disabledCapabilities.filter((id) => id !== 'design-taste')
    );
    expect(added.capabilities).toEqual(expect.arrayContaining(['impeccable', 'design-taste']));
  });
});

describe('resolveCapabilities', () => {
  const web = { platform: 'web' as const, stack: 'node' as const };

  it('replaces the pick in a category and keeps add-ons', () => {
    const { capabilities } = resolveCapabilities({
      ...web,
      flags: { methodology: 'superpowers', design: 'none', addons: ['context-mode'] }
    });
    expect(capabilities).toContain('superpowers');
    expect(capabilities).not.toContain('pocock');
    expect(capabilities).not.toContain('impeccable');
    expect(capabilities).toContain('context-mode');
  });

  it('records --without and --add-skill', () => {
    const resolved = resolveCapabilities({
      ...web,
      flags: { without: ['humanizer'], addSkills: ['acme/skills'] }
    });
    expect(resolved.capabilities).not.toContain('humanizer');
    expect(resolved.disabledCapabilities).toEqual(['humanizer']);
    expect(resolved.customCapabilities).toEqual([{ id: 'acme/skills', repo: 'acme/skills' }]);
  });

  it('keeps Node tooling out of non-Node projects', () => {
    expect(() =>
      resolveCapabilities({ platform: 'mobile-native', stack: 'flutter', flags: { testing: 'vitest' } })
    ).toThrow(/package\.json at the project root/);
    expect(
      resolveCapabilities({ platform: 'mobile-native', stack: 'flutter', flags: { testing: 'e2e' } })
        .capabilities
    ).toEqual(expect.arrayContaining(['native', 'e2e']));
  });

  it('rejects unknown ids with the valid choices', () => {
    expect(() => resolveCapabilities({ ...web, flags: { methodology: 'nope' } })).toThrow(
      /pocock, superpowers, minimal/
    );
    expect(() => resolveCapabilities({ ...web, flags: { uiDriver: 'impeccable' } })).toThrow(
      /Unknown ui-driver/
    );
  });

  it('re-derives UI defaults when the platform changes, keeping the methodology', () => {
    const { capabilities } = resolveCapabilities({
      platform: 'mobile-native',
      stack: 'flutter',
      base: ['trail', 'superpowers', 'vitest', 'context-mode'],
      basePlatform: 'cli',
      flags: { platform: 'mobile-native' }
    });
    expect(capabilities).toEqual(
      expect.arrayContaining(['superpowers', 'agent-device', 'native', 'context-mode'])
    );
    expect(capabilities).not.toContain('pocock');
    expect(capabilities).not.toContain('vitest');
  });
});

describe('configs written before v2', () => {
  const legacy = () => {
    const config = getDefaultConfig('old', 'web', { framework: 'vite' }) as any;
    delete config.capabilities;
    delete config.platform;
    delete config.stack;
    return validateConfig(config);
  };

  it('infer their capabilities from skill sources and switches', () => {
    expect(inferCapabilities(legacy())).toEqual(
      expect.arrayContaining(['trail', 'pocock', 'humanizer', 'ponytail', 'impeccable', 'agent-browser', 'vitest', 'playwright'])
    );
  });

  it('still honor codebase.trail and the configured sources', () => {
    const config = legacy();
    config.codebase.trail = false;
    config.skills.sources = config.skills.sources.filter((s) => s.package !== 'pbakaus/impeccable');
    const ids = activeCapabilities(config).map((c) => c.id);
    expect(ids).not.toContain('trail');
    expect(ids).not.toContain('impeccable');
    expect(ids).toContain('agent-browser');
  });
});

describe('a capability added to the registry', () => {
  const mock: CapabilityDescriptor = {
    id: 'mock-linter',
    name: 'Mock Linter',
    description: 'Lints with mocks',
    category: 'discipline',
    author: 'Mock Inc',
    repoUrl: 'https://github.com/mock/linter',
    license: 'MIT',
    supportedPlatforms: ['all'],
    requiresNodeInProjectRoot: false,
    default: true,
    install: [
      { kind: 'skills-sh', repo: 'mock/linter', skills: ['mock-lint'] },
      { kind: 'binary', bin: 'mocklint', install: 'npm i -g mocklint' }
    ]
  };
  let dir: string;
  let output: string[];
  beforeEach(() => {
    registerCapability(mock);
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aginit-registry-'));
    output = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => void output.push(args.join(' ')));
    shell.commandExists.mockResolvedValue(false);
    shell.runExecutable.mockReset().mockResolvedValue({ ok: true, exitCode: 0, stdout: '', stderr: '' });
  });
  afterEach(() => {
    CATALOG.splice(CATALOG.indexOf(mock), 1);
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('shows up in list, init --dry-run and doctor without other code changes', async () => {
    listCapabilities(dir);
    expect(output.join('\n')).toContain('mock-linter');

    output = [];
    await createProject('mocked', { targetDir: dir, dryRun: true, git: false, trail: false });
    const installs = shell.runExecutable.mock.calls.map((call) => call[1].join(' '));
    expect(installs.some((args) => args.includes('skills add mock/linter --skill mock-lint'))).toBe(true);
    expect(output.join('\n')).toContain('Mock Linter needs the `mocklint` CLI: npm i -g mocklint');

    // Write the config for real, then let doctor read it.
    await createProject('mocked', { targetDir: dir, git: false, trail: false, skills: true, silent: true });
    output = [];
    await runDoctor(dir);
    const report = output.join('\n');
    expect(report).toContain('Mock Linter (discipline)');
    expect(report).toContain('mock-lint');
    expect(report).toContain('mocklint CLI not found in PATH');
    expect(fs.readFileSync(path.join(dir, 'docs/agents/workflows.md'), 'utf8')).toContain(
      '`mock-lint`: Lints with mocks.'
    );
  });
});
