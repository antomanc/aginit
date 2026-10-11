import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createProject } from '../src/cli/new.js';
import { createCliProgram } from '../src/cli/main.js';
import { runDoctor } from '../src/cli/doctor.js';
import {
  ensureClaudeSkillLinks,
  getSkillsMissingForClaude,
  skillAgents
} from '../src/adapters/skills.js';
import { initGraft } from '../src/adapters/graft.js';
import { claudeMarkdownImportsAgents } from '../src/adapters/agents-md.js';
import { getDefaultConfig } from '../src/config/defaults.js';
import { readProjectConfig, validateConfig } from '../src/config/validation.js';

const shell = vi.hoisted(() => ({ runExecutable: vi.fn(), commandExists: vi.fn() }));
vi.mock('../src/utils/shell.js', async (original) => ({
  ...(await original<typeof import('../src/utils/shell.js')>()),
  ...shell
}));

const success = { ok: true, exitCode: 0, stdout: '1.0.0', stderr: '' };
let dir: string;
let cwd: string;
let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aginit-claude-'));
  cwd = process.cwd();
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  shell.commandExists.mockResolvedValue(true);
  shell.runExecutable.mockReset().mockResolvedValue(success);
});
afterEach(() => {
  process.chdir(cwd);
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

const legacyConfig = () => {
  const config: any = getDefaultConfig('app', 'generic');
  delete config.agents.claudeCode;
  config.codebase.graft = false;
  return config;
};
const skillCalls = () =>
  shell.runExecutable.mock.calls.filter(([bin, args]) => bin === 'npx' && args[2] === 'add');
const addSkill = (base: string, name: string) => {
  fs.mkdirSync(path.join(dir, base, 'skills', name), { recursive: true });
  fs.writeFileSync(path.join(dir, base, 'skills', name, 'SKILL.md'), `# ${name}\n`);
};

it('enables Claude Code in every default preset', () => {
  for (const preset of ['web', 'cli', 'generic'] as const) {
    const config = getDefaultConfig('app', preset);
    expect(config.agents.claudeCode).toBe(true);
    expect(skillAgents(config)).toEqual(['antigravity', 'codex', 'claude-code']);
  }
});

it('loads legacy configs without the claudeCode flag and treats them as enabled', () => {
  fs.writeFileSync(path.join(dir, 'aginit.config.json'), JSON.stringify(legacyConfig()));
  const config = readProjectConfig(dir)!;
  expect(config.agents.claudeCode).toBeUndefined();
  expect(skillAgents(config)).toContain('claude-code');
});

it('rejects a non-boolean claudeCode flag', () => {
  const config: any = getDefaultConfig('app', 'generic');
  config.agents.claudeCode = 'yes';
  expect(() => validateConfig(config)).toThrow(/agents\.claudeCode/);
});

it('does not duplicate claude-code when it is already a configured agent', () => {
  const config = getDefaultConfig('app', 'generic');
  config.agents.secondary = 'claude-code';
  expect(skillAgents(config)).toEqual(['antigravity', 'claude-code']);
});

it('installs skills for Claude Code and writes a CLAUDE.md that imports AGENTS.md', async () => {
  await createProject('app', { targetDir: dir, git: false, graft: false, silent: true });
  expect(skillCalls().length).toBeGreaterThan(0);
  for (const [, args] of skillCalls()) {
    const agents = args.slice(args.indexOf('--agent') + 1, -1);
    expect(agents).toEqual(['antigravity', 'codex', 'claude-code']);
  }
  expect(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n');
});

it('leaves Claude Code out when agents.claudeCode is false', async () => {
  const config = legacyConfig();
  config.agents.claudeCode = false;
  fs.writeFileSync(path.join(dir, 'aginit.config.json'), JSON.stringify(config));
  await createProject('app', { targetDir: dir, git: false, silent: true });
  for (const [, args] of skillCalls()) expect(args).not.toContain('claude-code');
  expect(fs.existsSync(path.join(dir, 'CLAUDE.md'))).toBe(false);
});

it('preserves an existing CLAUDE.md', async () => {
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Mine\n');
  await createProject('app', {
    targetDir: dir,
    git: false,
    graft: false,
    skills: false,
    silent: true
  });
  expect(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8')).toBe('# Mine\n');
});

it('wires Graft for Claude Code only when enabled', async () => {
  await initGraft(dir, { silent: true });
  expect(shell.runExecutable).toHaveBeenLastCalledWith(
    'graft',
    ['init', '--no-global', '--agents', 'antigravity', 'agents', 'claude', '-y'],
    expect.anything()
  );
  await initGraft(dir, { silent: true, claude: false });
  expect(shell.runExecutable).toHaveBeenLastCalledWith(
    'graft',
    ['init', '--no-global', '--agents', 'antigravity', 'agents', '-y'],
    expect.anything()
  );
});

it('detects skills not linked into .claude/skills/', () => {
  addSkill('.agents', 'tdd');
  addSkill('.agents', 'wayfinder');
  addSkill('.claude', 'tdd');
  expect(getSkillsMissingForClaude(dir)).toEqual(['wayfinder']);
});

it('relinks a legacy project for Claude Code only when skills are missing', async () => {
  const config = legacyConfig();
  addSkill('.agents', 'wayfinder');
  await ensureClaudeSkillLinks(dir, config, { silent: true });
  expect(skillCalls()).toHaveLength(config.skills.sources.length);
  expect(skillCalls()[0][1]).toContain('claude-code');

  shell.runExecutable.mockClear();
  addSkill('.claude', 'wayfinder');
  await ensureClaudeSkillLinks(dir, config, { silent: true });
  expect(skillCalls()).toHaveLength(0);
});

it('links skills and adds CLAUDE.md during aginit update on a legacy project', async () => {
  fs.writeFileSync(path.join(dir, 'aginit.config.json'), JSON.stringify(legacyConfig()));
  addSkill('.agents', 'wayfinder');
  process.chdir(dir);
  await createCliProgram().parseAsync(['node', 'aginit', 'update']);
  expect(skillCalls().some(([, args]) => args.includes('claude-code'))).toBe(true);
  expect(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n');
});

it('doctor flags unlinked skills and a CLAUDE.md without the AGENTS.md import', async () => {
  fs.writeFileSync(path.join(dir, 'aginit.config.json'), JSON.stringify(legacyConfig()));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# app\n');
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Mine\n');
  addSkill('.agents', 'wayfinder');
  await runDoctor(dir);
  const output = log.mock.calls.flat().join('\n');
  expect(output).toContain('not linked for Claude Code: wayfinder');
  expect(output).toContain('Claude Code ignores AGENTS.md');
});

it('recognizes the AGENTS.md import forms', () => {
  expect(claudeMarkdownImportsAgents('@AGENTS.md\n')).toBe(true);
  expect(claudeMarkdownImportsAgents('# Notes\n\n@./AGENTS.md\n')).toBe(true);
  expect(claudeMarkdownImportsAgents('Read AGENTS.md first.\n')).toBe(false);
});
