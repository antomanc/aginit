import {
  AginitConfig,
  PresetType,
  WebFramework,
  PackageManager,
  SkillSourceConfig
} from './schema.js';
import {
  applyResolvedProfile,
  isNodeStack,
  MATT_POCOCK_SKILLS,
  Platform,
  ProfileFlags,
  resolveCapabilities,
  Stack
} from '../registry/index.js';

export { MATT_POCOCK_SKILLS };

export interface DefaultConfigOptions {
  framework?: WebFramework;
  packageManager?: PackageManager;
  /** Defaults to the preset's platform (generic: cli). */
  platform?: Platform;
  /** Defaults to node: every preset scaffolds a Node project unless a stack is detected. */
  stack?: Stack;
  flags?: ProfileFlags;
  /** Skip skill sources (`--no-skills`). */
  skills?: boolean;
  /** false when the preset will not scaffold a Vitest harness. */
  harness?: boolean;
}

export function presetPlatform(preset: PresetType): Platform {
  return preset === 'web' ? 'web' : 'cli';
}

/**
 * A fresh config: the preset's scaffolding settings plus the capabilities the
 * registry enables for the platform, stack and profile flags.
 */
export function getDefaultConfig(
  name: string,
  preset: PresetType,
  options: DefaultConfigOptions = {}
): AginitConfig {
  const packageManager = options.packageManager || 'pnpm';
  const platform = options.platform ?? presetPlatform(preset);
  const stack = options.stack ?? 'node';
  const framework = preset === 'web' ? options.framework || 'none' : undefined;
  const base: AginitConfig = {
    schemaVersion: '1.0.0',
    name,
    preset,
    ...(framework ? { framework } : {}),
    // Only Node projects have a package manager; the others use their host toolchain.
    ...(isNodeStack(stack) ? { packageManager } : {}),
    platform,
    stack,
    agents: {
      primary: 'antigravity',
      secondary: 'codex',
      claudeCode: true
    },
    skills: { sources: [] },
    codebase: { graft: true },
    browser: { visualAgent: false, playwright: false },
    docs: { adr: true },
    github: { ci: preset !== 'generic' }
  };
  const profile = resolveCapabilities({
    platform,
    stack,
    framework,
    harness: options.harness,
    flags: options.flags
  });
  return applyResolvedProfile(base, profile, { skills: options.skills !== false });
}

/** The skill selections that older versions of aginit wrote as defaults. */
const LEGACY_MATT_SKILL_SELECTIONS: string[][] = [
  ['tdd', 'code-review', 'diagnosing-bugs'],
  ['tdd', 'code-review', 'diagnosing-bugs', 'to-spec', 'to-tickets', 'implement-spec']
];

function matchesLegacySelection(skills: string[]): boolean {
  return LEGACY_MATT_SKILL_SELECTIONS.some(
    (selection) =>
      selection.length === skills.length && selection.every((skill) => skills.includes(skill))
  );
}

/**
 * Bring a saved `skills` section forward to the current standard: install the
 * full stable Matt Pocock set and drop the retired workflow selector.
 *
 * Only the exact selections aginit used to write are migrated, so a project
 * whose skill list was narrowed by hand keeps the list its author chose.
 */
export function upgradeLegacySkillConfig(
  skills: AginitConfig['skills']
): AginitConfig['skills'] {
  const sources: SkillSourceConfig[] = skills.sources.map((source) =>
    source.package === 'mattpocock/skills' && matchesLegacySelection(source.skills)
      ? { ...source, skills: [...MATT_POCOCK_SKILLS] }
      : source
  );
  const migrated = sources.some((source, index) => source !== skills.sources[index]);
  if (!migrated) return skills;

  const upgraded: AginitConfig['skills'] = { ...skills, sources };
  delete upgraded.workflow;
  return upgraded;
}
