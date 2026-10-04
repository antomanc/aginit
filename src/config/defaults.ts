import { AIProjectConfig, PresetType } from './schema.js';

export function getDefaultConfig(name: string, preset: PresetType): AIProjectConfig {
  switch (preset) {
    case 'web':
      return {
        version: '1.0.0',
        name,
        preset: 'web',
        agents: {
          primary: 'antigravity',
          secondary: 'codex'
        },
        skills: {
          sources: [
            {
              package: 'mattpocock/skills',
              skills: ['tdd', 'code-review', 'diagnosing-bugs', 'prototype', 'implement-spec']
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
          sources: [
            {
              package: 'mattpocock/skills',
              skills: ['tdd', 'code-review', 'diagnosing-bugs', 'codebase-design']
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
          sources: [
            {
              package: 'mattpocock/skills',
              skills: ['tdd', 'code-review', 'diagnosing-bugs']
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
