#!/usr/bin/env node
import { Command } from 'commander';
import { createProject } from '../dist/cli/new.js';

const program = new Command();

program
  .name('ai-new')
  .description('Create a brand new AI-first project')
  .argument('<projectName>', 'Name of the project directory to create')
  .option('-p, --preset <preset>', 'Project preset: web | cli | generic', 'generic')
  .option('-f, --framework <framework>', 'Web framework: none | vite | next | existing', 'none')
  .option('--spec-workflow', 'Include full spec and tickets skills (to-spec, to-tickets, implement-spec)')
  .option('--no-skills', 'Skip installing AI skills')
  .option('--no-graft', 'Skip codebase graph (Graft) setup')
  .option('--no-git', 'Skip git repository initialization')
  .option('--dry-run', 'Simulate creation without writing changes to disk')
  .action(async (projectName, options) => {
    try {
      await createProject(projectName, {
        preset: options.preset,
        framework: options.framework,
        specWorkflow: options.specWorkflow,
        skills: options.skills,
        graft: options.graft,
        git: options.git,
        dryRun: options.dryRun
      });
    } catch (err) {
      console.error(err.message || err);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
