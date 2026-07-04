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
  it('places exactly the requested mines, keeping the whole safe zone clear', () => {
    const board = createBoard(9, 9, 10, 4, 4);
    const total = board.mine.flat().filter(Boolean).length;
    expect(total).toBe(10);
    // The clicked cell and its 8 neighbours are mine-free, so it always floods.
    expect(board.mine[4][4]).toBe(false);
    for (const [nr, nc] of neighbors(4, 4, 9, 9)) expect(board.mine[nr][nc]).toBe(false);
    expect(board.count[4][4]).toBe(0);
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
    // Safe zone around (2,2) is (1,1),(1,2),(2,1),(2,2); the other 5 cells all
    // become mines (8 requested, clamped to the 5 available), so (0,0) is a mine.
    const board = createBoard(3, 3, 8, 2, 2);
    expect(board.mine[0][0]).toBe(true);
    const revealed = emptyRevealed(3, 3);
    floodReveal(board, revealed, 0, 0); // a mine
    expect(revealed[0][0]).toBe(false);
  });
});
