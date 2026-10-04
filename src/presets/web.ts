import path from 'node:path';
import { fileExists, readJsonFile, safeWriteFile, writeJsonFile } from '../utils/fs.js';
import { PresetContext, PresetHandler } from './types.js';
import { setupBrowserTesting } from '../adapters/browser.js';
import { setupAdr } from './adr.js';

export const webPreset: PresetHandler = {
  name: 'web',
  description: 'AI-first Web stack (framework-agnostic: none | vite | next | existing) with Vitest and Playwright',
  async scaffold(ctx: PresetContext): Promise<void> {
    const { targetDir, projectName, dryRun, silent, config } = ctx;
    const framework = config.framework || 'none';
    const pkgPath = path.join(targetDir, 'package.json');

    // 1. package.json
    let pkg: Record<string, any>;

    if (framework === 'existing' && fileExists(pkgPath)) {
      pkg = readJsonFile<Record<string, any>>(pkgPath) || { name: projectName };
      pkg.scripts = pkg.scripts || {};
      if (!pkg.scripts.test) pkg.scripts.test = 'vitest run';
      if (!pkg.scripts['test:e2e']) pkg.scripts['test:e2e'] = 'playwright test';
      if (!pkg.scripts.typecheck) pkg.scripts.typecheck = 'tsc --noEmit';

      pkg.devDependencies = pkg.devDependencies || {};
      pkg.devDependencies['@playwright/test'] = pkg.devDependencies['@playwright/test'] || '^1.49.0';
      pkg.devDependencies['vitest'] = pkg.devDependencies['vitest'] || '^2.1.3';
    } else {
      pkg = {
        name: projectName,
        version: '0.1.0',
        type: 'module',
        scripts: {
          test: 'vitest run',
          'test:watch': 'vitest',
          'test:e2e': 'playwright test',
          typecheck: 'tsc --noEmit'
        },
        dependencies: {},
        devDependencies: {
          '@playwright/test': '^1.49.0',
          '@types/node': '^22.8.0',
          typescript: '^5.6.3',
          vitest: '^2.1.3'
        }
      };

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
        // 'none' or fallback
        pkg.scripts.build = 'tsc';
      }
    }

    writeJsonFile(pkgPath, pkg, { dryRun, silent });

    // pnpm-workspace.yaml for pnpm v12+ lifecycle scripts
    const workspaceYamlPath = path.join(targetDir, 'pnpm-workspace.yaml');
    if (!fileExists(workspaceYamlPath)) {
      const workspaceYaml = `allowBuilds:\n  esbuild: true\n`;
      safeWriteFile(workspaceYamlPath, workspaceYaml, { dryRun, silent });
    }

    // 2. tsconfig.json
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
        include: ['src/**/*', 'tests/**/*', 'e2e/**/*']
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

    // 4. Source & unit test files
    const srcIndexPath = path.join(targetDir, 'src', 'index.ts');
    if (!fileExists(srcIndexPath)) {
      const srcIndex = `export function createApp() {
  return {
    name: '${projectName}',
    status: 'ready'
  };
}
`;
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

    // 5. Browser E2E & Visual QA setup
    if (ctx.config.browser.playwright) {
      setupBrowserTesting(targetDir, { dryRun, silent });
    }

    // 6. Docs ADR
    if (ctx.config.docs.adr) {
      setupAdr(targetDir, { dryRun, silent });
    }
  }
};
