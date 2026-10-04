import { describe, it, expect } from 'vitest';
import * as aginit from '../src/index.js';

describe('Aginit main exports', () => {
  it('exports core CLI and library functions', () => {
    expect(typeof aginit.createProject).toBe('function');
    expect(typeof aginit.initCurrentDirectory).toBe('function');
    expect(typeof aginit.runDoctor).toBe('function');
    expect(typeof aginit.getDefaultConfig).toBe('function');
    expect(typeof aginit.getPreset).toBe('function');
    expect(typeof aginit.listPresets).toBe('function');
    expect(typeof aginit.validateConfig).toBe('function');
    expect(typeof aginit.readProjectConfig).toBe('function');
    expect(typeof aginit.validateProjectName).toBe('function');
  });
});
