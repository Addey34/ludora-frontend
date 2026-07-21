import { describe, expect, it } from 'vitest';

import { ludoraPoints } from './ludoraPoints.js';

describe('ludoraPoints', () => {
  it('awards nothing for a zero or negative score', () => {
    expect(ludoraPoints(0)).toBe(0);
    expect(ludoraPoints(-10)).toBe(0);
  });

  it('scales with the log of the score (bounded contribution)', () => {
    expect(ludoraPoints(9)).toBe(10); // 10*log10(10) = 10
    expect(ludoraPoints(99)).toBe(20); // 10*log10(100) = 20
    expect(ludoraPoints(999)).toBe(30);
    expect(ludoraPoints(9999)).toBe(40);
  });

  it('keeps heterogeneous games comparable', () => {
    // A 5000-point Tetris run and a 200-point Snake run land close together.
    expect(Math.abs(ludoraPoints(5000) - ludoraPoints(200))).toBeLessThanOrEqual(14);
  });

  it('ignores a non-finite score', () => {
    expect(ludoraPoints(NaN)).toBe(0);
    expect(ludoraPoints(Infinity)).toBe(0);
  });
});
