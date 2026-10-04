export type PresetType = 'web' | 'cli' | 'generic';

export interface SkillSourceConfig {
  package: string;
  skills: string[];
}

export interface AIProjectConfig {
  version: string;
  name: string;
  preset: PresetType;
  agents: {
    primary: string;
    secondary: string;
  };
  skills: {
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
