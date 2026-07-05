import { describe, expect, it } from 'vitest';
import {
  Cell,
  lineCells,
  readCells,
  sameCells,
  findPlacement,
  buildPuzzle,
  DIRS_EASY,
  DIRS_HARD,
} from './wordsearch.js';

/** A deterministic RNG cycling through the given values (for reproducible puzzles). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('lineCells', () => {
  it('expands a horizontal run inclusive of both ends', () => {
    expect(lineCells({ r: 2, c: 1 }, { r: 2, c: 4 })).toEqual([
      { r: 2, c: 1 },
      { r: 2, c: 2 },
      { r: 2, c: 3 },
      { r: 2, c: 4 },
    ]);
  });

  it('expands a diagonal run', () => {
    expect(lineCells({ r: 0, c: 0 }, { r: 2, c: 2 })).toEqual([
      { r: 0, c: 0 },
      { r: 1, c: 1 },
      { r: 2, c: 2 },
    ]);
  });

  it('returns null for a non-aligned pair', () => {
    expect(lineCells({ r: 0, c: 0 }, { r: 1, c: 2 })).toBeNull();
  });
});

describe('sameCells', () => {
  const a: Cell[] = [
    { r: 0, c: 0 },
    { r: 0, c: 1 },
    { r: 0, c: 2 },
  ];
  it('matches the same path forwards and reversed', () => {
    expect(sameCells(a, [...a])).toBe(true);
    expect(sameCells(a, [...a].reverse())).toBe(true);
  });
  it('rejects a different path', () => {
    expect(
      sameCells(a, [
        { r: 1, c: 0 },
        { r: 1, c: 1 },
        { r: 1, c: 2 },
      ])
    ).toBe(false);
  });
});

describe('buildPuzzle', () => {
  it('places the words and fills every cell', () => {
    const puzzle = buildPuzzle(8, ['CAT', 'DOG'], DIRS_EASY, seq([0, 0, 0]));
    // Every cell is a single A–Z letter.
    for (const row of puzzle.grid) {
      for (const ch of row) expect(ch).toMatch(/^[A-Z]$/);
    }
    // Each placement reads back as its word.
    for (const p of puzzle.placements) {
      expect(readCells(puzzle.grid, p.cells)).toBe(p.word);
    }
  });

  it('lets the trace find a placed word in either direction', () => {
    const puzzle = buildPuzzle(6, ['HELLO'], DIRS_HARD, Math.random);
    const placed = puzzle.placements[0];
    expect(placed).toBeDefined();
    // Trace along the placement's own cells → found.
    const hit = findPlacement(puzzle.placements, placed.cells);
    expect(hit?.word).toBe('HELLO');
    // Reversed trace → still found.
    const rev = findPlacement(puzzle.placements, [...placed.cells].reverse());
    expect(rev?.word).toBe('HELLO');
  });

  it('returns null when the trace matches no word', () => {
    const puzzle = buildPuzzle(8, ['CAT'], DIRS_EASY, seq([0, 0, 0]));
    const nowhere = findPlacement(puzzle.placements, [
      { r: 7, c: 7 },
      { r: 7, c: 6 },
    ]);
    expect(nowhere).toBeNull();
  });
});
