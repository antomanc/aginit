import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { createProject } from './new.js';
import { initCurrentDirectory } from './init.js';
import { runDoctor } from './doctor.js';
import { ensureClaudeSkillLinks, updateSkills } from '../adapters/skills.js';
import { ignoreVendoredSkills } from '../adapters/tool-ignores.js';
import { buildGraft } from '../adapters/graft.js';
import { readProjectConfig } from '../config/validation.js';
import { logger } from '../utils/logger.js';
import { PresetType, WebFramework, PackageManager } from '../config/schema.js';
import { Platform, ProfileFlags, TestingChoice } from '../registry/index.js';
import { changeCapabilities, listCapabilities } from './capabilities.js';
import { syncAgentDocs } from './new.js';
import {
  isInteractive,
  promptNewProject,
  promptInitProject,
  runInteractiveWizard
} from './wizard.js';

/**
 * Read the version from package.json so releases only bump one place.
 * Resolves from `src/cli/main.ts` and from `dist/cli/main.js` alike.
 */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const list = (value: string, previous: string[] = []) => [
  ...previous,
  ...value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
];

/** v2 profile options shared by the root command, `new` and `init`. */
function withProfileOptions(command: Command): Command {
  return command
    .option('--platform <platform>', 'Platform: auto | web | mobile-native | mobile-rn | backend | cli')
    .option('--methodology <preset>', 'Workflow skills: pocock | superpowers | minimal')
    .option('--design <design>', 'Design system: impeccable | none')
    .option('--testing <engine>', 'Testing: e2e | playwright | vitest | native')
    .option('--ui-driver <driver>', 'UI driver: auto | agent-browser | agent-device | none')
    .option('--addons <ids>', 'Add-ons: context-mode, worktrunk, chrome-devtools-mcp, browserskill', list)
    .option('--add-skill <owner/repo>', 'Add a skill repository as a custom capability (repeatable)', list)
    .option('--without <id>', 'Disable a capability, e.g. graft or humanizer (repeatable)', list);
}

function profileFlags(options: any): ProfileFlags {
  return {
    platform: options.platform === 'auto' ? undefined : (options.platform as Platform | undefined),
    methodology: options.methodology,
    design: options.design,
    testing: options.testing as TestingChoice | undefined,
    uiDriver: options.uiDriver,
    addons: options.addons,
    addSkills: options.addSkill,
    without: options.without
  };
}

export function createCliProgram(): Command {
  const program = new Command();

  program
    .name('aginit')
    .description('Set up a new or existing project for AI coding agents')
    .version(readVersion())
    .enablePositionalOptions()
    .option('-p, --preset <preset>', 'Project preset: web | cli | generic')
    .option('-f, --framework <framework>', 'Web framework: none | vite | next | existing')
    .option('-m, --package-manager <pm>', 'Package manager: pnpm | npm | yarn | bun')
    .option('--no-skills', 'Skip installing AI skills')
    .option('--no-graft', 'Skip codebase graph (Graft) setup')
    .option('--no-git', 'Skip git repository initialization')
    .option('--dry-run', 'Simulate setup without writing changes to disk')
    .option('-y, --yes', 'Initialize the current directory without prompts (saved or detected settings)');
  withProfileOptions(program);

  // Root action: `aginit [options]` initializes the current directory. Bare
  // `aginit` opens the wizard in a TTY and prints help otherwise, so a stray
  // invocation in CI never rewrites a project.
  program.action(async (options: any, command: Command) => {
    const explicit = command.options.some(
      (option) => command.getOptionValueSource(option.attributeName()) === 'cli'
    );
    if (!explicit) {
      if (isInteractive()) await runInteractiveWizard();
      else program.outputHelp();
      return;
    }
    const complete = await initCurrentDirectory({
      preset: options.preset as PresetType | undefined,
      framework: options.framework as WebFramework | undefined,
      packageManager: options.packageManager as PackageManager | undefined,
      skills: options.skills,
      graft: options.graft,
      git: options.git,
      dryRun: options.dryRun,
      profile: profileFlags(options)
    });
    if (!complete && !options.dryRun) process.exitCode = 1;
  });

  // Command: new
  const newCommand = program
    .command('new [projectName]')
    .description('Create a brand new AI-first project')
    .option('-p, --preset <preset>', 'Project preset: web | cli | generic', 'generic')
    .option('-f, --framework <framework>', 'Web framework: none | vite | next | existing', 'none')
    .option('-m, --package-manager <pm>', 'Package manager: pnpm | npm | yarn | bun', 'pnpm')
    .option('--no-skills', 'Skip installing AI skills')
    .option('--no-graft', 'Skip codebase graph (Graft) setup')
    .option('--no-git', 'Skip git repository initialization')
    .option('--dry-run', 'Simulate creation without writing changes to disk');
  withProfileOptions(newCommand)
    .action(async (projectName: string | undefined, options: any, command: Command) => {
      let finalName = projectName;
      let finalPreset = options.preset;
      let finalFramework = options.framework;
      let finalPackageManager = options.packageManager;
      let finalProfile = profileFlags(options);

      if (!finalName) {
        if (!isInteractive()) {
          program.error("error: missing required argument 'projectName'");
        }
        const answers = await promptNewProject({
          preset:
            command.getOptionValueSource('preset') === 'cli'
              ? (options.preset as PresetType)
              : undefined,
          framework:
            command.getOptionValueSource('framework') === 'cli'
              ? (options.framework as WebFramework)
              : undefined,
          packageManager:
            command.getOptionValueSource('packageManager') === 'cli'
              ? (options.packageManager as PackageManager)
              : undefined,
          profile: finalProfile
        });
        finalName = answers.projectName;
        finalPreset = answers.preset;
        finalFramework = answers.framework;
        finalPackageManager = answers.packageManager;
        finalProfile = answers.profile;
      }

      const complete = await createProject(finalName, {
        preset: finalPreset as PresetType,
        framework: finalFramework as WebFramework,
        packageManager: finalPackageManager as PackageManager,
        skills: options.skills,
        graft: options.graft,
        git: options.git,
        dryRun: options.dryRun,
        profile: finalProfile
      });
      if (!complete && !options.dryRun) process.exitCode = 1;
    });

  // Command: init
  const initCommand = program
    .command('init')
    .description('Initialize or update AI-first capabilities in the current directory')
    .option('-p, --preset <preset>', 'Project preset: web | cli | generic')
    .option('-f, --framework <framework>', 'Web framework: none | vite | next | existing')
    .option('-m, --package-manager <pm>', 'Package manager: pnpm | npm | yarn | bun')
    .option('--no-skills', 'Skip installing AI skills')
    .option('--no-graft', 'Skip codebase graph (Graft) setup')
    .option('--no-git', 'Skip git repository initialization')
    .option('--dry-run', 'Simulate setup without writing changes to disk')
    .option('-y, --yes', 'Skip the prompts and use saved or detected settings');
  withProfileOptions(initCommand)
    .action(async (options: any, command: Command) => {
      let finalPreset = options.preset;
      let finalFramework = options.framework;
      let finalPackageManager = options.packageManager;
      let finalProfile = profileFlags(options);

      const isPresetExplicit = command.getOptionValueSource('preset') === 'cli';
      const isFrameworkExplicit = command.getOptionValueSource('framework') === 'cli';
      const isPmExplicit = command.getOptionValueSource('packageManager') === 'cli';

      const savedConfig = readProjectConfig(process.cwd());
      if (isInteractive() && !isPresetExplicit && !options.dryRun && !options.yes && !savedConfig) {
        const answers = await promptInitProject({
          preset: isPresetExplicit ? (options.preset as PresetType) : undefined,
          framework: isFrameworkExplicit ? (options.framework as WebFramework) : undefined,
          packageManager: isPmExplicit ? (options.packageManager as PackageManager) : undefined,
          profile: finalProfile
        });
        finalPreset = answers.preset;
        finalFramework = answers.framework;
        finalPackageManager = answers.packageManager;
        finalProfile = answers.profile;
      }

      const complete = await initCurrentDirectory({
        preset: finalPreset as PresetType,
        framework: finalFramework as WebFramework,
        packageManager: finalPackageManager as PackageManager,
        skills: options.skills,
        graft: options.graft,
        git: options.git,
        dryRun: options.dryRun,
        profile: finalProfile
      });
      if (!complete && !options.dryRun) process.exitCode = 1;
    });

  // Command: list
  program
    .command('list')
    .description('List every capability in the registry and which ones this project enables')
    .option('-d, --dir <path>', 'Project directory', process.cwd())
    .action((options: any) => listCapabilities(options.dir));

  // Command: add
  program
    .command('add <capabilities...>')
    .description('Enable capabilities (registry ids or owner/repo skill repositories)')
    .option('--dry-run', 'Simulate the change')
    .action(async (ids: string[], options: any) => {
      const ok = await changeCapabilities(process.cwd(), { add: ids.flatMap((id) => list(id)) }, {
        dryRun: options.dryRun
      });
      if (!ok && !options.dryRun) process.exitCode = 1;
    });

  // Command: remove
  program
    .command('remove <capabilities...>')
    .description('Disable capabilities and remove the skills they installed')
    .option('--dry-run', 'Simulate the change')
    .action(async (ids: string[], options: any) => {
      const ok = await changeCapabilities(
        process.cwd(),
        { remove: ids.flatMap((id) => list(id)) },
        { dryRun: options.dryRun }
      );
      if (!ok && !options.dryRun) process.exitCode = 1;
    });

  // Command: doctor
  program
    .command('doctor')
    .description('Run system and project diagnostics for AI agent readiness')
    .option('-d, --dir <path>', 'Target directory to check', process.cwd())
    .action(async (options: any) => {
      await runDoctor(options.dir);
    });

  // Command: update
  program
    .command('update')
    .description('Update installed skills and refresh codebase graph')
    .option('--dry-run', 'Simulate update')
    .action(async (options: any) => {
      logger.banner('Aginit — Update');
      const targetDir = process.cwd();
      const config = readProjectConfig(targetDir);
      const skillsOk =
        (config?.skills.sources.length === 0
          ? true
          : await updateSkills(targetDir, { dryRun: options.dryRun })) &&
        (config ? await ensureClaudeSkillLinks(targetDir, config, { dryRun: options.dryRun }) : true);
      if (config) syncAgentDocs(targetDir, config, { dryRun: options.dryRun });
      if (config?.skills.sources.length !== 0) {
        const advice = ignoreVendoredSkills(targetDir, { dryRun: options.dryRun, silent: true });
        for (const line of advice) logger.warn(line);
      }
      const graftOk =
        config?.codebase.graft === false
          ? true
          : await buildGraft(targetDir, { dryRun: options.dryRun });
      if (skillsOk && graftOk) logger.success('Update finished.');
      else {
        if (!skillsOk) logger.warn('Skills update failed. Check connectivity and the skills CLI.');
        if (!graftOk)
          logger.warn(
            'Graft refresh failed or Graft is unavailable. Check installation and rerun graft build.'
          );
        process.exitCode = 1;
      }
    });

  return program;
}
