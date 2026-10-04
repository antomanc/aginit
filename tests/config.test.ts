import { describe, it, expect } from 'vitest';
import { getDefaultConfig } from '../src/config/defaults.js';

describe('Configuration & Defaults', () => {
  it('generates correct config for web preset with simplified Matt skills and schemaVersion', () => {
    const config = getDefaultConfig('my-web-app', 'web');
    expect(config.schemaVersion).toBe('1.0.0');
    expect(config.name).toBe('my-web-app');
    expect(config.preset).toBe('web');
    expect(config.framework).toBe('none');
    expect(config.agents.primary).toBe('antigravity');
    expect(config.agents.secondary).toBe('codex');
    expect(config.browser.visualAgent).toBe(true);
    // When framework is 'none', no unusable Playwright E2E is configured by default
    expect(config.browser.playwright).toBe(false);
    expect(config.codebase.graft).toBe(true);

    const mattSource = config.skills.sources.find((s) => s.package === 'mattpocock/skills');
    expect(mattSource).toBeDefined();
    // Default Matt skills must only contain the universally useful trio
    expect(mattSource?.skills).toEqual(['tdd', 'code-review', 'diagnosing-bugs']);

    const packages = config.skills.sources.map((s) => s.package);
    expect(packages).toContain('pbakaus/impeccable');
    expect(packages).toContain('vercel-labs/agent-browser');
  });

  it('supports optional specWorkflow in config', () => {
    const config = getDefaultConfig('my-spec-app', 'web', { specWorkflow: true });
    expect(config.skills.workflow).toBe('spec');
    const mattSource = config.skills.sources.find((s) => s.package === 'mattpocock/skills');
    expect(mattSource?.skills).toContain('to-spec');
    expect(mattSource?.skills).toContain('to-tickets');
    expect(mattSource?.skills).toContain('implement-spec');
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
    expect(config.browser.playwright).toBe(false);
    expect(config.codebase.graft).toBe(true);

    const mattSource = config.skills.sources.find((s) => s.package === 'mattpocock/skills');
    expect(mattSource?.skills).toEqual(['tdd', 'code-review', 'diagnosing-bugs']);
    expect(config.skills.sources.map((s) => s.package)).not.toContain('pbakaus/impeccable');
  });

  it('generates correct config for generic preset', () => {
    const config = getDefaultConfig('my-generic-repo', 'generic');
    expect(config.schemaVersion).toBe('1.0.0');
    expect(config.name).toBe('my-generic-repo');
    expect(config.preset).toBe('generic');
    expect(config.browser.visualAgent).toBe(false);
    expect(config.skills.sources.length).toBeGreaterThan(0);
  });
});
