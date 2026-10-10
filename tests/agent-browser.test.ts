import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  agentBrowserConfigured,
  agentBrowserStubInstalled,
  findUsernsRestriction,
  setupAgentBrowser,
  runAgentBrowserDiagnostics
} from '../src/adapters/agent-browser.js';
import { createProject } from '../src/cli/new.js';
import { runDoctor } from '../src/cli/doctor.js';
import { getDefaultConfig } from '../src/config/defaults.js';

const shell = vi.hoisted(() => ({ runExecutable: vi.fn(), commandExists: vi.fn() }));
vi.mock('../src/utils/shell.js', async (original) => ({
  ...(await original<typeof import('../src/utils/shell.js')>()),
  ...shell
}));

const success = { ok: true, exitCode: 0, stdout: '', stderr: '' };
let dir: string;
let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aginit-ab-'));
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  shell.commandExists.mockResolvedValue(false);
  shell.runExecutable.mockReset().mockResolvedValue(success);
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});
const output = () => log.mock.calls.flat().join('\n');
const writeConfig = (config: unknown) =>
  fs.writeFileSync(path.join(dir, 'aginit.config.json'), JSON.stringify(config));

/** A fake proc root holding the kernel sysctls under test. */
function fakeProc(values: Record<string, string>): string {
  const proc = fs.mkdtempSync(path.join(os.tmpdir(), 'aginit-proc-'));
  fs.mkdirSync(path.join(proc, 'sys', 'kernel'), { recursive: true });
  for (const [sysctl, value] of Object.entries(values)) {
    fs.writeFileSync(path.join(proc, 'sys', ...sysctl.split('.')), `${value}\n`);
  }
  return proc;
}

describe('agent-browser skill detection', () => {
  it('detects when a config will install the agent-browser skill stub', () => {
    expect(agentBrowserConfigured(getDefaultConfig('app', 'web').skills.sources)).toBe(true);
    expect(agentBrowserConfigured(getDefaultConfig('app', 'cli').skills.sources)).toBe(false);
    expect(agentBrowserConfigured(getDefaultConfig('app', 'generic').skills.sources)).toBe(false);
    expect(agentBrowserConfigured([{ package: 'vercel-labs/agent-browser', skills: [] }])).toBe(
      true
    );
    expect(
      agentBrowserConfigured([{ package: 'vercel-labs/agent-browser', skills: ['*'] }])
    ).toBe(true);
    expect(
      agentBrowserConfigured([{ package: 'vercel-labs/agent-browser', skills: ['readme'] }])
    ).toBe(false);
    expect(agentBrowserConfigured([{ package: 'other/repo', skills: ['agent-browser'] }])).toBe(
      true
    );
  });

  it('recognizes an agent-browser skill stub already on disk', () => {
    expect(agentBrowserStubInstalled(dir)).toBe(false);
    const stub = path.join(dir, '.agents', 'skills', 'agent-browser', 'SKILL.md');
    fs.mkdirSync(path.dirname(stub), { recursive: true });
    fs.writeFileSync(stub, '# agent-browser');
    expect(agentBrowserStubInstalled(dir)).toBe(true);
  });
});

describe('Chrome sandbox restriction detection', () => {
  it('reads the Linux sysctls that block Chrome sandbox launches', () => {
    const proc = fakeProc({});
    try {
      expect(findUsernsRestriction(proc)).toBeNull();

      fs.writeFileSync(
        path.join(proc, 'sys', 'kernel', 'apparmor_restrict_unprivileged_userns'),
        '0\n'
      );
      expect(findUsernsRestriction(proc)).toBeNull();

      fs.writeFileSync(
        path.join(proc, 'sys', 'kernel', 'apparmor_restrict_unprivileged_userns'),
        '1\n'
      );
      expect(findUsernsRestriction(proc)).toEqual({
        sysctl: 'kernel.apparmor_restrict_unprivileged_userns',
        value: '1',
        fixValue: '0'
      });

      fs.writeFileSync(
        path.join(proc, 'sys', 'kernel', 'apparmor_restrict_unprivileged_userns'),
        '0\n'
      );
      fs.writeFileSync(path.join(proc, 'sys', 'kernel', 'unprivileged_userns_clone'), '0\n');
      expect(findUsernsRestriction(proc)).toEqual({
        sysctl: 'kernel.unprivileged_userns_clone',
        value: '0',
        fixValue: '1'
      });
    } finally {
      fs.rmSync(proc, { recursive: true, force: true });
    }
  });
});

describe('setupAgentBrowser', () => {
  it('installs the missing CLI and then the browser binaries', async () => {
    shell.commandExists.mockResolvedValue(false);
    expect(await setupAgentBrowser({ silent: true })).toBe(true);
    expect(shell.runExecutable).toHaveBeenCalledWith(
      'npm',
      ['install', '-g', 'agent-browser'],
      expect.objectContaining({ silent: true })
    );
    expect(shell.runExecutable).toHaveBeenCalledWith(
      'agent-browser',
      ['install'],
      expect.objectContaining({ silent: true })
    );
  });

  it('skips the global install when the CLI is already on PATH', async () => {
    shell.commandExists.mockResolvedValue(true);
    expect(await setupAgentBrowser({ silent: true })).toBe(true);
    expect(shell.runExecutable).toHaveBeenCalledTimes(1);
    expect(shell.runExecutable).toHaveBeenCalledWith(
      'agent-browser',
      ['install'],
      expect.anything()
    );
  });

  it('reports failed provisioning instead of leaving a broken skill', async () => {
    shell.commandExists.mockResolvedValue(false);
    shell.runExecutable.mockResolvedValueOnce({ ...success, ok: false, stderr: 'EACCES' });
    expect(await setupAgentBrowser({ silent: true })).toBe(false);

    shell.commandExists.mockResolvedValue(true);
    shell.runExecutable.mockResolvedValueOnce({ ...success, ok: false, stderr: 'network down' });
    expect(await setupAgentBrowser({ silent: true })).toBe(false);
  });

  it('lists both commands during a dry run', async () => {
    shell.commandExists.mockResolvedValue(false);
    expect(await setupAgentBrowser({ dryRun: true, silent: true })).toBe(true);
    expect(shell.runExecutable).toHaveBeenCalledWith(
      'npm',
      ['install', '-g', 'agent-browser'],
      expect.objectContaining({ dryRun: true })
    );
    expect(shell.runExecutable).toHaveBeenCalledWith(
      'agent-browser',
      ['install'],
      expect.objectContaining({ dryRun: true })
    );
  });

  it('warns with both fixes when the sandbox is blocked, without failing', async () => {
    const proc = fakeProc({ 'kernel.apparmor_restrict_unprivileged_userns': '1' });
    try {
      shell.commandExists.mockResolvedValue(true);
      expect(await setupAgentBrowser({ procRoot: proc })).toBe(true);
      const text = output();
      expect(text).toContain('kernel.apparmor_restrict_unprivileged_userns=1');
      expect(text).toContain('99-agent-browser-userns.conf');
      expect(text).toContain('--no-sandbox');
    } finally {
      fs.rmSync(proc, { recursive: true, force: true });
    }
  });

  it('stays quiet about sandbox settings in silent mode', async () => {
    const proc = fakeProc({ 'kernel.apparmor_restrict_unprivileged_userns': '1' });
    try {
      shell.commandExists.mockResolvedValue(true);
      expect(await setupAgentBrowser({ procRoot: proc, silent: true })).toBe(true);
      expect(output()).not.toContain('--no-sandbox');
    } finally {
      fs.rmSync(proc, { recursive: true, force: true });
    }
  });
});

describe('runAgentBrowserDiagnostics', () => {
  it('surfaces upstream doctor failures with their fixes', async () => {
    shell.runExecutable.mockResolvedValueOnce({
      ok: false,
      exitCode: 1,
      stdout: JSON.stringify({
        success: false,
        checks: [
          {
            id: 'chrome.installed',
            status: 'fail',
            message: 'No browser downloaded',
            fix: 'agent-browser install'
          },
          { id: 'env.version', status: 'pass', message: 'ok' }
        ]
      }),
      stderr: ''
    });
    expect(await runAgentBrowserDiagnostics()).toEqual([
      { message: 'No browser downloaded', fix: 'agent-browser install' }
    ]);
  });

  it('returns null when the report cannot be parsed', async () => {
    shell.runExecutable.mockResolvedValueOnce({ ...success, stdout: 'agent-browser 0.39.0' });
    expect(await runAgentBrowserDiagnostics()).toBeNull();
  });
});

describe('createProject provisioning', () => {
  it('provisions the runtime when a web project installs the skill', async () => {
    const ok = await createProject('webapp', {
      preset: 'web',
      targetDir: dir,
      git: false,
      graft: false,
      silent: true
    });
    expect(ok).toBe(true);
    expect(shell.runExecutable).toHaveBeenCalledWith(
      'npm',
      ['install', '-g', 'agent-browser'],
      expect.anything()
    );
    expect(shell.runExecutable).toHaveBeenCalledWith(
      'agent-browser',
      ['install'],
      expect.anything()
    );
  });

  it('leaves the runtime alone when the skill is not configured', async () => {
    await createProject('cliapp', {
      preset: 'cli',
      skills: false,
      targetDir: dir,
      git: false,
      graft: false,
      silent: true
    });
    expect(shell.runExecutable).not.toHaveBeenCalledWith('npm', expect.anything(), expect.anything());
    expect(shell.runExecutable).not.toHaveBeenCalledWith(
      'agent-browser',
      expect.anything(),
      expect.anything()
    );
  });

  it('provisions for a skill stub left on disk even with --no-skills', async () => {
    const stub = path.join(dir, '.agents', 'skills', 'agent-browser', 'SKILL.md');
    fs.mkdirSync(path.dirname(stub), { recursive: true });
    fs.writeFileSync(stub, '# agent-browser');
    await createProject('existing', {
      preset: 'web',
      skills: false,
      targetDir: dir,
      git: false,
      graft: false,
      silent: true
    });
    expect(shell.runExecutable).toHaveBeenCalledWith(
      'agent-browser',
      ['install'],
      expect.anything()
    );
  });

  it('fails the run when provisioning fails', async () => {
    shell.runExecutable.mockImplementation(async (bin: string, args: string[]) => {
      if (bin === 'npm') return { ...success, ok: false, stderr: 'EACCES' };
      return success;
    });
    await expect(
      createProject('webapp', {
        preset: 'web',
        targetDir: dir,
        git: false,
        graft: false,
        silent: true
      })
    ).resolves.toBe(false);
  });

  it('announces the provisioning step only when the skill applies', async () => {
    const strip = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, '');
    await createProject('webapp', {
      preset: 'web',
      targetDir: path.join(dir, 'web'),
      git: false,
      graft: false,
      silent: false
    });
    expect(strip(output())).toContain('Provisioning agent-browser runtime');
    expect(strip(output())).toContain('[7/7]');

    log.mockClear();
    await createProject('cliapp', {
      preset: 'cli',
      skills: false,
      targetDir: path.join(dir, 'cli'),
      git: false,
      graft: false,
      silent: false
    });
    expect(strip(output())).not.toContain('Provisioning agent-browser runtime');
    expect(strip(output())).toContain('[6/6]');
  });
});

describe('doctor agent-browser checks', () => {
  it('flags a configured skill whose CLI is missing', async () => {
    writeConfig(getDefaultConfig('app', 'web'));
    shell.commandExists.mockResolvedValue(false);
    await runDoctor(dir);
    expect(output()).toContain('agent-browser CLI');
    expect(output()).toContain('npm i -g agent-browser');
  });

  it('stays quiet about agent-browser in projects that do not use it', async () => {
    writeConfig(getDefaultConfig('app', 'generic'));
    await runDoctor(dir);
    expect(output()).not.toContain('agent-browser');
  });

  it('reports upstream runtime failures when the CLI exists', async () => {
    writeConfig(getDefaultConfig('app', 'web'));
    shell.commandExists.mockResolvedValue(true);
    shell.runExecutable.mockImplementation(async (bin: string, args: string[]) => {
      if (bin === 'agent-browser' && args.includes('doctor')) {
        return {
          ok: false,
          exitCode: 1,
          stdout: JSON.stringify({
            success: false,
            checks: [
              { status: 'fail', message: 'No browser downloaded', fix: 'agent-browser install' }
            ]
          }),
          stderr: ''
        };
      }
      if (bin === 'agent-browser') return { ...success, stdout: 'agent-browser 0.39.0' };
      return success;
    });
    await runDoctor(dir);
    expect(output()).toContain('No browser downloaded');
    expect(output()).toContain('agent-browser install');
  });
});
