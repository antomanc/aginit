import { it, expect } from 'vitest';
import { runExecutable, commandExists } from '../src/utils/shell.js';

it('executes arguments literally without a shell', async () => {
  const payload = '*; echo injected; $(echo injected)';
  const result = await runExecutable(
    process.execPath,
    ['-e', 'process.stdout.write(process.argv[1])', payload],
    { silent: true }
  );
  expect(result.ok).toBe(true);
  expect(result.stdout).toBe(payload);
});

it('returns command failures and handles missing executables', async () => {
  expect((await runExecutable(process.execPath, ['-e', 'process.exit(7)'])).exitCode).toBe(7);
  expect(await commandExists('aginit-no-such-command')).toBe(false);
  expect(await commandExists('node; echo injected')).toBe(false);
  expect(await commandExists('node')).toBe(true);
});
