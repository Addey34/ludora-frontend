import { describe, expect, it } from 'vitest';
import type { Seat } from '../../shared/turn/turnGame.js';
import {
  applyTictactoeMove,
  bestTictactoeMove,
  createTictactoeState,
  isTictactoeDraw,
  legalTictactoeMoves,
  type TictactoeState,
} from './tictactoe.js';

/** Plays a full game where `bot` uses minimax and `opponent` supplies the other seat's move. */
function playOut(opponent: (state: TictactoeState) => number, botSeat: Seat): TictactoeState {
  let state = createTictactoeState();
  while (state.winner === null && !isTictactoeDraw(state)) {
    const move = state.current === botSeat ? bestTictactoeMove(state) : { index: opponent(state) };
    if (!move) break;
    state = applyTictactoeMove(state, move);
  }
  return state;
}

describe('tictactoe rules', () => {
  it('starts with every cell available', () => {
    const state = createTictactoeState();
    expect(legalTictactoeMoves(state)).toHaveLength(9);
    expect(state.current).toBe(0);
  });

  it('switches seats without mutating the previous state', () => {
    const state = createTictactoeState();
    const next = applyTictactoeMove(state, { index: 0 });
    expect(state.cells[0]).toBeNull();
    expect(next.cells[0]).toBe(0);
    expect(next.current).toBe(1);
  });

  it('detects a completed line', () => {
    let state = createTictactoeState();
    for (const index of [0, 3, 1, 4, 2]) {
      state = applyTictactoeMove(state, { index });
    }
    expect(state.winner).toBe(0);
    expect(legalTictactoeMoves(state)).toEqual([]);
  });

  it('detects a full board draw', () => {
    const state = {
      cells: [0, 1, 0, 0, 1, 1, 1, 0, 0],
      current: 1,
      winner: null,
    };
    expect(isTictactoeDraw(state)).toBe(true);
  });
});

describe('tictactoe minimax bot', () => {
  it('takes an immediate winning move', () => {
    // Seat 0 has two in a row on the top line (cells 0,1) — it must complete at 2.
    const state: TictactoeState = {
      cells: [0, 0, null, 1, 1, null, null, null, null],
      current: 0,
      winner: null,
    };
    expect(bestTictactoeMove(state)?.index).toBe(2);
  });

  it('blocks the opponent instead of ignoring the threat', () => {
    // Seat 1 threatens the middle column (cells 1,4); seat 0 must block at 7.
    const state: TictactoeState = {
      cells: [0, 1, null, null, 1, null, null, null, null],
      current: 0,
      winner: null,
    };
    expect(bestTictactoeMove(state)?.index).toBe(7);
  });

  it('never loses against naive opponents, from either seat', () => {
    const firstCell = (s: TictactoeState) => legalTictactoeMoves(s)[0].index;
    const lastCell = (s: TictactoeState) => {
      const moves = legalTictactoeMoves(s);
      return moves[moves.length - 1].index;
    };
    for (const botSeat of [0, 1] as const) {
      for (const opponent of [firstCell, lastCell]) {
        const result = playOut(opponent, botSeat);
        expect(result.winner).not.toBe(1 - botSeat);
      }
    }
  });

  it('draws itself when both seats play optimally', () => {
    const result = playOut((s) => bestTictactoeMove(s)!.index, 0);
    expect(result.winner).toBeNull();
    expect(isTictactoeDraw(result)).toBe(true);
  });
});
