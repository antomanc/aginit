import path from 'node:path';
import { safeWriteFile, fileExists } from '../utils/fs.js';
import { PresetContext } from './types.js';

export const VITEST_VERSION = '^4.1.11';
export function addTestingDependencies(pkg: Record<string, any>, playwright = false): void {
  pkg.scripts ??= {};
  pkg.devDependencies ??= {};
  if (!pkg.dependencies?.vitest && !pkg.devDependencies.vitest)
    pkg.devDependencies.vitest = VITEST_VERSION;
  const customTest = pkg.scripts.test && !/^vitest(?:\s|$)/.test(pkg.scripts.test);
  const testScript = customTest ? 'test:unit' : 'test';
  pkg.scripts[testScript] ??= 'vitest run';
  pkg.scripts[customTest ? 'test:unit:watch' : 'test:watch'] ??= 'vitest';
  if (playwright) {
    pkg.scripts['test:e2e'] ??= 'playwright test';
    if (!pkg.dependencies?.['@playwright/test'] && !pkg.devDependencies['@playwright/test'])
      pkg.devDependencies['@playwright/test'] = '^1.63.0';
  }
}

/** A starter harness checks package metadata without assuming application exports. */
export function setupTesting(ctx: PresetContext, preserveViteTestConfig = false): void {
  const { targetDir, dryRun, silent } = ctx;
  const hasConfig = [
    'vitest.config.ts',
    'vitest.config.js',
    'vitest.config.mts',
    'vitest.config.mjs',
    'vitest.config.cts',
    'vitest.config.cjs',
    ...(preserveViteTestConfig
      ? ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs']
      : [])
  ].some((name) => fileExists(path.join(targetDir, name)));
  if (!hasConfig)
    safeWriteFile(
      path.join(targetDir, 'vitest.config.mts'),
      `import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({\n  test: { include: ['tests/**/*.test.{js,ts}'] }\n});\n`,
      { dryRun, silent }
    );
  safeWriteFile(
    path.join(targetDir, 'tests', 'aginit.test.js'),
    `import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Starter harness: add application behavior tests as the project takes shape.
it('has a valid project manifest', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  expect(typeof pkg.name).toBe('string');
  expect(pkg.name.length).toBeGreaterThan(0);
});
`,
    { dryRun, silent }
  );
}
