#!/usr/bin/env node
import { Command } from 'commander';
import { initCurrentDirectory } from '../dist/cli/init.js';

const program = new Command();

program
  .name('ai-init')
  .description('Initialize or update AI-first capabilities in the current directory')
  .option('-p, --preset <preset>', 'Project preset: web | cli | generic', 'generic')
  .option('-f, --framework <framework>', 'Web framework: none | vite | next | existing', 'none')
  .option('--spec-workflow', 'Include full spec and tickets skills (to-spec, to-tickets, implement-spec)')
  .option('--no-skills', 'Skip installing AI skills')
  .option('--no-graft', 'Skip codebase graph (Graft) setup')
  .option('--no-git', 'Skip git repository initialization')
  .option('--dry-run', 'Simulate setup without writing changes to disk')
  .action(async (options) => {
    try {
      await initCurrentDirectory({
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
