#!/usr/bin/env node
/**
 * Guards MATT_POCOCK_SKILLS against drift in mattpocock/skills.
 *
 * It fails when:
 *   - a skill in the standard set was renamed, deleted, or moved out of the
 *     stable categories (engineering, productivity) — `aginit init` would fail
 *     for those names;
 *   - a skill published in a stable category is absent from the standard set.
 *
 * Usage: pnpm check:skills   (requires `pnpm build` first)
 * Set GITHUB_TOKEN to raise the GitHub API rate limit.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = 'mattpocock/skills';
const STABLE_CATEGORIES = new Set(['engineering', 'productivity']);

const defaultsPath = fileURLToPath(new URL('../dist/config/defaults.js', import.meta.url));
if (!existsSync(defaultsPath)) {
  console.error('dist/config/defaults.js is missing — run `pnpm build` first.');
  process.exit(1);
}
const { MATT_POCOCK_SKILLS } = await import(defaultsPath);

const headers = { 'User-Agent': 'aginit-skill-drift', Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const response = await fetch(
  `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`,
  { headers }
);
if (!response.ok) {
  console.error(`GitHub API responded ${response.status} while reading ${REPO}.`);
  process.exit(1);
}
const tree = await response.json();
if (tree.truncated) {
  console.error('Upstream tree is truncated; the comparison would be incomplete.');
  process.exit(1);
}

const stable = new Map(); // skill -> category
const published = new Map(); // skill -> category
for (const node of tree.tree ?? []) {
  const match = /^skills\/([^/]+)\/([^/]+)\/SKILL\.md$/.exec(node.path ?? '');
  if (!match) continue;
  const [, category, skill] = match;
  published.set(skill, category);
  if (STABLE_CATEGORIES.has(category)) stable.set(skill, category);
}

const standard = [...MATT_POCOCK_SKILLS];
const missing = standard.filter((skill) => !stable.has(skill));
const unpicked = [...stable.keys()].filter((skill) => !standard.includes(skill));

if (missing.length || unpicked.length) {
  if (missing.length) {
    console.error(
      `\n${missing.length} standard skill(s) are no longer in ${[...STABLE_CATEGORIES].join('/')}:`
    );
    for (const skill of missing) {
      const where = published.has(skill) ? `moved to ${published.get(skill)}` : 'renamed or deleted';
      console.error(`  - ${skill} (${where})`);
    }
    console.error('  `aginit init` would fail for these names. Update MATT_POCOCK_SKILLS.');
  }
  if (unpicked.length) {
    console.error(`\n${unpicked.length} stable skill(s) upstream are missing from MATT_POCOCK_SKILLS:`);
    for (const skill of unpicked) console.error(`  - ${skill} (${stable.get(skill)})`);
    console.error('  Add them to MATT_POCOCK_SKILLS, or move them out of the stable categories.');
  }
  console.error('');
  process.exit(1);
}

console.log(
  `All ${standard.length} standard skills verified against ${REPO} ` +
    `(${published.size} published, ${stable.size} in stable categories).`
);
