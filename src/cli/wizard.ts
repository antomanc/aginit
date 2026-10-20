import * as p from '@clack/prompts';
import pc from 'picocolors';
import { PresetType, WebFramework, PackageManager } from '../config/schema.js';
import { validateProjectName, readProjectConfig } from '../config/validation.js';
import { detectPackageManager } from '../adapters/package-manager.js';
import { detectProject } from '../detect/index.js';
import { presetPlatform } from '../config/defaults.js';
import { CATALOG, PLATFORMS, defaultCapabilities, isNodeStack, supports } from '../registry/index.js';
import type { CapabilityCategory, Platform, ProfileFlags, Stack } from '../registry/index.js';
import { createProject } from './new.js';
import { initCurrentDirectory } from './init.js';

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI);
}

function assertNotCancelled<T>(value: T | symbol): Exclude<T, symbol> {
  if (p.isCancel(value)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
  return value as Exclude<T, symbol>;
}

export interface WizardNewAnswers {
  projectName: string;
  preset: PresetType;
  framework: WebFramework;
  packageManager: PackageManager;
  profile: ProfileFlags;
}

export interface WizardInitAnswers {
  preset: PresetType;
  framework: WebFramework;
  packageManager: PackageManager;
  profile: ProfileFlags;
}

export async function promptNewProject(defaults?: {
  projectName?: string;
  preset?: PresetType;
  framework?: WebFramework;
  packageManager?: PackageManager;
  profile?: ProfileFlags;
}): Promise<WizardNewAnswers> {
  let projectName: string = defaults?.projectName || '';
  if (!projectName) {
    const res = await p.text({
      message: 'What is your project name?',
      placeholder: 'my-ai-project',
      validate: (val) => {
        if (!val || val.trim().length === 0) return 'Project name is required';
        try {
          validateProjectName(val.trim());
        } catch (error) {
          return error instanceof Error ? error.message : 'Invalid project name';
        }
      }
    });
    projectName = String(assertNotCancelled(res)).trim();
  }

  const platform = defaults?.profile?.platform ??
    await promptPlatform(presetPlatform(defaults?.preset ?? 'web'));
  const preset = defaults?.preset ??
    (platform === 'web' ? 'web' : platform === 'cli' ? 'cli' : 'generic');

  let framework: WebFramework = defaults?.framework || 'none';
  if (preset === 'web' && defaults?.framework === undefined) {
    const res = await p.select({
      message: 'Choose a web framework:',
      initialValue: 'none',
      options: [
        {
          value: 'none',
          label: 'None',
          hint: 'TypeScript baseline'
        },
        {
          value: 'vite',
          label: 'Vite',
          hint: 'Official Vite React-TS scaffolder + Playwright E2E'
        },
        { value: 'next', label: 'Next.js', hint: 'Official create-next-app + Playwright E2E' }
      ]
    });
    framework = assertNotCancelled(res) as WebFramework;
  }

  let packageManager = defaults?.packageManager;
  if (!packageManager) {
    packageManager = platform === 'mobile-native' ? 'pnpm' : await promptPackageManager();
  }

  const profile = await promptProfile(platform, 'unknown', framework, true,
    { ...defaults?.profile, platform });
  return {
    projectName,
    preset,
    framework,
    packageManager,
    profile
  };
}

export async function promptInitProject(defaults?: {
  targetDir?: string;
  preset?: PresetType;
  framework?: WebFramework;
  packageManager?: PackageManager;
  profile?: ProfileFlags;
}): Promise<WizardInitAnswers> {
  const targetDir = defaults?.targetDir || process.cwd();
  const detected = detectProject(targetDir);
  const preset = defaults?.preset ?? 'generic';
  const framework = defaults?.framework ?? 'existing';
  const platform =
    defaults?.profile?.platform ??
    (preset !== 'generic' ? presetPlatform(preset) : detected.platform ?? 'cli');
  const stack = detected.stack;
  p.note(
    stack === 'unknown'
      ? 'No stack detected. Choose a platform below.'
      : `Detected ${stack}. Existing project files are preserved.`,
    'Project'
  );
  const profile = await promptProfile(
    platform, stack, framework,
    preset !== 'generic' || detected.stack === 'unknown',
    defaults?.profile
  );
  const packageManager =
    defaults?.packageManager ?? detectPackageManager(targetDir) ??
    (isNodeStack(stack) || (stack === 'unknown' && profile.platform !== 'mobile-native')
      ? await promptPackageManager()
      : 'pnpm');
  return { preset, framework, packageManager, profile };
}

async function promptPackageManager(): Promise<PackageManager> {
  return assertNotCancelled(await p.select({
    message: 'Package manager',
    initialValue: 'pnpm',
    options: ['pnpm', 'npm', 'yarn', 'bun'].map((value) => ({ value, label: value }))
  })) as PackageManager;
}

async function promptPlatform(initialValue: Platform): Promise<Platform> {
  const labels: Record<Platform, string> = {
    web: 'Web',
    'mobile-native': 'Native mobile',
    'mobile-rn': 'React Native / Expo',
    backend: 'Backend',
    cli: 'CLI / library'
  };
  return assertNotCancelled(await p.select({
    message: 'Platform',
    initialValue,
    options: PLATFORMS.map((value) => ({ value, label: labels[value] }))
  }));
}

async function promptProfile(
  initialPlatform: Platform,
  stack: Stack,
  framework: WebFramework,
  harness: boolean,
  flags: ProfileFlags = {}
): Promise<ProfileFlags> {
  const platform = flags.platform ?? await promptPlatform(initialPlatform);
  const resolvedStack = stack === 'unknown' && platform !== 'mobile-native' ? 'node' : stack;
  const defaults = defaultCapabilities({ platform, stack: resolvedStack, framework, harness });
  const choose = async (category: CapabilityCategory, message: string, allowNone = false) => {
    const entries = CATALOG.filter((c) =>
      c.category === category && !c.addon && supports(c, platform) &&
      (!c.requiresNodeInProjectRoot || isNodeStack(resolvedStack))
    );
    return assertNotCancelled(await p.select({
      message,
      initialValue:
        [...defaults].reverse().find((id) => entries.some((c) => c.id === id)) ??
        (allowNone ? 'none' : entries[0]?.id),
      options: [
        ...entries.map((c) => ({ value: c.id, label: c.name, hint: c.description })),
        ...(allowNone ? [{ value: 'none', label: 'None' }] : [])
      ]
    }));
  };
  const methodology = flags.methodology ?? await choose('methodology', 'Methodology');
  const design = flags.design ?? await choose('design', 'Design', true);
  const testing = flags.testing ?? await choose('testing-engine', 'Testing engine');
  const uiDriver = flags.uiDriver ?? await choose('ui-driver', 'UI driver', true);
  const addons = flags.addons ?? assertNotCancelled(await p.multiselect({
    message: 'Add-ons',
    required: false,
    options: CATALOG.filter((c) => c.addon && supports(c, platform) &&
      (!c.requiresNodeInProjectRoot || isNodeStack(resolvedStack)))
      .map((c) => ({ value: c.id, label: c.name, hint: c.description }))
  }));
  return { ...flags, platform, methodology, design, testing: testing as ProfileFlags['testing'], uiDriver, addons };
}

export async function confirmSetup(answers: WizardInitAnswers): Promise<boolean> {
  const profile = answers.profile;
  const name = (id: string | undefined) => CATALOG.find((c) => c.id === id)?.name ?? id;
  const graph = CATALOG.find(
    (c) => c.category === 'codebase-graph' && c.default && !profile.without?.includes(c.id)
  );
  p.note([
    `Platform: ${profile.platform}`,
    `Methodology: ${name(profile.methodology)}`,
    `Design: ${name(profile.design)}`,
    `Testing: ${name(profile.testing)}`,
    `UI driver: ${name(profile.uiDriver)}`,
    `Add-ons: ${profile.addons?.map(name).join(', ') || 'None'}`,
    `Codebase graph: ${graph ? `${graph.name}. ${graph.description}` : 'None'}`
  ].join('\n'), 'Setup');
  return assertNotCancelled(await p.confirm({ message: 'Apply this setup?', initialValue: true }));
}

export async function runInteractiveWizard(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' aginit ')) + pc.dim(' — AI-First Project Bootstrap'));

  const action = assertNotCancelled(
    await p.select({
      message: 'What would you like to do?',
      initialValue: detectProject(process.cwd()).platform ? 'init' : 'new',
      options: [
        {
          value: 'new',
          label: 'New project',
          hint: 'Scaffold in a new directory'
        },
        {
          value: 'init',
          label: 'Current directory',
          hint: 'Add AGENTS.md, skills & Trail safely'
        }
      ]
    })
  );

  let complete: boolean;
  if (action === 'new') {
    const answers = await promptNewProject();
    if (!(await confirmSetup(answers))) {
      p.outro('Setup cancelled.');
      return;
    }
    p.outro(pc.cyan(`Scaffolding "${answers.projectName}"...`));
    complete = await createProject(answers.projectName, {
      preset: answers.preset,
      framework: answers.framework,
      packageManager: answers.packageManager,
      profile: answers.profile
    });
  } else {
    const saved = readProjectConfig(process.cwd());
    if (saved) {
      p.outro(pc.cyan('Configuring current directory using saved settings...'));
      complete = await initCurrentDirectory();
    } else {
      const answers = await promptInitProject();
      if (!(await confirmSetup(answers))) {
        p.outro('Setup cancelled.');
        return;
      }
      p.outro(pc.cyan('Configuring current directory...'));
      complete = await initCurrentDirectory({
        preset: answers.preset,
        framework: answers.framework,
        packageManager: answers.packageManager,
        profile: answers.profile
      });
    }
  }
  if (!complete) process.exitCode = 1;
}
