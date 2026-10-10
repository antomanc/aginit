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

  // A source with an empty skill list (or `*`) installs every skill it ships.
  const skillInstalled = (skill: string) =>
    config.skills.sources.some(
      (source) =>
        source.skills.length === 0 || source.skills.includes('*') || source.skills.includes(skill)
    );
  const mattSkills = (() => {
    const source = config.skills.sources.find((s) => s.package === 'mattpocock/skills');
    if (!source) return [];
    return source.skills.length ? source.skills : ['*'];
  })();
  const hasSkills = config.skills.sources.length > 0;

  const specSkillNames = ['to-spec', 'to-tickets', 'implement-spec'];
  let engineeringCapability = '';
  if (mattSkills.includes('*')) {
    engineeringCapability =
      '- **Engineering**: the full Matt Pocock skill set installed in `.agents/skills/` — start with `ask-matt` to route to the right one.';
  } else if (mattSkills.length) {
    const engineering = mattSkills.filter((skill) => !specSkillNames.includes(skill));
    if (engineering.length) {
      engineeringCapability = `- **Engineering**: ${engineering.map((skill) => '`' + skill + '`').join(', ')}`;
    }
  }

  let proseCapability = '';
  if (skillInstalled('humanizer')) {
    proseCapability =
      '- **Prose & Copy**: Use `humanizer` skill to eliminate AI writing tells and refine documentation.';
  }

  let simplicityCapability = '';
  if (skillInstalled('ponytail')) {
    simplicityCapability =
      '- **Simplicity**: Use `ponytail` skill for the smallest complete change and to cut over-engineering.';
  }

  let uiCapability = '';
  if (isWeb && skillInstalled('impeccable')) {
    uiCapability =
      '- **UI & Design**: Use `impeccable` skill for frontend polish, design critique, and token craft.';
  }

  let browserCapability = '';
  if (hasVisualAgent && skillInstalled('agent-browser')) {
    browserCapability =
      '- **Browser Verification**: Use `agent-browser` skill for interactive inspection and visual QA.';
  }

  let graftCapability = '';
  if (config.codebase.graft) {
    graftCapability =
      '- **Codebase Graph**: Use `graft ask "<query>" --source` or `graft map` for orientation before raw grep.';
  }

  const specCapability = skillInstalled('to-spec')
    ? '- **Spec & Tickets Workflow**: `to-spec`, `to-tickets`, `implement-spec`'
    : '';

  const sections: Array<string | undefined> = [
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
    devCommand || undefined,
    hasCommand('build') ? `- Build: \`${pmAdapter.runCmd('build')}\`` : undefined,
    hasCommand('typecheck') ? `- Typecheck: \`${pmAdapter.runCmd('typecheck')}\`` : undefined,
    hasCommand('test') ? `- Test: \`${pmAdapter.runCmd('test')}\`` : undefined,
    hasCommand('test:unit') ? `- Unit Test: \`${pmAdapter.runCmd('test:unit')}\`` : undefined,
    testE2E || undefined,
    '',
    '## AI Capabilities & Skills',
    hasSkills
      ? 'Configured skills install into `.agents/skills/` (shared by Antigravity and Codex):'
      : 'Skills installation is disabled in this configuration.',
    engineeringCapability || undefined,
    proseCapability || undefined,
    simplicityCapability || undefined,
    specCapability || undefined,
    uiCapability || undefined,
    browserCapability || undefined,
    graftCapability || undefined,
    '',
    '## Bootstrap & First Session',
    'When the user asks to "bootstrap this project" or kicks off a new initiative:',
    '1. Understand product intent and ask 2-3 essential questions to resolve ambiguity.',
    '2. Draft or refine canonical context in `PRODUCT.md` and `DESIGN.md` (or `docs/adr/`).',
    '3. Plan in small verifiable increments and implement test-first using installed skills.',
    ''
  ];

  // Conditional lines are `undefined` and dropped; `''` entries are the blank
  // separators between sections and must survive.
  return (
    sections
      .filter((s): s is string => s !== undefined)
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
