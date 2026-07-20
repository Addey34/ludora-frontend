import { describe, expect, it } from 'vitest';
import { decideMove } from './quoridorBot.js';
import {
  createQuoridorState,
  legalQuoridorMoves,
  quoridorMoveEquals,
  type QuoridorState,
} from './quoridor.js';

describe('quoridor bot', () => {
  it('takes an immediate winning move on hard', () => {
    const state: QuoridorState = {
      ...createQuoridorState(),
      pawns: [
        { row: 1, col: 4 },
        { row: 8, col: 8 },
      ],
      current: 0,
    };
    const move = decideMove(state, legalQuoridorMoves(state), 'hard', () => 0);

    expect(move).toEqual({ type: 'pawn', to: { row: 0, col: 4 } });
  });

  it('uses the random branch on easy', () => {
    const state = createQuoridorState();
    const legal = legalQuoridorMoves(state);
    const picks = [0.5, 0.75];
    const move = decideMove(state, legal, 'easy', () => picks.shift() ?? 0);

    expect(quoridorMoveEquals(move, legal[Math.floor(legal.length * 0.75)])).toBe(true);
  });

  it('always returns a legal move', () => {
    const state = createQuoridorState();
    const legal = legalQuoridorMoves(state);
    const move = decideMove(state, legal, 'medium', () => 0);

    expect(legal.some((candidate) => quoridorMoveEquals(candidate, move))).toBe(true);
  });
});
