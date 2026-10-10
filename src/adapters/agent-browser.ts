import path from 'node:path';
import { fileExists, readTextFile } from '../utils/fs.js';
import { commandExists, runExecutable } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import { SkillSourceConfig } from '../config/schema.js';

const AGENT_BROWSER_SKILL = 'agent-browser';
const AGENT_BROWSER_CLI = 'agent-browser';
const AGENT_BROWSER_PACKAGE = 'vercel-labs/agent-browser';

/**
 * Whether a configured skill source will install the agent-browser skill stub
 * whose instructions assume the `agent-browser` CLI exists.
 */
export function agentBrowserConfigured(sources: SkillSourceConfig[]): boolean {
  return sources.some(
    (source) =>
      source.skills.includes(AGENT_BROWSER_SKILL) ||
      (source.package === AGENT_BROWSER_PACKAGE &&
        (source.skills.length === 0 || source.skills.includes('*')))
  );
}

/** Whether the agent-browser skill stub is already on disk. */
export function agentBrowserStubInstalled(targetDir: string): boolean {
  return fileExists(path.join(targetDir, '.agents', 'skills', AGENT_BROWSER_SKILL, 'SKILL.md'));
}

export interface UsernsRestriction {
  sysctl: string;
  value: string;
  fixValue: string;
}

/**
 * Detect the Linux sysctls that block Chrome's sandbox when set to their
 * restrictive value: Chrome's renderer sandbox runs on unprivileged user
 * namespaces, so agent-browser launches die with "No usable sandbox!".
 *
 * Returns null when the kernel does not expose the knobs (other distros,
 * macOS, Windows) or none of them is restrictive.
 */
export function findUsernsRestriction(procRoot = '/proc'): UsernsRestriction | null {
  const knobs: Array<[sysctl: string, blockingValue: string, fixValue: string]> = [
    ['kernel.apparmor_restrict_unprivileged_userns', '1', '0'],
    ['kernel.unprivileged_userns_clone', '0', '1']
  ];
  for (const [sysctl, blockingValue, fixValue] of knobs) {
    const raw = readTextFile(path.join(procRoot, 'sys', ...sysctl.split('.')));
    if (raw !== null && raw.trim() === blockingValue) {
      return { sysctl, value: raw.trim(), fixValue };
    }
  }
  return null;
}

export interface AgentBrowserSetupOptions {
  dryRun?: boolean;
  silent?: boolean;
  /** Working directory for the provisioning commands (defaults to cwd). */
  cwd?: string;
  /** Root of the proc filesystem; overridable for tests. */
  procRoot?: string;
}

/**
 * Provision the runtime the agent-browser skill stub depends on: the globally
 * installed CLI (`npm i -g agent-browser`, matching the skill's own install
 * line — npm ships with Node and works regardless of the project's package
 * manager) and its browser binaries (`agent-browser install`, idempotent).
 *
 * A blocked Chrome sandbox is reported as a warning only: it needs a system
 * change aginit must not make on the user's behalf. Returns false when the
 * CLI or the browser binaries could not be provisioned.
 */
export async function setupAgentBrowser(options: AgentBrowserSetupOptions = {}): Promise<boolean> {
  const { dryRun = false, silent = false, cwd = process.cwd(), procRoot = '/proc' } = options;

  const cliPresent = await commandExists('agent-browser');
  if (!cliPresent) {
    if (!silent) logger.dim('Installing agent-browser CLI globally (npm -g)...');
    const cli = await runExecutable('npm', ['install', '-g', AGENT_BROWSER_SKILL], {
      cwd,
      dryRun,
      silent: true,
      timeout: 600_000
    });
    if (!cli.ok && !dryRun) {
      if (!silent) {
        logger.warn(`Failed installing agent-browser CLI: ${cli.stderr || cli.stdout}`);
        logger.dim('  Install it manually: npm i -g agent-browser && agent-browser install');
      }
      return false;
    }
  }

  if (!silent) logger.dim('Ensuring agent-browser browser binaries...');
  const browser = await runExecutable(AGENT_BROWSER_CLI, ['install'], {
    cwd,
    dryRun,
    silent: true,
    timeout: 600_000
  });
  if (!browser.ok && !dryRun) {
    if (!silent) {
      logger.warn(`Failed downloading agent-browser browsers: ${browser.stderr || browser.stdout}`);
      logger.dim('  Retry manually: agent-browser install');
    }
    return false;
  }

  const restriction = findUsernsRestriction(procRoot);
  if (restriction && !silent) {
    logger.warn(
      `Chrome's sandbox is blocked: ${restriction.sysctl}=${restriction.value} restricts unprivileged user namespaces, so agent-browser launches fail with "No usable sandbox!".`
    );
    logger.dim(
      `  → Fix (machine-wide): echo '${restriction.sysctl}=${restriction.fixValue}' | sudo tee /etc/sysctl.d/99-agent-browser-userns.conf && sudo sysctl --system`
    );
    logger.dim(
      '  → Narrower option: pass --args "--no-sandbox" to agent-browser for that launch (Chrome sandbox disabled for that session)'
    );
  }
  return true;
}

export interface AgentBrowserDiagnostic {
  message: string;
  fix?: string;
}

/**
 * Run upstream's own diagnostics (`agent-browser doctor --quick --offline
 * --json`) and return the failing checks, so aginit reports browser health
 * instead of reimplementing it. Returns null when the report cannot be
 * parsed (older CLI, unexpected output) — callers should then skip the check
 * rather than guess.
 */
export async function runAgentBrowserDiagnostics(): Promise<AgentBrowserDiagnostic[] | null> {
  const res = await runExecutable(
    AGENT_BROWSER_CLI,
    ['doctor', '--quick', '--offline', '--json'],
    {
      silent: true,
      timeout: 60_000
    }
  );
  try {
    const parsed = JSON.parse(res.stdout) as {
      checks?: Array<{ status?: string; message?: string; fix?: string }>;
    };
    if (!Array.isArray(parsed.checks)) return null;
    return parsed.checks
      .filter((check) => check?.status === 'fail')
      .map((check) => ({
        message: String(check?.message || 'check failed'),
        ...(check?.fix ? { fix: String(check.fix) } : {})
      }));
  } catch {
    return null;
  }
}
