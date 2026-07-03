import { describe, it, expect } from 'vitest';
import { createBoard, floodReveal, isWin, neighbors } from './minesweeper.js';

function emptyRevealed(rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
}

describe('neighbors', () => {
  it('gives 3 for a corner, 8 for an interior cell', () => {
    expect(neighbors(0, 0, 5, 5)).toHaveLength(3);
    expect(neighbors(2, 2, 5, 5)).toHaveLength(8);
  });
});

describe('createBoard', () => {
  it('places exactly the requested mines, never on the safe cell', () => {
    const board = createBoard(9, 9, 10, 4, 4);
    const total = board.mine.flat().filter(Boolean).length;
    expect(total).toBe(10);
    expect(board.mine[4][4]).toBe(false);
  });

  it('computes adjacency counts consistent with the layout', () => {
    const board = createBoard(8, 8, 12, 0, 0);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const expected = neighbors(r, c, 8, 8).filter(([nr, nc]) => board.mine[nr][nc]).length;
        expect(board.count[r][c]).toBe(expected);
      }
    }
  });
});

describe('floodReveal', () => {
  it('reveals the whole board when there are no mines', () => {
    const board = createBoard(5, 5, 0, 2, 2);
    const revealed = emptyRevealed(5, 5);
    floodReveal(board, revealed, 2, 2);
    expect(revealed.flat().every(Boolean)).toBe(true);
    expect(isWin(board, revealed)).toBe(true);
  });

  it('does nothing when clicking a mine', () => {
    const board = createBoard(3, 3, 8, 0, 0); // everything but (0,0) is a mine
    const revealed = emptyRevealed(3, 3);
    floodReveal(board, revealed, 1, 1); // a mine
    expect(revealed[1][1]).toBe(false);
  });
});
