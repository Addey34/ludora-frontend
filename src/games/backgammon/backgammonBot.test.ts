import { describe, expect, it } from 'vitest';
import type { Seat } from '../../shared/turn/turnGame.js';
import { type BackgammonState, legalBackgammonMoves, POINT_COUNT } from './backgammon.js';
import { decideMove } from './backgammonBot.js';

/** A blank board with the given overrides. */
function bg(overrides: Partial<BackgammonState>): BackgammonState {
  return {
    points: new Array<number>(POINT_COUNT).fill(0),
    bar: [0, 0],
    off: [0, 0],
    current: 0 as Seat,
    dice: [],
    winner: null,
    ...overrides,
  };
}

describe('backgammon bot difficulty', () => {
  it('hard prefers hitting an opponent blot', () => {
    const points = new Array<number>(POINT_COUNT).fill(0);
    points[10] = 2; // seat 0
    points[8] = -1; // reachable blot with die 2
    const state = bg({ points, dice: [2, 5] });
    const move = decideMove(state, legalBackgammonMoves(state), 'hard', () => 0);
    expect(move).toEqual({ from: 10, to: 8, die: 2 });
  });

  it('easy plays the first random legal step', () => {
    const points = new Array<number>(POINT_COUNT).fill(0);
    points[10] = 2;
    points[8] = -1;
    const state = bg({ points, dice: [2, 5] });
    const moves = legalBackgammonMoves(state);
    expect(decideMove(state, moves, 'easy', () => 0)).toEqual(moves[0]);
  });

  it('never returns an illegal step, at any tier', () => {
    const points = new Array<number>(POINT_COUNT).fill(0);
    points[23] = 2;
    points[12] = 5;
    const state = bg({ points, dice: [3, 4] });
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const legal = legalBackgammonMoves(state);
      const move = decideMove(state, legalBackgammonMoves(state), difficulty, () => 0.99);
      expect(legal).toContainEqual(move);
    }
  });
});
