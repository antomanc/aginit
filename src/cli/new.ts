import path from 'node:path';
import pc from 'picocolors';
import { getDefaultConfig, presetPlatform, upgradeLegacySkillConfig } from '../config/defaults.js';
import {
  AginitConfig,
  AGINIT_CONFIG_FILENAME,
  PresetType,
  WebFramework,
  PackageManager
} from '../config/schema.js';
import { getPreset } from '../presets/registry.js';
import { setupGit } from '../adapters/git.js';
import { setupAgentsMarkdown, setupClaudeMarkdown } from '../adapters/agents-md.js';
import { claudeCodeEnabled, installAllSkills, skillAgents } from '../adapters/skills.js';
import { ignoreVendoredSkills } from '../adapters/tool-ignores.js';
import { agentBrowserStubInstalled } from '../adapters/agent-browser.js';
import { microDocPath, projectProfile, resolvePlatformStack, setupMicroDocs } from '../adapters/agent-docs.js';
import { detectProject } from '../detect/index.js';
import {
  activeCapabilities,
  applyResolvedProfile,
  CapabilityDescriptor,
  e2eDirFor,
  hasProfileFlags,
  inferCapabilities,
  isNodeStack,
  MicroDoc,
  Platform,
  PLATFORMS,
  ProfileFlags,
  resolveCapabilities,
  Stack
} from '../registry/index.js';
import { SETUP_LABELS, SETUPS } from '../registry/setup.js';
import { commandExists } from '../utils/shell.js';
import { ensureDir, fileExists, writeJsonFile } from '../utils/fs.js';
import {
  readProjectConfig,
  readPackageManifest,
  validateConfig,
  validateProjectName,
  PRESETS,
  FRAMEWORKS,
  SUPPORTED_PACKAGE_MANAGERS
} from '../config/validation.js';
import { logger } from '../utils/logger.js';

export interface NewProjectOptions {
  preset?: PresetType;
  framework?: WebFramework;
  packageManager?: PackageManager;
  skills?: boolean;
  graft?: boolean;
  git?: boolean;
  dryRun?: boolean;
  targetDir?: string;
  silent?: boolean;
  /** v2 profile flags: --platform, --methodology, --design, --testing, --ui-driver, ... */
  profile?: ProfileFlags;
}

/**
 * Work out the config to save. A saved config is reused as written, so plain
 * reruns are deterministic; profile flags (and --preset/--framework for the
 * browser switches) are applied on top of it.
 */
function resolveConfig(
  projectName: string,
  targetDir: string,
  options: NewProjectOptions,
  existingConfig: AginitConfig | null,
  manifest: Record<string, any> | null
): AginitConfig {
  const flags = options.profile ?? {};
  const detected = detectProject(targetDir);
  const saved = existingConfig ? resolvePlatformStack(existingConfig, targetDir) : null;
  const presetHint = options.preset ?? existingConfig?.preset;
  const platform: Platform =
    flags.platform ??
    existingConfig?.platform ??
    (options.preset && options.preset !== 'generic'
      ? presetPlatform(options.preset)
      : (saved?.platform ?? detected.platform ?? presetPlatform(presetHint ?? 'generic')));
  const stack: Stack =
    existingConfig?.stack ??
    (detected.stack !== 'unknown'
      ? detected.stack
      : platform === 'mobile-native'
        ? 'unknown'
        : 'node');
  const presetName = options.preset ?? existingConfig?.preset ?? 'generic';
  const framework =
    options.framework ?? (presetName === 'web' ? existingConfig?.framework : undefined);
  if (presetName !== 'web' && framework && framework !== 'none' && framework !== 'existing')
    throw new Error('A web framework requires --preset web.');
  if (presetName === 'web' && framework === 'existing' && !manifest)
    throw new Error(
      'An existing web framework requires an existing package.json. Use --framework none for a new baseline.'
    );
  if (!isNodeStack(stack) && options.preset && options.preset !== 'generic')
    throw new Error(
      `--preset ${options.preset} scaffolds a Node.js project, but this is a ${stack} project. ` +
        'Use --preset generic (the default) to keep the project root free of package.json.'
    );
  const packageManager = options.packageManager ?? existingConfig?.packageManager ?? 'pnpm';
  const defaults = getDefaultConfig(projectName, presetName, {
    framework,
    packageManager,
    platform,
    stack,
    flags,
    skills: options.skills !== false,
    // A generic preset leaves an existing package.json (and its test runner) alone.
    harness: !(presetName === 'generic' && manifest !== null)
  });
  if (!existingConfig) return validateConfig(defaults);

  let config: AginitConfig = {
    ...existingConfig,
    name: projectName,
    preset: presetName,
    ...(isNodeStack(stack) || existingConfig.packageManager !== undefined ? { packageManager } : {}),
    ...(presetName === 'web' ? { framework: framework ?? 'none' } : {}),
    browser:
      options.framework !== undefined || options.preset !== undefined
        ? { ...existingConfig.browser, ...defaults.browser }
        : existingConfig.browser,
    skills: upgradeLegacySkillConfig(existingConfig.skills)
  };
  if (hasProfileFlags(flags)) {
    const base = existingConfig.capabilities ?? inferCapabilities(existingConfig);
    const profile = resolveCapabilities(
      {
        platform,
        stack,
        framework,
        base,
        basePlatform: saved!.platform,
        flags,
        custom: existingConfig.customCapabilities
      },
      existingConfig.disabledCapabilities
    );
    config = applyResolvedProfile({ ...config, platform, stack }, profile, {
      skills: true,
      previous: [...base, ...(existingConfig.customCapabilities ?? []).map((c) => c.id)]
    });
  } else if (config.capabilities && config.browser.playwright !== existingConfig.browser.playwright) {
    // --framework turned the Playwright switch; keep the capability list in step.
    config.capabilities = config.browser.playwright
      ? [...config.capabilities, 'playwright']
      : config.capabilities.filter((id) => id !== 'playwright');
  }
  return validateConfig(config);
}

export async function createProject(
  projectName: string,
  options: NewProjectOptions = {}
): Promise<boolean> {
  validateProjectName(projectName);
  if (options.preset !== undefined && !PRESETS.includes(options.preset))
    throw new Error('Invalid preset.');
  if (options.framework !== undefined && !FRAMEWORKS.includes(options.framework))
    throw new Error('Invalid framework.');
  if (
    options.packageManager !== undefined &&
    !SUPPORTED_PACKAGE_MANAGERS.includes(options.packageManager)
  )
    throw new Error('Invalid package manager.');
  if (options.profile?.platform !== undefined && !PLATFORMS.includes(options.profile.platform))
    throw new Error(`Invalid platform. Valid platforms are: ${PLATFORMS.join(', ')}`);
  const defaultDir =
    projectName.startsWith('@') && projectName.includes('/')
      ? projectName.split('/').pop()!
      : projectName;
  const targetDir = path.resolve(options.targetDir || path.join(process.cwd(), defaultDir));
  const existingConfig = readProjectConfig(targetDir);
  const manifest = readPackageManifest(targetDir); // Validate before creating or modifying anything.
  const config = resolveConfig(projectName, targetDir, options, existingConfig, manifest);
  if (config.preset !== 'web') delete config.framework;
  if (options.graft === false) config.codebase = { ...config.codebase, graft: false };
  if (options.skills === false && !existingConfig) config.skills.sources = [];
  const presetName = config.preset;
  const packageManager = config.packageManager ?? 'pnpm';
  const { platform, stack } = resolvePlatformStack(config, targetDir);
  const dryRun = !!options.dryRun;
  const silent = !!options.silent;
  const presetHandler = getPreset(presetName);
  const active = activeCapabilities(config);
  if (!silent)
    logger.banner(
      `Aginit — ${projectName}`,
      `Preset: ${presetName} | Platform: ${platform} (${stack})${isNodeStack(stack) ? ` | PM: ${packageManager}` : ''} | Target: ${targetDir}${dryRun ? ' (DRY RUN)' : ''}`
    );
  if (!silent) logger.dim(`Capabilities: ${active.map((c) => c.id).join(', ') || 'none'}`);
  let complete = true;

  const installSkills = options.skills !== false && config.skills.sources.length > 0;
  // Upstream setups (agent-browser runtime, e2e, Graft) in registry order, Graft last
  // so its first index sees every generated file.
  const setups = active
    .flatMap((capability) =>
      capability.install.flatMap((step) => (step.kind === 'setup' ? [step.setup] : []))
    )
    .filter((setup) => !(setup === 'graft' && options.graft === false))
    .sort((a, b) => Number(a === 'graft') - Number(b === 'graft'));
  const totalSteps = 6 + setups.length;
  let currentStep = 1;

  // Scaffold into the clean directory before Git adds files that upstream tools reject.
  if (!silent) logger.step(currentStep++, totalSteps, `Scaffolding preset: ${presetHandler.name}`);
  ensureDir(targetDir, dryRun);
  await presetHandler.scaffold({ targetDir, projectName, config, dryRun, silent: true });
  if (!silent) logger.success(`Scaffolded ${presetHandler.name} structure`);

  if (!silent) logger.step(currentStep++, totalSteps, 'Configuring Git');
  if (options.git !== false) {
    const gitOk = await setupGit(targetDir, { dryRun, silent: true });
    complete &&= gitOk;
    if (gitOk && !silent) logger.success('Git repository initialized and .gitignore configured');
  }

  // Step 3: Write declarative project config
  if (!silent) logger.step(currentStep++, totalSteps, 'Writing declarative project configuration');
  writeJsonFile(path.join(targetDir, AGINIT_CONFIG_FILENAME), config, {
    overwrite: true,
    dryRun,
    silent
  });
  if (!silent) logger.success(`Wrote ${AGINIT_CONFIG_FILENAME}`);

  // Step 4: AGENTS.md (task routing) and the docs/agents/ micro-docs it routes to
  if (!silent) logger.step(currentStep++, totalSteps, 'Generating AGENTS.md and docs/agents/');
  const docs = syncAgentDocs(targetDir, config, { dryRun, silent });
  if (!silent) logger.success(`Configured AGENTS.md${docs.length ? ` and ${docs.map(microDocPath).join(', ')}` : ''}`);

  // Step 5: Install skills via skills.sh engine
  if (!silent) logger.step(currentStep++, totalSteps, 'Installing upstream skills via skills.sh');
  if (installSkills) {
    const { installed, failed } = await installAllSkills(targetDir, config.skills.sources, {
      agents: skillAgents(config),
      dryRun,
      silent
    });
    complete &&= failed.length === 0;
    if (!silent) {
      if (installed.length > 0) {
        logger.success(`Installed skills: ${installed.join(', ')}`);
      }
      if (failed.length > 0) {
        logger.warn(`Failed installing: ${failed.join(', ')}`);
      }
    }
  } else if (!silent) {
    logger.dim('Skills installation skipped (--no-skills or empty configuration)');
  }
  const agentBrowserStub = agentBrowserStubInstalled(targetDir);
  if (installSkills || agentBrowserStub) {
    const advice = ignoreVendoredSkills(targetDir, { dryRun, silent: true });
    if (!silent) for (const line of advice) logger.warn(line);
  }
  // A stub installed earlier still needs its runtime, even when skills are skipped now.
  if (agentBrowserStub && !setups.includes('agent-browser')) setups.unshift('agent-browser');

  for (const setup of setups) {
    if (!silent) logger.step(currentStep++, totalSteps, SETUP_LABELS[setup]);
    const ok = await SETUPS[setup]({ targetDir, config, platform, stack, dryRun, silent });
    complete &&= ok;
    if (ok && !silent) logger.success(`${setup} ready`);
  }

  // CLIs aginit does not install: report the missing ones with their install command.
  if (!silent) logger.step(currentStep++, totalSteps, 'Checking capability CLIs');
  const missing = await missingBinaries(active, setups);
  if (!silent) {
    if (missing.length === 0) logger.success('Every capability CLI is available');
    for (const { name, bin, install } of missing)
      logger.warn(`${name} needs the \`${bin}\` CLI: ${install}`);
  }

  if (!silent) {
    console.log();
    if (complete) logger.success(pc.bold(`Project "${projectName}" is ready for development!`));
    else
      logger.warn(
        `Project "${projectName}" was scaffolded with incomplete integrations. Resolve the warnings above and rerun aginit init.`
      );
    console.log();
    console.log('Next steps:');
    const relativeTarget = path.relative(process.cwd(), targetDir);
    if (relativeTarget) console.log(pc.cyan(`  cd ${relativeTarget}`));
    if (isNodeStack(stack) && (manifest || fileExists(path.join(targetDir, 'package.json')) || dryRun))
      console.log(pc.cyan(`  ${packageManager} install`));
    if (active.some((c) => c.id === 'e2e') && e2eDirFor(stack))
      console.log(pc.cyan(`  (cd ${e2eDirFor(stack)} && npm install)`));
    console.log(pc.cyan('  Open the repository in your AI coding agent'));
    console.log(pc.dim('  Prompt the agent: ') + pc.bold(pc.green('"bootstrap this project"')));
    console.log();
  }

  return complete;
}

/** Binaries of active capabilities that are not on PATH (setups report their own). */
export async function missingBinaries(
  active: CapabilityDescriptor[],
  setups: string[]
): Promise<Array<{ name: string; bin: string; install: string }>> {
  const missing: Array<{ name: string; bin: string; install: string }> = [];
  for (const capability of active) {
    if (capability.install.some((step) => step.kind === 'setup' && setups.includes(step.setup)))
      continue;
    for (const step of capability.install)
      if (step.kind === 'binary' && !(await commandExists(step.bin)))
        missing.push({ name: capability.name, bin: step.bin, install: step.install });
  }
  return missing;
}

/** Refresh AGENTS.md, CLAUDE.md and docs/agents/ from the config. */
export function syncAgentDocs(
  targetDir: string,
  config: AginitConfig,
  options: { dryRun?: boolean; silent?: boolean } = {}
): MicroDoc[] {
  const scripts = readPackageManifest(targetDir)?.scripts;
  const docs = setupMicroDocs(targetDir, projectProfile(config, { targetDir, scripts }), options);
  setupAgentsMarkdown(targetDir, config, { ...options, docs });
  if (claudeCodeEnabled(config)) setupClaudeMarkdown(targetDir, options);
  return docs;
}
