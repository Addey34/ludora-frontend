import { describe, test, expect } from 'vitest';
import { decideMove } from './gooseBot.js';
import { initialState, legalMoves, PASS } from './goose.js';

describe('decideMove', () => {
  test('returns a value from the legal moves list', () => {
    const s = initialState();
    const moves = legalMoves(s);
    const m = decideMove(s, moves);
    expect(moves).toContain(m);
  });

  test('returns PASS when it is the only legal move', () => {
    const s = { ...initialState(), skipTurns: [2, 0, 0, 0] as [number, number, number, number] };
    expect(decideMove(s, [PASS])).toBe(PASS);
  });

  test('uses the injected rng to select among moves', () => {
    const moves = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    // rng = 0 → first move; rng = 0.999 → last move
    expect(decideMove(initialState(), moves, () => 0)).toBe(2);
    expect(decideMove(initialState(), moves, () => 0.999)).toBe(12);
  });
});
