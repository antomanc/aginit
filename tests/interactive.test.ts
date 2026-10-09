import { it, expect, vi, afterEach } from 'vitest';
import { runInteractiveWizard } from '../src/cli/wizard.js';
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  text: vi.fn(),
  create: vi.fn(),
  init: vi.fn(),
  config: vi.fn()
}));
vi.mock('@clack/prompts', () => ({
  select: mocks.select,
  text: mocks.text,
  isCancel: () => false,
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn()
}));
vi.mock('../src/cli/new.js', () => ({ createProject: mocks.create }));
vi.mock('../src/cli/init.js', () => ({ initCurrentDirectory: mocks.init }));
vi.mock('../src/config/validation.js', async (original) => ({
  ...(await original<typeof import('../src/config/validation.js')>()),
  readProjectConfig: mocks.config
}));
afterEach(() => {
  vi.resetAllMocks();
  process.exitCode = undefined;
});
it('reports incomplete new setup from the root wizard', async () => {
  mocks.select
    .mockResolvedValueOnce('new')
    .mockResolvedValueOnce('generic')
    .mockResolvedValueOnce('npm');
  mocks.text.mockResolvedValue('app');
  mocks.create.mockResolvedValue(false);
  await runInteractiveWizard();
  expect(process.exitCode).toBe(1);
});
it('initializes saved settings without converting them to explicit overrides', async () => {
  mocks.select.mockResolvedValueOnce('init');
  mocks.config.mockReturnValue({ preset: 'web', framework: 'vite', skills: { workflow: 'spec' } });
  mocks.init.mockResolvedValue(false);
  await runInteractiveWizard();
  expect(mocks.init).toHaveBeenCalledWith();
  expect(process.exitCode).toBe(1);
  expect(mocks.select).toHaveBeenCalledTimes(1);
});
