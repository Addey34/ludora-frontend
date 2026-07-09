import { describe, expect, it } from 'vitest';

import { gzPoints } from './gzPoints.js';

describe('gzPoints', () => {
  it('awards nothing for a zero or negative score', () => {
    expect(gzPoints(0)).toBe(0);
    expect(gzPoints(-10)).toBe(0);
  });

  it('scales with the log of the score (bounded contribution)', () => {
    expect(gzPoints(9)).toBe(10); // 10*log10(10) = 10
    expect(gzPoints(99)).toBe(20); // 10*log10(100) = 20
    expect(gzPoints(999)).toBe(30);
    expect(gzPoints(9999)).toBe(40);
  });

  it('keeps heterogeneous games comparable', () => {
    // A 5000-point Tetris run and a 200-point Snake run land close together.
    expect(Math.abs(gzPoints(5000) - gzPoints(200))).toBeLessThanOrEqual(14);
  });

  it('ignores a non-finite score', () => {
    expect(gzPoints(NaN)).toBe(0);
    expect(gzPoints(Infinity)).toBe(0);
  });
});
