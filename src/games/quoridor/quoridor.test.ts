import { describe, expect, it } from 'vitest';
import {
  applyQuoridorMove,
  createQuoridorState,
  hasPathToGoal,
  isLegalWall,
  legalPawnMoves,
  legalQuoridorMoves,
  quoridorMoveEquals,
  WALLS_PER_PLAYER,
  type QuoridorState,
} from './quoridor.js';

function stateAt(pawns: QuoridorState['pawns'], walls: QuoridorState['walls'] = []): QuoridorState {
  return {
    pawns,
    walls,
    wallsRemaining: [WALLS_PER_PLAYER, WALLS_PER_PLAYER],
    current: 0,
    winner: null,
  };
}

describe('quoridor rules', () => {
  it('starts both pawns in the centre with ten walls each', () => {
    const state = createQuoridorState();

    expect(state.pawns).toEqual([
      { row: 8, col: 4 },
      { row: 0, col: 4 },
    ]);
    expect(state.wallsRemaining).toEqual([10, 10]);
    expect(legalPawnMoves(state)).toEqual([
      { row: 7, col: 4 },
      { row: 8, col: 3 },
      { row: 8, col: 5 },
    ]);
  });

  it('moves a pawn without mutating the previous state', () => {
    const state = createQuoridorState();
    const next = applyQuoridorMove(state, { type: 'pawn', to: { row: 7, col: 4 } });

    expect(state.pawns[0]).toEqual({ row: 8, col: 4 });
    expect(next.pawns[0]).toEqual({ row: 7, col: 4 });
    expect(next.current).toBe(1);
  });

  it('jumps over the opposing pawn when the square behind is open', () => {
    const state = stateAt([
      { row: 5, col: 4 },
      { row: 4, col: 4 },
    ]);

    expect(legalPawnMoves(state)).toContainEqual({ row: 3, col: 4 });
    expect(legalPawnMoves(state)).not.toContainEqual({ row: 4, col: 4 });
  });

  it('offers diagonal moves when a wall blocks the straight jump', () => {
    const state = stateAt(
      [
        { row: 5, col: 4 },
        { row: 4, col: 4 },
      ],
      [{ row: 3, col: 4, orientation: 'horizontal' }]
    );

    const moves = legalPawnMoves(state);
    expect(moves).toContainEqual({ row: 4, col: 3 });
    expect(moves).toContainEqual({ row: 4, col: 5 });
    expect(moves).not.toContainEqual({ row: 3, col: 4 });
  });

  it('places walls immutably and blocks the crossed edge', () => {
    const state = stateAt([
      { row: 5, col: 4 },
      { row: 0, col: 4 },
    ]);
    const next = applyQuoridorMove(state, {
      type: 'wall',
      wall: { row: 4, col: 4, orientation: 'horizontal' },
    });

    expect(state.walls).toEqual([]);
    expect(next.wallsRemaining[0]).toBe(WALLS_PER_PLAYER - 1);
    expect(legalPawnMoves({ ...next, current: 0 })).not.toContainEqual({ row: 4, col: 4 });
  });

  it('rejects overlapping and crossing walls', () => {
    const state = stateAt(createQuoridorState().pawns, [
      { row: 4, col: 4, orientation: 'horizontal' },
    ]);

    expect(isLegalWall(state, { row: 4, col: 3, orientation: 'horizontal' })).toBe(false);
    expect(isLegalWall(state, { row: 4, col: 4, orientation: 'vertical' })).toBe(false);
  });

  it('keeps a route to both goals for every legal wall', () => {
    const state = createQuoridorState();
    const wallMoves = legalQuoridorMoves(state).filter((move) => move.type === 'wall');

    expect(wallMoves).toHaveLength(128);
    for (const move of wallMoves) {
      if (move.type !== 'wall') continue;
      const next = { ...state, walls: [move.wall] };
      expect(hasPathToGoal(next, 0)).toBe(true);
      expect(hasPathToGoal(next, 1)).toBe(true);
    }
  });

  it('ends when a pawn reaches the opposite side', () => {
    const state = stateAt([
      { row: 1, col: 4 },
      { row: 8, col: 4 },
    ]);
    const next = applyQuoridorMove(state, { type: 'pawn', to: { row: 0, col: 4 } });

    expect(next.winner).toBe(0);
    expect(legalQuoridorMoves(next)).toEqual([]);
  });

  it('compares pawn and wall moves by value', () => {
    expect(
      quoridorMoveEquals(
        { type: 'pawn', to: { row: 7, col: 4 } },
        { type: 'pawn', to: { row: 7, col: 4 } }
      )
    ).toBe(true);
    expect(
      quoridorMoveEquals(
        { type: 'wall', wall: { row: 2, col: 3, orientation: 'vertical' } },
        { type: 'wall', wall: { row: 2, col: 3, orientation: 'horizontal' } }
      )
    ).toBe(false);
  });
});
