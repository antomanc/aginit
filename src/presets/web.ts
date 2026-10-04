import path from 'node:path';
import { fileExists, safeWriteFile, writeJsonFile } from '../utils/fs.js';
import { readPackageManifest } from '../config/validation.js';
import { runExecutable } from '../utils/shell.js';
import { PresetContext, PresetHandler } from './types.js';
import { setupBrowserTesting } from '../adapters/browser.js';
import { setupAdr } from './adr.js';
import { scaffoldCommand } from '../adapters/package-manager.js';
import { addTestingDependencies, setupTesting } from './testing.js';

export const webPreset: PresetHandler = {
  name: 'web',
  description:
    'Framework-agnostic web project with upstream scaffolding, Vitest and optional Playwright',
  async scaffold(ctx: PresetContext): Promise<void> {
    const { targetDir, projectName, dryRun, silent, config } = ctx;
    const framework = config.framework || 'none';
    const pkgPath = path.join(targetDir, 'package.json');
    const pm = config.packageManager || 'pnpm';
    let pkg = readPackageManifest(targetDir);
    const fresh = pkg === null;
    if (fresh && framework === 'existing')
      throw new Error('An existing framework requires an existing package.json.');
    if (fresh && (framework === 'vite' || framework === 'next')) {
      const command = scaffoldCommand(pm, framework);
      const result = await runExecutable(command.executable, command.args, {
        cwd: targetDir,
        dryRun,
        silent: true
      });
      if (!result.ok)
        throw new Error(`${framework} scaffolding failed: ${result.stderr || result.stdout}`);
      if (!dryRun) {
        pkg = readPackageManifest(targetDir);
        const expected = framework === 'vite' ? 'index.html' : 'src/app/page.tsx';
        if (!pkg || !fileExists(path.join(targetDir, expected)))
          throw new Error(
            `${framework} scaffolding did not create a complete project; it may have been cancelled.`
          );
      }
    }
    if (!pkg) {
      // In a framework dry run the upstream command has only been displayed.
      if (dryRun && (framework === 'vite' || framework === 'next')) return;
      pkg = {
        name: projectName,
        version: '0.1.0',
        type: 'module',
        scripts: { build: 'tsc', typecheck: 'tsc --noEmit' },
        devDependencies: { '@types/node': '^22.8.0', typescript: '^5.6.3' }
      };
    }
    const hadVitestScript = Object.values(pkg.scripts || {}).some(
      (script) => typeof script === 'string' && /^vitest(?:\s|$)/.test(script)
    );
    addTestingDependencies(pkg, config.browser.playwright);
    if (fileExists(path.join(targetDir, 'tsconfig.json'))) {
      pkg.scripts.typecheck ??=
        fresh && framework === 'next' ? 'next typegen && tsc --noEmit' : 'tsc --noEmit';
      if (!pkg.dependencies?.typescript && !pkg.devDependencies.typescript)
        pkg.devDependencies.typescript = '^5.6.3';
    }
    // Only scaffold application source and compiler settings for a fresh agnostic project.
    if (fresh && framework === 'none') {
      writeJsonFile(
        path.join(targetDir, 'tsconfig.json'),
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            lib: ['ES2022', 'DOM'],
            strict: true,
            skipLibCheck: true,
            outDir: 'dist',
            rootDir: 'src'
          },
          include: ['src/**/*']
        },
        { dryRun, silent }
      );
      safeWriteFile(
        path.join(targetDir, 'src', 'index.ts'),
        `export function createApp() {\n  return { name: ${JSON.stringify(projectName)}, status: 'ready' };\n}\n`,
        { dryRun, silent }
      );
    }
    writeJsonFile(pkgPath, pkg, { overwrite: true, dryRun, silent });
    if (pm === 'pnpm')
      safeWriteFile(
        path.join(targetDir, 'pnpm-workspace.yaml'),
        'allowBuilds:\n  esbuild: true\n',
        { dryRun, silent }
      );
    setupTesting(ctx, hadVitestScript);
    if (config.browser.playwright) setupBrowserTesting(targetDir, { dryRun, silent });
    if (config.docs.adr) setupAdr(targetDir, { dryRun, silent });
  }
};
