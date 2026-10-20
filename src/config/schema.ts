import type { CustomCapabilityConfig, Platform, Stack } from '../registry/types.js';

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
    /**
     * Also install skills, Trail wiring and a CLAUDE.md import for Claude Code.
     * Missing in configs written before 0.4.0; treated as enabled.
     */
    claudeCode?: boolean;
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
    trail: boolean;
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
  /** Target platform. Missing in pre-v2 configs; detected from the project then. */
  platform?: Platform;
  /** Host toolchain. Missing in pre-v2 configs; detected from the project then. */
  stack?: Stack;
  /**
   * Enabled capability ids from the registry (src/registry/catalog.ts).
   * Missing in pre-v2 configs; inferred from skills.sources and the switches above.
   */
  capabilities?: string[];
  /** Skill repositories added on top of the registry; always enabled unless disabled. */
  customCapabilities?: CustomCapabilityConfig[];
  /** Capability ids to keep off, even when a preset or platform default would enable them. */
  disabledCapabilities?: string[];
}

// Backward-compatible alias
export type AIProjectConfig = AginitConfig;

export const AGINIT_CONFIG_FILENAME = 'aginit.config.json';
export const LEGACY_CONFIG_FILENAME = 'ai.config.json';
export const AI_CONFIG_FILENAME = AGINIT_CONFIG_FILENAME;
