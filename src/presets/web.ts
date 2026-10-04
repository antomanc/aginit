import path from 'node:path';
import { fileExists, readJsonFile, safeWriteFile, writeJsonFile } from '../utils/fs.js';
import { runCommand } from '../utils/shell.js';
import { PresetContext, PresetHandler } from './types.js';
import { setupBrowserTesting } from '../adapters/browser.js';
import { setupAdr } from './adr.js';
import { getPackageManagerAdapter } from '../adapters/package-manager.js';

export const webPreset: PresetHandler = {
  name: 'web',
  description: 'AI-first Web stack (framework-agnostic: none | vite | next | existing) with Vitest and Playwright',
  async scaffold(ctx: PresetContext): Promise<void> {
    const { targetDir, projectName, dryRun, silent, config } = ctx;
    const framework = config.framework || 'none';
    const pkgPath = path.join(targetDir, 'package.json');
    const pm = config.packageManager || 'pnpm';
    const pmAdapter = getPackageManagerAdapter(pm);

    // If framework is 'vite' or 'next' and package.json does not exist yet,
    // delegate to official scaffolders using selected package manager
    if (!fileExists(pkgPath) && !dryRun) {
      if (framework === 'vite') {
        await runCommand(pmAdapter.scaffoldViteCmd('react-ts'), {
          cwd: targetDir,
          silent: true
        });
      } else if (framework === 'next') {
        await runCommand(pmAdapter.scaffoldNextCmd(), {
          cwd: targetDir,
          silent: true
        });
      }
    }

    // 1. package.json management (idempotent & conservative)
    let pkg: Record<string, any>;

    if (fileExists(pkgPath)) {
      pkg = readJsonFile<Record<string, any>>(pkgPath) || { name: projectName };
      pkg.scripts = pkg.scripts || {};
      if (!pkg.scripts.test) pkg.scripts.test = 'vitest run';
      if (!pkg.scripts['test:watch']) pkg.scripts['test:watch'] = 'vitest';
      if (config.browser.playwright && !pkg.scripts['test:e2e']) {
        pkg.scripts['test:e2e'] = 'playwright test';
      }
      if (!pkg.scripts.typecheck && fileExists(path.join(targetDir, 'tsconfig.json'))) {
        pkg.scripts.typecheck = 'tsc --noEmit';
      }

      pkg.devDependencies = pkg.devDependencies || {};
      pkg.devDependencies['vitest'] = pkg.devDependencies['vitest'] || '^2.1.3';
      if (config.browser.playwright) {
        pkg.devDependencies['@playwright/test'] = pkg.devDependencies['@playwright/test'] || '^1.49.0';
      }
    } else {
      pkg = {
        name: projectName,
        version: '0.1.0',
        type: 'module',
        scripts: {
          test: 'vitest run',
          'test:watch': 'vitest',
          typecheck: 'tsc --noEmit'
        },
        dependencies: {},
        devDependencies: {
          '@types/node': '^22.8.0',
          typescript: '^5.6.3',
          vitest: '^2.1.3'
        }
      };

      if (config.browser.playwright) {
        pkg.scripts['test:e2e'] = 'playwright test';
        pkg.devDependencies['@playwright/test'] = '^1.49.0';
      }

      if (framework === 'vite') {
        pkg.scripts.dev = 'vite';
        pkg.scripts.build = 'tsc && vite build';
        pkg.devDependencies.vite = '^6.0.0';
      } else if (framework === 'next') {
        pkg.scripts.dev = 'next dev';
        pkg.scripts.build = 'next build';
        pkg.scripts.start = 'next start';
        pkg.dependencies.next = '^15.0.0';
        pkg.dependencies.react = '^19.0.0';
        pkg.dependencies['react-dom'] = '^19.0.0';
        pkg.devDependencies['@types/react'] = '^19.0.0';
        pkg.devDependencies['@types/react-dom'] = '^19.0.0';
      } else {
        // 'none' or agnostic baseline
        pkg.scripts.build = 'tsc';
      }
    }

    writeJsonFile(pkgPath, pkg, { dryRun, silent });

    // pnpm-workspace.yaml generated ONLY for pnpm!
    if (pm === 'pnpm') {
      const workspaceYamlPath = path.join(targetDir, 'pnpm-workspace.yaml');
      if (!fileExists(workspaceYamlPath)) {
        const workspaceYaml = `allowBuilds:\n  esbuild: true\n`;
        safeWriteFile(workspaceYamlPath, workspaceYaml, { dryRun, silent });
      }
    }

    // 2. tsconfig.json (only if not already created by official scaffolder)
    if (!fileExists(path.join(targetDir, 'tsconfig.json'))) {
      const tsconfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          strict: true,
          skipLibCheck: true,
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
          noEmit: true
        },
        include: config.browser.playwright
          ? ['src/**/*', 'tests/**/*', 'e2e/**/*']
          : ['src/**/*', 'tests/**/*']
      };
      writeJsonFile(path.join(targetDir, 'tsconfig.json'), tsconfig, { dryRun, silent });
    }

    // 3. vitest.config.ts
    if (!fileExists(path.join(targetDir, 'vitest.config.ts'))) {
      const vitestConfig = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts']
  }
});
`;
      safeWriteFile(path.join(targetDir, 'vitest.config.ts'), vitestConfig, { dryRun, silent });
    }

    // 4. Source & unit test files (only create sample index.ts if no src directory files exist)
    const srcIndexPath = path.join(targetDir, 'src', 'index.ts');
    if (!fileExists(srcIndexPath) && !fileExists(path.join(targetDir, 'src', 'main.tsx')) && !fileExists(path.join(targetDir, 'src', 'App.tsx'))) {
      const srcIndex = `export function createApp() {\n  return {\n    name: '${projectName}',\n    status: 'ready'\n  };\n}\n`;
      safeWriteFile(srcIndexPath, srcIndex, { dryRun, silent });
    }

    const testIndexPath = path.join(targetDir, 'tests', 'index.test.ts');
    if (!fileExists(testIndexPath)) {
      const unitTest = `import { describe, it, expect } from 'vitest';
import { createApp } from '../src/index.js';

describe('createApp', () => {
  it('initializes the app instance properly', () => {
    const app = createApp();
    expect(app.name).toBe('${projectName}');
    expect(app.status).toBe('ready');
  });
});
`;
      safeWriteFile(testIndexPath, unitTest, { dryRun, silent });
    }

    // 5. Browser E2E & Visual QA setup (only when playwright is enabled, e.g. when web target exists)
    if (config.browser.playwright) {
      setupBrowserTesting(targetDir, { dryRun, silent });
    }

    // 6. Docs ADR
    if (config.docs.adr) {
      setupAdr(targetDir, { dryRun, silent });
    }
  }
};
