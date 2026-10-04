import path from 'node:path';
import pc from 'picocolors';
import { getDefaultConfig } from '../config/defaults.js';
import { AI_CONFIG_FILENAME, PresetType } from '../config/schema.js';
import { getPreset } from '../presets/registry.js';
import { setupGit } from '../adapters/git.js';
import { setupAgentsMarkdown } from '../adapters/agents-md.js';
import { installAllSkills } from '../adapters/skills.js';
import { initGraft } from '../adapters/graft.js';
import { ensureDir, writeJsonFile } from '../utils/fs.js';
import { logger } from '../utils/logger.js';

export interface NewProjectOptions {
  preset?: PresetType;
  skills?: boolean;
  graft?: boolean;
  git?: boolean;
  dryRun?: boolean;
  targetDir?: string;
  silent?: boolean;
}

export async function createProject(
  projectName: string,
  options: NewProjectOptions = {}
): Promise<boolean> {
  const presetName = (options.preset || 'generic') as PresetType;
  const targetDir = options.targetDir
    ? path.resolve(options.targetDir)
    : path.resolve(process.cwd(), projectName);

  const dryRun = !!options.dryRun;
  const silent = !!options.silent;

  if (!silent) {
    logger.banner(
      `AI Project Bootstrap — ${projectName}`,
      `Preset: ${presetName} | Target: ${targetDir}${dryRun ? ' (DRY RUN)' : ''}`
    );
  }

  // 1. Resolve preset & configuration
  const presetHandler = getPreset(presetName);
  const config = getDefaultConfig(projectName, presetName);

  if (options.graft === false) config.codebase.graft = false;
  if (options.skills === false) config.skills.sources = [];

  const totalSteps = 6;
  let currentStep = 1;

  // Step 1: Ensure directory & Git
  if (!silent) logger.step(currentStep++, totalSteps, 'Setting up workspace directory & Git');
  ensureDir(targetDir, dryRun);
  if (options.git !== false) {
    await setupGit(targetDir, { dryRun, silent: true });
    if (!silent) logger.success('Git repository initialized and .gitignore configured');
  }

  // Step 2: Scaffolding preset structure
  if (!silent) logger.step(currentStep++, totalSteps, `Scaffolding preset: ${presetHandler.name}`);
  await presetHandler.scaffold({
    targetDir,
    projectName,
    config,
    dryRun,
    silent: true
  });
  if (!silent) logger.success(`Scaffolded ${presetHandler.name} structure`);

  // Step 3: Write declarative project config
  if (!silent) logger.step(currentStep++, totalSteps, 'Writing declarative project configuration');
  writeJsonFile(path.join(targetDir, AI_CONFIG_FILENAME), config, {
    overwrite: true,
    dryRun,
    silent: true
  });
  if (!silent) logger.success(`Saved configuration to ${AI_CONFIG_FILENAME}`);

  // Step 4: Generate AGENTS.md
  if (!silent) logger.step(currentStep++, totalSteps, 'Configuring AGENTS.md');
  setupAgentsMarkdown(targetDir, config, { dryRun, silent: true });
  if (!silent) logger.success('AGENTS.md configured with core invariants & intake guide');

  // Step 5: Install Skills
  if (!silent) logger.step(currentStep++, totalSteps, 'Installing upstream AI Skills');
  if (config.skills.sources.length > 0 && options.skills !== false) {
    const agents = [config.agents.primary, config.agents.secondary];
    const { installed, failed } = await installAllSkills(targetDir, config.skills.sources, {
      agents,
      dryRun,
      silent
    });
    if (!silent) {
      if (installed.length > 0) {
        logger.success(`Installed skills: ${installed.join(', ')}`);
      }
      if (failed.length > 0) {
        logger.warn(`Some skills failed to install: ${failed.join(', ')}`);
      }
    }
  } else {
    if (!silent) logger.dim('Skills installation skipped.');
  }

  // Step 6: Codebase intelligence (Graft)
  if (!silent) logger.step(currentStep++, totalSteps, 'Configuring codebase intelligence');
  if (config.codebase.graft && options.graft !== false) {
    const graftOk = await initGraft(targetDir, { dryRun, silent: true });
    if (graftOk && !silent) {
      logger.success('Graft context graph initialized');
    }
  } else {
    if (!silent) logger.dim('Graft skipped.');
  }

  if (!silent) {
    console.log();
    logger.success(pc.bold(`Project "${projectName}" is ready for development!`));
    console.log();
    console.log('Next steps:');
    console.log(pc.cyan(`  cd ${path.relative(process.cwd(), targetDir) || '.'}`));
    console.log(pc.cyan('  pnpm install'));
    console.log(pc.cyan('  Open the repository in T3 Code'));
    console.log(
      pc.dim('  Prompt the agent: ') + pc.bold(pc.green('"bootstrap this project"'))
    );
    console.log();
  }

  return true;
}
