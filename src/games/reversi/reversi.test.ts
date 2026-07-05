import { describe, expect, it } from 'vitest';
import {
  ReversiState,
  Cell,
  SIZE,
  initialState,
  legalMoves,
  applyMove,
  flips,
  winner,
  countDiscs,
  movesForSeat,
} from './reversi.js';

const idx = (r: number, c: number): number => r * SIZE + c;

describe('initialState', () => {
  it('sets the four central discs, black (seat 0) to move', () => {
    const s = initialState();
    expect(countDiscs(s.board)).toEqual([2, 2]);
    expect(s.board[idx(3, 3)]).toBe(1);
    expect(s.board[idx(4, 4)]).toBe(1);
    expect(s.board[idx(3, 4)]).toBe(0);
    expect(s.board[idx(4, 3)]).toBe(0);
    expect(s.current).toBe(0);
  });

  it('offers black exactly four opening moves', () => {
    const moves = legalMoves(initialState())
      .map((m) => m.index)
      .sort((a, b) => a - b);
    expect(moves).toEqual([idx(2, 3), idx(3, 2), idx(4, 5), idx(5, 4)].sort((a, b) => a - b));
  });
});

describe('flips / applyMove', () => {
  it('flips the bracketed disc when black plays (2,3)', () => {
    const s = initialState();
    const move = { index: idx(2, 3) };
    expect(flips(s.board, move.index, 0)).toEqual([idx(3, 3)]);
    const next = applyMove(s, move);
    expect(next.board[idx(2, 3)]).toBe(0); // placed
    expect(next.board[idx(3, 3)]).toBe(0); // flipped from white
    expect(countDiscs(next.board)).toEqual([4, 1]);
    expect(next.current).toBe(1); // white to move
  });

  it('does not mutate the input state', () => {
    const s = initialState();
    applyMove(s, { index: idx(2, 3) });
    expect(s.board[idx(2, 3)]).toBeNull();
    expect(s.board[idx(3, 3)]).toBe(1);
  });

  it('rejects a move that brackets nothing (no flips = illegal)', () => {
    const s = initialState();
    expect(flips(s.board, idx(0, 0), 0)).toEqual([]);
    expect(legalMoves(s).some((m) => m.index === idx(0, 0))).toBe(false);
  });
});

describe('passing / termination', () => {
  it('never leaves a live game without a legal move (passing is folded in)', () => {
    // Play a full deterministic game (always the first legal move); the pass
    // handling in applyMove must guarantee a live game always has ≥1 reply.
    let s = initialState();
    let guard = 0;
    while (!s.done && guard++ < 200) {
      const moves = legalMoves(s);
      expect(moves.length).toBeGreaterThan(0);
      s = applyMove(s, moves[0]);
    }
    expect(s.done).toBe(true);
    // The final winner is the disc majority (or null on a tie).
    const [b, w] = countDiscs(s.board);
    const expected = b > w ? 0 : w > b ? 1 : null;
    expect(s.winner).toBe(expected);
  });
});

describe('winner / draw', () => {
  it('is null while the game is running', () => {
    expect(winner(initialState())).toBeNull();
  });

  it('reports a draw as done with a null winner', () => {
    // A tiny 2-disc position, one each, with no empty square reachable: force a
    // full board split evenly by filling the rest with an even split.
    const board: Cell[] = Array.from({ length: SIZE * SIZE }, (_, i) => (i % 2) as 0 | 1);
    const state: ReversiState = { board, current: 0, done: true, winner: null };
    expect(countDiscs(board)).toEqual([32, 32]);
    expect(winner(state)).toBeNull(); // done + null winner = draw
  });

  it('movesForSeat finds the opening replies for white too', () => {
    const s = initialState();
    expect(movesForSeat(s.board, 1).length).toBe(4);
  });
});
