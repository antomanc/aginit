import path from 'node:path';
import { fileExists, writeJsonFile } from '../utils/fs.js';
import { PresetContext, PresetHandler } from './types.js';
import { setupAdr } from './adr.js';

export const genericPreset: PresetHandler = {
  name: 'generic',
  description: 'Minimal, unopinionated project skeleton with AI skills, Git, and ADR structure',
  async scaffold(ctx: PresetContext): Promise<void> {
    const { targetDir, projectName, dryRun, silent } = ctx;

    const pkgPath = path.join(targetDir, 'package.json');
    if (!fileExists(pkgPath)) {
      const pkg = {
        name: projectName,
        version: '0.1.0',
        type: 'module',
        scripts: {
          test: 'vitest run'
        }
      };
      writeJsonFile(pkgPath, pkg, { dryRun, silent });
    }

    if (ctx.config.docs.adr) {
      setupAdr(targetDir, { dryRun, silent });
    }
  }
};
