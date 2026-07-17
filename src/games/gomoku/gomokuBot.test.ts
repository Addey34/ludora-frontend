import { describe, expect, it } from 'vitest';
import { createGomokuState, legalGomokuMoves, type GomokuState } from './gomoku.js';
import { decideMove } from './gomokuBot.js';

describe('gomoku bot difficulty', () => {
  it('hard completes its own five when it can', () => {
    // Seat 0 has four in a row on the top edge (cells 0..3); it must win at 4.
    const cells = Array.from({ length: 15 * 15 }, () => null) as GomokuState['cells'];
    cells[0] = cells[1] = cells[2] = cells[3] = 0;
    const state: GomokuState = { cells, current: 0, winner: null, last: 3 };
    const move = decideMove(state, legalGomokuMoves(state), 'hard', () => 0);
    expect(move.index).toBe(4);
  });

  it('easy ignores the heuristic and plays a random legal cell', () => {
    const state = createGomokuState();
    const moves = legalGomokuMoves(state);
    expect(decideMove(state, moves, 'easy', () => 0).index).toBe(moves[0].index);
  });

  it('never returns an occupied cell', () => {
    const cells = Array.from({ length: 15 * 15 }, () => null) as GomokuState['cells'];
    cells[0] = 0;
    cells[1] = 1;
    const state: GomokuState = { cells, current: 0, winner: null, last: 1 };
    const move = decideMove(state, legalGomokuMoves(state), 'hard', () => 0.99);
    expect(state.cells[move.index]).toBeNull();
  });
});
