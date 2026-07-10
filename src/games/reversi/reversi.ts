/**
 * Reversi / Othello — pure rules (no DOM, no time, no randomness), unit-tested in
 * isolation (`reversi.test.ts`). Plugs into the generic turn engine
 * (`shared/turn/turnGame.ts`) as a {@link TurnRules}; the controller
 * (`ReversiGame`) owns the rendering and the turn pacing.
 *
 * Two players (seat 0 = black, moves first; seat 1 = white) place discs on an 8×8
 * board. A legal move drops a disc on an empty square that **brackets** one or
 * more straight lines (any of the 8 directions) of enemy discs between the new
 * disc and another of your own; every bracketed disc then **flips** to your
 * colour. If the side to move has no legal move it **passes**; if neither side can
 * move the game is over and the majority of discs wins (equal = draw).
 *
 * Passing is folded into {@link applyMove}: after a move it hands the turn to the
 * opponent, or — if the opponent is stuck — back to the same seat, or ends the
 * game. So `legalMoves` is **never empty for a live game**, which lets the generic
 * turn loop drive Reversi without a pass concept. A draw is a finished game with
 * `winner === null`, surfaced through the {@link done} flag (the controller
 * overrides `isRoundOver` to read it).
 *
 * The board is a flat length-64 array, row-major (`index = row * 8 + col`).
 */

import { Seat, TurnRules, nextSeat } from '../../shared/turn/turnGame.js';

export const SIZE = 8;
export const SEATS = 2;

export type Cell = Seat | null;

/** A move: place a disc on the empty square `index`. */
export interface ReversiMove {
  index: number;
}

export const eqMove = (a: ReversiMove, b: ReversiMove): boolean => a.index === b.index;

/** Board state: the 64 cells, whose turn it is, and the finished/winner outcome. */
export interface ReversiState {
  board: Cell[];
  current: Seat;
  /** True once neither side can move — the round is over (win **or** draw). */
  done: boolean;
  /** The winning seat; `null` while running **and** for a finished draw. */
  winner: Seat | null;
}

const DIRECTIONS: readonly [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const idx = (r: number, c: number): number => r * SIZE + c;
const onBoard = (r: number, c: number): boolean => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

/** A fresh game: the four central discs, black (seat 0) to move. */
export function initialState(): ReversiState {
  const board: Cell[] = Array.from({ length: SIZE * SIZE }, () => null);
  board[idx(3, 3)] = 1;
  board[idx(4, 4)] = 1;
  board[idx(3, 4)] = 0;
  board[idx(4, 3)] = 0;
  return { board, current: 0, done: false, winner: null };
}

function currentSeat(state: ReversiState): Seat {
  return state.current;
}

/** The discs `seat` would flip by playing `index`, or `[]` if the move is illegal. */
export function flips(board: Cell[], index: number, seat: Seat): number[] {
  if (board[index] !== null) return [];
  const r = Math.floor(index / SIZE);
  const c = index % SIZE;
  const flipped: number[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const line: number[] = [];
    let rr = r + dr;
    let cc = c + dc;
    while (onBoard(rr, cc) && board[idx(rr, cc)] !== null && board[idx(rr, cc)] !== seat) {
      line.push(idx(rr, cc));
      rr += dr;
      cc += dc;
    }
    // A run of enemy discs closed by one of our own → the whole run flips.
    if (line.length > 0 && onBoard(rr, cc) && board[idx(rr, cc)] === seat) {
      flipped.push(...line);
    }
  }
  return flipped;
}

/** Every legal placement for `seat` on `board`. */
export function movesForSeat(board: Cell[], seat: Seat): ReversiMove[] {
  const moves: ReversiMove[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null && flips(board, i, seat).length > 0) moves.push({ index: i });
  }
  return moves;
}

/** The moves the current seat may play (empty only once the game is over). */
export function legalMoves(state: ReversiState): ReversiMove[] {
  if (state.done) return [];
  return movesForSeat(state.board, state.current);
}

/** Places the disc, flips the bracketed run, and advances the turn (with passing). */
export function applyMove(state: ReversiState, move: ReversiMove): ReversiState {
  const board = state.board.slice();
  const seat = state.current;
  const flipped = flips(board, move.index, seat);
  board[move.index] = seat;
  for (const f of flipped) board[f] = seat;

  const opp = nextSeat(seat, SEATS);
  if (movesForSeat(board, opp).length > 0) {
    return { board, current: opp, done: false, winner: null };
  }
  // Opponent is stuck: same seat plays again if it can, else the game is over.
  if (movesForSeat(board, seat).length > 0) {
    return { board, current: seat, done: false, winner: null };
  }
  const [b, w] = countDiscs(board);
  const winner = b > w ? 0 : w > b ? 1 : null;
  return { board, current: seat, done: true, winner };
}

export function winner(state: ReversiState): Seat | null {
  return state.done ? state.winner : null;
}

/** `[seat0Count, seat1Count]` — discs currently on the board. */
export function countDiscs(board: Cell[]): [number, number] {
  let b = 0;
  let w = 0;
  for (const cell of board) {
    if (cell === 0) b++;
    else if (cell === 1) w++;
  }
  return [b, w];
}

/** The full rule set wired for the generic turn engine. */
export const rules: TurnRules<ReversiState, ReversiMove> = {
  seats: SEATS,
  initialState,
  currentSeat,
  legalMoves,
  applyMove,
  winner,
};
