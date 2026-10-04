import path from 'node:path';
import { fileExists, readJsonFile } from '../utils/fs.js';
import { AginitConfig, AGINIT_CONFIG_FILENAME, LEGACY_CONFIG_FILENAME } from './schema.js';

export const PRESETS = ['web', 'cli', 'generic'] as const;
export const FRAMEWORKS = ['none', 'vite', 'next', 'existing'] as const;
export const SUPPORTED_PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const;
export function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function validateProjectName(name: string): void {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name) || name.length > 214) {
    throw new Error(
      'Invalid project name. Use a lowercase npm package name (letters, numbers, dots, dashes, underscores; optional @scope/name).'
    );
  }
}
export function validateUpstreamArgument(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.startsWith('-') ||
    /[\x00-\x1f\x7f]/.test(value)
  ) {
    throw new Error(
      `Invalid ${label}: expected a nonempty value that does not begin with an option.`
    );
  }
}
export function validateConfig(value: unknown): AginitConfig {
  const fail = (field: string): never => {
    throw new Error(`Invalid project configuration: ${field}`);
  };
  if (!isRecord(value)) return fail('expected a JSON object');
  if (value.schemaVersion !== undefined && value.schemaVersion !== '1.0.0')
    fail('unsupported schemaVersion');
  if (typeof value.name !== 'string' || !value.name) fail('name');
  if (!PRESETS.includes(value.preset)) fail('preset');
  if (value.framework !== undefined && !FRAMEWORKS.includes(value.framework)) fail('framework');
  if (
    value.packageManager !== undefined &&
    !SUPPORTED_PACKAGE_MANAGERS.includes(value.packageManager)
  )
    fail('packageManager');
  if (!isRecord(value.agents)) fail('agents');
  for (const key of ['primary', 'secondary'])
    validateUpstreamArgument(value.agents[key], `agent ${key}`);
  if (!isRecord(value.skills) || !Array.isArray(value.skills.sources)) fail('skills.sources');
  if (value.skills.workflow !== undefined && !['minimal', 'spec'].includes(value.skills.workflow))
    fail('skills.workflow');
  for (const source of value.skills.sources) {
    if (!isRecord(source) || !Array.isArray(source.skills)) fail('skill source');
    validateUpstreamArgument(source.package, 'skill package');
    for (const skill of source.skills) validateUpstreamArgument(skill, 'skill name');
  }
  for (const [section, keys] of Object.entries({
    codebase: ['graft'],
    browser: ['visualAgent', 'playwright'],
    docs: ['adr'],
    github: ['ci']
  })) {
    if (!isRecord(value[section])) fail(section);
    for (const key of keys) if (typeof value[section][key] !== 'boolean') fail(`${section}.${key}`);
  }
  return { ...value, schemaVersion: '1.0.0' } as AginitConfig;
}
export function readProjectConfig(dir: string): AginitConfig | null {
  const file = [AGINIT_CONFIG_FILENAME, LEGACY_CONFIG_FILENAME]
    .map((name) => path.join(dir, name))
    .find(fileExists);
  if (!file) return null;
  try {
    return validateConfig(readJsonFile<unknown>(file));
  } catch (error) {
    throw new Error(
      `${path.basename(file)}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
export function readPackageManifest(dir: string): Record<string, any> | null {
  const file = path.join(dir, 'package.json');
  if (!fileExists(file)) return null;
  const pkg = readJsonFile<unknown>(file);
  if (!isRecord(pkg)) throw new Error('Invalid package.json: expected a JSON object.');
  for (const key of ['scripts', 'dependencies', 'devDependencies']) {
    if (
      pkg[key] !== undefined &&
      (!isRecord(pkg[key]) || Object.values(pkg[key]).some((v) => typeof v !== 'string'))
    ) {
      throw new Error(`Invalid package.json: ${key} must contain string values.`);
    }
  }
  if (pkg.name !== undefined && typeof pkg.name !== 'string')
    throw new Error('Invalid package.json: name must be a string.');
  return pkg;
}
