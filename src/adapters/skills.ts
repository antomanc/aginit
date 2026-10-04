import fs from 'node:fs';
import path from 'node:path';
import { fileExists, readJsonFile } from '../utils/fs.js';
import { runCommand } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import { SkillSourceConfig } from '../config/schema.js';

export interface SkillsLockFile {
  version: number;
  skills: Record<string, {
    source: string;
    sourceType: string;
    skillPath: string;
    computedHash: string;
  }>;
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
  const { agents = ['antigravity', 'codex'], dryRun = false, silent = false } = options;

  const agentFlags = agents.join(' ');
  const skillFlags = source.skills.length > 0 ? source.skills.join(' ') : '*';

  const cmd = `npx -y skills add ${source.package} --skill ${skillFlags} --agent ${agentFlags} -y`;

  if (!silent) {
    logger.dim(`Installing skills from ${source.package}: ${source.skills.join(', ')}...`);
  }

  const res = await runCommand(cmd, { cwd: targetDir, dryRun, silent: true });
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
      installed.push(...source.skills);
    } else {
      failed.push(...source.skills);
    }
  }

  return { installed, failed };
}

export function getInstalledSkills(targetDir: string): string[] {
  const lockPath = path.join(targetDir, 'skills-lock.json');
  if (fileExists(lockPath)) {
    const lock = readJsonFile<SkillsLockFile>(lockPath);
    if (lock && lock.skills) {
      return Object.keys(lock.skills);
    }
  }

  // Check .agents/skills directory directly
  const skillsDir = path.join(targetDir, '.agents', 'skills');
  if (fileExists(skillsDir)) {
    try {
      return fs.readdirSync(skillsDir).filter((f) => !f.startsWith('.'));
    } catch {
      return [];
    }
  }

  return [];
}

export async function updateSkills(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): Promise<boolean> {
  const { dryRun = false, silent = false } = options;
  if (!silent) logger.dim('Updating installed skills...');
  const res = await runCommand('npx -y skills update -p -y', {
    cwd: targetDir,
    dryRun,
    silent: true
  });
  return res.ok;
}
