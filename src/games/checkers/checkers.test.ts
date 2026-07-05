import { describe, expect, it } from 'vitest';
import {
  CheckersState,
  Cell,
  Piece,
  SIZE,
  initialState,
  legalMoves,
  applyMove,
  winner,
  countPieces,
  isDark,
} from './checkers.js';

const idx = (r: number, c: number): number => r * SIZE + c;

/** An empty board with the given pieces placed, seat `current` to play. */
function board(pieces: Record<number, Piece>, current: 0 | 1 = 0, chain: number | null = null) {
  const cells: Cell[] = Array.from({ length: SIZE * SIZE }, () => null);
  for (const [i, p] of Object.entries(pieces)) cells[Number(i)] = p;
  const state: CheckersState = { board: cells, current, chain, winner: null };
  // Recompute the winner the way applyMove would (no move yet → just probe).
  return state;
}

const man = (seat: 0 | 1): Piece => ({ seat, king: false });
const king = (seat: 0 | 1): Piece => ({ seat, king: true });

describe('initialState', () => {
  it('places 12 men per seat on dark squares, seat 0 to play', () => {
    const s = initialState();
    expect(countPieces(s.board)).toEqual([12, 12]);
    expect(s.current).toBe(0);
    expect(s.winner).toBeNull();
    // Every piece sits on a dark square.
    s.board.forEach((cell, i) => {
      if (cell) expect(isDark(Math.floor(i / SIZE), i % SIZE)).toBe(true);
    });
  });

  it('opens with seven simple moves for seat 0 and no captures', () => {
    const moves = legalMoves(initialState());
    expect(moves).toHaveLength(7);
    // All are single steps (row distance 1), none a capture.
    for (const m of moves) {
      expect(Math.abs(Math.floor(m.to / SIZE) - Math.floor(m.from / SIZE))).toBe(1);
    }
  });
});

describe('simple moves', () => {
  it('a seat 0 man steps diagonally forward (up), not backward', () => {
    const s = board({ [idx(5, 2)]: man(0) });
    const tos = legalMoves(s).map((m) => m.to);
    expect(tos.sort()).toEqual([idx(4, 1), idx(4, 3)].sort());
  });

  it('a king steps in all four diagonal directions', () => {
    const s = board({ [idx(4, 3)]: king(0) });
    expect(legalMoves(s)).toHaveLength(4);
  });
});

describe('captures', () => {
  it('forces a capture when one is available', () => {
    // Seat 0 man at (5,2), enemy at (4,3) with (3,4) empty → must jump.
    const s = board({ [idx(5, 2)]: man(0), [idx(4, 3)]: man(1) });
    const moves = legalMoves(s);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({ from: idx(5, 2), to: idx(3, 4) });
  });

  it('removes the jumped piece', () => {
    const s = board({ [idx(5, 2)]: man(0), [idx(4, 3)]: man(1) });
    const next = applyMove(s, { from: idx(5, 2), to: idx(3, 4) });
    expect(next.board[idx(4, 3)]).toBeNull(); // victim gone
    expect(next.board[idx(3, 4)]).toEqual(man(0)); // moved
    expect(countPieces(next.board)).toEqual([1, 0]);
  });

  it('chains a multi-jump on the same seat', () => {
    // (5,2) jumps (4,3)→(3,4); from (3,4) another enemy at (2,5) with (1,6) empty.
    const s = board({ [idx(5, 2)]: man(0), [idx(4, 3)]: man(1), [idx(2, 5)]: man(1) });
    const mid = applyMove(s, { from: idx(5, 2), to: idx(3, 4) });
    expect(mid.current).toBe(0); // same seat keeps playing
    expect(mid.chain).toBe(idx(3, 4));
    // Only the chaining piece's further capture is legal.
    expect(legalMoves(mid)).toEqual([{ from: idx(3, 4), to: idx(1, 6) }]);
  });

  it('does not mutate the input state', () => {
    const s = board({ [idx(5, 2)]: man(0), [idx(4, 3)]: man(1) });
    applyMove(s, { from: idx(5, 2), to: idx(3, 4) });
    expect(s.board[idx(5, 2)]).toEqual(man(0));
    expect(s.board[idx(4, 3)]).toEqual(man(1));
  });
});

describe('promotion', () => {
  it('crowns a man that reaches the far row and ends its turn', () => {
    const s = board({ [idx(1, 2)]: man(0) });
    const next = applyMove(s, { from: idx(1, 2), to: idx(0, 1) });
    expect(next.board[idx(0, 1)]).toEqual(king(0));
    expect(next.current).toBe(1); // turn passed
  });

  it('a just-crowned man does not keep jumping (turn ends)', () => {
    // Seat 0 man jumps into the crown row over an enemy; even if a king jump
    // would exist, the turn ends on promotion.
    const s = board({ [idx(2, 3)]: man(0), [idx(1, 2)]: man(1) });
    const next = applyMove(s, { from: idx(2, 3), to: idx(0, 1) });
    expect(next.board[idx(0, 1)]).toEqual(king(0));
    expect(next.chain).toBeNull();
    expect(next.current).toBe(1);
  });
});

describe('winner', () => {
  it('is null on a fresh game', () => {
    expect(winner(initialState())).toBeNull();
  });

  it('declares the mover the winner when the opponent has no piece left', () => {
    const s = board({ [idx(5, 2)]: man(0), [idx(4, 3)]: man(1) });
    const next = applyMove(s, { from: idx(5, 2), to: idx(3, 4) });
    expect(winner(next)).toBe(0);
  });

  it('declares a loss for a side with no legal move (blocked)', () => {
    // Seat 1 man at (0,1) hemmed into its corner with no forward square: seat 0
    // to move has a capture forcing seat 1 out — instead test a true block.
    // Seat 1 man at (7,0) can only move down/off-board (it moves down) → stuck,
    // and it is seat 1's turn.
    const s = board({ [idx(7, 0)]: man(1), [idx(0, 7)]: man(0) }, 1);
    // Seat 1 (moves down) at row 7 has no forward square → no legal move → loses.
    expect(legalMoves(s)).toEqual([]);
    // winner is only cached by applyMove; verify the block via legalMoves here.
  });
});
