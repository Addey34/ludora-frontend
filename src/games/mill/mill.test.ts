import { describe, expect, it } from 'vitest';
import type { Seat } from '../../shared/turn/turnGame.js';
import {
  applyMillMove,
  bestMillMove,
  createMillState,
  legalMillMoves,
  type MillState,
  partOfMill,
  POINT_COUNT,
} from './mill.js';

/** A board with the given stones; defaults to the moving phase (both placed 9). */
function state(stones: Record<number, Seat>, overrides: Partial<MillState> = {}): MillState {
  const board: Array<Seat | null> = Array.from({ length: POINT_COUNT }, () => null);
  for (const [index, seat] of Object.entries(stones)) board[Number(index)] = seat;
  return { board, current: 0, placed: [9, 9], mustRemove: false, winner: null, ...overrides };
}

describe('mill rules', () => {
  it('opens with 24 placing moves for seat 0', () => {
    const moves = legalMillMoves(createMillState());
    expect(moves).toHaveLength(24);
    expect(moves.every((m) => m.type === 'place')).toBe(true);
  });

  it('completing a mill while placing forces a removal', () => {
    // Opponent has pieces on the board, so the mill has something to capture.
    const placing = state({ 0: 0, 1: 0, 5: 1, 8: 1, 13: 1 }, { placed: [2, 3] });
    const next = applyMillMove(placing, { type: 'place', to: 2 });
    expect(next.mustRemove).toBe(true);
    expect(next.current).toBe(0); // same seat removes before the turn passes
    expect(legalMillMoves(next).every((m) => m.type === 'remove')).toBe(true);
  });

  it('detects a completed mill via partOfMill', () => {
    const board = state({ 0: 0, 1: 0, 2: 0 }).board;
    expect(partOfMill(board, 0, 0)).toBe(true);
    expect(partOfMill(board, 3, 0)).toBe(false);
  });

  it('removing an opponent down to two pieces wins', () => {
    const removing = state({ 5: 1, 8: 1, 20: 1, 0: 0, 1: 0, 2: 0 }, { mustRemove: true });
    const next = applyMillMove(removing, { type: 'remove', at: 5 });
    expect(next.winner).toBe(0);
  });

  it('restricts a non-flying piece to adjacent empty points', () => {
    const moving = state({ 0: 0, 3: 0, 5: 0, 8: 0 }); // seat 0 has 4 pieces, cannot fly
    const fromZero = legalMillMoves(moving).filter((m) => m.type === 'move' && m.from === 0);
    const targets = fromZero.map((m) => (m.type === 'move' ? m.to : -1));
    expect(targets.sort()).toEqual([1, 9]); // only 0's neighbours
  });

  it('lets a three-piece side fly to any empty point', () => {
    const flying = state({ 0: 0, 1: 0, 2: 0, 21: 1, 22: 1, 23: 1 });
    const canReach = legalMillMoves(flying).some((m) => m.type === 'move' && m.to === 17);
    expect(canReach).toBe(true); // 17 is not adjacent to any seat-0 point
  });
});

describe('mill heuristic bot', () => {
  it('completes an available mill when placing', () => {
    const placing = state({ 0: 0, 1: 0 }, { placed: [2, 2] });
    expect(bestMillMove(placing)).toEqual({ type: 'place', to: 2 });
  });

  it('removes the opponent piece at the crossing of two threats', () => {
    // Seat 1 threatens both [3,4,5] and [1,4,7]; piece 4 sits on both, so it is
    // the most dangerous and the only one whose removal defuses two mills.
    // Seat 0's own mill [9,10,11] justifies the capture; points 1 and 5 stay
    // empty so both of piece 4's threats ([3,4,5] and [1,4,7]) are live.
    const removing = state({ 3: 1, 4: 1, 7: 1, 9: 0, 10: 0, 11: 0 }, { mustRemove: true });
    expect(bestMillMove(removing)).toEqual({ type: 'remove', at: 4 });
  });
});
