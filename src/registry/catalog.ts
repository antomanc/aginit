import { CapabilityDescriptor, GuideContext } from './types.js';

/**
 * The stable skill set from mattpocock/skills installed by default:
 * every skill in the `engineering` and `productivity` categories.
 *
 * The `misc` (rarely used) and `in-progress` categories are deliberately
 * excluded. Re-evaluate when the upstream repository reshuffles categories
 * (`pnpm check:skills` reports drift).
 */
export const MATT_POCOCK_SKILLS = [
  // engineering
  'ask-matt',
  'code-review',
  'codebase-design',
  'diagnosing-bugs',
  'domain-modeling',
  'grill-with-docs',
  'implement',
  'implement-spec',
  'improve-codebase-architecture',
  'pr',
  'prototype',
  'research',
  'retro',
  'setup-matt-pocock-skills',
  'tdd',
  'to-spec',
  'to-tickets',
  'triage',
  'wayfinder',
  'wizard',
  // productivity
  'grill-me',
  'grilling',
  'handoff',
  'teach',
  'to-questionnaire',
  'wait-what',
  'writing-for-agents'
] as const;

export const SUPERPOWERS_SKILLS = [
  'brainstorming',
  'dispatching-parallel-agents',
  'executing-plans',
  'finishing-a-development-branch',
  'receiving-code-review',
  'requesting-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-git-worktrees',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
  'writing-skills'
] as const;

const UI_PLATFORMS = ['web', 'mobile-native', 'mobile-rn'] as const;
const MOBILE_PLATFORMS = ['mobile-native', 'mobile-rn'] as const;

const code = (command: string | undefined, fallback: string) => '`' + (command ?? fallback) + '`';
const isMobile = (ctx: GuideContext) => ctx.platform === 'mobile-native' || ctx.platform === 'mobile-rn';
const uiDriverName = (ctx: GuideContext) =>
  ctx.has('agent-device') ? 'agent-device' : ctx.has('agent-browser') ? 'agent-browser' : null;

export const CATALOG: CapabilityDescriptor[] = [
  // ── Codebase graph ────────────────────────────────────────────────────────
  {
    id: 'graft',
    name: 'Graft',
    description: 'Codebase context graph: graft map / ask --source / skeleton / callers',
    category: 'codebase-graph',
    author: 'NanoNets / Trail (graft contributors)',
    repoUrl: 'https://github.com/trailhq/Trail-Code',
    license: 'MIT',
    supportedPlatforms: ['all'],
    requiresNodeInProjectRoot: false,
    default: true,
    install: [
      { kind: 'binary', bin: 'graft', install: 'npm install -g @nanonets/graft' },
      { kind: 'setup', setup: 'graft' }
    ],
    doctor: [{ kind: 'file', path: 'graft/INDEX.md', fix: 'graft build' }],
    routing: {
      task: 'Codebase exploration & impact analysis',
      read: '`graft ask "<query>" --source` / `graft skeleton <file>` (see the Graft section)'
    },
    rebuttals: [
      {
        excuse: "I'll grep/read the whole folder to understand the module.",
        rule: 'Forbidden. Query `graft ask "<query>" --source` or `graft callers <symbol>` first to save context tokens.'
      }
    ]
  },

  // ── Methodology (exactly one) ─────────────────────────────────────────────
  {
    id: 'pocock',
    name: 'Matt Pocock skills',
    description: 'tdd, grill-me, to-spec, to-tickets, implement-spec, code-review, diagnosing-bugs, ...',
    category: 'methodology',
    author: 'Matt Pocock',
    repoUrl: 'https://github.com/mattpocock/skills',
    license: 'MIT',
    supportedPlatforms: ['all'],
    requiresNodeInProjectRoot: false,
    default: true,
    install: [{ kind: 'skills-sh', repo: 'mattpocock/skills', skills: [...MATT_POCOCK_SKILLS] }],
    guide: {
      doc: 'workflows',
      render: () =>
        [
          '## Methodology: Matt Pocock skills',
          'Not sure which skill fits? Start with `ask-matt`; it routes to the right one.',
          '',
          '| Phase | Skills |',
          '| --- | --- |',
          '| Clarify intent | `grill-me`, `grill-with-docs`, `wait-what` |',
          '| Specify & plan | `to-spec`, `to-tickets`, `domain-modeling`, `codebase-design` |',
          '| Build | `tdd`, `implement`, `implement-spec`, `prototype` |',
          '| Debug | `diagnosing-bugs`, `triage` |',
          '| Review & ship | `code-review`, `pr`, `retro`, `handoff` |'
        ].join('\n')
    }
  },
  {
    id: 'superpowers',
    name: 'Superpowers',
    description: 'Socratic brainstorming, plan/execute loops, subagent review, git worktree workflow',
    category: 'methodology',
    author: 'Jesse Vincent (obra)',
    repoUrl: 'https://github.com/obra/superpowers',
    license: 'MIT',
    supportedPlatforms: ['all'],
    requiresNodeInProjectRoot: false,
    install: [{ kind: 'skills-sh', repo: 'obra/superpowers', skills: [...SUPERPOWERS_SKILLS] }],
    guide: {
      doc: 'workflows',
      render: () =>
        [
          '## Methodology: Superpowers',
          'Start every task with `using-superpowers`; it decides which skill applies.',
          '',
          '| Phase | Skills |',
          '| --- | --- |',
          '| Clarify intent | `brainstorming` |',
          '| Plan | `writing-plans`, `using-git-worktrees` |',
          '| Build | `test-driven-development`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents` |',
          '| Debug | `systematic-debugging` |',
          '| Review & ship | `requesting-code-review`, `receiving-code-review`, `verification-before-completion`, `finishing-a-development-branch` |'
        ].join('\n')
    }
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Discipline core only (ponytail, karpathy-guidelines, rebuttals); no slash-command suite',
    category: 'methodology',
    author: 'aginit',
    repoUrl: 'https://github.com/antomanc/aginit',
    license: 'MIT',
    supportedPlatforms: ['all'],
    requiresNodeInProjectRoot: false,
    install: [],
    guide: {
      doc: 'workflows',
      render: () =>
        [
          '## Methodology: minimal',
          'No workflow suite is installed. Plan in small verifiable steps, write the failing test first,',
          'and lean on the discipline skills below.'
        ].join('\n')
    }
  },

  // ── Discipline (default core) ─────────────────────────────────────────────
  {
    id: 'ponytail',
    name: 'ponytail',
    description: 'Smallest complete change; cuts over-engineering',
    category: 'discipline',
    author: 'Dietrich Gebert',
    repoUrl: 'https://github.com/DietrichGebert/ponytail',
    license: 'MIT',
    supportedPlatforms: ['all'],
    requiresNodeInProjectRoot: false,
    default: true,
    install: [{ kind: 'skills-sh', repo: 'dietrichgebert/ponytail', skills: ['ponytail'] }],
    routing: { task: 'Scoping or simplifying a change', read: '`ponytail` skill' }
  },
  {
    id: 'karpathy-guidelines',
    name: 'Karpathy guidelines',
    description: 'Think before coding, simplicity first, surgical changes, goal-driven execution',
    category: 'discipline',
    author: 'Jiayuan Zhang (forrestchang)',
    repoUrl: 'https://github.com/multica-ai/andrej-karpathy-skills',
    license: 'MIT (declared in SKILL.md)',
    supportedPlatforms: ['all'],
    requiresNodeInProjectRoot: false,
    default: true,
    install: [
      {
        kind: 'skills-sh',
        repo: 'multica-ai/andrej-karpathy-skills',
        skills: ['karpathy-guidelines']
      }
    ]
  },
  {
    id: 'humanizer',
    name: 'humanizer',
    description: 'Strips AI writing tells from docs and copy',
    category: 'discipline',
    author: 'Siqi Chen (blader)',
    repoUrl: 'https://github.com/blader/humanizer',
    license: 'MIT',
    supportedPlatforms: ['all'],
    requiresNodeInProjectRoot: false,
    default: true,
    install: [{ kind: 'skills-sh', repo: 'blader/humanizer', skills: ['humanizer'] }],
    routing: { task: 'Prose & Copy (docs, README, UI text)', read: '`humanizer` skill' }
  },

  // ── Design ────────────────────────────────────────────────────────────────
  {
    id: 'impeccable',
    name: 'Impeccable',
    description: 'Design language & anti-slop review: PRODUCT.md, DESIGN.md, /impeccable commands',
    category: 'design',
    author: 'Paul Bakaus',
    repoUrl: 'https://github.com/pbakaus/impeccable',
    license: 'Apache-2.0',
    supportedPlatforms: [...UI_PLATFORMS],
    requiresNodeInProjectRoot: false,
    default: true,
    install: [{ kind: 'skills-sh', repo: 'pbakaus/impeccable', skills: ['impeccable'] }],
    routing: {
      task: 'UI/UX design system, anti-slop review',
      read: '`DESIGN.md` + `.agents/skills/impeccable`'
    },
    guide: {
      doc: 'ui-verification',
      render: (ctx) => {
        const driver = uiDriverName(ctx);
        return [
          '## Design review with Impeccable',
          '- No `PRODUCT.md` yet? Run `/impeccable init`: it interviews you and records the product and',
          `  platform${isMobile(ctx) ? ' (`ios`, `android` or `adaptive`, which loads its native-platform references)' : ''}.`,
          '- No `DESIGN.md`? Run `/impeccable document` to derive it from the existing code.',
          `- Before shipping UI: \`/impeccable audit <screen>\`, fix the findings, then \`/impeccable polish <screen>\`.`,
          driver
            ? `- Give both commands evidence: a snapshot and screenshot of the screen taken with ${driver} (loop above).`
            : '- Give both commands evidence: a screenshot of the running UI.',
          isMobile(ctx)
            ? '- Native checklist: 44pt/48dp touch targets, safe areas, platform navigation patterns, Dynamic Type / font scaling.'
            : undefined
        ]
          .filter((line): line is string => line !== undefined)
          .join('\n');
      }
    }
  },

  // ── UI drivers ────────────────────────────────────────────────────────────
  {
    id: 'agent-browser',
    name: 'agent-browser',
    description: 'Browser automation CLI over accessibility-tree snapshots (@e1 refs)',
    category: 'ui-driver',
    author: 'Vercel Labs',
    repoUrl: 'https://github.com/vercel-labs/agent-browser',
    license: 'Apache-2.0',
    supportedPlatforms: ['web'],
    requiresNodeInProjectRoot: false,
    default: true,
    install: [
      { kind: 'skills-sh', repo: 'vercel-labs/agent-browser', skills: ['agent-browser'] },
      { kind: 'binary', bin: 'agent-browser', install: 'npm i -g agent-browser && agent-browser install' },
      { kind: 'setup', setup: 'agent-browser' }
    ],
    rebuttals: [
      {
        excuse: "It's a small UI tweak, visual verification isn't needed.",
        rule: 'Forbidden. Run agent-browser, inspect the snapshot/screenshot, and confirm zero console/runtime errors (`agent-browser errors`).'
      }
    ],
    guide: {
      doc: 'ui-verification',
      render: (ctx) =>
        [
          '## Web: agent-browser loop',
          `Start the app (${code(ctx.commands.dev, 'your dev server')}), then:`,
          '```bash',
          'agent-browser open http://localhost:3000   # your dev URL',
          'agent-browser snapshot -i                  # interactive elements as @e refs',
          'agent-browser click @e2                    # act on a ref from the snapshot',
          'agent-browser fill @e3 "test@example.com"',
          'agent-browser snapshot -i                  # verify the new state',
          'agent-browser errors && agent-browser console   # must be clean',
          'agent-browser screenshot ui.png',
          'agent-browser close',
          '```',
          'Exploratory QA: `agent-browser skills get dogfood` loads the dogfood bug-bash workflow.'
        ].join('\n')
    }
  },
  {
    id: 'agent-device',
    name: 'agent-device',
    description: 'iOS Simulator / Android Emulator automation over the native accessibility tree',
    category: 'ui-driver',
    author: 'Callstack',
    repoUrl: 'https://github.com/callstack/agent-device',
    license: 'MIT',
    supportedPlatforms: [...MOBILE_PLATFORMS],
    requiresNodeInProjectRoot: false,
    default: true,
    install: [
      { kind: 'skills-sh', repo: 'callstack/agent-device', skills: ['agent-device'] },
      { kind: 'binary', bin: 'agent-device', install: 'npm install -g agent-device@latest' }
    ],
    rebuttals: [
      {
        excuse: "It's a small UI tweak, visual verification isn't needed.",
        rule: 'Forbidden. Run agent-device on the simulator/emulator, inspect the snapshot/screenshot, and confirm no runtime errors.'
      }
    ],
    guide: {
      doc: 'ui-verification',
      render: () =>
        [
          '## Mobile: agent-device loop',
          'Boot a simulator/emulator and install a debug build first (`agent-device doctor` checks the setup).',
          '```bash',
          'agent-device open <bundle-or-package-id> --platform ios   # or --platform android',
          'agent-device snapshot -i                # interactive elements as @e refs',
          'agent-device press @e2 --settle         # act, then read the printed diff',
          'agent-device fill @e7 "Ada" --settle',
          'agent-device screenshot ./screen.png',
          'agent-device close',
          '```',
          'Save a flow that works as an `.ad` replay script for CI: `agent-device help workflow` links the replay guide.'
        ].join('\n')
    }
  },
  {
    id: 'chrome-devtools-mcp',
    name: 'Chrome DevTools MCP',
    description: 'Deep web debugging: network waterfall, performance traces, memory heap',
    category: 'ui-driver',
    author: 'Google Chrome DevTools team',
    repoUrl: 'https://github.com/ChromeDevTools/chrome-devtools-mcp',
    license: 'Apache-2.0',
    supportedPlatforms: ['web'],
    requiresNodeInProjectRoot: false,
    addon: true,
    install: [
      { kind: 'skills-sh', repo: 'ChromeDevTools/chrome-devtools-mcp', skills: ['chrome-devtools'] }
    ],
    guide: {
      doc: 'ui-verification',
      render: () =>
        [
          '## Deep debugging: Chrome DevTools MCP',
          'For network, performance traces and memory leaks, use the `chrome-devtools` skill. It needs the MCP',
          'server registered once in your agent, e.g. `claude mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest`.'
        ].join('\n')
    }
  },
  {
    id: 'browserskill',
    name: 'BrowserSkill',
    description: "Drives the user's real, logged-in Chrome for OAuth/2FA flows",
    category: 'ui-driver',
    author: 'Tencent',
    repoUrl: 'https://github.com/Tencent/BrowserSkill',
    license: 'MIT',
    supportedPlatforms: ['web'],
    requiresNodeInProjectRoot: false,
    addon: true,
    install: [
      { kind: 'skills-sh', repo: 'Tencent/BrowserSkill', skills: ['browser-skill'] },
      {
        kind: 'binary',
        bin: 'bsk',
        install:
          'curl -fsSL https://raw.githubusercontent.com/Tencent/BrowserSkill/main/install.sh | sh (plus the browser extension)'
      }
    ],
    guide: {
      doc: 'ui-verification',
      render: () =>
        [
          '## Authenticated flows: BrowserSkill',
          "When a flow needs a real login (OAuth, 2FA), use the `browser-skill` skill: it borrows the user's Chrome",
          'session through `bsk` instead of automating credentials. Check `bsk status` first.'
        ].join('\n')
    }
  },

  // ── Testing engines ───────────────────────────────────────────────────────
  {
    id: 'vitest',
    name: 'Vitest',
    description: 'Unit tests for TypeScript/JavaScript projects',
    category: 'testing-engine',
    author: 'Vitest team',
    repoUrl: 'https://github.com/vitest-dev/vitest',
    license: 'MIT',
    supportedPlatforms: ['web', 'cli', 'backend', 'mobile-rn'],
    requiresNodeInProjectRoot: true,
    install: [],
    guide: {
      doc: 'testing',
      render: (ctx) =>
        [
          '## Unit tests: Vitest',
          `- Run: ${code(ctx.commands.unitTest ?? ctx.commands.test, 'vitest run')}`,
          '- Tests live next to the code they cover or in `tests/`, named `*.test.ts`.',
          '- Write the failing test first, then the code. Mock only process boundaries (network, shell, clock).'
        ].join('\n')
    }
  },
  {
    id: 'native',
    name: 'Native test runner',
    description: "Delegates tests to the host toolchain (flutter test, gradlew test, swift test, cargo test, pytest, ...)",
    category: 'testing-engine',
    author: 'aginit',
    repoUrl: 'https://github.com/antomanc/aginit',
    license: 'MIT',
    supportedPlatforms: ['all'],
    requiresNodeInProjectRoot: false,
    install: [],
    guide: {
      doc: 'testing',
      render: (ctx) =>
        [
          `## Unit & integration tests: ${ctx.stack} toolchain`,
          `- Run: ${code(ctx.commands.test, 'the project test command')}`,
          ctx.commands.lint ? `- Static checks: \`${ctx.commands.lint}\`` : undefined,
          '- Write the failing test first, then the code. Keep tests next to the module they cover, following the toolchain convention.'
        ]
          .filter((line): line is string => line !== undefined)
          .join('\n')
    }
  },

  {
    id: 'playwright',
    name: 'Playwright',
    description: 'Deterministic browser end-to-end tests',
    category: 'testing-engine',
    author: 'Microsoft Corporation',
    repoUrl: 'https://github.com/microsoft/playwright',
    license: 'Apache-2.0',
    supportedPlatforms: ['web'],
    requiresNodeInProjectRoot: true,
    install: [],
    guide: {
      doc: 'testing',
      render: (ctx) =>
        [
          '## Browser E2E: Playwright',
          `- Run: ${code(ctx.commands.e2e, 'playwright test')} (specs in \`e2e/\`, config in \`playwright.config.ts\`).`,
          '- Replace the skipped starter spec with a real flow as soon as the first screen exists.'
        ].join('\n')
    }
  },
  {
    id: 'e2e',
    name: 'e2e',
    description: 'Natural-language + assertion E2E tests for web and mobile with a zero-cost replay cache',
    category: 'testing-engine',
    author: 'TesterArmy',
    repoUrl: 'https://github.com/tester-army/e2e',
    license: 'Apache-2.0',
    supportedPlatforms: ['all'],
    requiresNodeInProjectRoot: false,
    install: [
      { kind: 'skills-sh', repo: 'tester-army/e2e', skills: ['e2e'], optional: true },
      { kind: 'setup', setup: 'e2e' }
    ],
    rebuttals: [
      {
        excuse: 'Unit tests pass, so the feature works.',
        rule: 'Insufficient. Unit tests do not verify wiring or rendering. Run or update the e2e flow before marking complete.'
      }
    ],
    guide: {
      doc: 'testing',
      render: (ctx) => {
        const dir = ctx.e2eDir;
        const prefix = dir ? `cd ${dir} && ` : '';
        const docs = `${dir ? dir + '/' : ''}node_modules/e2e/docs`;
        return [
          '## E2E: tester-army/e2e',
          dir
            ? `This project is not a Node project, so e2e lives in its own workspace, \`${dir}/\`; the project root has no \`package.json\`.`
            : 'e2e is configured at the project root (`e2e.config.ts`, tests in `tests/*.e2e.ts`).',
          `- Install once: \`${prefix}npm install\``,
          `- Run: \`${prefix}npx e2e run\` against ${isMobile(ctx) ? 'a booted simulator/emulator with the app installed' : 'the running dev server'}.`,
          `- Before writing a test, read the offline docs in \`${docs}\` (\`core-concepts.mdx\`, \`agent-steps.mdx\`, \`cache.mdx\`) rather than guessing the API.`,
          '- Tests mix `agent.act()` / `agent.assert()` steps with ordinary `expect` assertions. An agent step that a later',
          '  assertion verifies is recorded in `.e2e/cache/`, and later runs replay it with no model calls until the UI changes.',
          `- Set a model for agent steps in \`${dir ? dir + '/' : ''}e2e.config.ts\`; tests without agent steps need no model.`
        ].join('\n');
      }
    }
  },
  // ── Context guards (add-ons) ──────────────────────────────────────────────
  {
    id: 'context-mode',
    name: 'context-mode',
    description: 'Sandboxes large tool output (test/build logs) so it stays out of the context window',
    category: 'context-guard',
    author: 'Mert Köseoğlu (mksglu)',
    repoUrl: 'https://github.com/mksglu/context-mode',
    license: 'Elastic-2.0 (source-available)',
    supportedPlatforms: ['all'],
    requiresNodeInProjectRoot: false,
    addon: true,
    install: [
      { kind: 'skills-sh', repo: 'mksglu/context-mode', skills: ['context-mode'] },
      { kind: 'binary', bin: 'context-mode', install: 'npm install -g context-mode' }
    ],
    guide: {
      doc: 'workflows',
      render: () =>
        [
          '## Context guard: context-mode',
          'Run long builds and test suites through context-mode so only the summary enters your context',
          '(`context-mode` skill). Register its MCP server once: `claude mcp add context-mode -- npx -y context-mode`.'
        ].join('\n')
    }
  },
  {
    id: 'worktrunk',
    name: 'Worktrunk',
    description: 'Git worktree manager for parallel agents (wt)',
    category: 'context-guard',
    author: 'Maximilian Roos (max-sixty)',
    repoUrl: 'https://github.com/max-sixty/worktrunk',
    license: 'MIT OR Apache-2.0',
    supportedPlatforms: ['all'],
    requiresNodeInProjectRoot: false,
    addon: true,
    install: [
      { kind: 'skills-sh', repo: 'max-sixty/worktrunk', skills: ['worktrunk'] },
      {
        kind: 'binary',
        bin: 'wt',
        install: 'brew install worktrunk (or cargo install worktrunk) && wt config shell install'
      }
    ],
    guide: {
      doc: 'workflows',
      render: () =>
        [
          '## Parallel agents: Worktrunk',
          'Give each parallel agent its own worktree: `wt switch --create <branch>`, merge back with `wt merge`',
          '(`worktrunk` skill).'
        ].join('\n')
    }
  }
];
