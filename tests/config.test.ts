import { describe, it, expect } from 'vitest';
import { getDefaultConfig } from '../src/config/defaults.js';

describe('Configuration & Defaults', () => {
  it('generates correct config for web preset', () => {
    const config = getDefaultConfig('my-web-app', 'web');
    expect(config.name).toBe('my-web-app');
    expect(config.preset).toBe('web');
    expect(config.agents.primary).toBe('antigravity');
    expect(config.agents.secondary).toBe('codex');
    expect(config.browser.visualAgent).toBe(true);
    expect(config.browser.playwright).toBe(true);
    expect(config.codebase.graft).toBe(true);

    const packages = config.skills.sources.map((s) => s.package);
    expect(packages).toContain('mattpocock/skills');
    expect(packages).toContain('pbakaus/impeccable');
    expect(packages).toContain('vercel-labs/agent-browser');
  });

  it('generates correct config for cli preset', () => {
    const config = getDefaultConfig('my-cli-tool', 'cli');
    expect(config.name).toBe('my-cli-tool');
    expect(config.preset).toBe('cli');
    expect(config.browser.playwright).toBe(false);
    expect(config.codebase.graft).toBe(true);

    const packages = config.skills.sources.map((s) => s.package);
    expect(packages).toContain('mattpocock/skills');
    expect(packages).not.toContain('pbakaus/impeccable');
  });

  it('generates correct config for generic preset', () => {
    const config = getDefaultConfig('my-generic-repo', 'generic');
    expect(config.name).toBe('my-generic-repo');
    expect(config.preset).toBe('generic');
    expect(config.browser.visualAgent).toBe(false);
    expect(config.skills.sources.length).toBeGreaterThan(0);
  });
});
