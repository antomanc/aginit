import {
  AginitConfig,
  PresetType,
  WebFramework,
  PackageManager,
  SkillSourceConfig
} from './schema.js';

export interface DefaultConfigOptions {
  framework?: WebFramework;
  packageManager?: PackageManager;
}

/**
 * The stable skill set from mattpocock/skills installed by default:
 * every skill in the `engineering` and `productivity` categories.
 *
 * The `misc` (rarely used) and `in-progress` categories are deliberately
 * excluded. Re-evaluate when the upstream repository reshuffles categories.
 */
export const MATT_POCOCK_SKILLS = [
  // engineering
  'ask-matt',
  'code-review',
  'codebase-design',
  'diagnosing-bugs',
  'domain-modeling',
  'grill-with-docs',
  'implement',
  'implement-spec',
  'improve-codebase-architecture',
  'pr',
  'prototype',
  'research',
  'retro',
  'setup-matt-pocock-skills',
  'tdd',
  'to-spec',
  'to-tickets',
  'triage',
  'wayfinder',
  'wizard',
  // productivity
  'grill-me',
  'grilling',
  'handoff',
  'teach',
  'to-questionnaire',
  'wait-what',
  'writing-for-agents'
] as const;

export function getDefaultConfig(
  name: string,
  preset: PresetType,
  options: DefaultConfigOptions = {}
): AginitConfig {
  const packageManager = options.packageManager || 'pnpm';

  switch (preset) {
    case 'web': {
      const framework = options.framework || 'none';
      const hasWebTarget = framework === 'vite' || framework === 'next';

      return {
        schemaVersion: '1.0.0',
        name,
        preset: 'web',
        framework,
        packageManager,
        agents: {
          primary: 'antigravity',
          secondary: 'codex'
        },
        skills: {
          sources: [
            {
              package: 'mattpocock/skills',
              skills: [...MATT_POCOCK_SKILLS]
            },
            {
              package: 'blader/humanizer',
              skills: ['humanizer']
            },
            {
              package: 'pbakaus/impeccable',
              skills: ['impeccable']
            },
            {
              package: 'vercel-labs/agent-browser',
              skills: ['agent-browser']
            }
          ]
        },
        codebase: {
          graft: true
        },
        browser: {
          visualAgent: true,
          playwright: hasWebTarget
        },
        docs: {
          adr: true
        },
        github: {
          ci: true
        }
      };
    }

    case 'cli':
      return {
        schemaVersion: '1.0.0',
        name,
        preset: 'cli',
        packageManager,
        agents: {
          primary: 'antigravity',
          secondary: 'codex'
        },
        skills: {
          sources: [
            {
              package: 'mattpocock/skills',
              skills: [...MATT_POCOCK_SKILLS]
            },
            {
              package: 'blader/humanizer',
              skills: ['humanizer']
            }
          ]
        },
        codebase: {
          graft: true
        },
        browser: {
          visualAgent: false,
          playwright: false
        },
        docs: {
          adr: true
        },
        github: {
          ci: true
        }
      };

    case 'generic':
    default:
      return {
        schemaVersion: '1.0.0',
        name,
        preset: 'generic',
        packageManager,
        agents: {
          primary: 'antigravity',
          secondary: 'codex'
        },
        skills: {
          sources: [
            {
              package: 'mattpocock/skills',
              skills: [...MATT_POCOCK_SKILLS]
            },
            {
              package: 'blader/humanizer',
              skills: ['humanizer']
            }
          ]
        },
        codebase: {
          graft: true
        },
        browser: {
          visualAgent: false,
          playwright: false
        },
        docs: {
          adr: true
        },
        github: {
          ci: false
        }
      };
  }
}

/** The skill selections that older versions of aginit wrote as defaults. */
const LEGACY_MATT_SKILL_SELECTIONS: string[][] = [
  ['tdd', 'code-review', 'diagnosing-bugs'],
  ['tdd', 'code-review', 'diagnosing-bugs', 'to-spec', 'to-tickets', 'implement-spec']
];

function matchesLegacySelection(skills: string[]): boolean {
  return LEGACY_MATT_SKILL_SELECTIONS.some(
    (selection) =>
      selection.length === skills.length && selection.every((skill) => skills.includes(skill))
  );
}

/**
 * Bring a saved `skills` section forward to the current standard: install the
 * full stable Matt Pocock set and drop the retired workflow selector.
 *
 * Only the exact selections aginit used to write are migrated, so a project
 * whose skill list was narrowed by hand keeps the list its author chose.
 */
export function upgradeLegacySkillConfig(
  skills: AginitConfig['skills']
): AginitConfig['skills'] {
  const sources: SkillSourceConfig[] = skills.sources.map((source) =>
    source.package === 'mattpocock/skills' && matchesLegacySelection(source.skills)
      ? { ...source, skills: [...MATT_POCOCK_SKILLS] }
      : source
  );
  const migrated = sources.some((source, index) => source !== skills.sources[index]);
  if (!migrated) return skills;

  const upgraded: AginitConfig['skills'] = { ...skills, sources };
  delete upgraded.workflow;
  return upgraded;
}
