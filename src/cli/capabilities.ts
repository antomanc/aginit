import path from 'node:path';
import pc from 'picocolors';
import { AGINIT_CONFIG_FILENAME, AginitConfig } from '../config/schema.js';
import { readProjectConfig, validateConfig } from '../config/validation.js';
import { resolvePlatformStack } from '../adapters/agent-docs.js';
import { installAllSkills, removeSkills, skillAgents } from '../adapters/skills.js';
import { uninstallTrail } from '../adapters/trail.js';
import { ignoreVendoredSkills } from '../adapters/tool-ignores.js';
import {
  activeIds,
  applyResolvedProfile,
  CapabilityCategory,
  CapabilityDescriptor,
  catalogFor,
  findCapability,
  inferCapabilities,
  ProfileFlags,
  resolveCapabilities,
  sourcesFor
} from '../registry/index.js';
import { SETUPS } from '../registry/setup.js';
import { writeJsonFile } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { missingBinaries, syncAgentDocs } from './new.js';

const CATEGORY_ORDER: CapabilityCategory[] = [
  'codebase-graph',
  'methodology',
  'discipline',
  'design',
  'ui-driver',
  'testing-engine',
  'context-guard',
  'custom'
];

/** Print the registry grouped by category, marking what the project has enabled. */
export function listCapabilities(targetDir: string = process.cwd()): void {
  const config = readProjectConfig(targetDir);
  const enabled = config ? activeIds(config) : new Set<string>();
  logger.banner(
    'Aginit — Capability registry',
    config ? `Enabled in ${AGINIT_CONFIG_FILENAME}: ●` : `No ${AGINIT_CONFIG_FILENAME} here; showing the catalog`
  );
  const catalog = catalogFor(config);
  for (const category of CATEGORY_ORDER) {
    // art-direction (Taste Skill) is listed with design.
    const entries = catalog.filter(
      (c) => c.category === category || (category === 'design' && c.category === 'art-direction')
    );
    if (entries.length === 0) continue;
    console.log(pc.bold(pc.underline(category)));
    for (const c of entries) {
      const mark = enabled.has(c.id) ? pc.green('●') : pc.dim('○');
      const platforms = c.supportedPlatforms.join(', ');
      console.log(`  ${mark} ${pc.bold(c.id.padEnd(22))} ${c.description}`);
      console.log(pc.dim(`      ${platforms} · ${c.license} · ${c.repoUrl}`));
    }
    console.log();
  }
}

export interface ChangeOptions {
  dryRun?: boolean;
  silent?: boolean;
}

function requireConfig(targetDir: string): AginitConfig {
  const config = readProjectConfig(targetDir);
  if (!config)
    throw new Error(`No ${AGINIT_CONFIG_FILENAME} in ${targetDir}. Run \`aginit init\` first.`);
  return config;
}

/** Skill names to remove; a source installed whole is removed by its repo. */
const skillsOf = (capabilities: CapabilityDescriptor[]) =>
  capabilities.flatMap((c) =>
    c.install.flatMap((s) => (s.kind !== 'skills-sh' ? [] : s.skills.length ? s.skills : [s.repo]))
  );

/**
 * Enable or disable capabilities, then bring the project in line: config,
 * skills (installed or removed through the Skills CLI), upstream setups,
 * AGENTS.md and docs/agents/. Picking a methodology, design or UI driver
 * replaces the current one in that category.
 */
export async function changeCapabilities(
  targetDir: string,
  change: { add?: string[]; remove?: string[] },
  options: ChangeOptions = {}
): Promise<boolean> {
  const { dryRun = false, silent = false } = options;
  const config = requireConfig(targetDir);
  const { platform, stack } = resolvePlatformStack(config, targetDir);
  const base = config.capabilities ?? inferCapabilities(config);
  const previous = [...base, ...(config.customCapabilities ?? []).map((c) => c.id)];
  const before = activeIds(config);

  const flags: ProfileFlags = { addons: [], addSkills: [], without: [] };
  for (const id of change.add ?? []) {
    const capability = findCapability(id, config);
    if (!capability) {
      if (id.includes('/')) flags.addSkills!.push(id);
      else throw new Error(`Unknown capability "${id}". Run \`aginit list\` to see the registry.`);
    } else if (capability.category === 'methodology') flags.methodology = id;
    else if (capability.category === 'design') flags.design = id;
    else if (capability.category === 'ui-driver' && !capability.addon) flags.uiDriver = id;
    else flags.addons!.push(id);
  }
  for (const id of change.remove ?? []) {
    if (!findCapability(id, config))
      throw new Error(`Unknown capability "${id}". Run \`aginit list\` to see the registry.`);
    flags.without!.push(id);
  }
  const custom = config.customCapabilities ?? [];
  const customIds = new Set(custom.map((c) => c.id));
  const disabled = (config.disabledCapabilities ?? []).filter((id) => !(change.add ?? []).includes(id));
  const resolved = resolveCapabilities(
    { platform, stack, framework: config.framework, base, basePlatform: platform, flags, custom },
    disabled
  );
  // A removed custom capability is gone, not disabled.
  resolved.disabledCapabilities = resolved.disabledCapabilities.filter((id) => !customIds.has(id));
  const next = validateConfig(
    applyResolvedProfile({ ...config, platform, stack }, resolved, { skills: true, previous })
  );
  // Adding trail or playwright turns their legacy switch back on.
  if (next.capabilities?.includes('trail')) next.codebase.trail = true;

  const after = activeIds(next);
  const nextCatalog = catalogFor(next);
  const added = nextCatalog.filter((c) => after.has(c.id) && !before.has(c.id));
  const removed = catalogFor(config).filter((c) => before.has(c.id) && !after.has(c.id));
  if (added.length === 0 && removed.length === 0 && JSON.stringify(next) === JSON.stringify(config)) {
    if (!silent) logger.info('Nothing to change.');
    return true;
  }
  if (!silent) {
    for (const c of added) logger.success(`Enabling ${c.id}`);
    for (const c of removed) logger.warn(`Disabling ${c.id}`);
  }

  writeJsonFile(path.join(targetDir, AGINIT_CONFIG_FILENAME), next, { overwrite: true, dryRun, silent });
  let ok = true;

  ok = (await removeSkills(targetDir, skillsOf(removed), { dryRun, silent })) && ok;
  if (removed.some((c) => c.id === 'trail')) await uninstallTrail(targetDir, { dryRun, silent });
  const leftovers = removed.filter((c) =>
    c.install.some((s) => s.kind === 'setup' && s.setup !== 'trail')
  );
  if (!silent)
    for (const c of leftovers)
      logger.dim(`${c.id}: files and global CLIs its setup created are left in place; remove them by hand.`);

  const addedSources = sourcesFor(added);
  if (addedSources.length > 0) {
    const { failed } = await installAllSkills(targetDir, addedSources, {
      agents: skillAgents(next),
      dryRun,
      silent
    });
    ok = failed.length === 0 && ok;
    for (const line of ignoreVendoredSkills(targetDir, { dryRun, silent: true })) logger.warn(line);
  }
  for (const c of added)
    for (const step of c.install)
      if (step.kind === 'setup')
        ok = (await SETUPS[step.setup]({ targetDir, config: next, platform, stack, dryRun, silent })) && ok;

  syncAgentDocs(targetDir, next, { dryRun, silent });
  if (!silent)
    for (const { name, bin, install } of await missingBinaries(added, ['trail', 'agent-browser', 'e2e']))
      logger.warn(`${name} needs the \`${bin}\` CLI: ${install}`);
  if (!silent) {
    if (ok) logger.success('Capabilities updated. AGENTS.md and docs/agents/ are in sync.');
    else logger.warn('Capabilities updated with warnings. Resolve them and rerun `aginit init`.');
  }
  return ok;
}
