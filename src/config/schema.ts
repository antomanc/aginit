export type PresetType = 'web' | 'cli' | 'generic';
export type WebFramework = 'none' | 'vite' | 'next' | 'existing';
export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

export interface SkillSourceConfig {
  package: string;
  skills: string[];
}

export interface AginitConfig {
  schemaVersion: string;
  name: string;
  preset: PresetType;
  framework?: WebFramework;
  packageManager?: PackageManager;
  agents: {
    primary: string;
    secondary: string;
  };
  skills: {
    /**
     * @deprecated Legacy selector from when only a subset of skills was
     * installed. All standard skills are installed now, so this field is no
     * longer written. It is still accepted so existing configs keep loading.
     */
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
