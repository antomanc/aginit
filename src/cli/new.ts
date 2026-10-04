import path from 'node:path';
import pc from 'picocolors';
import { getDefaultConfig } from '../config/defaults.js';
import {
  AGINIT_CONFIG_FILENAME,
  PresetType,
  WebFramework,
  PackageManager
} from '../config/schema.js';
import { getPreset } from '../presets/registry.js';
import { setupGit } from '../adapters/git.js';
import { setupAgentsMarkdown } from '../adapters/agents-md.js';
import { installAllSkills } from '../adapters/skills.js';
import { initGraft } from '../adapters/graft.js';
import { ensureDir, writeJsonFile } from '../utils/fs.js';
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
  specWorkflow?: boolean;
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
  const defaultDir =
    projectName.startsWith('@') && projectName.includes('/')
      ? projectName.split('/').pop()!
      : projectName;
  const targetDir = path.resolve(options.targetDir || path.join(process.cwd(), defaultDir));
  const existingConfig = readProjectConfig(targetDir);
  const manifest = readPackageManifest(targetDir); // Validate before creating or modifying anything.
  const presetName = options.preset ?? existingConfig?.preset ?? 'generic';
  const framework =
    options.framework ?? (presetName === 'web' ? existingConfig?.framework : undefined);
  if (presetName !== 'web' && framework && framework !== 'none' && framework !== 'existing')
    throw new Error('A web framework requires --preset web.');
  if (presetName === 'web' && framework === 'existing' && !manifest)
    throw new Error(
      'An existing web framework requires an existing package.json. Use --framework none for a new baseline.'
    );
  const packageManager = options.packageManager ?? existingConfig?.packageManager ?? 'pnpm';
  const dryRun = !!options.dryRun;
  const silent = !!options.silent;
  const presetHandler = getPreset(presetName);
  const defaults = getDefaultConfig(projectName, presetName, {
    framework,
    packageManager,
    specWorkflow: options.specWorkflow
  });
  const config = validateConfig(
    existingConfig
      ? {
          ...existingConfig,
          name: projectName,
          preset: presetName,
          packageManager,
          ...(presetName === 'web' ? { framework: framework ?? 'none' } : {}),
          browser:
            options.framework !== undefined || options.preset !== undefined
              ? { ...existingConfig.browser, ...defaults.browser }
              : existingConfig.browser,
          skills:
            options.specWorkflow !== undefined
              ? {
                  ...existingConfig.skills,
                  workflow: defaults.skills.workflow,
                  sources: existingConfig.skills.sources.map((source) =>
                    source.package === 'mattpocock/skills'
                      ? {
                          ...source,
                          skills: defaults.skills.sources.find((s) => s.package === source.package)!
                            .skills
                        }
                      : source
                  )
                }
              : existingConfig.skills
        }
      : defaults
  );
  if (presetName !== 'web') delete config.framework;
  if (options.graft === false) config.codebase = { ...config.codebase, graft: false };
  if (options.skills === false && !existingConfig) config.skills.sources = [];
  if (!silent)
    logger.banner(
      `Aginit — ${projectName}`,
      `Preset: ${presetName} | PM: ${packageManager} | Target: ${targetDir}${dryRun ? ' (DRY RUN)' : ''}`
    );
  let complete = true;

  const totalSteps = 6;
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

  // Step 4: Write or update AGENTS.md intake contract
  if (!silent) logger.step(currentStep++, totalSteps, 'Generating AGENTS.md intake guidance');
  setupAgentsMarkdown(targetDir, config, { dryRun, silent });
  if (!silent) logger.success('Configured AGENTS.md');

  // Step 5: Install skills via skills.sh engine
  if (!silent) logger.step(currentStep++, totalSteps, 'Installing upstream skills via skills.sh');
  if (options.skills !== false && config.skills.sources.length > 0) {
    const { installed, failed } = await installAllSkills(targetDir, config.skills.sources, {
      agents: [config.agents.primary, config.agents.secondary],
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

  // Step 6: Codebase intelligence (Graft)
  if (!silent) logger.step(currentStep++, totalSteps, 'Configuring codebase intelligence');
  if (config.codebase.graft && options.graft !== false) {
    const graftOk = await initGraft(targetDir, { dryRun, silent });
    complete &&= graftOk;
    if (graftOk && !silent) {
      logger.success('Graft context graph initialized');
    }
  } else if (!silent) {
    logger.dim('Graft setup skipped (--no-graft or codebase.graft: false)');
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
    console.log(pc.cyan(`  cd ${path.relative(process.cwd(), targetDir) || '.'}`));
    console.log(pc.cyan(`  ${packageManager} install`));
    console.log(pc.cyan('  Open the repository in T3 Code'));
    console.log(pc.dim('  Prompt the agent: ') + pc.bold(pc.green('"bootstrap this project"')));
    console.log();
  }

  return complete;
}
