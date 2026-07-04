/**
 * Sudoku — pure logic, no DOM, no time. Solved-grid generation (randomised
 * backtracking), unique-solution puzzle carving, validity checks and win test all
 * live here so they are deterministic (given an `rng`) and unit-tested, exactly
 * like the other games' rules.
 *
 * A grid is a 9×9 matrix of 0–9 (0 = empty). Puzzles are carved so they keep a
 * **single** solution (verified with a 2-cap solution counter).
 */

import { Difficulty } from '../../shared/quiz/quiz.js';

export type Grid = number[][];
export const SIZE = 9;

/** Empty cells removed from the full solution, per difficulty. */
export const REMOVALS: Record<Difficulty, number> = {
  easy: 40,
  medium: 48,
  hard: 54,
};

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(0));
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

/** Whether placing `value` at (r, c) breaks no row/column/box constraint. */
export function isValidPlacement(grid: Grid, r: number, c: number, value: number): boolean {
  for (let i = 0; i < SIZE; i++) {
    if (grid[r][i] === value || grid[i][c] === value) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      if (grid[br + dr][bc + dc] === value) return false;
    }
  }
  return true;
}

function shuffled(n: number, rng: () => number): number[] {
  const out = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Fills `grid` in place with a valid complete solution (randomised). */
function fill(grid: Grid, rng: () => number): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== 0) continue;
      for (const value of shuffled(SIZE, rng)) {
        if (isValidPlacement(grid, r, c, value)) {
          grid[r][c] = value;
          if (fill(grid, rng)) return true;
          grid[r][c] = 0;
        }
      }
      return false;
    }
  }
  return true;
}

/** Builds a random complete, valid solution grid. */
export function generateSolved(rng: () => number = Math.random): Grid {
  const grid = emptyGrid();
  fill(grid, rng);
  return grid;
}

/** Counts solutions of `grid`, stopping once `limit` is reached (mutates a copy). */
export function countSolutions(grid: Grid, limit = 2): number {
  const work = cloneGrid(grid);
  let count = 0;
  const solve = (): void => {
    if (count >= limit) return;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (work[r][c] !== 0) continue;
        for (let value = 1; value <= SIZE; value++) {
          if (isValidPlacement(work, r, c, value)) {
            work[r][c] = value;
            solve();
            work[r][c] = 0;
            if (count >= limit) return;
          }
        }
        return; // this empty cell had all values tried
      }
    }
    count += 1; // no empty cell left → a full solution
  };
  solve();
  return count;
}

/**
 * Generates a puzzle for `difficulty`: a full solution, then cells removed (in
 * random order) as long as the puzzle keeps a unique solution, up to the target
 * number of removals. Returns the puzzle and its solution.
 */
export function generatePuzzle(
  difficulty: Difficulty,
  rng: () => number = Math.random
): { puzzle: Grid; solution: Grid } {
  const solution = generateSolved(rng);
  const puzzle = cloneGrid(solution);
  const target = REMOVALS[difficulty];

  const order = Array.from({ length: SIZE * SIZE }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  let removed = 0;
  for (const cell of order) {
    if (removed >= target) break;
    const r = Math.floor(cell / SIZE);
    const c = cell % SIZE;
    if (puzzle[r][c] === 0) continue;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      removed += 1;
    } else {
      puzzle[r][c] = backup; // removal would create ambiguity — keep it
    }
  }

  return { puzzle, solution };
}

/** Whether every cell is filled and equals the solution. */
export function isSolved(grid: Grid, solution: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

/**
 * Returns the set of filled cells that clash with another in their row, column
 * or box, as `"r,c"` keys — used to highlight conflicts live.
 */
export function conflicts(grid: Grid): Set<string> {
  const bad = new Set<string>();
  const check = (cells: [number, number][]): void => {
    const seen = new Map<number, [number, number]>();
    for (const [r, c] of cells) {
      const v = grid[r][c];
      if (v === 0) continue;
      const prev = seen.get(v);
      if (prev) {
        bad.add(`${r},${c}`);
        bad.add(`${prev[0]},${prev[1]}`);
      } else {
        seen.set(v, [r, c]);
      }
    }
  };

  for (let i = 0; i < SIZE; i++) {
    check(Array.from({ length: SIZE }, (_, j) => [i, j] as [number, number]));
    check(Array.from({ length: SIZE }, (_, j) => [j, i] as [number, number]));
  }
  for (let br = 0; br < SIZE; br += 3) {
    for (let bc = 0; bc < SIZE; bc += 3) {
      const box: [number, number][] = [];
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) box.push([br + dr, bc + dc]);
      }
      check(box);
    }
  }
  return bad;
}
