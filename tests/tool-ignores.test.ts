import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ignoreVendoredSkills, vendoredSkillsExposure } from '../src/adapters/tool-ignores.js';

describe('ignoreVendoredSkills', () => {
  let dir: string;
  const write = (file: string, content: string) => fs.writeFileSync(path.join(dir, file), content);
  const read = (file: string) => fs.readFileSync(path.join(dir, file), 'utf8');

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aginit-ignores-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('leaves a project without linters or formatters untouched', () => {
    write('package.json', JSON.stringify({ name: 'plain' }));
    expect(ignoreVendoredSkills(dir, { silent: true })).toEqual([]);
    expect(fs.readdirSync(dir)).toEqual(['package.json']);
  });

  it('appends vendored dirs to .prettierignore once', () => {
    write('package.json', JSON.stringify({ devDependencies: { prettier: '^3.0.0' } }));
    write('.prettierignore', 'dist\n');
    ignoreVendoredSkills(dir, { silent: true });
    ignoreVendoredSkills(dir, { silent: true });
    expect(read('.prettierignore')).toBe(
      'dist\n\n# Vendored agent skills (aginit)\n.agents/\n.claude/\n'
    );
    expect(vendoredSkillsExposure(dir)).toEqual([]);
  });

  it('writes .eslintignore for oxlint and legacy ESLint', () => {
    write('package.json', JSON.stringify({ devDependencies: { oxlint: '^1.0.0' } }));
    write('.eslintignore', '.agents/**\n');
    ignoreVendoredSkills(dir, { silent: true });
    expect(read('.eslintignore')).toBe(
      '.agents/**\n\n# Vendored agent skills (aginit)\n.claude/\n'
    );
  });

  it('adds vendored dirs to a flat config ignores-only object (AstroPaper)', () => {
    write(
      'eslint.config.js',
      'export default [\n  ...base,\n  { ignores: ["dist/**", ".astro"] },\n];\n'
    );
    expect(ignoreVendoredSkills(dir, { silent: true })).toEqual([]);
    expect(read('eslint.config.js')).toContain(
      '{ ignores: [".agents/**", ".claude/**", "dist/**", ".astro"] }'
    );
    expect(vendoredSkillsExposure(dir)).toEqual([]);
  });

  it('adds vendored dirs to globalIgnores (create-next-app)', () => {
    write(
      'eslint.config.mjs',
      'const c = defineConfig([\n  globalIgnores([\n    // defaults\n    ".next/**",\n  ]),\n]);\n'
    );
    ignoreVendoredSkills(dir, { silent: true });
    expect(read('eslint.config.mjs')).toContain(
      'globalIgnores([\n    ".agents/**",\n    ".claude/**",\n    // defaults\n'
    );
  });

  it('advises instead of editing a flat config without a global ignores array', () => {
    const config = "export default [{ files: ['**/*.js'], ignores: ['x'], rules: {} }];\n";
    write('eslint.config.js', config);
    const advice = ignoreVendoredSkills(dir, { silent: true });
    expect(advice[0]).toContain("{ ignores: ['.agents/**', '.claude/**'] }");
    expect(read('eslint.config.js')).toBe(config);
    expect(vendoredSkillsExposure(dir)).toHaveLength(1);
  });
  it('force-ignores vendored dirs in biome.json, keeping its indentation', () => {
    write(
      'biome.json',
      '{\n\t"files": { "ignoreUnknown": false },\n\t"linter": { "enabled": true }\n}\n'
    );
    expect(ignoreVendoredSkills(dir, { silent: true })).toEqual([]);
    const config = JSON.parse(read('biome.json'));
    expect(config.files.includes).toEqual(['**', '!!**/.agents', '!!**/.claude']);
    expect(config.linter.enabled).toBe(true);
    expect(read('biome.json')).toContain(
      '\n\t\t"includes": ["**", "!!**/.agents", "!!**/.claude"]\n'
    );
    expect(vendoredSkillsExposure(dir)).toEqual([]);
  });

  it('appends to existing biome includes and advises for a commented biome.jsonc', () => {
    write('biome.json', JSON.stringify({ files: { includes: ['src/**'] } }));
    ignoreVendoredSkills(dir, { silent: true });
    expect(JSON.parse(read('biome.json')).files.includes).toEqual([
      'src/**',
      '!!**/.agents',
      '!!**/.claude'
    ]);

    fs.rmSync(path.join(dir, 'biome.json'));
    write('biome.jsonc', '{\n  // comment\n  "linter": {}\n}\n');
    expect(ignoreVendoredSkills(dir, { silent: true })[0]).toContain(
      'add "!!**/.agents", "!!**/.claude" to files.includes in biome.jsonc'
    );
  });
});
