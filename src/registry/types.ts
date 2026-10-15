export type Platform = 'web' | 'mobile-native' | 'mobile-rn' | 'backend' | 'cli';
export type Stack =
  | 'node'
  | 'react-native'
  | 'flutter'
  | 'swift'
  | 'kotlin'
  | 'rust'
  | 'python'
  | 'go'
  | 'unknown';

export type CapabilityCategory =
  | 'methodology' // pocock, superpowers, minimal
  | 'discipline' // ponytail, karpathy-guidelines, humanizer
  | 'design' // impeccable
  | 'codebase-graph' // graft
  | 'ui-driver' // agent-browser, agent-device, chrome-devtools-mcp, browserskill
  | 'testing-engine' // e2e, playwright, vitest, native
  | 'context-guard' // context-mode, worktrunk
  | 'custom'; // user-defined via customCapabilities / --add-skill

/** The micro-docs aginit generates under docs/agents/. */
export type MicroDoc = 'testing' | 'ui-verification' | 'workflows';

export type InstallStep =
  /** `npx skills add <repo> --skill <skills...>` into .agents/skills/ (empty list = every skill). */
  | { kind: 'skills-sh'; repo: string; skills: string[] }
  /** A CLI the capability drives. aginit checks it and prints `install`; it never installs it globally. */
  | { kind: 'binary'; bin: string; install: string }
  /** Upstream setup that needs code (see src/registry/setup.ts). */
  | { kind: 'setup'; setup: SetupId };

/**
 * Setups that run an upstream init command. vitest and playwright have none:
 * the presets add them to package.json when they are active.
 */
export type SetupId = 'graft' | 'agent-browser' | 'e2e';

export type DoctorCheck =
  | { kind: 'file'; path: string; fix: string }
  | { kind: 'command'; bin: string; args: string[]; fix: string };

/** What a generated doc needs to know about the project. */
export interface GuideContext {
  platform: Platform;
  stack: Stack;
  /** Whether a capability is active. */
  has(id: string): boolean;
  /** The project's own commands (package scripts or the stack's host toolchain). */
  commands: ProjectCommands;
  /** Directory that holds the e2e workspace ('' for the project root). */
  e2eDir: string;
}

export interface ProjectCommands {
  build?: string;
  typecheck?: string;
  lint?: string;
  test?: string;
  unitTest?: string;
  e2e?: string;
  dev?: string;
}

export interface CapabilityDescriptor {
  id: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  author: string;
  repoUrl: string;
  license: string;
  supportedPlatforms: Array<Platform | 'all'>;
  /** Needs a package.json at the project root (vitest, playwright). */
  requiresNodeInProjectRoot: boolean;
  /** Enabled by default on supported platforms (exclusive categories pick one default). */
  default?: boolean;
  /** Optional extra: selected through --addons, never replaced by a category flag. */
  addon?: boolean;
  install: InstallStep[];
  /** Checks beyond the ones derived from `install` (skill files, binaries). */
  doctor?: DoctorCheck[];
  /** A direct row in the AGENTS.md Task Routing table. */
  routing?: { task: string; read: string };
  /** Pre-refuted shortcuts for the AGENTS.md Anti-Rationalization table. */
  rebuttals?: Array<{ excuse: string; rule: string }>;
  /** Section contributed to a docs/agents/ micro-doc. */
  guide?: { doc: MicroDoc; render: (ctx: GuideContext) => string };
}

/** JSON form of a capability users add in aginit.config.json (`customCapabilities`). */
export interface CustomCapabilityConfig {
  id: string;
  /** owner/repo installed with the Skills CLI. */
  repo: string;
  /** Skills to install from the repo; omitted or empty installs every skill. */
  skills?: string[];
  name?: string;
  description?: string;
  category?: CapabilityCategory;
  supportedPlatforms?: Array<Platform | 'all'>;
  /** A CLI the skill drives: checked by doctor, never installed by aginit. */
  binary?: { bin: string; install: string };
}
