import { describe, expect, it } from 'vitest';
import { generateCode, scoreGuess, isWin } from './mastermind.js';

describe('scoreGuess', () => {
  it('counts exact hits as black', () => {
    expect(scoreGuess([0, 1, 2, 3], [0, 1, 2, 3])).toEqual({ black: 4, white: 0 });
  });

  it('counts right colour / wrong spot as white', () => {
    expect(scoreGuess([0, 1, 2, 3], [3, 2, 1, 0])).toEqual({ black: 0, white: 4 });
  });

  it('mixes black and white', () => {
    // spots 0 and 3 exact; 1 and 5 present but misplaced.
    expect(scoreGuess([0, 1, 2, 5], [0, 5, 3, 1])).toEqual({ black: 1, white: 2 });
  });

  it('does not over-count duplicates in the guess', () => {
    // Secret has a single 0; a guess with two 0s (one misplaced) yields one white.
    expect(scoreGuess([0, 1, 2, 3], [4, 0, 0, 5])).toEqual({ black: 0, white: 1 });
  });

  it('does not over-count duplicates in the secret', () => {
    // Secret has two 1s, guess has one 1 misplaced → a single white.
    expect(scoreGuess([1, 1, 2, 3], [4, 5, 6, 1])).toEqual({ black: 0, white: 1 });
  });

  it('caps whites by the available code pegs', () => {
    expect(scoreGuess([2, 2, 2, 2], [2, 2, 3, 3])).toEqual({ black: 2, white: 0 });
  });
});

describe('isWin', () => {
  it('is true only when every peg is black', () => {
    expect(isWin({ black: 4, white: 0 }, 4)).toBe(true);
    expect(isWin({ black: 3, white: 1 }, 4)).toBe(false);
  });
});

describe('generateCode', () => {
  const seq = (values: number[]): (() => number) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it('produces a code of the requested length within the colour range', () => {
    const code = generateCode(5, 8, true, Math.random);
    expect(code).toHaveLength(5);
    for (const c of code) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(8);
    }
  });

  it('yields distinct colours when duplicates are disallowed', () => {
    const code = generateCode(4, 6, false, Math.random);
    expect(new Set(code).size).toBe(4);
  });

  it('is deterministic given the rng (duplicates allowed)', () => {
    expect(generateCode(4, 6, true, seq([0, 0.2, 0.9, 0.5]))).toEqual([0, 1, 5, 3]);
  });
});
