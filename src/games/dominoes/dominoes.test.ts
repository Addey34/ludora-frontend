import { describe, expect, it } from 'vitest';
import {
  applyDominoesMove,
  createDominoesState,
  fullDominoSet,
  HAND_SIZE,
  legalDominoesMoves,
  pipTotal,
  type DominoesState,
  type Tile,
} from './dominoes.js';

function stateWith(overrides: Partial<DominoesState>): DominoesState {
  return {
    hands: [[], []],
    boneyard: [],
    chain: [],
    current: 0,
    winner: null,
    finished: false,
    blocked: false,
    passes: 0,
    ...overrides,
  };
}

describe('dominoes rules', () => {
  it('deals two hands of seven and a fourteen-tile boneyard', () => {
    const state = createDominoesState(fullDominoSet());
    expect(state.hands[0]).toHaveLength(HAND_SIZE);
    expect(state.hands[1]).toHaveLength(HAND_SIZE);
    expect(state.boneyard).toHaveLength(28 - HAND_SIZE * 2);
    expect(state.current).toBe(0);
  });

  it('allows any hand tile as the first placement', () => {
    const state = createDominoesState(fullDominoSet());
    const moves = legalDominoesMoves(state);
    expect(moves).toHaveLength(HAND_SIZE);
    expect(moves.every((move) => move.type === 'place')).toBe(true);
  });

  it('only offers tiles matching an open end, on the matching side', () => {
    const state = stateWith({
      hands: [
        [
          [2, 5],
          [1, 1],
          [3, 6],
        ],
        [],
      ],
      chain: [[3, 2]],
    });
    const moves = legalDominoesMoves(state);
    expect(moves).toEqual([
      { type: 'place', tile: [2, 5], end: 'right' },
      { type: 'place', tile: [3, 6], end: 'left' },
    ]);
  });

  it('offers both ends when a tile fits either side', () => {
    // chain is [4|4]: both open ends are 4.
    const state = stateWith({ hands: [[[4, 4]], []], chain: [[4, 4]] });
    expect(legalDominoesMoves(state)).toHaveLength(2);
  });

  it('orients a placed tile to keep the chain adjacency invariant', () => {
    let state = stateWith({
      hands: [[[5, 2]], [[3, 6]]],
      chain: [[3, 2]],
    });
    state = applyDominoesMove(state, { type: 'place', tile: [5, 2], end: 'right' });
    expect(state.chain).toEqual([
      [3, 2],
      [2, 5],
    ]);
    state = applyDominoesMove(state, { type: 'place', tile: [3, 6], end: 'left' });
    expect(state.chain[0]).toEqual([6, 3]);
    for (let i = 0; i < state.chain.length - 1; i++) {
      expect(state.chain[i][1]).toBe(state.chain[i + 1][0]);
    }
  });

  it('forces a draw when stuck with a non-empty boneyard, keeping the turn', () => {
    const drawn: Tile = [6, 6];
    const state = stateWith({
      hands: [[[1, 1]], [[0, 1]]],
      boneyard: [drawn],
      chain: [[2, 3]],
    });
    expect(legalDominoesMoves(state)).toEqual([{ type: 'draw' }]);
    const next = applyDominoesMove(state, { type: 'draw' });
    expect(next.current).toBe(0);
    expect(next.hands[0]).toContainEqual(drawn);
    expect(next.boneyard).toHaveLength(0);
  });

  it('resolves a blocked game to the lowest pip total', () => {
    let state = stateWith({
      hands: [[[1, 1]], [[6, 6]]],
      chain: [[2, 3]],
    });
    expect(legalDominoesMoves(state)).toEqual([{ type: 'pass' }]);
    state = applyDominoesMove(state, { type: 'pass' });
    expect(state.finished).toBe(false);
    state = applyDominoesMove(state, { type: 'pass' });
    expect(state.finished).toBe(true);
    expect(state.blocked).toBe(true);
    expect(state.winner).toBe(0);
  });

  it('declares a draw when a blocked game ties on pips', () => {
    let state = stateWith({
      hands: [[[1, 5]], [[2, 4]]],
      chain: [[3, 3]],
    });
    state = applyDominoesMove(state, { type: 'pass' });
    state = applyDominoesMove(state, { type: 'pass' });
    expect(state.finished).toBe(true);
    expect(state.winner).toBeNull();
  });

  it('wins immediately when a hand empties', () => {
    const state = stateWith({
      hands: [[[2, 6]], [[0, 0]]],
      chain: [[3, 2]],
    });
    const next = applyDominoesMove(state, { type: 'place', tile: [2, 6], end: 'left' });
    expect(next.winner).toBe(0);
    expect(next.finished).toBe(true);
    expect(legalDominoesMoves(next)).toHaveLength(0);
  });

  it('placing resets the pass streak', () => {
    const state = stateWith({
      hands: [[[2, 6]], [[0, 2]]],
      chain: [[3, 2]],
      passes: 1,
    });
    const next = applyDominoesMove(state, { type: 'place', tile: [2, 6], end: 'left' });
    expect(next.passes).toBe(0);
  });

  it('pipTotal sums both halves of every tile', () => {
    expect(
      pipTotal([
        [1, 2],
        [0, 6],
      ])
    ).toBe(9);
  });
});
