import { AginitConfig, PresetType, WebFramework, PackageManager } from './schema.js';

export interface DefaultConfigOptions {
  framework?: WebFramework;
  specWorkflow?: boolean;
  packageManager?: PackageManager;
}

export function getDefaultConfig(
  name: string,
  preset: PresetType,
  options: DefaultConfigOptions = {}
): AginitConfig {
  const specWorkflow = !!options.specWorkflow;
  const packageManager = options.packageManager || 'pnpm';
  const mattSkills = specWorkflow
    ? ['tdd', 'code-review', 'diagnosing-bugs', 'to-spec', 'to-tickets', 'implement-spec']
    : ['tdd', 'code-review', 'diagnosing-bugs'];

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
          workflow: specWorkflow ? 'spec' : 'minimal',
          sources: [
            {
              package: 'mattpocock/skills',
              skills: mattSkills
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
          workflow: specWorkflow ? 'spec' : 'minimal',
          sources: [
            {
              package: 'mattpocock/skills',
              skills: mattSkills
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
          workflow: specWorkflow ? 'spec' : 'minimal',
          sources: [
            {
              package: 'mattpocock/skills',
              skills: mattSkills
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
