/**
 * Word Search — pure grid logic (no DOM, no time), unit-tested in isolation
 * (`wordsearch.test.ts`). The controller (`WordSearchGame`) owns the rendering,
 * the pointer selection and the scoring; the words themselves come from the
 * shared word service (`shared/words`).
 *
 * A puzzle hides a set of words on a square grid of letters, each along a straight
 * run (horizontal, vertical or diagonal, forwards or backwards depending on the
 * allowed {@link Direction} set). Empty cells are filled with random letters. The
 * player traces a straight line of cells; {@link lineCells} turns two endpoints
 * into that run, and a trace counts as a find when its cells match a placed word's
 * cells (in either order — see {@link sameCells}).
 */

/** A grid coordinate. */
export interface Cell {
  r: number;
  c: number;
}

export type Grid = string[][];

/** A step vector `[dr, dc]` a word may be laid along. */
export type Direction = readonly [number, number];

/** Where one word sits in the grid: its letters and the cells it occupies. */
export interface Placement {
  word: string;
  cells: Cell[];
}

export interface Puzzle {
  size: number;
  grid: Grid;
  placements: Placement[];
}

/** →, ↓ (easy: forwards only). */
export const DIRS_EASY: Direction[] = [
  [0, 1],
  [1, 0],
];
/** …plus the two downward diagonals (medium). */
export const DIRS_MEDIUM: Direction[] = [...DIRS_EASY, [1, 1], [1, -1]];
/** …plus every reverse — all eight directions (hard). */
export const DIRS_HARD: Direction[] = [...DIRS_MEDIUM, [0, -1], [-1, 0], [-1, -1], [-1, 1]];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * The straight run of cells between two endpoints, or `null` if they are not
 * aligned on a row, a column or a 45° diagonal. Inclusive of both ends.
 */
export function lineCells(a: Cell, b: Cell): Cell[] | null {
  const dr = b.r - a.r;
  const dc = b.c - a.c;
  const aligned = dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
  if (!aligned) return null;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  const cells: Cell[] = [];
  for (let i = 0; i <= steps; i++) cells.push({ r: a.r + sr * i, c: a.c + sc * i });
  return cells;
}

/** Reads the letters of `grid` along `cells`, joined into a string. */
export function readCells(grid: Grid, cells: Cell[]): string {
  return cells.map(({ r, c }) => grid[r]?.[c] ?? '').join('');
}

/** Whether two cell paths cover the same cells, in the same or reverse order. */
export function sameCells(a: Cell[], b: Cell[]): boolean {
  if (a.length !== b.length) return false;
  const forward = a.every((cell, i) => cell.r === b[i].r && cell.c === b[i].c);
  const reversed = a.every(
    (cell, i) => cell.r === b[b.length - 1 - i].r && cell.c === b[b.length - 1 - i].c
  );
  return forward || reversed;
}

/** The placed word whose cells the trace matches, or `null`. */
export function findPlacement(placements: Placement[], trace: Cell[]): Placement | null {
  return placements.find((p) => sameCells(p.cells, trace)) ?? null;
}

const inBounds = (size: number, r: number, c: number): boolean =>
  r >= 0 && r < size && c >= 0 && c < size;

/** Tries to lay `word` on `grid`, allowing overlaps on matching letters. */
function tryPlace(
  grid: Grid,
  word: string,
  size: number,
  dirs: Direction[],
  rng: () => number
): Cell[] | null {
  for (let attempt = 0; attempt < 100; attempt++) {
    const [dr, dc] = dirs[Math.floor(rng() * dirs.length)];
    const r0 = Math.floor(rng() * size);
    const c0 = Math.floor(rng() * size);
    const cells: Cell[] = [];
    let ok = true;
    for (let i = 0; i < word.length; i++) {
      const r = r0 + dr * i;
      const c = c0 + dc * i;
      if (!inBounds(size, r, c) || (grid[r][c] !== '' && grid[r][c] !== word[i])) {
        ok = false;
        break;
      }
      cells.push({ r, c });
    }
    if (ok) {
      cells.forEach(({ r, c }, i) => (grid[r][c] = word[i]));
      return cells;
    }
  }
  return null;
}

/**
 * Builds a puzzle: places as many of `words` as fit (in order), then fills the
 * empty cells with random letters. Pure given `rng`. Words are assumed uppercase
 * A–Z (use the word service's `keyboardForm`).
 */
export function buildPuzzle(
  size: number,
  words: string[],
  dirs: Direction[],
  rng: () => number = Math.random
): Puzzle {
  const grid: Grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ''));
  const placements: Placement[] = [];
  for (const word of words) {
    const cells = tryPlace(grid, word, size, dirs, rng);
    if (cells) placements.push({ word, cells });
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === '') grid[r][c] = ALPHABET[Math.floor(rng() * ALPHABET.length)];
    }
  }
  return { size, grid, placements };
}
