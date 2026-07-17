import { describe, expect, it } from 'vitest';
import type { Seat } from '../../shared/turn/turnGame.js';
import {
  applyBackgammonMove,
  BAR,
  type BackgammonState,
  bestBackgammonMove,
  CHECKERS_PER_PLAYER,
  createBackgammonState,
  legalBackgammonMoves,
  OFF,
  owner,
  pipCount,
  POINT_COUNT,
} from './backgammon.js';

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

describe('backgammon rules', () => {
  it('starts from the standard 167-pip position', () => {
    const state = createBackgammonState();
    expect(pipCount(state, 0)).toBe(167);
    expect(pipCount(state, 1)).toBe(167);
    expect(legalBackgammonMoves(state)).toEqual([]); // no dice rolled yet
  });

  it('forces a checker on the bar to re-enter first', () => {
    const points = new Array<number>(POINT_COUNT).fill(0);
    points[5] = 2;
    const state = bg({ points, bar: [1, 0], dice: [2] });
    const moves = legalBackgammonMoves(state);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({ from: BAR, to: 22, die: 2 }); // seat 0 enters on 24 - d
  });

  it('bears a checker off with an exact die', () => {
    const points = new Array<number>(POINT_COUNT).fill(0);
    points[3] = 1;
    const state = bg({ points, dice: [4] });
    expect(legalBackgammonMoves(state)).toContainEqual({ from: 3, to: OFF, die: 4 });
    const next = applyBackgammonMove(state, { from: 3, to: OFF, die: 4 });
    expect(next.off[0]).toBe(1);
    expect(next.current).toBe(1); // die spent, turn passes
  });

  it('only offers first moves that allow the maximum number of dice to be played', () => {
    const points = new Array<number>(POINT_COUNT).fill(0);
    points[1] = 1;
    const state = bg({ points, off: [CHECKERS_PER_PLAYER - 1, 0], dice: [1, 2] });

    expect(legalBackgammonMoves(state)).toEqual([{ from: 1, to: 0, die: 1 }]);
  });

  it('uses the higher die when only one of two dice can be played', () => {
    const points = new Array<number>(POINT_COUNT).fill(0);
    points[0] = 1;
    const state = bg({ points, off: [CHECKERS_PER_PLAYER - 1, 0], dice: [1, 2] });

    expect(legalBackgammonMoves(state)).toEqual([{ from: 0, to: OFF, die: 2 }]);
  });

  it('does not allow an oversize bear-off while a checker is farther away', () => {
    const points = new Array<number>(POINT_COUNT).fill(0);
    points[2] = 1;
    points[4] = 1;
    const state = bg({ points, off: [CHECKERS_PER_PLAYER - 2, 0], dice: [4] });

    expect(legalBackgammonMoves(state)).not.toContainEqual({ from: 2, to: OFF, die: 4 });
    expect(legalBackgammonMoves(state)).toContainEqual({ from: 4, to: 0, die: 4 });
  });

  it('hits an opponent blot and sends it to the bar', () => {
    const points = new Array<number>(POINT_COUNT).fill(0);
    points[10] = 1; // seat 0
    points[8] = -1; // seat 1 blot
    const next = applyBackgammonMove(bg({ points, dice: [2] }), { from: 10, to: 8, die: 2 });
    expect(next.bar[1]).toBe(1);
    expect(owner(next.points[8])).toBe(0);
  });

  it('wins when all fifteen checkers are borne off', () => {
    const points = new Array<number>(POINT_COUNT).fill(0);
    points[0] = 1;
    const next = applyBackgammonMove(bg({ points, off: [CHECKERS_PER_PLAYER - 1, 0], dice: [1] }), {
      from: 0,
      to: OFF,
      die: 1,
    });
    expect(next.winner).toBe(0);
  });
});

describe('backgammon bot', () => {
  it('prefers hitting an opponent blot', () => {
    const points = new Array<number>(POINT_COUNT).fill(0);
    points[10] = 2; // seat 0
    points[8] = -1; // reachable blot with die 2
    const move = bestBackgammonMove(bg({ points, dice: [2, 5] }));
    expect(move).toEqual({ from: 10, to: 8, die: 2 });
  });
});
