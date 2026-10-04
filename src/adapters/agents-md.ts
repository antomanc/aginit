import path from 'node:path';
import { fileExists, readTextFile, safeWriteFile } from '../utils/fs.js';
import { AIProjectConfig } from '../config/schema.js';
import { logger } from '../utils/logger.js';

export function generateAgentsMarkdown(config: AIProjectConfig): string {
  const isWeb = config.preset === 'web';
  const hasBrowser = isWeb && config.browser.playwright;
  const hasVisualAgent = isWeb && config.browser.visualAgent;

  let testE2E = '';
  if (hasBrowser) {
    testE2E = '- Test (E2E / Browser): `pnpm test:e2e`';
  }

  let uiCapability = '';
  if (isWeb) {
    uiCapability = '- **UI & Design**: Use `impeccable` skill for frontend polish, design critique, and token craft.';
  }

  let browserCapability = '';
  if (hasVisualAgent) {
    browserCapability = '- **Browser Verification**: Use `agent-browser` skill for interactive inspection and visual QA.';
  }

  let graftCapability = '';
  if (config.codebase.graft) {
    graftCapability = '- **Codebase Graph**: Use `graft ask "<query>" --source` or `graft map` for orientation before raw grep.';
  }

  const sections = [
    `# ${config.name}`,
    '',
    `AI-first ${config.preset} project bootstrapped with \`ai-project-bootstrap\`.`,
    '',
    '## Core Invariants',
    '- Keep changes small, focused, and test-verified.',
    '- Prefer native language & platform capabilities over heavy external frameworks.',
    '- Never commit broken builds, failed typechecks, or unverified changes.',
    '',
    '## Essential Commands',
    '- Package Manager: `pnpm`',
    '- Build: `pnpm build`',
    '- Typecheck: `pnpm typecheck`',
    '- Test: `pnpm test`',
    testE2E,
    '',
    '## AI Capabilities & Skills',
    'Installed skills live in `.agents/skills/` (shared by Antigravity and Codex):',
    '- **Engineering**: `tdd`, `code-review`, `diagnosing-bugs`',
    uiCapability,
    browserCapability,
    graftCapability,
    '',
    '## Bootstrap & First Session',
    'When the user asks to "bootstrap this project" or kicks off a new initiative:',
    '1. Understand product intent and ask 2-3 essential questions to resolve ambiguity.',
    '2. Draft or refine canonical context in `PRODUCT.md` and `DESIGN.md` (or `docs/adr/`).',
    '3. Plan in small verifiable increments and implement test-first using installed skills.',
    ''
  ];

  return sections.filter((s) => s !== '').join('\n').trim() + '\n';
}

export function setupAgentsMarkdown(
  targetDir: string,
  config: AIProjectConfig,
  options: { overwrite?: boolean; dryRun?: boolean; silent?: boolean } = {}
): boolean {
  const { overwrite = false, dryRun = false, silent = false } = options;
  const filePath = path.join(targetDir, 'AGENTS.md');

  if (fileExists(filePath) && !overwrite) {
    // File exists; check if it has the bootstrap guidance. If not, append it conservatively.
    const existing = readTextFile(filePath) || '';
    if (!existing.includes('## Bootstrap & First Session')) {
      const addition = [
        '',
        '## Bootstrap & First Session',
        'When the user asks to "bootstrap this project" or kicks off a new initiative:',
        '1. Understand product intent and ask 2-3 essential questions to resolve ambiguity.',
        '2. Draft or refine canonical context in `PRODUCT.md` and `DESIGN.md` (or `docs/adr/`).',
        '3. Plan in small verifiable increments and implement test-first using installed skills.',
        ''
      ].join('\n');
      safeWriteFile(filePath, existing.trimEnd() + '\n' + addition, {
        overwrite: true,
        dryRun,
        silent
      });
      if (!silent) logger.dim('Appended Bootstrap section to existing AGENTS.md');
      return true;
    }
    if (!silent) logger.dim('AGENTS.md already exists, preserving content.');
    return true;
  }

  const content = generateAgentsMarkdown(config);
  return safeWriteFile(filePath, content, { overwrite: true, dryRun, silent });
}
