import { describe, expect, it } from 'vitest';
import { createMillState, legalMillMoves } from './mill.js';
import { decideMove } from './millBot.js';

describe('mill bot difficulty', () => {
  it('easy ignores the heuristic and plays the first random legal move', () => {
    const state = createMillState();
    const moves = legalMillMoves(state);
    const chosen = decideMove(state, moves, 'easy', () => 0);
    expect(chosen).toEqual(moves[0]);
  });

  it('never returns a move outside the legal set, at any tier', () => {
    const state = createMillState();
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const legal = legalMillMoves(state);
      const chosen = decideMove(state, legalMillMoves(state), difficulty, () => 0.5);
      expect(legal).toContainEqual(chosen);
    }
  });
});
