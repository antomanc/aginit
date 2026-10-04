import { AIProjectConfig, PresetType, WebFramework } from './schema.js';

export interface DefaultConfigOptions {
  framework?: WebFramework;
  specWorkflow?: boolean;
}

export function getDefaultConfig(
  name: string,
  preset: PresetType,
  options: DefaultConfigOptions = {}
): AIProjectConfig {
  const specWorkflow = !!options.specWorkflow;
  const mattSkills = specWorkflow
    ? ['tdd', 'code-review', 'diagnosing-bugs', 'to-spec', 'to-tickets', 'implement-spec']
    : ['tdd', 'code-review', 'diagnosing-bugs'];

  switch (preset) {
    case 'web':
      return {
        version: '1.0.0',
        name,
        preset: 'web',
        framework: options.framework || 'none',
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
          playwright: true
        },
        docs: {
          adr: true
        },
        github: {
          ci: true
        }
      };

    case 'cli':
      return {
        version: '1.0.0',
        name,
        preset: 'cli',
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
        version: '1.0.0',
        name,
        preset: 'generic',
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
