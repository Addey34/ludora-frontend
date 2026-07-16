import type { Direction } from '../../shared/engine/input.js';

/**
 * Pure, DOM-free 2048 grid logic. The game class ({@link Game2048}) owns the
 * animated tile identities and rendering; everything here is a plain function of
 * plain values (a `number[][]` value board, `0` = empty) so it can be unit-tested
 * without a DOM. Keep it side-effect free and randomness-free.
 */

/**
 * Maps a board position to the "left-oriented" grid, where a requested slide in
 * any {@link Direction} becomes a plain leftward slide. Inverse of
 * {@link orientFromLeft}.
 */
export function orientToLeft(
  row: number,
  col: number,
  direction: Direction,
  n: number
): { r: number; c: number } {
  switch (direction) {
    case 'left':
      return { r: row, c: col };
    case 'right':
      return { r: row, c: n - 1 - col };
    case 'up':
      return { r: col, c: row };
    case 'down':
      return { r: col, c: n - 1 - row };
  }
}

/**
 * Maps a position `(r, c)` in the left-oriented grid back to board coordinates.
 * Inverse of {@link orientToLeft}.
 */
export function orientFromLeft(
  r: number,
  c: number,
  direction: Direction,
  n: number
): { row: number; col: number } {
  switch (direction) {
    case 'left':
      return { row: r, col: c };
    case 'right':
      return { row: r, col: n - 1 - c };
    case 'up':
      return { row: c, col: r };
    case 'down':
      return { row: n - 1 - c, col: r };
  }
}

/** One resolved cell after collapsing a line: its value and how many source tiles fed it. */
interface LineOutput {
  /** Resulting value at this output cell (doubled when {@link merged}). */
  value: number;
  /** How many input tiles collapsed here: 1 (slid) or 2 (merged pair). */
  sources: number;
  /** True when two equal tiles merged into this cell. */
  merged: boolean;
}

/**
 * Collapses one line of tile values (in slide order, zeros already removed)
 * leftward: equal neighbours merge into their sum, **at most one merge per tile**
 * per move. Returns the ordered output cells and the score gained. Pure.
 */
export function planLine(values: number[]): { outputs: LineOutput[]; gained: number } {
  const outputs: LineOutput[] = [];
  let gained = 0;
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < values.length && values[i + 1] === values[i]) {
      const value = values[i] * 2;
      outputs.push({ value, sources: 2, merged: true });
      gained += value;
      i++;
    } else {
      outputs.push({ value: values[i], sources: 1, merged: false });
    }
  }
  return { outputs, gained };
}

/** All empty cells of a value board, in row-major order (`0` = empty). */
export function emptyCells(board: number[][]): Array<{ x: number; y: number }> {
  const empty: Array<{ x: number; y: number }> = [];
  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value === 0) empty.push({ x, y });
    });
  });
  return empty;
}

/**
 * Whether any move is still possible on a value board: a free cell, or two equal
 * adjacent tiles (horizontally or vertically). Pure.
 */
export function canMove(board: number[][]): boolean {
  const n = board.length;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const value = board[y][x];
      if (value === 0) return true;
      if (x + 1 < n && value === board[y][x + 1]) return true;
      if (y + 1 < n && value === board[y + 1][x]) return true;
    }
  }
  return false;
}
