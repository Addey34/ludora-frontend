import { describe, it, expect } from 'vitest';
import {
  SIZE,
  conflicts,
  countSolutions,
  generatePuzzle,
  generateSolved,
  isSolved,
  isValidPlacement,
} from './sudoku.js';

/** Deterministic-ish RNG for reproducible generation in tests. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('generateSolved', () => {
  it('produces a full, valid grid', () => {
    const grid = generateSolved(lcg(1));
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = grid[r][c];
        expect(v).toBeGreaterThanOrEqual(1);
        grid[r][c] = 0;
        expect(isValidPlacement(grid, r, c, v)).toBe(true);
        grid[r][c] = v;
      }
    }
    expect(countSolutions(grid, 2)).toBe(1);
  });
});

describe('generatePuzzle', () => {
  it('carves a puzzle with a unique solution that matches', () => {
    const { puzzle, solution } = generatePuzzle('easy', lcg(7));
    expect(countSolutions(puzzle, 2)).toBe(1);
    // Every given agrees with the solution.
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (puzzle[r][c] !== 0) expect(puzzle[r][c]).toBe(solution[r][c]);
      }
    }
    expect(isSolved(solution, solution)).toBe(true);
    expect(isSolved(puzzle, solution)).toBe(false);
  });
});

describe('conflicts', () => {
  it('flags duplicates in a row', () => {
    const grid = Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(0));
    grid[0][0] = 5;
    grid[0][4] = 5;
    const bad = conflicts(grid);
    expect(bad.has('0,0')).toBe(true);
    expect(bad.has('0,4')).toBe(true);
    expect(bad.size).toBe(2);
  });
});
