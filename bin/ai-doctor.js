#!/usr/bin/env node
import { Command } from 'commander';
import { runDoctor } from '../dist/cli/doctor.js';

const program = new Command();

program
  .name('ai-doctor')
  .description('Run system and project diagnostics for AI agent readiness')
  .option('-d, --dir <path>', 'Target directory to check', process.cwd())
  .action(async (options) => {
    try {
      await runDoctor(options.dir);
    } catch (err) {
      console.error(err.message || err);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
