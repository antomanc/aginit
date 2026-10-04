#!/usr/bin/env node
import { createCliProgram } from '../dist/cli/main.js';

const program = createCliProgram();
program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
