import { describe, it, expect } from 'vitest';
import { initial, isSolved, move, clickTile, isMovable, shuffle } from './taquin.js';

/** Deterministic RNG cycling through the given values. */
function seededRng(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}

describe('taquin', () => {
  it('initial() is a solved board with the blank last', () => {
    const s = initial(4);
    expect(s.grid).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]);
    expect(s.blank).toBe(15);
    expect(isSolved(s)).toBe(true);
  });

  describe('move', () => {
    it('slides a tile into the blank and updates the blank index', () => {
      const s = initial(3); // blank at index 8 (bottom-right)
      const up = move(s, 'up');
      expect(up).not.toBeNull();
      expect(up!.blank).toBe(5); // the tile above slid down
      expect(up!.grid[8]).toBe(6); // tile 6 (was at index 5) moved into the blank
      expect(up!.grid[5]).toBe(0);
    });

    it('returns null for a move off the board', () => {
      const s = initial(3); // blank bottom-right: down and right are illegal
      expect(move(s, 'down')).toBeNull();
      expect(move(s, 'right')).toBeNull();
      expect(move(s, 'up')).not.toBeNull();
      expect(move(s, 'left')).not.toBeNull();
    });
  });

  describe('clickTile / isMovable', () => {
    it('slides an adjacent tile', () => {
      const s = initial(3);
      // index 7 is directly left of the blank (8) → movable.
      expect(isMovable(s, 7)).toBe(true);
      const next = clickTile(s, 7);
      expect(next).not.toBeNull();
      expect(next!.blank).toBe(7);
    });

    it('rejects a non-adjacent or blank tile', () => {
      const s = initial(3);
      expect(isMovable(s, 0)).toBe(false);
      expect(clickTile(s, 0)).toBeNull();
      expect(isMovable(s, s.blank)).toBe(false);
      expect(clickTile(s, s.blank)).toBeNull();
    });
  });

  describe('shuffle', () => {
    it('keeps a valid permutation (all tiles present, one blank)', () => {
      const s = shuffle(initial(4), 50, seededRng([0.1, 0.4, 0.7, 0.9, 0.25, 0.55]));
      const sorted = [...s.grid].sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length: 16 }, (_, i) => i));
      expect(s.grid[s.blank]).toBe(0);
    });

    it('leaves exactly one blank (shuffle is built from legal blank moves only)', () => {
      // Solvability is guaranteed by construction — every shuffle step is a legal
      // blank move — so we only assert the structural invariant here.
      const s = shuffle(initial(3), 30, seededRng([0.2, 0.6, 0.05, 0.85, 0.45]));
      expect(s.grid.filter((v) => v === 0)).toHaveLength(1);
    });
  });
});
