import path from 'node:path';
import { fileExists, readTextFile, safeWriteFile } from '../utils/fs.js';
import { readPackageManifest } from '../config/validation.js';
import { ruffConfigFile } from '../detect/index.js';

// Vendored skill sources ship third-party JS and Markdown that the project's own
// linters and formatters must not check. No ignore convention is shared across tools,
// so each tool below says where its ignores live and how to add to them.
const VENDORED_DIRS = ['.agents', '.claude'];

interface Project {
  dir: string;
  manifest: Record<string, any> | null;
  has(dependency: string): boolean;
  exists(file: string): boolean;
}

interface ToolIgnore {
  /** The file holding this tool's ignores, when the project uses the tool. */
  file(project: Project): string | undefined;
  /** Vendored directories the file does not ignore yet. */
  missing(text: string): string[];
  /** The file with those directories ignored, or null when it cannot be edited safely. */
  patch(text: string, dirs: string[]): string | null;
  advice(file: string, dirs: string[]): string;
}

const configs = (base: string, extensions: string[]) => extensions.map((ext) => `${base}${ext}`);

/** Gitignore-syntax files: append the directories. */
function ignoreFile(name: string, used: (project: Project) => boolean): ToolIgnore {
  return {
    file: (project) => (used(project) ? name : undefined),
    missing: (text) => {
      const lines = text.split(/\r?\n/).map((line) => line.trim().replace(/^\/|\/(\*\*)?$/g, ''));
      return VENDORED_DIRS.filter((dir) => !lines.includes(dir));
    },
    patch: (text, dirs) => {
      const block = `# Vendored agent skills (aginit)\n${dirs.map((dir) => `${dir}/`).join('\n')}\n`;
      return text.trim() ? `${text.trimEnd()}\n\n${block}` : block;
    },
    advice: (file, dirs) => `add ${dirs.map((dir) => `${dir}/`).join(' and ')} to ${file}`
  };
}

const prettier = ignoreFile(
  '.prettierignore',
  (project) =>
    project.has('prettier') ||
    Boolean(project.manifest?.prettier) ||
    [
      ...configs('.prettierrc', ['', '.json', '.json5', '.yaml', '.yml', '.toml']),
      ...configs('.prettierrc', ['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts']),
      ...configs('prettier.config', ['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts'])
    ].some(project.exists)
);

// Legacy ESLint and oxlint read .eslintignore; flat-config ESLint does not.
const eslintIgnore = ignoreFile(
  '.eslintignore',
  (project) =>
    project.has('oxlint') ||
    Boolean(project.manifest?.eslintConfig) ||
    configs('.eslintrc', ['', '.js', '.cjs', '.json', '.yaml', '.yml']).some(project.exists)
);

/** Flat ESLint config: extend a global ignores array if there is an unambiguous one,
 * `globalIgnores([...])` or an object holding only `ignores`. */
const eslintFlat: ToolIgnore = {
  file: (project) =>
    configs('eslint.config', ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts']).find(project.exists),
  missing: (text) => VENDORED_DIRS.filter((dir) => !text.includes(`${dir}/`)),
  patch: (text, dirs) => {
    const match =
      /globalIgnores\(\s*\[/.exec(text) ??
      /\{\s*ignores\s*:\s*\[(?=[^[\]]*\]\s*,?\s*\})/.exec(text);
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
      : entries.join(', ') + (/^\s*\]/.test(rest) ? '' : ', ');
    return text.slice(0, at) + insertion + rest;
  },
  advice: (file, dirs) =>
    `add { ignores: [${dirs.map((dir) => `'${dir}/**'`).join(', ')}] } to the exported array in ${file}`
};

/** Biome 2.2+: force-ignore the folders through files.includes. */
const biome: ToolIgnore = {
  file: (project) => ['biome.json', 'biome.jsonc'].find(project.exists),
  missing: (text) => VENDORED_DIRS.filter((dir) => !text.includes(`**/${dir}`)),
  patch: (text, dirs) => {
    let config: Record<string, any>;
    try {
      config = JSON.parse(text); // a biome.jsonc with comments gets advice instead
    } catch {
      return null;
    }
    const includes = config.files?.includes ?? ['**'];
    if (!Array.isArray(includes)) return null;
    config.files = {
      ...config.files,
      includes: [...includes, ...dirs.map((dir) => `!!**/${dir}`)]
    };
    const json = JSON.stringify(config, null, /\n([ \t]+)"/.exec(text)?.[1] ?? 2) + '\n';
    // Like Biome's formatter, keep the array on one line when it fits in 80 columns.
    return json.replace(/^([ \t]*"includes": )\[[^\]]*\]/m, (block, key: string) => {
      const inline = `${key}[${config.files.includes.map((p: string) => JSON.stringify(p)).join(', ')}]`;
      return inline.replace(/\t/g, '  ').length <= 80 ? inline : block;
    });
  },
  advice: (file, dirs) =>
    `add ${dirs.map((dir) => `"!!**/${dir}"`).join(', ')} to files.includes in ${file}`
};

/** Ruff: extend-exclude at the top of ruff.toml, or under an existing [tool.ruff] table. */
const ruff: ToolIgnore = {
  file: (project) => ruffConfigFile(project.dir),
  missing: (text) =>
    VENDORED_DIRS.filter((dir) => !text.includes(`"${dir}"`) && !text.includes(`'${dir}'`)),
  patch: (text, dirs) => {
    let start = 0;
    if (/^\[tool\.ruff[.\]]/m.test(text)) {
      const header = /^\[tool\.ruff\][ \t]*(#.*)?\r?\n/m.exec(text);
      if (!header) return null;
      start = header.index + header[0].length;
    }
    const next = text.slice(start).search(/^\[/m);
    const table = text.slice(start, next === -1 ? undefined : start + next);
    if (/^\s*extend-exclude\s*=/m.test(table)) return null;
    const line = `extend-exclude = [${dirs.map((dir) => `"${dir}"`).join(', ')}]  # vendored agent skills (aginit)\n`;
    return text.slice(0, start) + line + text.slice(start);
  },
  advice: (file, dirs) =>
    `add extend-exclude = [${dirs.map((dir) => `"${dir}"`).join(', ')}] to ` +
    (file === 'pyproject.toml' ? '[tool.ruff] in pyproject.toml' : file)
};

const TOOLS = [prettier, eslintIgnore, eslintFlat, biome, ruff];

function pendingIgnores(targetDir: string) {
  const manifest = readPackageManifest(targetDir);
  const project: Project = {
    dir: targetDir,
    manifest,
    has: (name) => Boolean(manifest?.dependencies?.[name] || manifest?.devDependencies?.[name]),
    exists: (file) => fileExists(path.join(targetDir, file))
  };
  return TOOLS.flatMap((tool) => {
    const file = tool.file(project);
    if (!file) return [];
    const text = readTextFile(path.join(targetDir, file)) ?? '';
    const missing = tool.missing(text);
    return missing.length > 0 ? [{ tool, file, text, missing }] : [];
  });
}

/** Keeps the project's linters and formatters off vendored skills. Returns the
 * advice for configs that could not be edited safely. */
export function ignoreVendoredSkills(
  targetDir: string,
  options: { dryRun?: boolean; silent?: boolean } = {}
): string[] {
  const { dryRun = false, silent = false } = options;
  const advice: string[] = [];
  for (const { tool, file, text, missing } of pendingIgnores(targetDir)) {
    const patched = tool.patch(text, missing);
    if (patched === null)
      advice.push(`Linters check vendored skills: ${tool.advice(file, missing)}`);
    else safeWriteFile(path.join(targetDir, file), patched, { overwrite: true, dryRun, silent });
  }
  return advice;
}

/** Doctor view: every config that still lets a linter or formatter see vendored skills. */
export function vendoredSkillsExposure(targetDir: string): string[] {
  return pendingIgnores(targetDir).map(({ tool, file, missing }) => tool.advice(file, missing));
}
