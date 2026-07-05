/**
 * Nonogram (a.k.a. Picross) — pure puzzle logic (no DOM, no time), unit-tested in
 * isolation (`nonogram.test.ts`, which also proves every shipped level is
 * *uniquely* solvable by pure logic, so none can ship ambiguous). The controller
 * (`NonogramGame`) owns the rendering, the pointer painting and the level
 * bookkeeping.
 *
 * A picture is authored as rows of characters: any non-blank character (`#`) is a
 * filled cell, a space or `.` an empty cell. From the picture we derive the row
 * and column *clues* (the run-lengths the player reads off the margins) and check
 * a win by comparing the player's filled cells to the solution — pencil marks
 * (crosses that note a known-empty cell) are ignored.
 */

/** A player cell state: nothing, painted filled, or crossed out (known-empty). */
export const EMPTY = 0;
export const FILLED = 1;
export const CROSS = 2;
export type Mark = typeof EMPTY | typeof FILLED | typeof CROSS;

export interface Puzzle {
  rows: number;
  cols: number;
  /** `true` = a filled cell in the target picture. */
  solution: boolean[][];
  /** Run-lengths per row (an empty list → the row is blank). */
  rowClues: number[][];
  /** Run-lengths per column. */
  colClues: number[][];
}

/** Run-lengths of consecutive filled cells in a line (`[]` when the line is blank). */
export function lineClue(line: boolean[]): number[] {
  const runs: number[] = [];
  let run = 0;
  for (const on of line) {
    if (on) {
      run++;
    } else if (run > 0) {
      runs.push(run);
      run = 0;
    }
  }
  if (run > 0) runs.push(run);
  return runs;
}

/** Parses a character-row picture into a {@link Puzzle} with its derived clues. */
export function parsePuzzle(rows: string[]): Puzzle {
  const cols = Math.max(...rows.map((r) => r.length));
  const solution = rows.map((row) => {
    const cells: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      const ch = row[c] ?? ' ';
      cells.push(ch !== ' ' && ch !== '.');
    }
    return cells;
  });
  const rowClues = solution.map(lineClue);
  const colClues: number[][] = [];
  for (let c = 0; c < cols; c++) {
    colClues.push(lineClue(solution.map((row) => row[c])));
  }
  return { rows: rows.length, cols, solution, rowClues, colClues };
}

/** Whether the player's marks reveal exactly the solution (crosses ignored). */
export function isSolved(puzzle: Puzzle, marks: Mark[][]): boolean {
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const filled = marks[r]?.[c] === FILLED;
      if (filled !== puzzle.solution[r][c]) return false;
    }
  }
  return true;
}

/** A blank mark grid (all {@link EMPTY}) matching the puzzle size. */
export function emptyMarks(puzzle: Puzzle): Mark[][] {
  return Array.from({ length: puzzle.rows }, () => new Array<Mark>(puzzle.cols).fill(EMPTY));
}

/** The number of filled cells in the target picture (drives the progress HUD). */
export function filledCount(puzzle: Puzzle): number {
  let n = 0;
  for (const row of puzzle.solution) for (const on of row) if (on) n++;
  return n;
}

/**
 * Every arrangement of a line's clue runs across `len` cells. Used by the logic
 * solver (and testable in isolation). Pure.
 */
export function lineCandidates(clue: number[], len: number): boolean[][] {
  const res: boolean[][] = [];
  const k = clue.length;
  if (k === 0) {
    res.push(new Array<boolean>(len).fill(false));
    return res;
  }
  const place = (idx: number, start: number, acc: boolean[]): void => {
    if (idx === k) {
      const line = acc.slice();
      while (line.length < len) line.push(false);
      res.push(line);
      return;
    }
    // Cells still needed by this run and the ones after it (with gaps).
    let needed = -1; // trailing gap after the last run isn't required
    for (let i = idx; i < k; i++) needed += clue[i] + 1;
    for (let s = start; s <= len - needed; s++) {
      const next = acc.slice();
      while (next.length < s) next.push(false);
      for (let i = 0; i < clue[idx]; i++) next.push(true);
      let after = s + clue[idx];
      if (idx < k - 1) {
        next.push(false); // mandatory gap between runs
        after++;
      }
      place(idx + 1, after, next);
    }
  };
  place(0, 0, []);
  return res;
}

/** Whether a full-line candidate agrees with the currently-known cells (`-1` = unknown). */
function agrees(candidate: boolean[], known: number[]): boolean {
  for (let i = 0; i < candidate.length; i++) {
    if (known[i] !== -1 && known[i] !== (candidate[i] ? 1 : 0)) return false;
  }
  return true;
}

/** The cell value shared by every candidate at index `i`, or `null` if they differ. */
function forcedValue(candidates: boolean[][], i: number): boolean | null {
  const first = candidates[0][i];
  for (const cand of candidates) if (cand[i] !== first) return null;
  return first;
}

/**
 * Solves a puzzle by pure constraint propagation (line solving) — no guessing.
 * Returns the reconstructed picture when the clues force a full, unambiguous
 * solution, else `null` (blank, contradictory, or requiring a guess). Because it
 * never guesses, a non-null result is by construction the *only* solution, which
 * is exactly the "fair puzzle" guarantee we assert on every shipped level.
 */
export function solveByLogic(puzzle: Puzzle): boolean[][] | null {
  const { rows, cols, rowClues, colClues } = puzzle;
  const grid: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(-1));
  const rowCands = rowClues.map((clue) => lineCandidates(clue, cols));
  const colCands = colClues.map((clue) => lineCandidates(clue, rows));

  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < rows; r++) {
      rowCands[r] = rowCands[r].filter((cand) => agrees(cand, grid[r]));
      if (rowCands[r].length === 0) return null;
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] !== -1) continue;
        const v = forcedValue(rowCands[r], c);
        if (v !== null) {
          grid[r][c] = v ? 1 : 0;
          changed = true;
        }
      }
    }
    for (let c = 0; c < cols; c++) {
      const known = grid.map((row) => row[c]);
      colCands[c] = colCands[c].filter((cand) => agrees(cand, known));
      if (colCands[c].length === 0) return null;
      for (let r = 0; r < rows; r++) {
        if (grid[r][c] !== -1) continue;
        const v = forcedValue(colCands[c], r);
        if (v !== null) {
          grid[r][c] = v ? 1 : 0;
          changed = true;
        }
      }
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === -1) return null; // stalled with unknowns → ambiguous
    }
  }
  return grid.map((row) => row.map((v) => v === 1));
}

/** Whether the clues alone force exactly this picture (fair, guess-free puzzle). */
export function isUniquelySolvable(puzzle: Puzzle): boolean {
  const solved = solveByLogic(puzzle);
  if (!solved) return false;
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      if (solved[r][c] !== puzzle.solution[r][c]) return false;
    }
  }
  return true;
}
