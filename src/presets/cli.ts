import path from 'node:path';
import { fileExists, safeWriteFile, writeJsonFile } from '../utils/fs.js';
import { PresetContext, PresetHandler } from './types.js';
import { setupAdr } from './adr.js';

export const cliPreset: PresetHandler = {
  name: 'cli',
  description: 'AI-first TypeScript CLI application with Vitest and Commander',
  async scaffold(ctx: PresetContext): Promise<void> {
    const { targetDir, projectName, dryRun, silent } = ctx;

    // 1. package.json
    const pkg = {
      name: projectName,
      version: '0.1.0',
      type: 'module',
      bin: {
        [projectName]: './bin/cli.js'
      },
      scripts: {
        build: 'tsc',
        test: 'vitest run',
        'test:watch': 'vitest',
        typecheck: 'tsc --noEmit'
      },
      dependencies: {
        commander: '^12.1.0',
        picocolors: '^1.1.1'
      },
      devDependencies: {
        '@types/node': '^22.8.0',
        typescript: '^5.6.3',
        vitest: '^2.1.3'
      }
    };
    writeJsonFile(path.join(targetDir, 'package.json'), pkg, { dryRun, silent });

    // pnpm-workspace.yaml for pnpm v12+ lifecycle scripts
    const workspaceYamlPath = path.join(targetDir, 'pnpm-workspace.yaml');
    if (!fileExists(workspaceYamlPath)) {
      const workspaceYaml = `allowBuilds:\n  esbuild: true\n`;
      safeWriteFile(workspaceYamlPath, workspaceYaml, { dryRun, silent });
    }

    // 2. tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2022'],
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        outDir: './dist',
        rootDir: './src'
      },
      include: ['src/**/*']
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

    // 4. Executable CLI entrypoint
    const binCli = `#!/usr/bin/env node
import { run } from '../dist/index.js';

run(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
    safeWriteFile(path.join(targetDir, 'bin', 'cli.js'), binCli, { dryRun, silent });

    // 5. Source code
    const srcIndex = `export async function run(args: string[] = []): Promise<void> {
  console.log('${projectName} ready. Args:', args);
}
`;
    safeWriteFile(path.join(targetDir, 'src', 'index.ts'), srcIndex, { dryRun, silent });

    // 6. Unit test
    const unitTest = `import { describe, it, expect } from 'vitest';
import { run } from '../src/index.js';

describe('run', () => {
  it('is a callable async function', async () => {
    expect(typeof run).toBe('function');
  });
});
`;
    safeWriteFile(path.join(targetDir, 'tests', 'index.test.ts'), unitTest, { dryRun, silent });

    // 7. Docs ADR
    if (ctx.config.docs.adr) {
      setupAdr(targetDir, { dryRun, silent });
    }
  }
};
