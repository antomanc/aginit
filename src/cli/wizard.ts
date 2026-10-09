import * as p from '@clack/prompts';
import pc from 'picocolors';
import { PresetType, WebFramework, PackageManager } from '../config/schema.js';
import { validateProjectName, readProjectConfig } from '../config/validation.js';
import { detectPackageManager } from '../adapters/package-manager.js';
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
}

export interface WizardInitAnswers {
  preset: PresetType;
  framework: WebFramework;
  packageManager: PackageManager;
}

export async function promptNewProject(defaults?: {
  projectName?: string;
  preset?: PresetType;
  framework?: WebFramework;
  packageManager?: PackageManager;
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

  let preset = defaults?.preset;
  if (!preset) {
    const res = await p.select({
      message: 'Select a project preset:',
      initialValue: 'web',
      options: [
        {
          value: 'web',
          label: 'Web Application',
          hint: 'React, Next.js, Vite, or agnostic + Vitest/Playwright'
        },
        { value: 'cli', label: 'CLI Tool', hint: 'TypeScript, Commander, Picocolors + Vitest' },
        {
          value: 'generic',
          label: 'Generic / Existing Codebase',
          hint: 'Codebase graph + agent intake guide'
        }
      ]
    });
    preset = assertNotCancelled(res) as PresetType;
  }

  let framework: WebFramework = defaults?.framework || 'none';
  if (preset === 'web' && defaults?.framework === undefined) {
    const res = await p.select({
      message: 'Choose a web framework:',
      initialValue: 'none',
      options: [
        {
          value: 'none',
          label: 'Framework-agnostic (Recommended)',
          hint: 'Clean TypeScript + Vitest, zero bundler lock-in'
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
    const res = await p.select({
      message: 'Select package manager:',
      initialValue: 'pnpm',
      options: [
        {
          value: 'pnpm',
          label: 'pnpm (Recommended)',
          hint: 'Fast, disk-efficient & compliant workspace'
        },
        { value: 'npm', label: 'npm', hint: 'Standard Node.js package manager' },
        { value: 'yarn', label: 'yarn', hint: 'Yarn package manager' },
        { value: 'bun', label: 'bun', hint: 'Fast all-in-one JavaScript runtime & toolkit' }
      ]
    });
    packageManager = assertNotCancelled(res) as PackageManager;
  }

  return {
    projectName,
    preset,
    framework,
    packageManager
  };
}

export async function promptInitProject(defaults?: {
  targetDir?: string;
  preset?: PresetType;
  framework?: WebFramework;
  packageManager?: PackageManager;
}): Promise<WizardInitAnswers> {
  const targetDir = defaults?.targetDir || process.cwd();

  let preset = defaults?.preset;
  if (!preset) {
    const res = await p.select({
      message: 'Select project preset to configure in this directory:',
      initialValue: 'web',
      options: [
        { value: 'web', label: 'Web Application', hint: 'Impeccable UI, agent-browser, Vitest' },
        { value: 'cli', label: 'CLI Tool', hint: 'TypeScript, Vitest' },
        {
          value: 'generic',
          label: 'Generic Repository',
          hint: 'Codebase graph + agent intake guide'
        }
      ]
    });
    preset = assertNotCancelled(res) as PresetType;
  }

  let framework: WebFramework = defaults?.framework || 'existing';
  if (preset === 'web' && defaults?.framework === undefined) {
    const res = await p.select({
      message: 'Select web framework setting:',
      initialValue: 'existing',
      options: [
        {
          value: 'existing',
          label: 'Existing Web Setup (Recommended)',
          hint: 'Preserve existing bundler and dependencies'
        },
        { value: 'none', label: 'Framework-agnostic', hint: 'Baseline TypeScript' },
        { value: 'vite', label: 'Vite', hint: 'Vite React setup' },
        { value: 'next', label: 'Next.js', hint: 'Next.js setup' }
      ]
    });
    framework = assertNotCancelled(res) as WebFramework;
  }

  // Auto-detect and preserve existing package manager without prompting
  let packageManager = defaults?.packageManager;
  if (!packageManager) {
    const detected = detectPackageManager(targetDir);
    if (detected) {
      packageManager = detected;
    } else {
      const res = await p.select({
        message: 'Select package manager for this project:',
        initialValue: 'pnpm',
        options: [
          { value: 'pnpm', label: 'pnpm (Recommended)', hint: 'Fast, disk-efficient workspace' },
          { value: 'npm', label: 'npm', hint: 'Standard Node.js package manager' },
          { value: 'yarn', label: 'yarn', hint: 'Yarn package manager' },
          { value: 'bun', label: 'bun', hint: 'Fast runtime and package manager' }
        ]
      });
      packageManager = assertNotCancelled(res) as PackageManager;
    }
  }

  return {
    preset,
    framework,
    packageManager
  };
}

export async function runInteractiveWizard(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' aginit ')) + pc.dim(' — AI-First Project Bootstrap'));

  const action = assertNotCancelled(
    await p.select({
      message: 'What would you like to do?',
      initialValue: 'new',
      options: [
        {
          value: 'new',
          label: 'Create a brand new AI-first project',
          hint: 'Scaffold in a new directory'
        },
        {
          value: 'init',
          label: 'Initialize AI capabilities in current directory',
          hint: 'Add AGENTS.md, skills & Graft safely'
        }
      ]
    })
  );

  let complete: boolean;
  if (action === 'new') {
    const answers = await promptNewProject();
    p.outro(pc.cyan(`Scaffolding "${answers.projectName}"...`));
    complete = await createProject(answers.projectName, {
      preset: answers.preset,
      framework: answers.framework,
      packageManager: answers.packageManager
    });
  } else {
    const saved = readProjectConfig(process.cwd());
    if (saved) {
      p.outro(pc.cyan('Configuring current directory using saved settings...'));
      complete = await initCurrentDirectory();
    } else {
      const answers = await promptInitProject();
      p.outro(pc.cyan('Configuring current directory...'));
      complete = await initCurrentDirectory({
        preset: answers.preset,
        framework: answers.framework,
        packageManager: answers.packageManager
      });
    }
  }
  if (!complete) process.exitCode = 1;
}
