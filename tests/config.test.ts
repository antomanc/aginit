import { describe, it, expect } from 'vitest';
import {
  getDefaultConfig,
  upgradeLegacySkillConfig,
  MATT_POCOCK_SKILLS
} from '../src/config/defaults.js';

describe('Configuration & Defaults', () => {
  it('generates correct config for web preset with the full stable Matt skill set and schemaVersion', () => {
    const config = getDefaultConfig('my-web-app', 'web');
    expect(config.schemaVersion).toBe('1.0.0');
    expect(config.name).toBe('my-web-app');
    expect(config.preset).toBe('web');
    expect(config.framework).toBe('none');
    expect(config.packageManager).toBe('pnpm');
    expect(config.agents.primary).toBe('antigravity');
    expect(config.agents.secondary).toBe('codex');
    expect(config.browser.visualAgent).toBe(true);
    // When framework is 'none', no unusable Playwright E2E is configured by default
    expect(config.browser.playwright).toBe(false);
    expect(config.codebase.graft).toBe(true);

    const mattSource = config.skills.sources.find((s) => s.package === 'mattpocock/skills');
    expect(mattSource).toBeDefined();
    // The whole stable Matt Pocock set is installed as standard
    expect(mattSource?.skills).toEqual([...MATT_POCOCK_SKILLS]);
    expect(mattSource?.skills).toHaveLength(27);

    const packages = config.skills.sources.map((s) => s.package);
    expect(packages).toContain('blader/humanizer');
    expect(packages).toContain('pbakaus/impeccable');
    expect(packages).toContain('vercel-labs/agent-browser');
  });

  it('supports explicit packageManager choices: npm, yarn, bun', () => {
    const configNpm = getDefaultConfig('app-npm', 'web', { packageManager: 'npm' });
    expect(configNpm.packageManager).toBe('npm');

    const configYarn = getDefaultConfig('app-yarn', 'cli', { packageManager: 'yarn' });
    expect(configYarn.packageManager).toBe('yarn');

    const configBun = getDefaultConfig('app-bun', 'generic', { packageManager: 'bun' });
    expect(configBun.packageManager).toBe('bun');
  });

  it('installs every standard skill without a workflow selector', () => {
    const config = getDefaultConfig('my-spec-app', 'web');
    const mattSource = config.skills.sources.find((s) => s.package === 'mattpocock/skills');
    expect(mattSource?.skills).toContain('to-spec');
    expect(mattSource?.skills).toContain('to-tickets');
    expect(mattSource?.skills).toContain('implement-spec');
    // Upstream skills outside the stable categories stay out of the standard set
    expect(mattSource?.skills).not.toContain('chief-of-staff'); // in-progress
    expect(mattSource?.skills).not.toContain('setup-pre-commit'); // misc
    expect(config.skills.workflow).toBeUndefined();
  });

  it('upgrades saved legacy skill selections to the current standard', () => {
    const legacy = {
      workflow: 'minimal' as const,
      sources: [
        { package: 'mattpocock/skills', skills: ['tdd', 'code-review', 'diagnosing-bugs'] },
        { package: 'blader/humanizer', skills: ['humanizer'] }
      ]
    };
    const upgraded = upgradeLegacySkillConfig(legacy);
    expect(upgraded.workflow).toBeUndefined();
    expect(upgraded.sources[0].skills).toEqual([...MATT_POCOCK_SKILLS]);
    expect(upgraded.sources[1]).toBe(legacy.sources[1]);
  });

  it('preserves skill selections that were narrowed by hand', () => {
    const custom = { sources: [{ package: 'mattpocock/skills', skills: ['tdd'] }] };
    expect(upgradeLegacySkillConfig(custom)).toBe(custom);
  });

  it('supports custom web framework choice and enables playwright when web target exists', () => {
    const configVite = getDefaultConfig('my-vite-app', 'web', { framework: 'vite' });
    expect(configVite.framework).toBe('vite');
    expect(configVite.browser.playwright).toBe(true);

    const configNext = getDefaultConfig('my-next-app', 'web', { framework: 'next' });
    expect(configNext.framework).toBe('next');
    expect(configNext.browser.playwright).toBe(true);
  });

  it('generates correct config for cli preset', () => {
    const config = getDefaultConfig('my-cli-tool', 'cli');
    expect(config.schemaVersion).toBe('1.0.0');
    expect(config.name).toBe('my-cli-tool');
    expect(config.preset).toBe('cli');
    expect(config.packageManager).toBe('pnpm');
    expect(config.browser.playwright).toBe(false);
    expect(config.codebase.graft).toBe(true);

    const mattSource = config.skills.sources.find((s) => s.package === 'mattpocock/skills');
    expect(mattSource?.skills).toEqual([...MATT_POCOCK_SKILLS]);
    expect(config.skills.sources.map((s) => s.package)).toContain('blader/humanizer');
    expect(config.skills.sources.map((s) => s.package)).not.toContain('pbakaus/impeccable');
  });

  it('generates correct config for generic preset', () => {
    const config = getDefaultConfig('my-generic-repo', 'generic');
    expect(config.schemaVersion).toBe('1.0.0');
    expect(config.name).toBe('my-generic-repo');
    expect(config.preset).toBe('generic');
    expect(config.packageManager).toBe('pnpm');
    expect(config.browser.visualAgent).toBe(false);
    expect(config.skills.sources.length).toBeGreaterThan(0);
    expect(config.skills.sources.map((s) => s.package)).toContain('blader/humanizer');
  });
});
