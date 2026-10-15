import { it, expect, vi, afterEach } from 'vitest';
import { runInteractiveWizard } from '../src/cli/wizard.js';
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  text: vi.fn(),
  create: vi.fn(),
  init: vi.fn(),
  config: vi.fn(),
  confirm: vi.fn()
}));
vi.mock('@clack/prompts', () => ({
  select: mocks.select,
  multiselect: async () => [],
  note: vi.fn(),
  confirm: mocks.confirm,
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
    .mockResolvedValueOnce('cli')
    .mockResolvedValueOnce('npm');
  mocks.select.mockImplementation(async (options) => options.initialValue);
  mocks.confirm.mockResolvedValue(true);
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

it('passes the selected v2 profile to setup', async () => {
  mocks.select.mockImplementation(async (options) => {
    const choices: Record<string, string> = {
      'What would you like to do?': 'init', Platform: 'web', Methodology: 'superpowers',
      Design: 'impeccable', 'Testing engine': 'e2e', 'UI driver': 'agent-browser'
    };
    return choices[options.message] ?? options.initialValue;
  });
  mocks.confirm.mockResolvedValue(true);
  mocks.init.mockResolvedValue(true);
  await runInteractiveWizard();
  expect(mocks.init).toHaveBeenCalledWith(expect.objectContaining({
    preset: 'generic',
    profile: { platform: 'web', methodology: 'superpowers', design: 'impeccable',
      testing: 'e2e', uiDriver: 'agent-browser', addons: [] }
  }));
});
it('leaves setup untouched when the user declines the summary', async () => {
  mocks.select.mockImplementation(async (options) =>
    options.message === 'What would you like to do?' ? 'init' : options.initialValue);
  mocks.confirm.mockResolvedValue(false);
  await runInteractiveWizard();
  expect(mocks.init).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});
