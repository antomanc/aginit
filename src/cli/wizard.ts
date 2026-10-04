import * as p from '@clack/prompts';
import pc from 'picocolors';
import { PresetType, WebFramework } from '../config/schema.js';
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
  specWorkflow: boolean;
}

export interface WizardInitAnswers {
  preset: PresetType;
  framework: WebFramework;
  specWorkflow: boolean;
}

export async function promptNewProject(defaults?: {
  projectName?: string;
  preset?: PresetType;
  framework?: WebFramework;
  specWorkflow?: boolean;
}): Promise<WizardNewAnswers> {
  let projectName: string = defaults?.projectName || '';
  if (!projectName) {
    const res = await p.text({
      message: 'What is your project name?',
      placeholder: 'my-ai-project',
      validate: (val) => {
        if (!val || val.trim().length === 0) return 'Project name is required';
        if (/[^a-zA-Z0-9._-]/.test(val)) return 'Project name can only contain letters, numbers, dashes, and underscores';
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
        { value: 'web', label: 'Web Application', hint: 'React, Next.js, Vite, or agnostic + Vitest/Playwright' },
        { value: 'cli', label: 'CLI Tool', hint: 'TypeScript, Commander, Picocolors + Vitest' },
        { value: 'generic', label: 'Generic / Existing Codebase', hint: 'Codebase graph + agent intake guide' }
      ]
    });
    preset = assertNotCancelled(res) as PresetType;
  }

  let framework: WebFramework = defaults?.framework || 'none';
  if (preset === 'web' && (!defaults?.framework || defaults.framework === 'none')) {
    const res = await p.select({
      message: 'Choose a web framework:',
      initialValue: 'none',
      options: [
        { value: 'none', label: 'Framework-agnostic (Recommended)', hint: 'Clean TypeScript + Vitest, zero bundler lock-in' },
        { value: 'vite', label: 'Vite', hint: 'Official Vite React-TS scaffolder + Playwright E2E' },
        { value: 'next', label: 'Next.js', hint: 'Official create-next-app + Playwright E2E' }
      ]
    });
    framework = assertNotCancelled(res) as WebFramework;
  }

  let specWorkflow = defaults?.specWorkflow;
  if (specWorkflow === undefined) {
    const res = await p.select({
      message: 'Select AI engineering workflow:',
      initialValue: 'minimal',
      options: [
        { value: 'minimal', label: 'Standard Workflow (Recommended)', hint: 'TDD, Code Review, Diagnosing Bugs' },
        { value: 'spec', label: 'Spec & Tickets Workflow', hint: 'Adds to-spec, to-tickets, implement-spec' }
      ]
    });
    const selected = assertNotCancelled(res);
    specWorkflow = selected === 'spec';
  }

  return {
    projectName,
    preset,
    framework,
    specWorkflow
  };
}

export async function promptInitProject(defaults?: {
  preset?: PresetType;
  framework?: WebFramework;
  specWorkflow?: boolean;
}): Promise<WizardInitAnswers> {
  let preset = defaults?.preset;
  if (!preset) {
    const res = await p.select({
      message: 'Select project preset to configure in this directory:',
      initialValue: 'web',
      options: [
        { value: 'web', label: 'Web Application', hint: 'Impeccable UI, agent-browser, Vitest' },
        { value: 'cli', label: 'CLI Tool', hint: 'TypeScript, Vitest' },
        { value: 'generic', label: 'Generic Repository', hint: 'Codebase graph + agent intake guide' }
      ]
    });
    preset = assertNotCancelled(res) as PresetType;
  }

  let framework: WebFramework = defaults?.framework || 'existing';
  if (preset === 'web' && (!defaults?.framework || defaults.framework === 'none')) {
    const res = await p.select({
      message: 'Select web framework setting:',
      initialValue: 'existing',
      options: [
        { value: 'existing', label: 'Existing Web Setup (Recommended)', hint: 'Preserve existing bundler and dependencies' },
        { value: 'none', label: 'Framework-agnostic', hint: 'Baseline TypeScript' },
        { value: 'vite', label: 'Vite', hint: 'Vite React setup' },
        { value: 'next', label: 'Next.js', hint: 'Next.js setup' }
      ]
    });
    framework = assertNotCancelled(res) as WebFramework;
  }

  let specWorkflow = defaults?.specWorkflow;
  if (specWorkflow === undefined) {
    const res = await p.select({
      message: 'Select AI engineering workflow:',
      initialValue: 'minimal',
      options: [
        { value: 'minimal', label: 'Standard Workflow (Recommended)', hint: 'TDD, Code Review, Diagnosing Bugs' },
        { value: 'spec', label: 'Spec & Tickets Workflow', hint: 'Adds to-spec, to-tickets, implement-spec' }
      ]
    });
    const selected = assertNotCancelled(res);
    specWorkflow = selected === 'spec';
  }

  return {
    preset,
    framework,
    specWorkflow
  };
}

export async function runInteractiveWizard(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' aginit ')) + pc.dim(' — AI-First Project Bootstrap'));

  const action = assertNotCancelled(
    await p.select({
      message: 'What would you like to do?',
      initialValue: 'new',
      options: [
        { value: 'new', label: 'Create a brand new AI-first project', hint: 'Scaffold in a new directory' },
        { value: 'init', label: 'Initialize AI capabilities in current directory', hint: 'Add AGENTS.md, skills & Graft safely' }
      ]
    })
  );

  if (action === 'new') {
    const answers = await promptNewProject();
    p.outro(pc.cyan(`Scaffolding "${answers.projectName}"...`));
    await createProject(answers.projectName, {
      preset: answers.preset,
      framework: answers.framework,
      specWorkflow: answers.specWorkflow
    });
  } else {
    const answers = await promptInitProject();
    p.outro(pc.cyan('Configuring current directory...'));
    await initCurrentDirectory({
      preset: answers.preset,
      framework: answers.framework,
      specWorkflow: answers.specWorkflow
    });
  }
}
