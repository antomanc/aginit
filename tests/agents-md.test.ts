import { describe, it, expect } from 'vitest';
import { generateAgentsMarkdown, setupAgentsMarkdown } from '../src/adapters/agents-md.js';
import { getDefaultConfig } from '../src/config/defaults.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('AGENTS.md generation & safety', () => {
  it('generates concise AGENTS.md with web capabilities', () => {
    const config = getDefaultConfig('demo-web', 'web');
    const md = generateAgentsMarkdown(config);

    expect(md).toContain('# demo-web');
    expect(md).toContain('## Core Invariants');
    expect(md).toContain('## Essential Commands');
    expect(md).toContain('pnpm test:e2e');
    expect(md).toContain('impeccable');
    expect(md).toContain('agent-browser');
    expect(md).toContain('## Bootstrap & First Session');
    expect(md).toContain('bootstrap this project');
  });

  it('generates concise AGENTS.md for cli preset without browser references', () => {
    const config = getDefaultConfig('demo-cli', 'cli');
    const md = generateAgentsMarkdown(config);

    expect(md).toContain('# demo-cli');
    expect(md).not.toContain('pnpm test:e2e');
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
});
