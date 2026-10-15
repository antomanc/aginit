import type { AginitConfig, SkillSourceConfig, WebFramework } from '../config/schema.js';
import { CATALOG } from './catalog.js';
import {
  CapabilityCategory,
  CapabilityDescriptor,
  CustomCapabilityConfig,
  DoctorCheck,
  Platform,
  Stack
} from './types.js';

export * from './types.js';
export { CATALOG, MATT_POCOCK_SKILLS, SUPERPOWERS_SKILLS } from './catalog.js';

export const PLATFORMS: Platform[] = ['web', 'mobile-native', 'mobile-rn', 'backend', 'cli'];
export const TESTING_CHOICES = ['e2e', 'playwright', 'vitest', 'native'] as const;
export type TestingChoice = (typeof TESTING_CHOICES)[number];

/** Categories where picking one capability replaces the previous pick. */
const EXCLUSIVE: CapabilityCategory[] = ['methodology', 'design', 'ui-driver'];

/** Profile options from the CLI (`--platform`, `--methodology`, ...). */
export interface ProfileFlags {
  platform?: Platform;
  methodology?: string;
  design?: string;
  testing?: TestingChoice;
  uiDriver?: string;
  addons?: string[];
  addSkills?: string[];
  without?: string[];
}

export function hasProfileFlags(flags: ProfileFlags): boolean {
  return Object.values(flags).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined
  );
}

/** Add a capability to the built-in catalog (programmatic API and tests). */
export function registerCapability(descriptor: CapabilityDescriptor): void {
  if (CATALOG.some((entry) => entry.id === descriptor.id))
    throw new Error(`Capability "${descriptor.id}" is already registered.`);
  CATALOG.push(descriptor);
}

export function customToDescriptor(custom: CustomCapabilityConfig): CapabilityDescriptor {
  return {
    id: custom.id,
    name: custom.name ?? custom.id,
    description: custom.description ?? `Skills from ${custom.repo}`,
    category: custom.category ?? 'custom',
    author: custom.repo.split('/')[0] ?? custom.repo,
    repoUrl: `https://github.com/${custom.repo}`,
    license: 'see upstream',
    supportedPlatforms: custom.supportedPlatforms ?? ['all'],
    requiresNodeInProjectRoot: false,
    install: [
      { kind: 'skills-sh', repo: custom.repo, skills: custom.skills ?? [] },
      ...(custom.binary ? [{ kind: 'binary' as const, ...custom.binary }] : [])
    ]
  };
}

/** The built-in catalog plus the project's custom capabilities. */
export function catalogFor(config?: Pick<AginitConfig, 'customCapabilities'> | null): CapabilityDescriptor[] {
  return [...CATALOG, ...(config?.customCapabilities ?? []).map(customToDescriptor)];
}

export function findCapability(
  id: string,
  config?: Pick<AginitConfig, 'customCapabilities'> | null
): CapabilityDescriptor | undefined {
  return catalogFor(config).find((entry) => entry.id === id);
}

export function isNodeStack(stack: Stack): boolean {
  return stack === 'node' || stack === 'react-native';
}

export function supports(capability: CapabilityDescriptor, platform: Platform): boolean {
  return (
    capability.supportedPlatforms.includes('all') || capability.supportedPlatforms.includes(platform)
  );
}

interface ProfileContext {
  platform: Platform;
  stack: Stack;
  framework?: WebFramework;
  /** false when aginit will not scaffold Vitest (a generic preset over an existing package.json). */
  harness?: boolean;
}

function testingIds(choice: TestingChoice | undefined, ctx: ProfileContext): string[] {
  const node = isNodeStack(ctx.stack);
  const unit = node && ctx.platform !== 'mobile-rn' && ctx.harness !== false ? 'vitest' : 'native';
  switch (choice) {
    case undefined:
      return ctx.platform === 'web' &&
        node &&
        (ctx.framework === 'vite' || ctx.framework === 'next')
        ? ['vitest', 'playwright']
        : [unit];
    case 'vitest':
      return ['vitest'];
    case 'playwright':
      return ['vitest', 'playwright'];
    case 'e2e':
      return [unit, 'e2e'];
    case 'native':
      return ['native'];
  }
}

/** Capabilities enabled by default for a platform and stack. */
export function defaultCapabilities(ctx: ProfileContext): string[] {
  const picked: CapabilityDescriptor[] = [];
  for (const capability of CATALOG) {
    if (!capability.default || capability.addon) continue;
    if (capability.category === 'testing-engine') continue;
    if (!supports(capability, ctx.platform)) continue;
    if (capability.requiresNodeInProjectRoot && !isNodeStack(ctx.stack)) continue;
    if (
      EXCLUSIVE.includes(capability.category) &&
      picked.some((p) => p.category === capability.category)
    )
      continue;
    picked.push(capability);
  }
  return [...picked.map((c) => c.id), ...testingIds(undefined, ctx)];
}

const unique = (ids: string[]) => [...new Set(ids)];

/** Capability id for a `--add-skill owner/repo` value. */
export function customCapabilityFromRepo(repo: string): CustomCapabilityConfig {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))
    throw new Error(`Invalid skill repository "${repo}": expected owner/repo.`);
  return { id: repo, repo };
}

export interface ResolveInput extends ProfileContext {
  /** Previously saved capabilities; flags are applied on top of them. */
  base?: string[];
  /** The platform the base was resolved for; a different platform re-derives defaults. */
  basePlatform?: Platform;
  flags?: ProfileFlags;
  custom?: CustomCapabilityConfig[];
}

export interface ResolvedProfile {
  capabilities: string[];
  customCapabilities: CustomCapabilityConfig[];
  disabledCapabilities: string[];
}

/**
 * Turn a platform, a stack and the profile flags into the list of capability
 * ids to save. Explicit flags replace the pick in their category; everything
 * else keeps the saved choice (or the platform default on a fresh project).
 */
export function resolveCapabilities(input: ResolveInput, disabled: string[] = []): ResolvedProfile {
  const flags = input.flags ?? {};
  const custom = [...(input.custom ?? [])];
  const byId = (id: string) =>
    CATALOG.find((c) => c.id === id) ?? custom.map(customToDescriptor).find((c) => c.id === id);
  const require = (id: string, category?: CapabilityCategory, allowNone = false): string | null => {
    if (allowNone && id === 'none') return null;
    const capability = byId(id);
    const valid = CATALOG.filter((c) => !category || c.category === category).map((c) => c.id);
    if (!capability || (category && capability.category !== category))
      throw new Error(
        `Unknown ${category ?? 'capability'} "${id}". Valid: ${[...valid, ...(allowNone ? ['none'] : [])].join(', ')}`
      );
    return capability.id;
  };

  const ctx: ProfileContext = input;
  let ids: string[];
  if (!input.base) ids = defaultCapabilities(ctx);
  else if (input.basePlatform && input.basePlatform !== input.platform) {
    // A new platform brings its own UI defaults; methodology and add-ons carry over.
    const methodology = input.base.find((id) => byId(id)?.category === 'methodology');
    ids = defaultCapabilities(ctx);
    if (methodology)
      ids = [...ids.filter((id) => byId(id)?.category !== 'methodology'), methodology];
    ids.push(...input.base.filter((id) => byId(id)?.addon));
  } else ids = [...input.base];

  const replace = (category: CapabilityCategory, id: string | null) => {
    ids = ids.filter((existing) => {
      const capability = byId(existing);
      return !(capability?.category === category && !capability.addon);
    });
    if (id) ids.push(id);
  };
  if (flags.methodology) replace('methodology', require(flags.methodology, 'methodology'));
  if (flags.design) replace('design', require(flags.design, 'design', true));
  if (flags.uiDriver) {
    const pick =
      flags.uiDriver === 'auto'
        ? (defaultCapabilities(ctx).find((id) => byId(id)?.category === 'ui-driver') ?? null)
        : require(flags.uiDriver, 'ui-driver', true);
    replace('ui-driver', pick);
  }
  if (flags.testing) {
    if (!TESTING_CHOICES.includes(flags.testing))
      throw new Error(`Unknown testing engine "${flags.testing}". Valid: ${TESTING_CHOICES.join(', ')}`);
    ids = ids.filter((id) => byId(id)?.category !== 'testing-engine');
    ids.push(...testingIds(flags.testing, ctx));
  }
  for (const addon of flags.addons ?? []) ids.push(require(addon)!);
  for (const repo of flags.addSkills ?? []) {
    const entry = customCapabilityFromRepo(repo);
    if (!custom.some((c) => c.id === entry.id)) custom.push(entry);
  }

  const without = flags.without ?? [];
  for (const id of without) if (!byId(id)) require(id);
  const disabledIds = unique([...disabled.filter((id) => !(flags.addons ?? []).includes(id)), ...without]);
  ids = unique(ids).filter((id) => !disabledIds.includes(id));

  for (const id of ids) {
    const capability = byId(id)!;
    if (capability.requiresNodeInProjectRoot && !isNodeStack(input.stack))
      throw new Error(
        `${capability.name} needs a package.json at the project root, but this is a ${input.stack} project. ` +
          'Use --testing e2e (isolated in .agents/e2e/) or --testing native.'
      );
  }
  return {
    capabilities: ids,
    customCapabilities: custom.filter((c) => !disabledIds.includes(c.id)),
    disabledCapabilities: disabledIds
  };
}

const samePackage = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function skillSteps(capability: CapabilityDescriptor) {
  return capability.install.flatMap((step) => (step.kind === 'skills-sh' ? [step] : []));
}

/** Skill sources that install the given capabilities. */
export function sourcesFor(capabilities: CapabilityDescriptor[]): SkillSourceConfig[] {
  return mergeSources([], capabilities);
}

function mergeSources(
  sources: SkillSourceConfig[],
  capabilities: CapabilityDescriptor[]
): SkillSourceConfig[] {
  const merged = sources.map((source) => ({ ...source, skills: [...source.skills] }));
  for (const step of capabilities.flatMap(skillSteps)) {
    const existing = merged.find((source) => samePackage(source.package, step.repo));
    if (!existing) merged.push({ package: step.repo, skills: [...step.skills] });
    else if (existing.skills.length > 0)
      existing.skills =
        step.skills.length === 0 ? [] : unique([...existing.skills, ...step.skills]);
  }
  return merged;
}

/**
 * Capabilities a config written before v2 (no `capabilities` field) uses:
 * the ones whose skills it installs, plus Graft and its test harness.
 */
export function inferCapabilities(config: AginitConfig): string[] {
  const ids: string[] = [];
  if (config.codebase.graft) ids.push('graft');
  for (const capability of CATALOG) {
    const steps = skillSteps(capability);
    if (
      steps.length > 0 &&
      steps.some((step) => config.skills.sources.some((s) => samePackage(s.package, step.repo)))
    )
      ids.push(capability.id);
  }
  // Every pre-v2 preset scaffolded a Vitest harness.
  ids.push(config.stack && !isNodeStack(config.stack) ? 'native' : 'vitest');
  if (config.browser.playwright) ids.push('playwright');
  return ids;
}

/** The capabilities a project config turns on. */
export function activeCapabilities(config: AginitConfig): CapabilityDescriptor[] {
  const disabled = new Set(config.disabledCapabilities ?? []);
  const ids = unique([
    ...(config.capabilities ?? inferCapabilities(config)),
    ...(config.customCapabilities ?? []).map((c) => c.id)
  ]);
  const catalog = catalogFor(config);
  return ids
    .filter((id) => !disabled.has(id))
    .map((id) => catalog.find((c) => c.id === id))
    .filter((c): c is CapabilityDescriptor => c !== undefined)
    .filter((capability) => {
      // The legacy switches still turn their capability off.
      if (capability.id === 'graft' && config.codebase.graft === false) return false;
      if (capability.id === 'playwright' && !config.browser.playwright) return false;
      // Skills only install from configured sources (`--no-skills` empties them).
      const steps = skillSteps(capability).filter((step) => !step.optional);
      return (
        steps.length === 0 ||
        steps.some((step) => config.skills.sources.some((s) => samePackage(s.package, step.repo)))
      );
    });
}

export function activeIds(config: AginitConfig): Set<string> {
  return new Set(activeCapabilities(config).map((c) => c.id));
}

/** Keep the pre-v2 switches in step with the capability list. */
function mirrorLegacySwitches(config: AginitConfig, ids: string[]): void {
  config.codebase = { ...config.codebase, graft: ids.includes('graft') };
  config.browser = {
    ...config.browser,
    visualAgent: ids.includes('agent-browser'),
    playwright: ids.includes('playwright')
  };
}

/** A fresh config section for a resolved profile. */
export function applyResolvedProfile(
  config: AginitConfig,
  profile: ResolvedProfile,
  options: { skills: boolean; previous?: string[] }
): AginitConfig {
  const catalog = catalogFor({ customCapabilities: profile.customCapabilities });
  const pick = (ids: string[]) =>
    ids.map((id) => catalog.find((c) => c.id === id)).filter((c): c is CapabilityDescriptor => !!c);
  const all = [...profile.capabilities, ...profile.customCapabilities.map((c) => c.id)];
  const next: AginitConfig = {
    ...config,
    capabilities: profile.capabilities,
    ...(profile.customCapabilities.length ? { customCapabilities: profile.customCapabilities } : {}),
    ...(profile.disabledCapabilities.length
      ? { disabledCapabilities: profile.disabledCapabilities }
      : {})
  };
  if (!profile.customCapabilities.length) delete next.customCapabilities;
  if (!profile.disabledCapabilities.length) delete next.disabledCapabilities;
  if (!options.skills) next.skills = { ...config.skills, sources: [] };
  else if (!options.previous) next.skills = { ...config.skills, sources: sourcesFor(pick(all)) };
  else {
    // Incremental: keep hand-edited sources, drop removed capabilities, add new ones.
    const removed = pick(options.previous.filter((id) => !all.includes(id)));
    const removedRepos = removed.flatMap(skillSteps).map((step) => step.repo);
    const kept = config.skills.sources.filter(
      (source) => !removedRepos.some((repo) => samePackage(repo, source.package))
    );
    const added = pick(all.filter((id) => !options.previous!.includes(id)));
    next.skills = { ...config.skills, sources: mergeSources(kept, added) };
  }
  mirrorLegacySwitches(next, all);
  return next;
}

export interface DerivedCheck {
  capability: CapabilityDescriptor;
  check: DoctorCheck;
}

/**
 * Doctor checks for a capability: its declared ones plus one per skill and
 * binary. Optional skills are checked only when their source is configured.
 */
export function doctorChecks(
  capability: CapabilityDescriptor,
  sources?: SkillSourceConfig[]
): DoctorCheck[] {
  const derived: DoctorCheck[] = [];
  for (const step of capability.install) {
    if (step.kind === 'skills-sh') {
      if (step.optional && sources && !sources.some((s) => samePackage(s.package, step.repo)))
        continue;
      for (const skill of step.skills)
        derived.push({
          kind: 'file',
          path: `.agents/skills/${skill}/SKILL.md`,
          fix: `npx skills add ${step.repo} --skill ${skill}`
        });
    } else if (step.kind === 'binary') {
      derived.push({ kind: 'command', bin: step.bin, args: ['--version'], fix: step.install });
    }
  }
  return [...derived, ...(capability.doctor ?? [])];
}

/** Where e2e lives: the project root for Node projects, an isolated workspace otherwise. */
export function e2eDirFor(stack: Stack): string {
  return isNodeStack(stack) ? '' : '.agents/e2e';
}
