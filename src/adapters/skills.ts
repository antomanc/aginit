import fs from 'node:fs';
import path from 'node:path';
import { fileExists, readJsonFile } from '../utils/fs.js';
import { runExecutable } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import { validateUpstreamArgument } from '../config/validation.js';
import { AginitConfig, SkillSourceConfig } from '../config/schema.js';

/** The skills CLI id for Claude Code; it links skills into `.claude/skills/`. */
export const CLAUDE_CODE_AGENT = 'claude-code';

export function claudeCodeEnabled(config: Pick<AginitConfig, 'agents'>): boolean {
  return config.agents.claudeCode !== false;
}

/** Agents the skills CLI installs into, deduplicated. */
export function skillAgents(config: Pick<AginitConfig, 'agents'>): string[] {
  const agents = [config.agents.primary, config.agents.secondary];
  if (claudeCodeEnabled(config)) agents.push(CLAUDE_CODE_AGENT);
  return [...new Set(agents)];
}

export interface SkillsLockFile {
  version: number;
  skills: Record<
    string,
    {
      source: string;
      sourceType: string;
      skillPath: string;
      computedHash: string;
    }
  >;
}

export interface SkillInstallOptions {
  agents?: string[];
  dryRun?: boolean;
  silent?: boolean;
}

export async function installSkillSource(
  targetDir: string,
  source: SkillSourceConfig,
  options: SkillInstallOptions = {}
): Promise<{ ok: boolean; message?: string }> {
  const { agents = ['antigravity', 'codex', CLAUDE_CODE_AGENT], dryRun = false, silent = false } = options;

  validateUpstreamArgument(source.package, 'skill package');
  for (const skill of source.skills) validateUpstreamArgument(skill, 'skill name');
  for (const agent of agents) validateUpstreamArgument(agent, 'agent');
  const args = [
    '-y',
    'skills',
    'add',
    source.package,
    '--skill',
    ...(source.skills.length ? source.skills : ['*']),
    '--agent',
    ...agents,
    '-y'
  ];

  if (!silent) {
    logger.dim(`Installing skills from ${source.package}: ${source.skills.join(', ')}...`);
  }

  const res = await runExecutable('npx', args, { cwd: targetDir, dryRun, silent: true });
  if (!res.ok) {
    logger.warn(`Failed installing skills from ${source.package}: ${res.stderr || res.stdout}`);
    return { ok: false, message: res.stderr || res.stdout };
  }

  return { ok: true };
}

export async function installAllSkills(
  targetDir: string,
  sources: SkillSourceConfig[],
  options: SkillInstallOptions = {}
): Promise<{ installed: string[]; failed: string[] }> {
  const installed: string[] = [];
  const failed: string[] = [];

  for (const source of sources) {
    const res = await installSkillSource(targetDir, source, options);
    if (res.ok) {
      installed.push(...(source.skills.length ? source.skills : [`${source.package}:*`]));
    } else {
      failed.push(...(source.skills.length ? source.skills : [`${source.package}:*`]));
    }
  }

  return { installed, failed };
}

export function getInstalledSkills(targetDir: string): string[] {
  // The lockfile only records what the skills CLI installed through aginit;
  // skills added by hand live on disk only, so report the union of both.
  const installed = new Set<string>();

  const lockPath = path.join(targetDir, 'skills-lock.json');
  if (fileExists(lockPath)) {
    const lock = readJsonFile<SkillsLockFile>(lockPath);
    for (const name of Object.keys(lock?.skills ?? {})) installed.add(name);
  }

  const skillsDir = path.join(targetDir, '.agents', 'skills');
  if (fileExists(skillsDir)) {
    try {
      for (const entry of fs.readdirSync(skillsDir)) {
        if (!entry.startsWith('.')) installed.add(entry);
      }
    } catch {
      // Unreadable directory: keep whatever the lockfile reported.
    }
  }

  return [...installed];
}

/**
 * Installed skills Claude Code cannot see because `.claude/skills/<name>/SKILL.md`
 * is missing (the skills CLI links them there when `claude-code` is an agent).
 */
export function getSkillsMissingForClaude(targetDir: string): string[] {
  return getInstalledSkills(targetDir).filter(
    (name) => !fileExists(path.join(targetDir, '.claude', 'skills', name, 'SKILL.md'))
  );
}

/**
 * Bring projects set up before Claude Code support up to date: when Claude Code
 * is enabled and some installed skill is not linked into `.claude/skills/`,
 * reinstall the configured sources with the full agent list (idempotent).
 */
export async function ensureClaudeSkillLinks(
  targetDir: string,
  config: AginitConfig,
  options: { dryRun?: boolean; silent?: boolean } = {}
): Promise<boolean> {
  if (!claudeCodeEnabled(config) || config.skills.sources.length === 0) return true;
  if (getSkillsMissingForClaude(targetDir).length === 0) return true;
  if (!options.silent) logger.dim('Linking skills into .claude/skills/ for Claude Code...');
  const { failed } = await installAllSkills(targetDir, config.skills.sources, {
    ...options,
    agents: skillAgents(config)
  });
  return failed.length === 0;
}

export async function updateSkills(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): Promise<boolean> {
  const { dryRun = false, silent = false } = options;
  if (!silent) logger.dim('Updating installed skills...');
  const res = await runExecutable('npx', ['-y', 'skills', 'update', '-p', '-y'], {
    cwd: targetDir,
    dryRun,
    silent: true
  });
  return res.ok;
}

/** Remove skills from every agent through the Skills CLI (`npx skills remove`). */
export async function removeSkills(
  targetDir: string,
  skills: string[],
  options: { dryRun?: boolean; silent?: boolean } = {}
): Promise<boolean> {
  if (skills.length === 0) return true;
  for (const skill of skills) validateUpstreamArgument(skill, 'skill name');
  if (!options.silent) logger.dim(`Removing skills: ${skills.join(', ')}...`);
  const res = await runExecutable('npx', ['-y', 'skills', 'remove', ...skills, '-y'], {
    cwd: targetDir,
    dryRun: options.dryRun,
    silent: true
  });
  if (!res.ok) logger.warn(`Failed removing skills: ${res.stderr || res.stdout}`);
  return res.ok;
}
