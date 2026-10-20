import path from 'node:path';
import pc from 'picocolors';
import { runExecutable, commandExists } from '../utils/shell.js';
import { fileExists, readTextFile } from '../utils/fs.js';
import {
  AGINIT_CONFIG_FILENAME,
  LEGACY_CONFIG_FILENAME,
  AginitConfig,
  PackageManager
} from '../config/schema.js';
import { detectPackageManager } from '../adapters/package-manager.js';
import fs from 'node:fs';
import {
  claudeCodeEnabled,
  getInstalledSkills,
  getSkillsMissingForClaude
} from '../adapters/skills.js';
import { AGINIT_START_PATTERN, claudeMarkdownImportsAgents } from '../adapters/agents-md.js';
import {
  agentBrowserStubInstalled,
  findUsernsRestriction,
  runAgentBrowserDiagnostics
} from '../adapters/agent-browser.js';
import { readProjectConfig } from '../config/validation.js';
import { vendoredSkillsExposure } from '../adapters/tool-ignores.js';
import { logger } from '../utils/logger.js';
import { activeCapabilities, activeIds, doctorChecks, isNodeStack } from '../registry/index.js';
import { resolvePlatformStack } from '../adapters/agent-docs.js';

/**
 * One row per active capability, built from its registry entry: every skill
 * file it installs, every CLI it drives and any artifact it declares.
 */
export async function capabilityChecks(
  targetDir: string,
  config: AginitConfig
): Promise<CheckItem[]> {
  const items: CheckItem[] = [];
  for (const capability of activeCapabilities(config)) {
    const problems: string[] = [];
    const fixes: string[] = [];
    const missingSkills: string[] = [];
    const versions: string[] = [];
    for (const check of doctorChecks(capability, config.skills.sources)) {
      if (check.kind === 'file') {
        if (fileExists(path.join(targetDir, check.path))) continue;
        const skill = /^\.agents\/skills\/([^/]+)\/SKILL\.md$/.exec(check.path)?.[1];
        if (skill) missingSkills.push(skill);
        else {
          problems.push(`${check.path} missing`);
          fixes.push(check.fix);
        }
      } else if (!(await commandExists(check.bin))) {
        problems.push(`${check.bin} CLI not found in PATH`);
        fixes.push(check.fix);
      } else {
        const res = await runExecutable(check.bin, check.args, { silent: true, timeout: 30_000 });
        versions.push(res.ok && res.stdout ? `${check.bin} ${res.stdout.split('\n')[0]}` : check.bin);
      }
    }
    if (missingSkills.length) {
      problems.unshift(`skills missing from .agents/skills/: ${missingSkills.join(', ')}`);
      fixes.unshift('Run `aginit init` to reinstall the configured skills');
    }
    items.push({
      name: `${capability.name} (${capability.category})`,
      category: 'Capabilities',
      ok: problems.length === 0,
      detail: problems.length ? problems.join('; ') : `Ready${versions.length ? ` (${versions.join(', ')})` : ''}`,
      suggestion: fixes.length ? fixes.join(' · ') : undefined
    });
  }
  return items;
}

type CheckCategory = 'Environment' | 'AI Tooling' | 'Project Config' | 'Capabilities';

interface CheckItem {
  name: string;
  category: CheckCategory;
  ok: boolean;
  version?: string;
  detail: string;
  suggestion?: string;
}

export async function runDoctor(targetDir: string = process.cwd()): Promise<void> {
  logger.banner('Aginit — System & Project Doctor', `Target: ${targetDir}`);

  // Resolve project config early to detect configured package manager
  let configPath = path.join(targetDir, AGINIT_CONFIG_FILENAME);
  if (!fileExists(configPath)) {
    const legacyPath = path.join(targetDir, LEGACY_CONFIG_FILENAME);
    if (fileExists(legacyPath)) {
      configPath = legacyPath;
    }
  }

  const configExists = fileExists(configPath);
  let projectConfig: AginitConfig | null = null;
  let configError = '';
  try {
    projectConfig = readProjectConfig(targetDir);
  } catch (error) {
    configError = error instanceof Error ? error.message : String(error);
  }
  const activePm: PackageManager =
    projectConfig?.packageManager || detectPackageManager(targetDir) || 'pnpm';

  const checks: CheckItem[] = [];

  // 1. Node.js check
  const nodeRes = await runExecutable('node', ['-v'], { silent: true });
  let nodeOk = nodeRes.ok;
  let nodeDetail = 'Node.js is not found in PATH';
  let nodeSuggestion: string | undefined =
    'Install Node.js (>= 22.12.0 LTS recommended) via nvm, fnm, or brew';
  if (nodeRes.ok) {
    const rawVer = nodeRes.stdout.replace(/^v/, '');
    const [major = 0, minor = 0] = rawVer.split('.').map(Number);
    const meetsEngine = major > 22 || (major === 22 && minor >= 12);
    if (meetsEngine) {
      nodeDetail = `Installed (${nodeRes.stdout})`;
      nodeSuggestion = undefined;
    } else {
      nodeOk = false;
      nodeDetail = `Installed (${nodeRes.stdout}) — requires Node.js >= 22.12.0`;
      nodeSuggestion = 'Upgrade Node.js to >= 22.12.0 (LTS) via nvm, fnm, or brew';
    }
  }
  checks.push({
    name: 'Node.js runtime',
    category: 'Environment',
    ok: nodeOk,
    version: nodeRes.stdout,
    detail: nodeDetail,
    suggestion: nodeSuggestion
  });

  // 2. Active Package Manager check (pnpm, npm, yarn, or bun); none for non-Node stacks
  const { stack, platform } = projectConfig
    ? resolvePlatformStack(projectConfig, targetDir)
    : { stack: 'node' as const, platform: null };
  const pmRes = isNodeStack(stack)
    ? await runExecutable(activePm, ['-v'], { silent: true })
    : null;
  if (pmRes) checks.push({
    name: `${activePm} package manager`,
    category: 'Environment',
    ok: pmRes.ok,
    version: pmRes.stdout,
    detail: pmRes.ok ? `Installed (${pmRes.stdout})` : `${activePm} is not found in PATH`,
    suggestion: pmRes.ok
      ? undefined
      : `Install ${activePm} (${activePm === 'pnpm' ? 'npm install -g pnpm' : activePm === 'bun' ? 'curl -fsSL https://bun.sh/install | bash' : 'install ' + activePm})`
  });

  // 3. Git check
  const gitExists = await commandExists('git');
  let isGitRepo = fileExists(path.join(targetDir, '.git'));
  let inWorkTree = false;
  if (gitExists && !isGitRepo) {
    const revParse = await runExecutable('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: targetDir,
      silent: true
    });
    if (revParse.ok && revParse.stdout === 'true') {
      isGitRepo = true;
      inWorkTree = true;
    }
  }
  checks.push({
    name: 'Git VCS',
    category: 'Environment',
    ok: gitExists && isGitRepo,
    detail: gitExists
      ? isGitRepo
        ? inWorkTree
          ? 'Git installed and target directory is within an active git repository'
          : 'Git installed and repository initialized'
        : 'Git installed, but target directory is not a git repo'
      : 'Git is not installed',
    suggestion: !gitExists
      ? 'Install git via brew or Xcode Command Line Tools'
      : !isGitRepo
        ? 'Run `git init` or `aginit init` to initialize repository'
        : undefined
  });

  // 5. Codex CLI check
  const codexExists = await commandExists('codex');
  checks.push({
    name: 'Codex CLI (secondary agent)',
    category: 'AI Tooling',
    ok: codexExists,
    detail: codexExists ? 'Codex CLI available in PATH' : 'Codex CLI not found in PATH',
    suggestion: codexExists ? undefined : 'Install Codex CLI if you want dual-agent orchestration'
  });

  // 6. Skills CLI check (skills.sh engine)
  const skillsRes = await runExecutable('npx', ['-y', 'skills', '--version'], { silent: true });
  checks.push({
    name: 'Skills CLI (skills.sh engine)',
    category: 'AI Tooling',
    ok: skillsRes.ok,
    version: skillsRes.stdout,
    detail: skillsRes.ok ? `Functional (${skillsRes.stdout})` : 'Failed running npx skills',
    suggestion: skillsRes.ok ? undefined : 'Check network connectivity or npm/npx configuration'
  });

  // 7. Project-level checks
  checks.push({
    name: `Project configuration (${path.basename(configPath)})`,
    category: 'Project Config',
    ok: !!projectConfig,
    detail: projectConfig
      ? `Preset: "${projectConfig.preset}" (v${projectConfig.schemaVersion || '1.0.0'}), platform: ${platform} (${stack})${pmRes ? `, pm: ${activePm}` : ''}, agents: ${projectConfig.agents.primary}/${projectConfig.agents.secondary}${claudeCodeEnabled(projectConfig) ? '/claude-code' : ''}`
      : configError
        ? `Invalid configuration: ${configError}`
        : 'No aginit.config.json found in current directory',
    suggestion: projectConfig
      ? undefined
      : configError
        ? 'Correct the configuration fields before running initialization'
        : 'Run `aginit init` to generate declarative configuration'
  });

  // 8. AGENTS.md check
  const agentsPath = path.join(targetDir, 'AGENTS.md');
  const agentsExists = fileExists(agentsPath);
  const agentsContent = agentsExists ? readTextFile(agentsPath) || '' : '';
  const hasBlock = AGINIT_START_PATTERN.test(agentsContent);

  checks.push({
    name: 'AGENTS.md Context',
    category: 'Project Config',
    ok: agentsExists && hasBlock,
    detail: agentsExists
      ? hasBlock
        ? 'AGENTS.md present with the aginit block'
        : 'AGENTS.md present but missing the aginit block'
      : 'AGENTS.md not found in directory',
    suggestion: !agentsExists
      ? 'Run `aginit init` to generate standard AGENTS.md'
      : !hasBlock
        ? 'Run `aginit init` to add the aginit block to AGENTS.md'
        : undefined
  });

  // 9. Installed skills check
  const installedSkills = getInstalledSkills(targetDir);
  const skillsDisabled = projectConfig !== null && projectConfig.skills.sources.length === 0;
  checks.push({
    name: 'Local Agent Skills (.agents/skills/)',
    category: 'Project Config',
    ok: skillsDisabled || installedSkills.length > 0,
    detail: skillsDisabled
      ? 'Disabled in configuration (skills.sources is empty)'
      : installedSkills.length > 0
        ? `${installedSkills.length} skills installed: ${installedSkills.join(', ')}`
        : 'No skills found in .agents/skills/',
    suggestion:
      skillsDisabled || installedSkills.length > 0
        ? undefined
        : 'Run `aginit init` or `npx skills add ...` to install skills'
  });

  // 9a. Vendored skills must stay out of the project's linters and formatters
  if (installedSkills.length > 0) {
    const exposure = vendoredSkillsExposure(targetDir);
    checks.push({
      name: 'Lint/format ignores for vendored skills',
      category: 'Project Config',
      ok: exposure.length === 0,
      detail:
        exposure.length === 0
          ? 'Detected linters and formatters skip .agents/ and .claude/'
          : 'Project linters or formatters will check vendored skill files',
      suggestion:
        exposure.length === 0 ? undefined : `Run \`aginit update\`, or ${exposure.join('; ')}`
    });
  }

  // 9b. Claude Code: skills linked into .claude/skills/ and AGENTS.md reachable
  if (projectConfig !== null && claudeCodeEnabled(projectConfig)) {
    if (!skillsDisabled && installedSkills.length > 0) {
      const missing = getSkillsMissingForClaude(targetDir);
      checks.push({
        name: 'Claude Code Skills (.claude/skills/)',
        category: 'Project Config',
        ok: missing.length === 0,
        detail:
          missing.length === 0
            ? `All ${installedSkills.length} skills visible to Claude Code`
            : `${missing.length} skills not linked for Claude Code: ${missing.join(', ')}`,
        suggestion:
          missing.length === 0
            ? undefined
            : 'Run `aginit update` or `aginit init` to link skills into .claude/skills/ (or set agents.claudeCode: false)'
      });
    }

    const claudePath = path.join(targetDir, 'CLAUDE.md');
    const claudeExists = fileExists(claudePath);
    // A CLAUDE.md symlinked to AGENTS.md is as good as the import.
    const claudeIsAgentsLink =
      claudeExists &&
      agentsExists &&
      fs.realpathSync(claudePath) === fs.realpathSync(agentsPath);
    const claudeOk =
      !claudeExists ||
      claudeIsAgentsLink ||
      claudeMarkdownImportsAgents(readTextFile(claudePath) || '');
    checks.push({
      name: 'CLAUDE.md → AGENTS.md',
      category: 'Project Config',
      ok: claudeExists && claudeOk,
      detail: !claudeExists
        ? 'No CLAUDE.md; only Claude Code v2.1.277+ reads AGENTS.md on its own'
        : claudeOk
          ? 'CLAUDE.md imports AGENTS.md'
          : 'CLAUDE.md exists without `@AGENTS.md`, so Claude Code ignores AGENTS.md',
      suggestion: !claudeExists
        ? 'Run `aginit update` or `aginit init` to add a CLAUDE.md that imports AGENTS.md'
        : claudeOk
          ? undefined
          : 'Add a line `@AGENTS.md` to CLAUDE.md'
    });
  }

  // 10. Registry: each active capability's checks (skill files, CLIs, artifacts)
  if (projectConfig !== null) checks.push(...(await capabilityChecks(targetDir, projectConfig)));

  // 10. agent-browser runtime (only when the project ships the skill)
  const agentBrowserWanted =
    projectConfig !== null &&
    (activeIds(projectConfig).has('agent-browser') || agentBrowserStubInstalled(targetDir));
  if (agentBrowserWanted && (await commandExists('agent-browser'))) {
    const diagnostics = await runAgentBrowserDiagnostics();
    if (diagnostics !== null) {
      checks.push({
        name: 'agent-browser browser runtime',
        category: 'AI Tooling',
        ok: diagnostics.length === 0,
        detail:
          diagnostics.length === 0
            ? 'Upstream doctor reports browser and launch environment healthy'
            : diagnostics.map((d) => d.message).join('; '),
        suggestion:
          diagnostics.length === 0
            ? undefined
            : (diagnostics.find((d) => d.fix)?.fix ?? 'Run `agent-browser doctor` for details')
      });
    }
  }

  // 11. Chrome sandbox prerequisites — agent-browser and Playwright both
  // launch Chrome from the same sandbox on Linux.
  const sandboxRelevant = agentBrowserWanted || projectConfig?.browser.playwright === true;
  if (sandboxRelevant) {
    const restriction = findUsernsRestriction();
    if (restriction) {
      checks.push({
        name: 'Chrome sandbox (unprivileged user namespaces)',
        category: 'Environment',
        ok: false,
        detail: `${restriction.sysctl}=${restriction.value} blocks Chrome's sandbox: browser launches fail with "No usable sandbox!"`,
        suggestion: `Lift it: echo '${restriction.sysctl}=${restriction.fixValue}' | sudo tee /etc/sysctl.d/99-agent-browser-userns.conf && sudo sysctl --system — or pass --args "--no-sandbox" per launch`
      });
    } else if (process.platform === 'linux') {
      checks.push({
        name: 'Chrome sandbox (unprivileged user namespaces)',
        category: 'Environment',
        ok: true,
        detail: 'Unprivileged user namespaces available to Chrome'
      });
    }
  }

  // Print grouped results
  const categories: CheckCategory[] = ['Environment', 'AI Tooling', 'Project Config', 'Capabilities'];

  for (const cat of categories) {
    const catChecks = checks.filter((c) => c.category === cat);
    if (catChecks.length === 0) continue;
    console.log(pc.bold(pc.underline(cat)));
    for (const c of catChecks) {
      const icon = c.ok ? pc.green('✓') : pc.yellow('⚠');
      const name = pc.bold(c.name);
      console.log(`  ${icon} ${name}: ${c.detail}`);
      if (c.suggestion) {
        console.log(`    ${pc.cyan('→ Suggestion:')} ${pc.dim(c.suggestion)}`);
      }
    }
    console.log();
  }

  const passed = checks.filter((c) => c.ok).length;
  const total = checks.length;

  if (passed === total) {
    logger.success(pc.bold(`All ${total} health checks passed! System and repo are fully ready.`));
  } else {
    logger.info(`Doctor finished: ${passed}/${total} checks healthy.`);
  }
}
