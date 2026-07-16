import { describe, expect, it } from 'vitest';
import type { Seat } from '../../shared/turn/turnGame.js';
import {
  applyGomokuMove,
  bestGomokuMove,
  BOARD_SIZE,
  createGomokuState,
  isGomokuDraw,
  legalGomokuMoves,
  type GomokuState,
} from './gomoku.js';

const at = (x: number, y: number) => y * BOARD_SIZE + x;

/** A board with the given stones, no winner yet. */
function stateWith(stones: Array<[number, number, Seat]>, current: Seat): GomokuState {
  const cells: Array<Seat | null> = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null);
  for (const [x, y, seat] of stones) cells[at(x, y)] = seat;
  return { cells, current, winner: null, last: null };
}

describe('gomoku rules', () => {
  it('starts empty with seat 0 to play', () => {
    const state = createGomokuState();
    expect(legalGomokuMoves(state)).toHaveLength(BOARD_SIZE * BOARD_SIZE);
    expect(state.current).toBe(0);
  });

  it('wins on five in a horizontal row', () => {
    const state = stateWith(
      [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
        [3, 0, 0],
      ],
      0
    );
    const next = applyGomokuMove(state, { index: at(4, 0) });
    expect(next.winner).toBe(0);
    expect(legalGomokuMoves(next)).toEqual([]);
  });

  it('wins on five along a diagonal', () => {
    const state = stateWith(
      [
        [0, 0, 1],
        [1, 1, 1],
        [2, 2, 1],
        [3, 3, 1],
      ],
      1
    );
    expect(applyGomokuMove(state, { index: at(4, 4) }).winner).toBe(1);
  });

  it('does not win on only four in a row', () => {
    const state = stateWith(
      [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
      ],
      0
    );
    expect(applyGomokuMove(state, { index: at(3, 0) }).winner).toBeNull();
  });

  it('reports a full board with no line as a draw', () => {
    const full: GomokuState = {
      cells: Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => 0 as Seat),
      current: 0,
      winner: null,
      last: null,
    };
    expect(isGomokuDraw(full)).toBe(true);
    expect(isGomokuDraw(createGomokuState())).toBe(false);
  });
});

describe('gomoku heuristic bot', () => {
  it('opens on the centre of an empty board', () => {
    expect(bestGomokuMove(createGomokuState())?.index).toBe(at(7, 7));
  });

  it('completes its own open four', () => {
    const state = stateWith(
      [
        [3, 7, 0],
        [4, 7, 0],
        [5, 7, 0],
        [6, 7, 0],
      ],
      0
    );
    const move = bestGomokuMove(state)!.index;
    expect([at(2, 7), at(7, 7)]).toContain(move); // either end makes five
  });

  it('blocks the open end of an opponent four', () => {
    // Opponent (seat 1) has four with the left end already blocked by seat 0.
    const state = stateWith(
      [
        [4, 7, 0],
        [5, 7, 1],
        [6, 7, 1],
        [7, 7, 1],
        [8, 7, 1],
      ],
      0
    );
    expect(bestGomokuMove(state)?.index).toBe(at(9, 7));
  });
});
