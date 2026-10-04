import { describe, it, expect } from 'vitest';
import { run } from '../src/index.js';

describe('run', () => {
  it('is a callable async function', async () => {
    expect(typeof run).toBe('function');
  });
});
