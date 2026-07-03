import { describe, it, expect } from 'vitest';
import { extendSequence, flashInterval, PADS } from './simon.js';

describe('extendSequence', () => {
  it('appends exactly one pad and keeps the original untouched', () => {
    const seq = [0, 2];
    const next = extendSequence(seq, () => 0.5);
    expect(next).toHaveLength(3);
    expect(seq).toEqual([0, 2]); // input not mutated
    expect(next.slice(0, 2)).toEqual([0, 2]);
  });

  it('maps the rng into a valid pad index (0..PADS-1)', () => {
    expect(extendSequence([], () => 0)[0]).toBe(0);
    expect(extendSequence([], () => 0.999)[0]).toBe(PADS - 1);
  });
});

describe('flashInterval', () => {
  it('speeds up as the sequence grows', () => {
    expect(flashInterval(1)).toBeGreaterThan(flashInterval(5));
  });

  it('never drops below the 320 ms floor', () => {
    expect(flashInterval(100)).toBe(320);
  });
});
