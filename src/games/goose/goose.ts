/**
 * Game of the Goose — pure rules, no DOM, no randomness.
 * Classic French edition: 63 squares, 4 seats, 2d6 roll each turn.
 *
 * Special squares:
 *  Goose  (5,9,14,18,23,27,32,36,41,45,50,54,59) — chain: move the same roll again
 *  Bridge (6  → 12)  — jump to square 12
 *  Inn        (19)   — skip 1 turn
 *  Well       (31)   — skip 3 turns
 *  Labyrinth  (42 → 39) — go back to 39
 *  Prison     (52)   — skip 3 turns
 *  Death      (58 → 1) — back to start
 *  Finish     (63)   — exact landing wins; overshoot bounces back
 *
 * Bump rule: landing on an occupied square sends the occupant back to where the
 * arriving player came from. Effects apply only at the arriving player's final square.
 */

import { type TurnRules } from '../../shared/turn/turnGame.js';

export const SQUARES = 63;
export const SEATS = 4;
export const COLS = 7;
export const ROWS = 9;

export const OFF_BOARD = 0;
export const PASS = 0;
export const FINISH = 63;

export const GOOSE_SQUARES = new Set([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);
export const BRIDGE_FROM = 6;
export const BRIDGE_TO = 12;
export const INN = 19;
export const WELL = 31;
export const LABYRINTH_FROM = 42;
export const LABYRINTH_TO = 39;
export const PRISON = 52;
export const DEATH = 58;
export const INN_SKIP = 1;
export const WELL_SKIP = 3;
export const PRISON_SKIP = 3;

export interface GooseState {
  /** Square each seat occupies (0 = off-board, not yet entered). */
  positions: [number, number, number, number];
  current: number;
  winner: number | null;
  skipTurns: [number, number, number, number];
}

/** Dice total (2–12) for a normal move; 0 (PASS) to consume a penalty turn. */
export type GooseMove = number;

/** CSS Grid position of `sq` — row/col are 0-based; 1-based when set as style. */
export function squareToCell(sq: number): { row: number; col: number } {
  const idx = sq - 1;
  const rowFromBottom = Math.floor(idx / COLS);
  const posInRow = idx % COLS;
  const col = rowFromBottom % 2 === 0 ? posInRow : COLS - 1 - posInRow;
  return { row: ROWS - 1 - rowFromBottom, col };
}

function clone(s: GooseState): GooseState {
  return {
    positions: [s.positions[0], s.positions[1], s.positions[2], s.positions[3]],
    current: s.current,
    winner: s.winner,
    skipTurns: [s.skipTurns[0], s.skipTurns[1], s.skipTurns[2], s.skipTurns[3]],
  };
}

export function initialState(): GooseState {
  return {
    positions: [OFF_BOARD, OFF_BOARD, OFF_BOARD, OFF_BOARD],
    current: 0,
    winner: null,
    skipTurns: [0, 0, 0, 0],
  };
}

export function legalMoves(state: GooseState): GooseMove[] {
  if (state.winner !== null) return [];
  if (state.skipTurns[state.current] > 0) return [PASS];
  return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

export function applyMove(state: GooseState, move: GooseMove): GooseState {
  const s = clone(state);
  const seat = s.current;

  if (move === PASS) {
    s.skipTurns[seat] = Math.max(0, s.skipTurns[seat] - 1);
    s.current = (seat + 1) % SEATS;
    return s;
  }

  const oldPos = s.positions[seat];
  const firstMove = oldPos === OFF_BOARD;
  let pos = (firstMove ? 0 : oldPos) + move;

  if (!firstMove) {
    while (pos < FINISH && GOOSE_SQUARES.has(pos)) {
      pos += move;
      if (pos > FINISH) break;
    }
  }

  if (pos > FINISH) {
    s.positions[seat] = FINISH - (pos - FINISH);
    s.current = (seat + 1) % SEATS;
    return s;
  }

  if (pos === FINISH) {
    s.positions[seat] = FINISH;
    s.winner = seat;
    s.current = (seat + 1) % SEATS;
    return s;
  }

  if (pos === BRIDGE_FROM) {
    pos = BRIDGE_TO;
    if (!firstMove) {
      while (pos < FINISH && GOOSE_SQUARES.has(pos)) {
        pos += move;
        if (pos > FINISH) break;
      }
    }
    if (pos > FINISH) {
      s.positions[seat] = FINISH - (pos - FINISH);
      s.current = (seat + 1) % SEATS;
      return s;
    }
    if (pos === FINISH) {
      s.positions[seat] = FINISH;
      s.winner = seat;
      s.current = (seat + 1) % SEATS;
      return s;
    }
  }

  for (let other = 0; other < SEATS; other++) {
    if (other !== seat && s.positions[other] === pos) {
      s.positions[other] = oldPos;
      break;
    }
  }

  if (pos === INN) {
    s.skipTurns[seat] = INN_SKIP;
  } else if (pos === WELL) {
    s.skipTurns[seat] = WELL_SKIP;
  } else if (pos === LABYRINTH_FROM) {
    pos = LABYRINTH_TO;
  } else if (pos === PRISON) {
    s.skipTurns[seat] = PRISON_SKIP;
  } else if (pos === DEATH) {
    pos = 1;
  }

  s.positions[seat] = pos;
  s.current = (seat + 1) % SEATS;
  return s;
}

export function winner(state: GooseState): number | null {
  return state.winner;
}

export const eqMove = (a: GooseMove, b: GooseMove): boolean => a === b;

export const rules: TurnRules<GooseState, GooseMove> = {
  seats: SEATS,
  initialState,
  currentSeat: (s) => s.current,
  legalMoves,
  applyMove,
  winner,
};
