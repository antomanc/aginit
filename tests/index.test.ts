import { describe, it, expect } from 'vitest';
import * as bootstrap from '../src/index.js';

describe('ai-project-bootstrap main exports', () => {
  it('exports core CLI and library functions', () => {
    expect(typeof bootstrap.createProject).toBe('function');
    expect(typeof bootstrap.initCurrentDirectory).toBe('function');
    expect(typeof bootstrap.runDoctor).toBe('function');
    expect(typeof bootstrap.getDefaultConfig).toBe('function');
    expect(typeof bootstrap.getPreset).toBe('function');
    expect(typeof bootstrap.listPresets).toBe('function');
  });
});
