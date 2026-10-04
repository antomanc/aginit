export type PresetType = 'web' | 'cli' | 'generic';
export type WebFramework = 'none' | 'vite' | 'next' | 'existing';

export interface SkillSourceConfig {
  package: string;
  skills: string[];
}

export interface AIProjectConfig {
  version: string;
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

export const AI_CONFIG_FILENAME = 'ai.config.json';
