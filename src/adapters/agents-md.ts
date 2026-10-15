import path from 'node:path';
import { fileExists, readTextFile, safeWriteFile } from '../utils/fs.js';
import { AginitConfig } from '../config/schema.js';
import { readPackageManifest } from '../config/validation.js';
import { logger } from '../utils/logger.js';
import { CapabilityDescriptor, isNodeStack, MicroDoc } from '../registry/index.js';
import {
  microDocPath,
  plannedMicroDocs,
  projectProfile,
  ProjectProfile,
  resolvePlatformStack
} from './agent-docs.js';

const PLATFORM_LABELS: Record<string, string> = {
  web: 'Web',
  'mobile-native': 'Native mobile',
  'mobile-rn': 'React Native',
  backend: 'Backend',
  cli: 'CLI'
};

export const AGINIT_BLOCK_START = '<!-- aginit:start -->';
export const AGINIT_BLOCK_END = '<!-- aginit:end -->';

const BOOTSTRAP_SECTION = [
  '## Bootstrap & First Session',
  'When the user asks to "bootstrap this project" or kicks off a new initiative:',
  '1. Understand product intent and ask 2-3 essential questions to resolve ambiguity.',
  '2. Draft or refine canonical context in `PRODUCT.md` and `DESIGN.md` (or `docs/adr/`).',
  '3. Plan in small verifiable increments and implement test-first using installed skills.'
];

/** Placeholder scripts used when AGENTS.md is rendered without a package.json to read. */
function presetScripts(config: AginitConfig): Record<string, string> {
  return config.preset === 'generic'
    ? { test: 'vitest run' }
    : { build: '', typecheck: '', test: '', dev: '', 'test:e2e': '' };
}

const table = (head: [string, string], rows: Array<[string, string]>) => [
  `| ${head[0]} | ${head[1]} |`,
  '| --- | --- |',
  ...rows.map(([a, b]) => `| ${a} | ${b} |`)
];

/**
 * The part of AGENTS.md aginit keeps in sync with the active capabilities:
 * guardrails, the Task Routing table and the Anti-Rationalization table.
 */
export function renderAgentsBlock(
  config: AginitConfig,
  profile: ProjectProfile,
  docs: MicroDoc[] = plannedMicroDocs(profile)
): string {
  const hasSkills = config.skills.sources.length > 0;
  const routing: Array<[string, string]> = [
    ['Product intent, scope, target users', '`PRODUCT.md`']
  ];
  const order = ['design', 'codebase-graph'];
  const rank = (c: CapabilityDescriptor) => (order.indexOf(c.category) + order.length + 1) % (order.length + 1);
  const direct = profile.active.filter((c) => c.routing).sort((a, b) => rank(a) - rank(b));
  const routeOf = (c: CapabilityDescriptor): [string, string] => [c.routing!.task, c.routing!.read];
  // Design and codebase rows lead, discipline rows follow the micro-docs.
  routing.push(...direct.filter((c) => c.category !== 'discipline').map(routeOf));
  if (docs.includes('testing'))
    routing.push(['Automated unit & E2E testing', '`' + microDocPath('testing') + '`']);
  if (docs.includes('ui-verification'))
    routing.push(['Live UI verification (Web / Mobile)', '`' + microDocPath('ui-verification') + '`']);
  if (docs.includes('workflows'))
    routing.push(['Engineering workflow & skills', '`' + microDocPath('workflows') + '`']);
  routing.push(...direct.filter((c) => c.category === 'discipline').map(routeOf));

  const rebuttals = new Map<string, string>();
  for (const capability of profile.active)
    for (const { excuse, rule } of capability.rebuttals ?? [])
      if (!rebuttals.has(excuse)) rebuttals.set(excuse, rule);
  const unitExcuse = 'Unit tests pass, so the feature works.';
  if (!rebuttals.has(unitExcuse) && profile.active.some((c) => c.category === 'testing-engine'))
    rebuttals.set(
      unitExcuse,
      'Insufficient. Unit tests do not verify wiring or rendering. Exercise the feature end to end ' +
        `(${profile.commands.e2e && profile.has('playwright') ? '`' + profile.commands.e2e + '`' : 'integration or smoke run'}) before marking complete.`
    );

  const lines = [
    AGINIT_BLOCK_START,
    ...(profile.has('karpathy-guidelines')
      ? [
          '## Guardrails (karpathy-guidelines)',
          '- **Think before coding**: state assumptions and trade-offs; ask instead of guessing.',
          '- **Simplicity first**: minimum code that solves the problem; no speculative features or abstractions.',
          '- **Surgical changes**: touch only what the task needs; no silent scope creep or drive-by refactors.',
          '- **Goal-driven execution**: define a verifiable success check first, then loop until it passes.',
          ''
        ]
      : []),
    '## Task Routing',
    hasSkills
      ? config.agents.claudeCode === false
        ? 'Load only what the task needs. Skills live in `.agents/skills/`.'
        : 'Load only what the task needs. Skills live in `.agents/skills/` (linked into `.claude/skills/` for Claude Code).'
      : 'Load only what the task needs. Skills installation is disabled in this configuration.',
    '',
    ...table(['Task', 'Read / Use'], routing),
    ...(rebuttals.size
      ? ['', '## Anti-Rationalization', ...table(['Excuse', 'Rule'], [...rebuttals].map(([e, r]) => [`"${e}"`, r]))]
      : []),
    AGINIT_BLOCK_END
  ];
  return lines.join('\n');
}

export function generateAgentsMarkdown(
  config: AginitConfig,
  scripts?: Record<string, string>,
  targetDir?: string
): string {
  const resolved = resolvePlatformStack(config, targetDir);
  const node = isNodeStack(resolved.stack);
  const profile = projectProfile(config, {
    targetDir,
    scripts: node ? (scripts ?? presetScripts(config)) : undefined
  });
  const { commands } = profile;
  const pm = config.packageManager || 'pnpm';
  const isWeb = profile.platform === 'web';
  const commandLines = [
    node ? `- Package Manager: \`${pm}\`` : undefined,
    commands.dev && isWeb && config.framework && config.framework !== 'none'
      ? `- Dev Server: \`${commands.dev}\``
      : undefined,
    commands.build ? `- Build: \`${commands.build}\`` : undefined,
    commands.typecheck ? `- Typecheck: \`${commands.typecheck}\`` : undefined,
    commands.lint ? `- Lint: \`${commands.lint}\`` : undefined,
    commands.test ? `- Test: \`${commands.test}\`` : undefined,
    commands.unitTest ? `- Unit Test: \`${commands.unitTest}\`` : undefined,
    commands.e2e && profile.has('playwright')
      ? `- Test (E2E / Browser): \`${commands.e2e}\``
      : undefined
  ].filter((line): line is string => line !== undefined);

  const sections: string[] = [
    `# ${config.name}`,
    '',
    `AI-first ${config.preset} project configured with \`aginit\` (${PLATFORM_LABELS[profile.platform]}, ${profile.stack}).`,
    '',
    '## Core Invariants',
    '- Keep changes small, focused, and test-verified.',
    '- Prefer native language & platform capabilities over heavy external frameworks.',
    '- Never commit broken builds, failed typechecks, or unverified changes.',
    '',
    '## Essential Commands',
    ...(commandLines.length ? commandLines : ['- Add the build and test commands here once they exist.']),
    '',
    renderAgentsBlock(config, profile),
    '',
    ...BOOTSTRAP_SECTION,
    ''
  ];
  return sections.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** Insert or refresh the aginit block in an existing AGENTS.md, leaving everything else as written. */
export function mergeAgentsBlock(existing: string, block: string): string {
  const start = existing.indexOf(AGINIT_BLOCK_START);
  const end = existing.indexOf(AGINIT_BLOCK_END);
  if (start !== -1 && end > start)
    return existing.slice(0, start) + block + existing.slice(end + AGINIT_BLOCK_END.length);
  // Above Graft's block when there is one, so Graft keeps owning the end of the file.
  const graft = existing.indexOf('<!-- graft:start -->');
  if (graft !== -1)
    return existing.slice(0, graft).trimEnd() + '\n\n' + block + '\n\n' + existing.slice(graft);
  return existing.trimEnd() + '\n\n' + block + '\n';
}

export function setupAgentsMarkdown(
  targetDir: string,
  config: AginitConfig,
  options: { overwrite?: boolean; dryRun?: boolean; silent?: boolean; docs?: MicroDoc[] } = {}
): boolean {
  const { overwrite = false, dryRun = false, silent = false } = options;
  const filePath = path.join(targetDir, 'AGENTS.md');

  if (fileExists(filePath) && !overwrite) {
    const existing = readTextFile(filePath) || '';
    const scripts = readPackageManifest(targetDir)?.scripts;
    const profile = projectProfile(config, { targetDir, scripts });
    let updated = mergeAgentsBlock(existing, renderAgentsBlock(config, profile, options.docs));
    if (!updated.includes('## Bootstrap & First Session'))
      updated = updated.trimEnd() + '\n\n' + BOOTSTRAP_SECTION.join('\n') + '\n';
    if (updated === existing) {
      if (!silent) logger.dim('AGENTS.md is up to date, preserving content.');
      return true;
    }
    if (!silent) logger.dim('Refreshed the aginit section of the existing AGENTS.md');
    return safeWriteFile(filePath, updated, { overwrite: true, dryRun, silent });
  }

  const content = generateAgentsMarkdown(config, readPackageManifest(targetDir)?.scripts, targetDir);
  return safeWriteFile(filePath, content, { overwrite: true, dryRun, silent });
}

export const CLAUDE_AGENTS_IMPORT = '@AGENTS.md';

/**
 * Point Claude Code at AGENTS.md through a one-line `@AGENTS.md` import. Recent
 * Claude Code reads AGENTS.md on its own, but only without a CLAUDE.md and not
 * in every session; the import works everywhere and never loads it twice.
 * An existing CLAUDE.md is left alone (doctor reports a missing import).
 */
export function setupClaudeMarkdown(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): boolean {
  const { dryRun = false, silent = false } = options;
  const filePath = path.join(targetDir, 'CLAUDE.md');
  if (fileExists(filePath)) {
    if (!silent) logger.dim('CLAUDE.md already exists, preserving content.');
    return true;
  }
  return safeWriteFile(filePath, CLAUDE_AGENTS_IMPORT + '\n', { overwrite: false, dryRun, silent });
}

export function claudeMarkdownImportsAgents(content: string): boolean {
  return content
    .split(/\r?\n/)
    .some((line) => ['@AGENTS.md', '@./AGENTS.md'].includes(line.trim()));
}
