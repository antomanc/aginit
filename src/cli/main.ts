import { Command } from 'commander';
import { createProject } from './new.js';
import { initCurrentDirectory } from './init.js';
import { runDoctor } from './doctor.js';
import { updateSkills } from '../adapters/skills.js';
import { buildGraft } from '../adapters/graft.js';
import { readProjectConfig } from '../config/validation.js';
import { logger } from '../utils/logger.js';
import { PresetType, WebFramework, PackageManager } from '../config/schema.js';
import {
  isInteractive,
  promptNewProject,
  promptInitProject,
  runInteractiveWizard
} from './wizard.js';

export function createCliProgram(): Command {
  const program = new Command();

  program
    .name('aginit')
    .description(
      'Minimal, modular AI-first project bootstrapper for T3 Code, Antigravity, and Codex'
    )
    .version('0.1.0');

  // Root action: interactive wizard when in TTY, else display help
  program.action(async () => {
    if (isInteractive()) {
      await runInteractiveWizard();
    } else {
      program.outputHelp();
    }
  });

  // Command: new
  program
    .command('new [projectName]')
    .description('Create a brand new AI-first project')
    .option('-p, --preset <preset>', 'Project preset: web | cli | generic', 'generic')
    .option('-f, --framework <framework>', 'Web framework: none | vite | next | existing', 'none')
    .option('-m, --package-manager <pm>', 'Package manager: pnpm | npm | yarn | bun', 'pnpm')
    .option(
      '--spec-workflow',
      'Include full spec and tickets skills (to-spec, to-tickets, implement-spec)'
    )
    .option('--no-skills', 'Skip installing AI skills')
    .option('--no-graft', 'Skip codebase graph (Graft) setup')
    .option('--no-git', 'Skip git repository initialization')
    .option('--dry-run', 'Simulate creation without writing changes to disk')
    .action(async (projectName: string | undefined, options: any, command: Command) => {
      let finalName = projectName;
      let finalPreset = options.preset;
      let finalFramework = options.framework;
      let finalPackageManager = options.packageManager;
      let finalSpecWorkflow = options.specWorkflow;

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
          specWorkflow:
            command.getOptionValueSource('specWorkflow') === 'cli'
              ? options.specWorkflow
              : undefined
        });
        finalName = answers.projectName;
        finalPreset = answers.preset;
        finalFramework = answers.framework;
        finalPackageManager = answers.packageManager;
        finalSpecWorkflow = answers.specWorkflow;
      }

      const complete = await createProject(finalName, {
        preset: finalPreset as PresetType,
        framework: finalFramework as WebFramework,
        packageManager: finalPackageManager as PackageManager,
        specWorkflow: finalSpecWorkflow,
        skills: options.skills,
        graft: options.graft,
        git: options.git,
        dryRun: options.dryRun
      });
      if (!complete && !options.dryRun) process.exitCode = 1;
    });

  // Command: init
  program
    .command('init')
    .description('Initialize or update AI-first capabilities in the current directory')
    .option('-p, --preset <preset>', 'Project preset: web | cli | generic')
    .option('-f, --framework <framework>', 'Web framework: none | vite | next | existing')
    .option('-m, --package-manager <pm>', 'Package manager: pnpm | npm | yarn | bun')
    .option(
      '--spec-workflow',
      'Include full spec and tickets skills (to-spec, to-tickets, implement-spec)'
    )
    .option('--no-skills', 'Skip installing AI skills')
    .option('--no-graft', 'Skip codebase graph (Graft) setup')
    .option('--no-git', 'Skip git repository initialization')
    .option('--dry-run', 'Simulate setup without writing changes to disk')
    .action(async (options: any, command: Command) => {
      let finalPreset = options.preset;
      let finalFramework = options.framework;
      let finalPackageManager = options.packageManager;
      let finalSpecWorkflow = options.specWorkflow;

      const isPresetExplicit = command.getOptionValueSource('preset') === 'cli';
      const isFrameworkExplicit = command.getOptionValueSource('framework') === 'cli';
      const isPmExplicit = command.getOptionValueSource('packageManager') === 'cli';
      const isSpecExplicit = command.getOptionValueSource('specWorkflow') === 'cli';

      const savedConfig = readProjectConfig(process.cwd());
      if (isInteractive() && !isPresetExplicit && !options.dryRun && !savedConfig) {
        const answers = await promptInitProject({
          preset: isPresetExplicit ? (options.preset as PresetType) : undefined,
          framework: isFrameworkExplicit ? (options.framework as WebFramework) : undefined,
          packageManager: isPmExplicit ? (options.packageManager as PackageManager) : undefined,
          specWorkflow: isSpecExplicit ? options.specWorkflow : undefined
        });
        finalPreset = answers.preset;
        finalFramework = answers.framework;
        finalPackageManager = answers.packageManager;
        finalSpecWorkflow = answers.specWorkflow;
      }

      const complete = await initCurrentDirectory({
        preset: finalPreset as PresetType,
        framework: finalFramework as WebFramework,
        packageManager: finalPackageManager as PackageManager,
        specWorkflow: finalSpecWorkflow,
        skills: options.skills,
        graft: options.graft,
        git: options.git,
        dryRun: options.dryRun
      });
      if (!complete && !options.dryRun) process.exitCode = 1;
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
        config?.skills.sources.length === 0
          ? true
          : await updateSkills(targetDir, { dryRun: options.dryRun });
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
