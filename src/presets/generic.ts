import path from 'node:path';
import { fileExists, writeJsonFile } from '../utils/fs.js';
import { PresetContext, PresetHandler } from './types.js';
import { addTestingDependencies, setupTesting } from './testing.js';
import { setupAdr } from './adr.js';
import { activeIds } from '../registry/index.js';

export const genericPreset: PresetHandler = {
  name: 'generic',
  description: 'Minimal, unopinionated project skeleton with AI skills, Git, and ADR structure',
  async scaffold(ctx: PresetContext): Promise<void> {
    const { targetDir, projectName, dryRun, silent } = ctx;

    // Only a Vitest harness needs a root package.json; Flutter, Swift, Kotlin,
    // Rust, Go and Python projects stay free of Node files.
    const pkgPath = path.join(targetDir, 'package.json');
    if (!fileExists(pkgPath) && activeIds(ctx.config).has('vitest')) {
      const pkg = {
        name: projectName,
        version: '0.1.0',
        type: 'module',
        scripts: {
          test: 'vitest run'
        }
      };
      addTestingDependencies(pkg);
      writeJsonFile(pkgPath, pkg, { dryRun, silent });
      setupTesting(ctx);
    }

    if (ctx.config.docs.adr) {
      setupAdr(targetDir, { dryRun, silent });
    }
  }
};
