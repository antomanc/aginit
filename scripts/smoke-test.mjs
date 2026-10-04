import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'aginit-smoke-install-'));
const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aginit-smoke-projects-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const frameworks = process.argv.includes('--frameworks');
function run(bin, args, cwd, options = {}) {
  try {
    return execFileSync(bin, args, {
      cwd,
      encoding: 'utf8',
      timeout: 300_000,
      env: { ...process.env, CI: 'true', NEXT_TELEMETRY_DISABLED: '1' },
      shell: process.platform === 'win32',
      ...options
    });
  } catch (error) {
    throw new Error(
      `${bin} ${args.join(' ')} failed:\n${error.stdout || ''}\n${error.stderr || error.message}`
    );
  }
}
function manifest(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
}
const flags = ['--no-skills', '--no-graft'];
async function serve(dir, preset) {
  const server = spawn(
    npm,
    [
      'run',
      preset === 'vite' ? 'dev' : 'start',
      '--',
      ...(preset === 'vite'
        ? ['--host', '127.0.0.1', '--port', '3197', '--strictPort']
        : ['--hostname', '127.0.0.1', '--port', '3197'])
    ],
    {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
      detached: process.platform !== 'win32',
      shell: process.platform === 'win32'
    }
  );
  let logs = '';
  server.stdout.on('data', (chunk) => (logs += chunk));
  server.stderr.on('data', (chunk) => (logs += chunk));
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        const response = await fetch('http://127.0.0.1:3197', {
          signal: AbortSignal.timeout(2000)
        });
        if (response.ok || response.status === 404) {
          ready = true;
          break;
        }
      } catch {}
    }
    if (!ready) {
      throw new Error(`Timed out waiting for ${preset} server at http://127.0.0.1:3197\n${logs}`);
    }
  } finally {
    if (server.pid) {
      if (process.platform === 'win32') server.kill();
      else process.kill(-server.pid, 'SIGTERM');
      await new Promise((resolve) => {
        server.once('exit', resolve);
        setTimeout(resolve, 3000).unref();
      });
    }
  }
}
try {
  console.log('Building and packing aginit...');
  run(npm, ['run', 'build'], root);
  const packed = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', workspace], root))[0];
  assert(packed.files.some((f) => f.path === 'dist/cli/main.js'));
  assert(packed.files.some((f) => f.path === 'dist/index.d.ts'));
  run(npm, ['init', '-y'], workspace);
  run(
    npm,
    ['install', path.join(workspace, packed.filename), '--no-audit', '--no-fund'],
    workspace
  );
  const entry = path.join(workspace, 'node_modules', '@antomanc', 'aginit', 'bin', 'aginit.js');
  const cli = (args, cwd = projectsDir) => run(process.execPath, [entry, ...args], cwd);
  assert.equal(cli(['--version']).trim(), '0.1.0');
  cli(['new', 'dry-run', '--preset', 'web', '--framework', 'vite', '--dry-run', ...flags], projectsDir);
  assert(!fs.existsSync(path.join(projectsDir, 'dry-run')));
  for (const [name, preset, framework] of [
    ['generic-app', 'generic', 'none'],
    ['cli-app', 'cli', 'none'],
    ['web-app', 'web', 'none'],
    ...(frameworks
      ? [
          ['vite-app', 'web', 'vite'],
          ['next-app', 'web', 'next']
        ]
      : [])
  ]) {
    console.log(`Verifying packed CLI → ${name}...`);
    cli([
      'new',
      name,
      '--preset',
      preset,
      '--framework',
      framework,
      '--package-manager',
      'npm',
      ...flags
    ], projectsDir);
    const dir = path.join(projectsDir, name);
    assert(!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')));
    assert.match(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), /\.env/);
    run(npm, ['install', '--no-audit', '--no-fund'], dir);
    run(npm, ['test'], dir);
    const pkg = manifest(dir);
    if (pkg.scripts.typecheck) run(npm, ['run', 'typecheck'], dir);
    if (pkg.scripts.build) run(npm, ['run', 'build'], dir);
    if (preset === 'cli')
      assert.match(run(process.execPath, ['bin/cli.js', '--help'], dir), /ready.*--help/);
    if (framework === 'vite' || framework === 'next') {
      run(npm, ['run', 'test:e2e', '--', '--list'], dir);
      await serve(dir, framework);
    }
    const before = fs.readFileSync(path.join(dir, 'aginit.config.json'), 'utf8');
    cli(['init', ...flags], dir);
    assert.equal(fs.readFileSync(path.join(dir, 'aginit.config.json'), 'utf8'), before);
    run(npm, ['test'], dir);
  }
  if (process.argv.includes('--package-managers')) {
    for (const pm of ['pnpm', 'yarn', 'bun']) {
      const name = `${pm}-app`;
      console.log(`Verifying native ${pm} consumer commands...`);
      cli(['new', name, '--preset', 'cli', '--package-manager', pm, ...flags], projectsDir);
      const dir = path.join(projectsDir, name);
      assert.equal(fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')), pm === 'pnpm');
      run(pm, ['install'], dir);
      for (const script of ['test', 'typecheck', 'build']) run(pm, ['run', script], dir);
      assert.match(run(process.execPath, ['bin/cli.js', '--help'], dir), /ready.*--help/);
    }
  }
  // Existing applications retain their source, test scripts and custom fields.
  const existing = path.join(projectsDir, 'existing');
  fs.mkdirSync(existing);
  fs.mkdirSync(path.join(existing, 'src'));
  const source = 'export const existing = true;\n';
  fs.writeFileSync(path.join(existing, 'src', 'index.ts'), source);
  fs.writeFileSync(
    path.join(existing, 'package.json'),
    JSON.stringify({
      name: 'existing',
      type: 'module',
      scripts: { test: 'node --version' },
      custom: true
    })
  );
  cli(
    ['init', '--preset', 'web', '--framework', 'existing', '--package-manager', 'npm', ...flags],
    existing
  );
  assert.equal(fs.readFileSync(path.join(existing, 'src', 'index.ts'), 'utf8'), source);
  assert.equal(manifest(existing).scripts.test, 'node --version');
  assert.equal(manifest(existing).custom, true);
  run(npm, ['install', '--no-audit', '--no-fund'], existing);
  run(npm, ['run', 'test:unit'], existing);
  console.log('Packaging and generated-project smoke tests passed.');
} finally {
  for (const d of [workspace, projectsDir]) {
    if (fs.existsSync(d)) {
      fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }
}
