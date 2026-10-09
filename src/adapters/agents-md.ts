import path from 'node:path';
import { fileExists, readTextFile, safeWriteFile } from '../utils/fs.js';
import { AginitConfig } from '../config/schema.js';
import { readPackageManifest } from '../config/validation.js';
import { logger } from '../utils/logger.js';
import { getPackageManagerAdapter } from './package-manager.js';

export function generateAgentsMarkdown(
  config: AginitConfig,
  scripts?: Record<string, string>
): string {
  const commands =
    scripts ??
    (config.preset === 'generic'
      ? { test: 'vitest run' }
      : { build: '', typecheck: '', test: '', dev: '', 'test:e2e': '' });
  const hasCommand = (name: string) => Object.hasOwn(commands, name);
  const isWeb = config.preset === 'web';
  const hasBrowser = isWeb && config.browser.playwright;
  const hasVisualAgent = isWeb && config.browser.visualAgent;
  const pm = config.packageManager || 'pnpm';
  const pmAdapter = getPackageManagerAdapter(pm);

  let devCommand = '';
  if (hasCommand('dev') && isWeb && config.framework && config.framework !== 'none') {
    devCommand = `- Dev Server: \`${pmAdapter.runCmd('dev')}\``;
  }

  let testE2E = '';
  if (hasBrowser && hasCommand('test:e2e')) {
    testE2E = `- Test (E2E / Browser): \`${pmAdapter.runCmd('test:e2e')}\``;
  }

  const selectedSkills = config.skills.sources.flatMap((source) => source.skills);
  const engineering = selectedSkills.filter((skill) =>
    ['tdd', 'code-review', 'diagnosing-bugs'].includes(skill)
  );
  let proseCapability = '';
  if (selectedSkills.includes('humanizer')) {
    proseCapability =
      '- **Prose & Copy**: Use `humanizer` skill to eliminate AI writing tells and refine documentation.';
  }

  let uiCapability = '';
  if (isWeb && selectedSkills.includes('impeccable')) {
    uiCapability =
      '- **UI & Design**: Use `impeccable` skill for frontend polish, design critique, and token craft.';
  }

  let browserCapability = '';
  if (hasVisualAgent && selectedSkills.includes('agent-browser')) {
    browserCapability =
      '- **Browser Verification**: Use `agent-browser` skill for interactive inspection and visual QA.';
  }

  let graftCapability = '';
  if (config.codebase.graft) {
    graftCapability =
      '- **Codebase Graph**: Use `graft ask "<query>" --source` or `graft map` for orientation before raw grep.';
  }

  let specWorkflow = '';
  if (config.skills.workflow === 'spec' && selectedSkills.includes('to-spec')) {
    specWorkflow = '- **Spec & Tickets Workflow**: `to-spec`, `to-tickets`, `implement-spec`';
  }

  const sections = [
    `# ${config.name}`,
    '',
    `AI-first ${config.preset} project configured with \`aginit\`.`,
    '',
    '## Core Invariants',
    '- Keep changes small, focused, and test-verified.',
    '- Prefer native language & platform capabilities over heavy external frameworks.',
    '- Never commit broken builds, failed typechecks, or unverified changes.',
    '',
    '## Essential Commands',
    `- Package Manager: \`${pm}\``,
    devCommand,
    hasCommand('build') ? `- Build: \`${pmAdapter.runCmd('build')}\`` : '',
    hasCommand('typecheck') ? `- Typecheck: \`${pmAdapter.runCmd('typecheck')}\`` : '',
    hasCommand('test') ? `- Test: \`${pmAdapter.runCmd('test')}\`` : '',
    hasCommand('test:unit') ? `- Unit Test: \`${pmAdapter.runCmd('test:unit')}\`` : '',
    testE2E,
    '',
    '## AI Capabilities & Skills',
    selectedSkills.length
      ? 'Configured skills install into `.agents/skills/` (shared by Antigravity and Codex):'
      : 'Skills installation is disabled in this configuration.',
    engineering.length
      ? `- **Engineering**: ${engineering.map((skill) => '\`' + skill + '\`').join(', ')}`
      : '',
    proseCapability,
    specWorkflow,
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

  return (
    sections
      .filter((s) => s !== '')
      .join('\n')
      .trim() + '\n'
  );
}

export function setupAgentsMarkdown(
  targetDir: string,
  config: AginitConfig,
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

  const content = generateAgentsMarkdown(config, readPackageManifest(targetDir)?.scripts);
  return safeWriteFile(filePath, content, { overwrite: true, dryRun, silent });
}
