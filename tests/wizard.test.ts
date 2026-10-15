import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isInteractive, promptNewProject, promptInitProject } from '../src/cli/wizard.js';
import * as prompts from '@clack/prompts';
import { createProject } from '../src/cli/new.js';
import { createCliProgram } from '../src/cli/main.js';

vi.mock('@clack/prompts', () => ({
  select: vi.fn(async (options) => options.initialValue),
  multiselect: vi.fn(async () => [] as string[]),
  isCancel: () => false,
  cancel: vi.fn(),
  note: vi.fn(),
  confirm: vi.fn(async () => true)
}));

describe('Wizard & Interactive Prompts', () => {
  const originalEnv = { ...process.env };
  const originalIsTTY = process.stdin.isTTY;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    process.stdin.isTTY = originalIsTTY;
  });

  it('detects non-interactive environment in CI', () => {
    process.env.CI = 'true';
    expect(isInteractive()).toBe(false);
  });

  it('detects non-interactive environment when stdin is not a TTY', () => {
    delete process.env.CI;
    process.stdin.isTTY = false;
    expect(isInteractive()).toBe(false);
  });

  it('uses provided defaults for new project without prompting for preset, framework or package manager', async () => {
    const answers = await promptNewProject({
      projectName: 'custom-app',
      preset: 'cli',
      packageManager: 'bun'
    });

    expect(answers.projectName).toBe('custom-app');
    expect(answers.preset).toBe('cli');
    expect(answers.framework).toBe('none');
    expect(answers.packageManager).toBe('bun');
  });

  it('uses provided defaults for init project', async () => {
    const answers = await promptInitProject({
      preset: 'generic',
      packageManager: 'yarn'
    });

    expect(answers.preset).toBe('generic');
    expect(answers.framework).toBe('existing');
    expect(answers.packageManager).toBe('yarn');
  });

  it('auto-detects and preserves existing package manager in init project without prompting', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wizard-init-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      const answers = await promptInitProject({
        targetDir: tmpDir,
        preset: 'generic'
      });

      expect(answers.packageManager).toBe('yarn');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('defaults Flutter init to native tooling and offers e2e without Node-only engines', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wizard-flutter-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'pubspec.yaml'), 'name: app');
      const answers = await promptInitProject({ targetDir: tmpDir });
      expect(answers.preset).toBe('generic');
      expect(answers.profile).toEqual({
        platform: 'mobile-native', methodology: 'pocock', design: 'impeccable',
        testing: 'native', uiDriver: 'agent-device', addons: []
      });
      const testing = vi.mocked(prompts.select).mock.calls.find(([o]) => o.message === 'Testing engine');
      expect(testing?.[0].options.map((o) => o.value)).toEqual(['native', 'e2e']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      vi.clearAllMocks();
    }
  });

  it('keeps Playwright as the detected default for a new Vite app', async () => {
    const answers = await promptNewProject({
      projectName: 'web-app', preset: 'web', framework: 'vite', packageManager: 'pnpm'
    });
    expect(answers.profile.testing).toBe('playwright');
    expect(answers.profile.uiDriver).toBe('agent-browser');
  });

  it('applies wizard selections to a Flutter project without adding Node files', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wizard-apply-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'pubspec.yaml'), 'name: app');
      vi.mocked(prompts.select).mockImplementation(async (options) => {
        const choices: Record<string, string> = {
          Methodology: 'superpowers', Design: 'none', 'UI driver': 'none'
        };
        return choices[options.message] ?? options.initialValue as never;
      });
      const answers = await promptInitProject({ targetDir: tmpDir });
      await createProject('app', {
        ...answers, targetDir: tmpDir, skills: false, graft: false, git: false, silent: true
      });
      const config = JSON.parse(fs.readFileSync(path.join(tmpDir, 'aginit.config.json'), 'utf8'));
      expect(config).toMatchObject({ platform: 'mobile-native', stack: 'flutter' });
      expect(config.capabilities).toContain('superpowers');
      expect(config.capabilities).toContain('native');
      expect(config.capabilities).not.toContain('impeccable');
      expect(config.capabilities).not.toContain('agent-device');
      expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, 'tsconfig.json'))).toBe(false);
      expect(fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf8')).toContain('flutter test');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      vi.mocked(prompts.select).mockImplementation(async (options) => options.initialValue as never);
      vi.clearAllMocks();
    }
  });

  it('uses agent setup only for a new native mobile project', async () => {
    vi.mocked(prompts.select).mockImplementationOnce(async () => 'mobile-native' as never);
    const answers = await promptNewProject({ projectName: 'mobile-app' });
    expect(answers.preset).toBe('generic');
    expect(answers.profile).toMatchObject({
      platform: 'mobile-native', testing: 'native', uiDriver: 'agent-device', addons: []
    });
  });

  it('offers compatible registry add-ons and carries the selection into the profile', async () => {
    vi.mocked(prompts.multiselect).mockResolvedValueOnce(['chrome-devtools-mcp']);
    const answers = await promptNewProject({
      projectName: 'web-app', preset: 'web', framework: 'vite', packageManager: 'pnpm'
    });
    expect(answers.profile.addons).toEqual(['chrome-devtools-mcp']);
    const options = vi.mocked(prompts.multiselect).mock.calls.at(-1)?.[0].options;
    expect(options?.map((option) => option.value)).toContain('context-mode');
  });

  it('CLI handles no arguments cleanly in non-interactive mode', async () => {
    process.env.CI = 'true';
    const program = createCliProgram();
    const helpSpy = vi.spyOn(program, 'outputHelp').mockImplementation(() => {});

    await program.parseAsync(['node', 'aginit']);
    expect(helpSpy).toHaveBeenCalled();
  });

  it('CLI rejects "aginit new" without projectName in non-interactive mode', async () => {
    process.env.CI = 'true';
    const program = createCliProgram();
    program.exitOverride();

    await expect(program.parseAsync(['node', 'aginit', 'new'])).rejects.toThrow(
      "error: missing required argument 'projectName'"
    );
  });
});
