export type PresetType = 'web' | 'cli' | 'generic';
export type WebFramework = 'none' | 'vite' | 'next' | 'existing';

export interface SkillSourceConfig {
  package: string;
  skills: string[];
}

export interface AginitConfig {
  schemaVersion: string;
  name: string;
  preset: PresetType;
  framework?: WebFramework;
  agents: {
    primary: string;
    secondary: string;
  };
  skills: {
    workflow?: 'minimal' | 'spec';
    sources: SkillSourceConfig[];
  };
  codebase: {
    graft: boolean;
  };
  browser: {
    visualAgent: boolean;
    playwright: boolean;
  };
  docs: {
    adr: boolean;
  };
  github: {
    ci: boolean;
  };
}

// Backward-compatible alias
export type AIProjectConfig = AginitConfig;

export const AGINIT_CONFIG_FILENAME = 'aginit.config.json';
export const LEGACY_CONFIG_FILENAME = 'ai.config.json';
export const AI_CONFIG_FILENAME = AGINIT_CONFIG_FILENAME;
