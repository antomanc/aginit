import path from 'node:path';
import { safeWriteFile, writeJsonFile } from '../utils/fs.js';
import { PresetContext, PresetHandler } from './types.js';
import { setupBrowserTesting } from '../adapters/browser.js';
import { setupAdr } from './adr.js';

export const webPreset: PresetHandler = {
  name: 'web',
  description: 'AI-first Web stack with TypeScript, Vitest, Playwright, and agent-browser',
  async scaffold(ctx: PresetContext): Promise<void> {
    const { targetDir, projectName, dryRun, silent } = ctx;

    // 1. package.json
    const pkg = {
      name: projectName,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
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
        vite: '^6.0.0',
        vitest: '^2.1.3'
      },
      pnpm: {
        onlyBuiltDependencies: ['esbuild']
      }
    };
    writeJsonFile(path.join(targetDir, 'package.json'), pkg, { dryRun, silent });

    // 2. tsconfig.json
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

    // 3. vitest.config.ts
    const vitestConfig = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts']
  }
});
`;
    safeWriteFile(path.join(targetDir, 'vitest.config.ts'), vitestConfig, { dryRun, silent });

    // 4. Source & unit test files
    const srcIndex = `export function createApp() {
  return {
    name: '${projectName}',
    status: 'ready'
  };
}
`;
    safeWriteFile(path.join(targetDir, 'src', 'index.ts'), srcIndex, { dryRun, silent });

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
    safeWriteFile(path.join(targetDir, 'tests', 'index.test.ts'), unitTest, { dryRun, silent });

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
