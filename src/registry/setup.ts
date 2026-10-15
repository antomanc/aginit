import { AginitConfig } from '../config/schema.js';
import { initGraft } from '../adapters/graft.js';
import { setupAgentBrowser } from '../adapters/agent-browser.js';
import { setupE2e } from '../adapters/e2e.js';
import { claudeCodeEnabled } from '../adapters/skills.js';
import { Platform, SetupId, Stack } from './types.js';

export interface SetupContext {
  targetDir: string;
  config: AginitConfig;
  platform: Platform;
  stack: Stack;
  dryRun: boolean;
  silent: boolean;
}

/** Upstream setup commands, keyed by the `setup` install step that names them. */
export const SETUPS: Record<SetupId, (ctx: SetupContext) => Promise<boolean>> = {
  graft: (ctx) =>
    initGraft(ctx.targetDir, {
      dryRun: ctx.dryRun,
      silent: ctx.silent,
      claude: claudeCodeEnabled(ctx.config)
    }),
  'agent-browser': (ctx) =>
    setupAgentBrowser({ dryRun: ctx.dryRun, silent: ctx.silent, cwd: ctx.targetDir }),
  e2e: (ctx) =>
    setupE2e(ctx.targetDir, {
      stack: ctx.stack,
      platform: ctx.platform,
      dryRun: ctx.dryRun,
      silent: ctx.silent
    })
};

export const SETUP_LABELS: Record<SetupId, string> = {
  graft: 'Configuring codebase intelligence (Graft)',
  'agent-browser': 'Provisioning agent-browser runtime',
  e2e: 'Scaffolding e2e tests'
};
