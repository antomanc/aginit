import { Command } from 'commander';
import { createProject } from './new.js';
import { initCurrentDirectory } from './init.js';
import { runDoctor } from './doctor.js';
import { updateSkills } from '../adapters/skills.js';
import { buildGraft } from '../adapters/graft.js';
import { logger } from '../utils/logger.js';
import { PresetType } from '../config/schema.js';

export function createCliProgram(): Command {
  const program = new Command();

  program
    .name('ai')
    .description('Minimal, modular AI-first project bootstrapper for T3 Code, Antigravity, and Codex')
    .version('0.1.0');

  // Command: new
  program
    .command('new <projectName>')
    .description('Create a brand new AI-first project')
    .option('-p, --preset <preset>', 'Project preset: web | cli | generic', 'generic')
    .option('--no-skills', 'Skip installing AI skills')
    .option('--no-graft', 'Skip codebase graph (Graft) setup')
    .option('--no-git', 'Skip git repository initialization')
    .option('--dry-run', 'Simulate creation without writing changes to disk')
    .action(async (projectName: string, options: any) => {
      await createProject(projectName, {
        preset: options.preset as PresetType,
        skills: options.skills,
        graft: options.graft,
        git: options.git,
        dryRun: options.dryRun
      });
    });

  // Command: init
  program
    .command('init')
    .description('Initialize or update AI-first capabilities in the current directory')
    .option('-p, --preset <preset>', 'Project preset: web | cli | generic', 'generic')
    .option('--no-skills', 'Skip installing AI skills')
    .option('--no-graft', 'Skip codebase graph (Graft) setup')
    .option('--no-git', 'Skip git repository initialization')
    .option('--dry-run', 'Simulate setup without writing changes to disk')
    .action(async (options: any) => {
      await initCurrentDirectory({
        preset: options.preset as PresetType,
        skills: options.skills,
        graft: options.graft,
        git: options.git,
        dryRun: options.dryRun
      });
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
      logger.banner('AI Project Bootstrap — Update');
      const targetDir = process.cwd();
      await updateSkills(targetDir, { dryRun: options.dryRun });
      await buildGraft(targetDir, { dryRun: options.dryRun });
      logger.success('Update finished.');
    });

  return program;
}
