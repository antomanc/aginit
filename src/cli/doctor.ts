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
import { getInstalledSkills } from '../adapters/skills.js';
import { readProjectConfig } from '../config/validation.js';
import { logger } from '../utils/logger.js';

interface CheckItem {
  name: string;
  category: 'Environment' | 'AI Tooling' | 'Project Config';
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

  // 2. Active Package Manager check (pnpm, npm, yarn, or bun)
  const pmRes = await runExecutable(activePm, ['-v'], { silent: true });
  checks.push({
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

  // 4. Graft CLI check
  const graftExists = await commandExists('graft');
  let graftVersion = '';
  if (graftExists) {
    const gv = await runExecutable('graft', ['--version'], { silent: true });
    graftVersion = gv.stdout;
  }
  checks.push({
    name: 'Graft codebase graph CLI',
    category: 'AI Tooling',
    ok: graftExists,
    version: graftVersion,
    detail: graftExists ? `Installed globally (${graftVersion})` : 'Graft CLI not found in PATH',
    suggestion: graftExists ? undefined : 'Install Graft: `npm install -g @nanonets/graft`'
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
      ? `Preset: "${projectConfig.preset}" (v${projectConfig.schemaVersion || '1.0.0'}), pm: ${activePm}, agents: ${projectConfig.agents.primary}/${projectConfig.agents.secondary}`
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
  const hasIntakeSection = agentsContent.includes('Bootstrap & First Session');

  checks.push({
    name: 'AGENTS.md Context',
    category: 'Project Config',
    ok: agentsExists && hasIntakeSection,
    detail: agentsExists
      ? hasIntakeSection
        ? 'AGENTS.md present with intake/bootstrap guidance'
        : 'AGENTS.md present but missing intake guidance'
      : 'AGENTS.md not found in directory',
    suggestion: !agentsExists
      ? 'Run `aginit init` to generate standard AGENTS.md'
      : !hasIntakeSection
        ? 'Run `aginit init` to add intake section to AGENTS.md'
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

  // Print grouped results
  const categories: Array<'Environment' | 'AI Tooling' | 'Project Config'> = [
    'Environment',
    'AI Tooling',
    'Project Config'
  ];

  for (const cat of categories) {
    console.log(pc.bold(pc.underline(cat)));
    const catChecks = checks.filter((c) => c.category === cat);
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
