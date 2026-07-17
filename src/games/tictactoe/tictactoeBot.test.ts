import { describe, expect, it } from 'vitest';
import { createTictactoeState, legalTictactoeMoves, type TictactoeState } from './tictactoe.js';
import { decideMove } from './tictactoeBot.js';

describe('tictactoe bot difficulty', () => {
  it('hard always plays the optimal move (blocks a threat)', () => {
    // Seat 1 threatens the middle column (cells 1,4); seat 0 must block at 7.
    const state: TictactoeState = {
      cells: [0, 1, null, null, 1, null, null, null, null],
      current: 0,
      winner: null,
    };
    const move = decideMove(state, legalTictactoeMoves(state), 'hard', () => 0);
    expect(move.index).toBe(7);
  });

  it('easy ignores the strategy and plays a random legal cell', () => {
    const state = createTictactoeState();
    const moves = legalTictactoeMoves(state);
    // rng = 0 → first legal move regardless of what minimax would pick.
    expect(decideMove(state, moves, 'easy', () => 0).index).toBe(moves[0].index);
  });

  it('never returns an illegal move', () => {
    const state: TictactoeState = {
      cells: [0, 1, 0, 1, null, 0, 1, 0, null],
      current: 1,
      winner: null,
    };
    const legal = legalTictactoeMoves(state).map((m) => m.index);
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const move = decideMove(state, legalTictactoeMoves(state), difficulty, () => 0.99);
      expect(legal).toContain(move.index);
    }
  });
});
