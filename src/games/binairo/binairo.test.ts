import { describe, it, expect } from 'vitest';
import { generatePuzzle, isConflict, isSolved, type Cell } from './binairo.js';

describe('binairo', () => {
  describe('generatePuzzle', () => {
    for (const size of [6, 8] as const) {
      it(`produces a valid ${size}×${size} puzzle`, () => {
        const { solution, puzzle, grid, size: s } = generatePuzzle(size);
        expect(s).toBe(size);
        // The full solution is itself a solved board.
        expect(isSolved(solution as Cell[][], size)).toBe(true);
        // Every given (non-null) puzzle cell matches the solution.
        for (let r = 0; r < size; r++)
          for (let c = 0; c < size; c++)
            if (puzzle[r][c] !== null) expect(puzzle[r][c]).toBe(solution[r][c]);
        // The starting grid is a copy of the puzzle (some cells still blank).
        expect(grid).toEqual(puzzle);
        expect(grid.flat().some((v) => v === null)).toBe(true);
      });
    }
  });

  describe('isConflict', () => {
    const size = 6;
    const emptyRow = (): Cell[] => new Array(size).fill(null);

    it('flags three equal cells in a row', () => {
      const grid: Cell[][] = Array.from({ length: size }, emptyRow);
      grid[0][0] = grid[0][1] = grid[0][2] = 1;
      expect(isConflict(grid, 0, 1, size)).toBe(true);
      expect(isConflict(grid, 0, 0, size)).toBe(true);
    });

    it('flags three equal cells in a column', () => {
      const grid: Cell[][] = Array.from({ length: size }, emptyRow);
      grid[1][2] = grid[2][2] = grid[3][2] = 0;
      expect(isConflict(grid, 2, 2, size)).toBe(true);
    });

    it('does not flag a pair', () => {
      const grid: Cell[][] = Array.from({ length: size }, emptyRow);
      grid[0][0] = grid[0][1] = 1;
      expect(isConflict(grid, 0, 0, size)).toBe(false);
    });

    it('ignores blank cells', () => {
      const grid: Cell[][] = Array.from({ length: size }, emptyRow);
      expect(isConflict(grid, 0, 0, size)).toBe(false);
    });
  });

  describe('isSolved', () => {
    it('rejects an incomplete grid', () => {
      const { solution, size } = generatePuzzle(6);
      const grid: Cell[][] = solution.map((row) => [...row] as Cell[]);
      grid[0][0] = null;
      expect(isSolved(grid, size)).toBe(false);
    });

    it('rejects a grid with a three-in-a-row conflict', () => {
      const { solution, size } = generatePuzzle(6);
      const grid: Cell[][] = solution.map((row) => [...row] as Cell[]);
      // Force a triple in the first row (breaks either the run or the balance).
      grid[0][0] = grid[0][1] = grid[0][2] = 1;
      expect(isSolved(grid, size)).toBe(false);
    });

    it('rejects duplicate rows/columns even when balanced and triple-free', () => {
      // A pure checkerboard: every row/column is balanced and has no run of 3,
      // but the rows (and columns) repeat — which Binairo forbids.
      const size = 6;
      const grid: Cell[][] = Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) => ((r + c) % 2) as Cell)
      );
      expect(isSolved(grid, size)).toBe(false);
    });
  });
});
