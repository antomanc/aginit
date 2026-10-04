import path from 'node:path';
import { safeWriteFile } from '../utils/fs.js';

const PLAYWRIGHT_CONFIG = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
`;

const SMOKE_TEST = `import { test, expect } from '@playwright/test';

test.skip('TODO: verify the application in a browser', async ({ page }) => {
  // Replace with local dev server or preview URL during development
  // Example: await page.goto('/'); await expect(page).toHaveTitle(/Your app/);
});
`;

export function setupBrowserTesting(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): void {
  const { dryRun = false, silent = false } = options;

  safeWriteFile(path.join(targetDir, 'playwright.config.ts'), PLAYWRIGHT_CONFIG, {
    dryRun,
    silent
  });

  safeWriteFile(path.join(targetDir, 'e2e', 'smoke.spec.ts'), SMOKE_TEST, {
    dryRun,
    silent
  });
}
