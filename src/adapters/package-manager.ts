import fs from 'node:fs';
import path from 'node:path';
import { PackageManager } from '../config/schema.js';

export interface PackageManagerAdapter {
  name: PackageManager;
  installCmd: string;
  runCmd: (script: string) => string;
  execCmd: (pkg: string, args?: string[]) => string;
  lockfile: string;
  scaffoldViteCmd: (template?: string) => string;
  scaffoldNextCmd: () => string;
}

export const PACKAGE_MANAGERS: Record<PackageManager, PackageManagerAdapter> = {
  pnpm: {
    name: 'pnpm',
    installCmd: 'pnpm install',
    runCmd: (script: string) => `pnpm ${script}`,
    execCmd: (pkg: string, args: string[] = []) =>
      `pnpm dlx ${pkg}${args.length ? ' ' + args.join(' ') : ''}`,
    lockfile: 'pnpm-lock.yaml',
    scaffoldViteCmd: (template = 'react-ts') => `pnpm create vite . --template ${template}`,
    scaffoldNextCmd: () =>
      `pnpm create next-app . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm`
  },
  npm: {
    name: 'npm',
    installCmd: 'npm install',
    runCmd: (script: string) => `npm run ${script}`,
    execCmd: (pkg: string, args: string[] = []) =>
      `npx -y ${pkg}${args.length ? ' ' + args.join(' ') : ''}`,
    lockfile: 'package-lock.json',
    scaffoldViteCmd: (template = 'react-ts') => `npm create vite@latest . -- --template ${template}`,
    scaffoldNextCmd: () =>
      `npx -y create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`
  },
  yarn: {
    name: 'yarn',
    installCmd: 'yarn install',
    runCmd: (script: string) => `yarn ${script}`,
    execCmd: (pkg: string, args: string[] = []) =>
      `yarn dlx ${pkg}${args.length ? ' ' + args.join(' ') : ''}`,
    lockfile: 'yarn.lock',
    scaffoldViteCmd: (template = 'react-ts') => `yarn create vite . --template ${template}`,
    scaffoldNextCmd: () =>
      `yarn create next-app . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-yarn`
  },
  bun: {
    name: 'bun',
    installCmd: 'bun install',
    runCmd: (script: string) => `bun run ${script}`,
    execCmd: (pkg: string, args: string[] = []) =>
      `bunx ${pkg}${args.length ? ' ' + args.join(' ') : ''}`,
    lockfile: 'bun.lockb',
    scaffoldViteCmd: (template = 'react-ts') => `bun create vite . --template ${template}`,
    scaffoldNextCmd: () =>
      `bun create next-app . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-bun`
  }
};

export function getPackageManagerAdapter(pm: PackageManager = 'pnpm'): PackageManagerAdapter {
  return PACKAGE_MANAGERS[pm] || PACKAGE_MANAGERS.pnpm;
}

export function detectPackageManager(dir: string): PackageManager | null {
  if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.join(dir, 'bun.lockb')) || fs.existsSync(path.join(dir, 'bun.lock'))) {
    return 'bun';
  }
  if (fs.existsSync(path.join(dir, 'yarn.lock'))) {
    return 'yarn';
  }
  if (fs.existsSync(path.join(dir, 'package-lock.json'))) {
    return 'npm';
  }
  return null;
}
