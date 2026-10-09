import { describe, it, expect } from 'vitest';
import { generateAgentsMarkdown, setupAgentsMarkdown } from '../src/adapters/agents-md.js';
import { getDefaultConfig } from '../src/config/defaults.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('AGENTS.md generation & safety', () => {
  it('generates concise AGENTS.md with web capabilities for vite framework', () => {
    const config = getDefaultConfig('demo-web', 'web', { framework: 'vite' });
    const md = generateAgentsMarkdown(config);

    expect(md).toContain('# demo-web');
    expect(md).toContain('## Core Invariants');
    expect(md).toContain('## Essential Commands');
    expect(md).toContain('Package Manager: `pnpm`');
    expect(md).toContain('pnpm test:e2e');
    expect(md).toContain('humanizer');
    expect(md).toContain('impeccable');
    expect(md).toContain('agent-browser');
    expect(md).toContain('## Bootstrap & First Session');
    expect(md).toContain('bootstrap this project');
  });

  it('includes humanizer prose guidance when humanizer skill is configured', () => {
    const config = getDefaultConfig('demo-generic', 'generic');
    const md = generateAgentsMarkdown(config);
    expect(md).toContain('humanizer');
    expect(md).toContain('Prose & Copy');
  });

  it('reflects selected package manager in Essential Commands', () => {
    const configNpm = getDefaultConfig('demo-npm', 'web', { framework: 'vite', packageManager: 'npm' });
    const mdNpm = generateAgentsMarkdown(configNpm);

    expect(mdNpm).toContain('Package Manager: `npm`');
    expect(mdNpm).toContain('- Build: `npm run build`');
    expect(mdNpm).toContain('- Test: `npm run test`');
    expect(mdNpm).toContain('- Test (E2E / Browser): `npm run test:e2e`');

    const configBun = getDefaultConfig('demo-bun', 'web', { framework: 'vite', packageManager: 'bun' });
    const mdBun = generateAgentsMarkdown(configBun);

    expect(mdBun).toContain('Package Manager: `bun`');
    expect(mdBun).toContain('- Test: `bun run test`');
  });

  it('generates concise AGENTS.md for cli preset without browser references', () => {
    const config = getDefaultConfig('demo-cli', 'cli');
    const md = generateAgentsMarkdown(config);

    expect(md).toContain('# demo-cli');
    expect(md).not.toContain('test:e2e');
    expect(md).not.toContain('agent-browser');
    expect(md).toContain('## Bootstrap & First Session');
  });

  it('safely updates existing AGENTS.md without erasing custom instructions', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-test-'));
    try {
      const agentsFile = path.join(tempDir, 'AGENTS.md');
      fs.writeFileSync(agentsFile, '# Custom Project Notes\n\n- Custom invariant 1\n');

      const config = getDefaultConfig('demo', 'web');
      setupAgentsMarkdown(tempDir, config, { silent: true });

      const updated = fs.readFileSync(agentsFile, 'utf-8');
      expect(updated).toContain('# Custom Project Notes');
      expect(updated).toContain('- Custom invariant 1');
      expect(updated).toContain('## Bootstrap & First Session');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('separates sections with blank lines while dropping inapplicable lines', () => {
    const config = getDefaultConfig('demo-cli', 'cli');
    const md = generateAgentsMarkdown(config);

    expect(md).toContain('# demo-cli\n\nAI-first cli project configured');
    expect(md).toContain('## Core Invariants\n- Keep changes small');
    expect(md).toContain('\n\n## Essential Commands');
    expect(md).toContain('\n\n## AI Capabilities & Skills');
    expect(md).toContain('\n\n## Bootstrap & First Session');
    expect(md).not.toContain('\n\n\n');
    expect(md.endsWith('\n')).toBe(true);
  });

  it('reports skills as disabled only when no source is configured', () => {
    const config = getDefaultConfig('demo-off', 'generic');
    config.skills.sources = [];
    const md = generateAgentsMarkdown(config);
    expect(md).toContain('Skills installation is disabled');
    expect(md).not.toContain('**Engineering**');
  });
});
