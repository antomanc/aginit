import path from 'node:path';
import { fileExists, readTextFile, safeWriteFile } from '../utils/fs.js';
import { readPackageManifest } from '../config/validation.js';

// Vendored skill sources ship third-party JS and Markdown that the project's own
// linters and formatters must not check.
const VENDORED_DIRS = ['.agents', '.claude'];

const PRETTIER_CONFIGS = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.json5',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  '.prettierrc.toml',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  '.prettierrc.ts',
  '.prettierrc.cts',
  '.prettierrc.mts',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  'prettier.config.ts',
  'prettier.config.cts',
  'prettier.config.mts'
];
const LEGACY_ESLINT_CONFIGS = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml'
];
const FLAT_ESLINT_CONFIGS = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  'eslint.config.mts',
  'eslint.config.cts'
];

interface IgnorePlan {
  /** Ignore files (gitignore syntax) and the directory lines they lack. */
  ignoreFiles: Array<{ file: string; missing: string[] }>;
  /** Flat ESLint config and the directories its ignores lack. */
  flatConfig?: { file: string; missing: string[] };
}

function ignoreFileMissing(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  return VENDORED_DIRS.filter(
    (dir) =>
      !lines.some((line) => new RegExp(`^/?${dir.replace('.', '\\.')}(/(\\*\\*)?)?$`).test(line))
  );
}

function planIgnores(targetDir: string): IgnorePlan {
  const pkg = readPackageManifest(targetDir);
  const has = (name: string) => Boolean(pkg?.dependencies?.[name] || pkg?.devDependencies?.[name]);
  const exists = (name: string) => fileExists(path.join(targetDir, name));
  const plan: IgnorePlan = { ignoreFiles: [] };
  const addIgnoreFile = (file: string) => {
    const missing = ignoreFileMissing(readTextFile(path.join(targetDir, file)) || '');
    if (missing.length > 0) plan.ignoreFiles.push({ file, missing });
  };

  if (has('prettier') || pkg?.prettier || PRETTIER_CONFIGS.some(exists))
    addIgnoreFile('.prettierignore');
  // Legacy ESLint and oxlint both read .eslintignore; flat-config ESLint does not.
  if (has('oxlint') || pkg?.eslintConfig || LEGACY_ESLINT_CONFIGS.some(exists))
    addIgnoreFile('.eslintignore');

  const flat = FLAT_ESLINT_CONFIGS.find(exists);
  if (flat) {
    const text = readTextFile(path.join(targetDir, flat)) || '';
    const missing = VENDORED_DIRS.filter((dir) => !text.includes(`${dir}/`));
    if (missing.length > 0) plan.flatConfig = { file: flat, missing };
  }
  return plan;
}

/** Adds the vendored directories to a global ignores array, if the config has an
 * unambiguous one: `globalIgnores([...])` or an object holding only `ignores`. */
function patchFlatConfig(text: string, dirs: string[]): string | null {
  const match =
    /globalIgnores\(\s*\[/.exec(text) ?? /\{\s*ignores\s*:\s*\[(?=[^[\]]*\]\s*,?\s*\})/.exec(text);
  if (!match) return null;
  const at = match.index + match[0].length;
  const rest = text.slice(at);
  const quote =
    /^\s*(['"`])/.exec(rest)?.[1] ??
    ((text.match(/"/g)?.length ?? 0) > (text.match(/'/g)?.length ?? 0) ? '"' : "'");
  const entries = dirs.map((dir) => `${quote}${dir}/**${quote}`);
  const indent = /^(\s*\n[ \t]*)/.exec(rest)?.[1];
  const insertion = indent
    ? entries.map((entry) => `${indent}${entry},`).join('')
    : /^\s*\]/.test(rest)
      ? entries.join(', ')
      : entries.join(', ') + ', ';
  return text.slice(0, at) + insertion + rest;
}

function flatConfigAdvice(file: string, dirs: string[]): string {
  return `add { ignores: [${dirs.map((dir) => `'${dir}/**'`).join(', ')}] } to the exported array in ${file}`;
}

/** Keeps the project's linters and formatters off vendored skills. Returns the
 * advice for configs that could not be edited safely. */
export function ignoreVendoredSkills(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): string[] {
  const { dryRun = false, silent = false } = options;
  const plan = planIgnores(targetDir);
  for (const { file, missing } of plan.ignoreFiles) {
    const filePath = path.join(targetDir, file);
    const existing = readTextFile(filePath);
    const lines = missing.map((dir) => `${dir}/`).join('\n');
    const updated = existing
      ? `${existing.trimEnd()}\n\n# Vendored agent skills (aginit)\n${lines}\n`
      : `# Vendored agent skills (aginit)\n${lines}\n`;
    safeWriteFile(filePath, updated, { overwrite: true, dryRun, silent });
  }
  if (!plan.flatConfig) return [];
  const { file, missing } = plan.flatConfig;
  const filePath = path.join(targetDir, file);
  const patched = patchFlatConfig(readTextFile(filePath) || '', missing);
  if (patched === null) return [`ESLint lints vendored skills: ${flatConfigAdvice(file, missing)}`];
  safeWriteFile(filePath, patched, { overwrite: true, dryRun, silent });
  return [];
}

/** Doctor view: every config that still lets a linter or formatter see vendored skills. */
export function vendoredSkillsExposure(targetDir: string): string[] {
  const plan = planIgnores(targetDir);
  const issues = plan.ignoreFiles.map(
    ({ file, missing }) => `add ${missing.map((dir) => `${dir}/`).join(' and ')} to ${file}`
  );
  if (plan.flatConfig) issues.push(flatConfigAdvice(plan.flatConfig.file, plan.flatConfig.missing));
  return issues;
}
