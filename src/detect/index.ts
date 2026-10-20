import fs from 'node:fs';
import path from 'node:path';
import { readJsonFile, readTextFile } from '../utils/fs.js';
import { PackageManager } from '../config/schema.js';
import { getPackageManagerAdapter } from '../adapters/package-manager.js';
import { Platform, ProjectCommands, Stack } from '../registry/types.js';

export interface DetectedProject {
  /** null when nothing marks the platform (empty directory). */
  platform: Platform | null;
  stack: Stack;
}

const WEB_FRAMEWORKS = [
  'next',
  'vite',
  'astro',
  'react',
  'react-dom',
  'vue',
  'nuxt',
  'svelte',
  '@sveltejs/kit',
  '@angular/core',
  'solid-js',
  '@remix-run/react',
  'preact'
];

function entries(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

const hasXcodeProject = (dir: string) => entries(dir).some((name) => name.endsWith('.xcodeproj'));

function gradleFiles(dir: string): string[] {
  return ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts']
    .map((name) => readTextFile(path.join(dir, name)))
    .filter((text): text is string => text !== null);
}

/** Read the project's markers (pubspec.yaml, Package.swift, gradle, package.json, ...). */
export function detectProject(dir: string): DetectedProject {
  const exists = (file: string) => fs.existsSync(path.join(dir, file));
  const pkg = readJsonFile<Record<string, any>>(path.join(dir, 'package.json'));
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };

  if (exists('pubspec.yaml')) return { platform: 'mobile-native', stack: 'flutter' };
  const expoApp = /"expo"\s*:/.test(readTextFile(path.join(dir, 'app.json')) ?? '');
  if (deps['react-native'] || deps.expo || expoApp)
    return { platform: 'mobile-rn', stack: 'react-native' };
  if (exists('Package.swift') || hasXcodeProject(dir) || hasXcodeProject(path.join(dir, 'ios'))) {
    const manifest = readTextFile(path.join(dir, 'Package.swift')) ?? '';
    const apple = !exists('Package.swift') || /\.(iOS|macOS|tvOS|watchOS|visionOS)\(/.test(manifest);
    return { platform: apple ? 'mobile-native' : 'cli', stack: 'swift' };
  }
  const androidGradle = gradleFiles(path.join(dir, 'android'));
  const rootGradle = gradleFiles(dir);
  if (androidGradle.length > 0 || rootGradle.some((text) => /com\.android|android\s*\{/.test(text)))
    return { platform: 'mobile-native', stack: 'kotlin' };
  if (pkg) {
    const web = WEB_FRAMEWORKS.some((name) => deps[name]);
    return { platform: web ? 'web' : 'cli', stack: 'node' };
  }
  if (rootGradle.length > 0) return { platform: 'backend', stack: 'kotlin' };
  if (exists('Cargo.toml')) return { platform: 'cli', stack: 'rust' };
  if (exists('go.mod')) return { platform: 'backend', stack: 'go' };
  if (exists('pyproject.toml') || exists('requirements.txt'))
    return { platform: 'backend', stack: 'python' };
  return { platform: null, stack: 'unknown' };
}

/** The file configuring ruff, in ruff's own lookup order, when the project uses it. */
export function ruffConfigFile(dir: string): string | undefined {
  const local = ['.ruff.toml', 'ruff.toml'].find((file) => fs.existsSync(path.join(dir, file)));
  if (local) return local;
  const pyproject = readTextFile(path.join(dir, 'pyproject.toml')) ?? '';
  return /^\[tool\.ruff[.\]]/m.test(pyproject) ? 'pyproject.toml' : undefined;
}

/**
 * The project's own commands: package scripts for Node projects, the host
 * toolchain otherwise. Commands that would be guesses are left out.
 */
export function projectCommands(
  dir: string,
  stack: Stack,
  options: { packageManager?: PackageManager; scripts?: Record<string, string> } = {}
): ProjectCommands {
  const exists = (file: string) => fs.existsSync(path.join(dir, file));
  switch (stack) {
    case 'node':
    case 'react-native': {
      const scripts =
        options.scripts ??
        readJsonFile<Record<string, any>>(path.join(dir, 'package.json'))?.scripts ??
        {};
      const pm = getPackageManagerAdapter(options.packageManager);
      const run = (name: string) => (Object.hasOwn(scripts, name) ? pm.runCmd(name) : undefined);
      return {
        dev: run('dev'),
        build: run('build'),
        typecheck: run('typecheck'),
        lint: run('lint'),
        test: run('test'),
        unitTest: run('test:unit'),
        e2e: run('test:e2e')
      };
    }
    case 'flutter':
      return { lint: 'flutter analyze', test: 'flutter test' };
    case 'swift':
      return exists('Package.swift')
        ? { build: 'swift build', test: 'swift test' }
        : {
            build: 'xcodebuild build -scheme <Scheme>',
            test: "xcodebuild test -scheme <Scheme> -destination 'platform=iOS Simulator,name=<Device>'"
          };
    case 'kotlin': {
      const nested = fs.existsSync(path.join(dir, 'android'));
      const android = nested || gradleFiles(dir).some((text) => /com\.android|android\s*\{/.test(text));
      const gradlew = nested ? 'cd android && ./gradlew' : './gradlew';
      return {
        build: `${gradlew} build`,
        ...(android ? { lint: `${gradlew} lint` } : {}),
        test: `${gradlew} test`
      };
    }
    case 'rust':
      return { build: 'cargo build', typecheck: 'cargo check', lint: 'cargo clippy', test: 'cargo test' };
    case 'go':
      return { build: 'go build ./...', lint: 'go vet ./...', test: 'go test ./...' };
    case 'python': {
      const run = exists('uv.lock') ? 'uv run ' : '';
      return {
        ...(ruffConfigFile(dir) ? { lint: `${run}ruff check . && ${run}ruff format --check .` } : {}),
        test: `${run}pytest`
      };
    }
    case 'unknown':
      return {};
  }
}
