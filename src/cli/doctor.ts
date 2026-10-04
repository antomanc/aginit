import path from 'node:path';
import pc from 'picocolors';
import { runCommand, commandExists } from '../utils/shell.js';
import { fileExists, readJsonFile, readTextFile } from '../utils/fs.js';
import { AI_CONFIG_FILENAME, AIProjectConfig } from '../config/schema.js';
import { getInstalledSkills } from '../adapters/skills.js';
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
  logger.banner('AI Project Bootstrap — System & Project Doctor', `Target: ${targetDir}`);

  const checks: CheckItem[] = [];

  // 1. Node.js check
  const nodeRes = await runCommand('node -v', { silent: true });
  checks.push({
    name: 'Node.js runtime',
    category: 'Environment',
    ok: nodeRes.ok,
    version: nodeRes.stdout,
    detail: nodeRes.ok ? `Installed (${nodeRes.stdout})` : 'Node.js is not found in PATH',
    suggestion: nodeRes.ok ? undefined : 'Install Node.js (>= 20 recommended) via nvm or brew'
  });

  // 2. pnpm check
  const pnpmRes = await runCommand('pnpm -v', { silent: true });
  checks.push({
    name: 'pnpm package manager',
    category: 'Environment',
    ok: pnpmRes.ok,
    version: pnpmRes.stdout,
    detail: pnpmRes.ok ? `Installed (${pnpmRes.stdout})` : 'pnpm is not found in PATH',
    suggestion: pnpmRes.ok ? undefined : 'Install pnpm: `npm install -g pnpm`'
  });

  // 3. Git check
  const gitExists = await commandExists('git');
  const isGitRepo = fileExists(path.join(targetDir, '.git'));
  checks.push({
    name: 'Git VCS',
    category: 'Environment',
    ok: gitExists && isGitRepo,
    detail: gitExists
      ? (isGitRepo ? 'Git installed and repository initialized' : 'Git installed, but target directory is not a git repo')
      : 'Git is not installed',
    suggestion: !gitExists
      ? 'Install git via brew or Xcode Command Line Tools'
      : (!isGitRepo ? 'Run `git init` or `ai-init` to initialize repository' : undefined)
  });

  // 4. Graft CLI check
  const graftExists = await commandExists('graft');
  let graftVersion = '';
  if (graftExists) {
    const gv = await runCommand('graft --version', { silent: true });
    graftVersion = gv.stdout;
  }
  checks.push({
    name: 'Graft codebase graph CLI',
    category: 'AI Tooling',
    ok: graftExists,
    version: graftVersion,
    detail: graftExists ? `Installed globally (${graftVersion})` : 'Graft CLI not found in PATH',
    suggestion: graftExists ? undefined : 'Install Graft for codebase understanding: `npm i -g graft`'
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
  const skillsRes = await runCommand('npx -y skills --version', { silent: true });
  checks.push({
    name: 'Skills CLI (skills.sh engine)',
    category: 'AI Tooling',
    ok: skillsRes.ok,
    version: skillsRes.stdout,
    detail: skillsRes.ok ? `Functional (${skillsRes.stdout})` : 'Failed running npx skills',
    suggestion: skillsRes.ok ? undefined : 'Check network connectivity or npm/npx configuration'
  });

  // 7. Project-level checks (if target dir has ai.config.json or AGENTS.md)
  const configPath = path.join(targetDir, AI_CONFIG_FILENAME);
  const configExists = fileExists(configPath);
  const projectConfig = configExists ? readJsonFile<AIProjectConfig>(configPath) : null;

  checks.push({
    name: 'Project configuration (ai.config.json)',
    category: 'Project Config',
    ok: !!projectConfig,
    detail: projectConfig
      ? `Preset: "${projectConfig.preset}", agents: ${projectConfig.agents.primary}/${projectConfig.agents.secondary}`
      : 'No ai.config.json found in current directory',
    suggestion: projectConfig ? undefined : 'Run `ai-init` to generate declarative configuration'
  });

  // 8. AGENTS.md check
  const agentsPath = path.join(targetDir, 'AGENTS.md');
  const agentsExists = fileExists(agentsPath);
  const agentsContent = agentsExists ? (readTextFile(agentsPath) || '') : '';
  const hasIntakeSection = agentsContent.includes('Bootstrap & First Session');

  checks.push({
    name: 'AGENTS.md Context',
    category: 'Project Config',
    ok: agentsExists && hasIntakeSection,
    detail: agentsExists
      ? (hasIntakeSection ? 'AGENTS.md present with intake/bootstrap guidance' : 'AGENTS.md present but missing intake guidance')
      : 'AGENTS.md not found in directory',
    suggestion: !agentsExists
      ? 'Run `ai-init` to generate standard AGENTS.md'
      : (!hasIntakeSection ? 'Run `ai-init` to add intake section to AGENTS.md' : undefined)
  });

  // 9. Installed skills check
  const installedSkills = getInstalledSkills(targetDir);
  checks.push({
    name: 'Local Agent Skills (.agents/skills/)',
    category: 'Project Config',
    ok: installedSkills.length > 0,
    detail: installedSkills.length > 0
      ? `${installedSkills.length} skills installed: ${installedSkills.join(', ')}`
      : 'No skills found in .agents/skills/',
    suggestion: installedSkills.length === 0 ? 'Run `ai-init` or `npx skills add ...` to install skills' : undefined
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
