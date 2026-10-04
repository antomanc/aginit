import { PresetHandler } from './types.js';
import { webPreset } from './web.js';
import { cliPreset } from './cli.js';
import { genericPreset } from './generic.js';
import { PresetType } from '../config/schema.js';

export const presets: Record<PresetType, PresetHandler> = {
  web: webPreset,
  cli: cliPreset,
  generic: genericPreset
};

export function getPreset(name: string): PresetHandler {
  const handler = presets[name as PresetType];
  if (!handler) {
    const valid = Object.keys(presets).join(', ');
    throw new Error(`Unknown preset: "${name}". Valid presets are: ${valid}`);
  }
  return handler;
}

export function listPresets(): PresetHandler[] {
  return Object.values(presets);
}
