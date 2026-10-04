import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isInteractive, promptNewProject, promptInitProject } from '../src/cli/wizard.js';
import { createCliProgram } from '../src/cli/main.js';

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
      packageManager: 'bun',
      specWorkflow: false
    });

    expect(answers.projectName).toBe('custom-app');
    expect(answers.preset).toBe('cli');
    expect(answers.framework).toBe('none');
    expect(answers.packageManager).toBe('bun');
    expect(answers.specWorkflow).toBe(false);
  });

  it('uses provided defaults for init project', async () => {
    const answers = await promptInitProject({
      preset: 'generic',
      packageManager: 'yarn',
      specWorkflow: true
    });

    expect(answers.preset).toBe('generic');
    expect(answers.framework).toBe('existing');
    expect(answers.packageManager).toBe('yarn');
    expect(answers.specWorkflow).toBe(true);
  });

  it('auto-detects and preserves existing package manager in init project without prompting', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wizard-init-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      const answers = await promptInitProject({
        targetDir: tmpDir,
        preset: 'generic',
        specWorkflow: false
      });

      expect(answers.packageManager).toBe('yarn');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
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
