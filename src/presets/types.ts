import { AIProjectConfig, PresetType } from '../config/schema.js';

export interface PresetContext {
  targetDir: string;
  projectName: string;
  config: AIProjectConfig;
  dryRun?: boolean;
  silent?: boolean;
}

export interface PresetHandler {
  name: PresetType;
  description: string;
  scaffold: (ctx: PresetContext) => Promise<void>;
}
