import { describe, it, expect } from 'vitest';
import { getPreset, listPresets } from '../src/presets/registry.js';

describe('Preset Registry', () => {
  it('lists all supported presets', () => {
    const list = listPresets();
    const names = list.map((p) => p.name);
    expect(names).toContain('web');
    expect(names).toContain('cli');
    expect(names).toContain('generic');
  });

  it('retrieves existing preset handlers', () => {
    const web = getPreset('web');
    expect(web.name).toBe('web');
    expect(web.description).toBeTruthy();

    const cli = getPreset('cli');
    expect(cli.name).toBe('cli');

    const generic = getPreset('generic');
    expect(generic.name).toBe('generic');
  });

  it('throws an error for unknown preset', () => {
    expect(() => getPreset('non-existent')).toThrowError(/Unknown preset/);
  });
});
