import { describe, expect, it } from 'vitest';
import {
  CheckersState,
  Cell,
  Piece,
  SIZE,
  initialState,
  legalMoves,
  applyMove,
} from './checkers.js';
import { decideMove } from './checkersBot.js';

const idx = (r: number, c: number): number => r * SIZE + c;
const man = (seat: 0 | 1): Piece => ({ seat, king: false });

function board(pieces: Record<number, Piece>, current: 0 | 1 = 0): CheckersState {
  const cells: Cell[] = Array.from({ length: SIZE * SIZE }, () => null);
  for (const [i, p] of Object.entries(pieces)) cells[Number(i)] = p;
  return { board: cells, current, chain: null, winner: null };
}

describe('decideMove', () => {
  it('always returns a legal move', () => {
    const s = initialState();
    const legal = legalMoves(s);
    const chosen = decideMove(s, legal, 'medium', () => 0.5);
    expect(legal.some((m) => m.from === chosen.from && m.to === chosen.to)).toBe(true);
  });

  it('plays the only legal move without searching (forced capture)', () => {
    const s = board({ [idx(5, 2)]: man(0), [idx(4, 3)]: man(1) });
    expect(decideMove(s, legalMoves(s), 'hard')).toEqual({ from: idx(5, 2), to: idx(3, 4) });
  });

  it('hard grabs a free capture over a quiet step', () => {
    // Seat 0 man can either step quietly (7,0)->(6,1) or capture (5,2)x(4,3).
    // Capture is mandatory, so the only legal moves are captures — hard takes it.
    const s = board({ [idx(5, 2)]: man(0), [idx(7, 0)]: man(0), [idx(4, 3)]: man(1) });
    const chosen = decideMove(s, legalMoves(s), 'hard');
    expect(applyMove(s, chosen).board[idx(4, 3)]).toBeNull(); // the enemy is gone
  });

  it('easy plays the random move its rng selects', () => {
    const s = initialState();
    const legal = legalMoves(s);
    // rng 0 -> index 0 of the legal list.
    expect(decideMove(s, legal, 'easy', () => 0)).toEqual(legal[0]);
  });
});
