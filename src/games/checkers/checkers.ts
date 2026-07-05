/**
 * Checkers / Draughts (8×8 English/American variant) — pure rules (no DOM, no
 * time, no randomness), unit-tested in isolation (`checkers.test.ts`). Plugs into
 * the generic turn engine (`shared/turn/turnGame.ts`) as a {@link TurnRules}; the
 * controller (`CheckersGame`) owns the rendering and the turn pacing.
 *
 * Two players own 12 men each on the dark squares of an 8×8 board. Men step one
 * square **diagonally forward** to an empty square; kings step one square in any
 * diagonal direction. A **capture** jumps an adjacent enemy piece to the empty
 * square beyond, and **capturing is mandatory** — when any capture exists only
 * captures are legal. After a capturing hop the same piece keeps jumping if it
 * can (a multi-jump), modelled as the *same seat playing again* via {@link chain},
 * exactly like Ludo's "roll a 6 → play again". A man that reaches the far row is
 * **crowned** (its turn then ends). A player with no piece left — or no legal move
 * on their turn — loses.
 *
 * The board is a flat length-64 array, row-major (`index = row * 8 + col`), rows
 * top→bottom. Seat 0 starts at the bottom (rows 5–7) and moves **up** (row −1);
 * seat 1 starts at the top (rows 0–2) and moves **down** (row +1).
 */

import { Seat, TurnRules, nextSeat } from '../../shared/turn/turnGame.js';

export const SIZE = 8;
export const SEATS = 2;

/** A single piece: which seat owns it and whether it has been crowned. */
export interface Piece {
  seat: Seat;
  king: boolean;
}
export type Cell = Piece | null;

/** A move: slide/jump the piece on square `from` to the empty square `to`. */
export interface CheckersMove {
  from: number;
  to: number;
}

export const eqMove = (a: CheckersMove, b: CheckersMove): boolean =>
  a.from === b.from && a.to === b.to;

/** Board state: the 64 cells, whose turn it is, the mid-multi-jump piece, winner. */
export interface CheckersState {
  board: Cell[];
  current: Seat;
  /** Index of the piece that must keep capturing (mid multi-jump), or null. */
  chain: number | null;
  winner: Seat | null;
}

const idx = (r: number, c: number): number => r * SIZE + c;
const rowOf = (i: number): number => Math.floor(i / SIZE);
const colOf = (i: number): number => i % SIZE;
const onBoard = (r: number, c: number): boolean => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
/** The playable (dark) squares hold pieces; light squares stay empty. */
export const isDark = (r: number, c: number): boolean => (r + c) % 2 === 1;

/** A fresh game: 12 men each on the dark squares, seat 0 (bottom) to play. */
export function initialState(): CheckersState {
  const board: Cell[] = Array.from({ length: SIZE * SIZE }, () => null);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isDark(r, c)) continue;
      if (r <= 2) board[idx(r, c)] = { seat: 1, king: false };
      else if (r >= 5) board[idx(r, c)] = { seat: 0, king: false };
    }
  }
  return { board, current: 0, chain: null, winner: null };
}

export function currentSeat(state: CheckersState): Seat {
  return state.current;
}

/** Diagonal steps a piece may take: kings all four, men forward only. */
function directions(piece: Piece): readonly [number, number][] {
  if (piece.king) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }
  const dr = piece.seat === 0 ? -1 : 1; // seat 0 moves up, seat 1 down
  return [
    [dr, -1],
    [dr, 1],
  ];
}

/** Capturing hops available from square `i` for the piece standing on it. */
function capturesFrom(board: Cell[], i: number): CheckersMove[] {
  const piece = board[i];
  if (!piece) return [];
  const r = rowOf(i);
  const c = colOf(i);
  const moves: CheckersMove[] = [];
  for (const [dr, dc] of directions(piece)) {
    const mr = r + dr;
    const mc = c + dc; // the jumped (victim) square
    const lr = r + 2 * dr;
    const lc = c + 2 * dc; // the landing square
    if (!onBoard(lr, lc)) continue;
    const victim = board[idx(mr, mc)];
    if (victim && victim.seat !== piece.seat && board[idx(lr, lc)] === null) {
      moves.push({ from: i, to: idx(lr, lc) });
    }
  }
  return moves;
}

/** Simple (non-capturing) steps from square `i`. */
function stepsFrom(board: Cell[], i: number): CheckersMove[] {
  const piece = board[i];
  if (!piece) return [];
  const r = rowOf(i);
  const c = colOf(i);
  const moves: CheckersMove[] = [];
  for (const [dr, dc] of directions(piece)) {
    const tr = r + dr;
    const tc = c + dc;
    if (onBoard(tr, tc) && board[idx(tr, tc)] === null) moves.push({ from: i, to: idx(tr, tc) });
  }
  return moves;
}

/** The moves the current seat may legally play (captures are mandatory). */
export function legalMoves(state: CheckersState): CheckersMove[] {
  if (state.winner !== null) return [];
  // Mid multi-jump: only the chaining piece moves, and only by capturing.
  if (state.chain !== null) return capturesFrom(state.board, state.chain);

  const seat = state.current;
  const captures: CheckersMove[] = [];
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i]?.seat === seat) captures.push(...capturesFrom(state.board, i));
  }
  if (captures.length > 0) return captures; // capture is forced

  const steps: CheckersMove[] = [];
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i]?.seat === seat) steps.push(...stepsFrom(state.board, i));
  }
  return steps;
}

/** Plays `move` (assumed legal); never mutates `state`. */
export function applyMove(state: CheckersState, move: CheckersMove): CheckersState {
  const board = state.board.slice();
  const piece = board[move.from];
  if (!piece) return state;
  board[move.from] = null;

  const fromR = rowOf(move.from);
  const toR = rowOf(move.to);
  const isCapture = Math.abs(toR - fromR) === 2;
  if (isCapture) {
    const midR = (fromR + toR) / 2;
    const midC = (colOf(move.from) + colOf(move.to)) / 2;
    board[idx(midR, midC)] = null;
  }

  // Promotion: a man reaching the far row is crowned — and its turn ends.
  const lastRow = piece.seat === 0 ? 0 : SIZE - 1;
  const promoted = !piece.king && toR === lastRow;
  board[move.to] = { seat: piece.seat, king: piece.king || promoted };

  // Multi-jump: the same piece keeps capturing (unless it just got crowned).
  if (isCapture && !promoted && capturesFrom(board, move.to).length > 0) {
    return { board, current: piece.seat, chain: move.to, winner: null };
  }
  const next = nextSeat(piece.seat, SEATS);
  return { board, current: next, chain: null, winner: computeWinner(board, next) };
}

/** With `next` to move, the winner (a side with no piece or no move loses), else null. */
function computeWinner(board: Cell[], next: Seat): Seat | null {
  const [p0, p1] = countPieces(board);
  if (p0 === 0) return 1;
  if (p1 === 0) return 0;
  const probe: CheckersState = { board, current: next, chain: null, winner: null };
  if (legalMoves(probe).length === 0) return nextSeat(next, SEATS);
  return null;
}

export function winner(state: CheckersState): Seat | null {
  return state.winner;
}

/** `[seat0Count, seat1Count]` — pieces remaining on the board. */
export function countPieces(board: Cell[]): [number, number] {
  let p0 = 0;
  let p1 = 0;
  for (const cell of board) {
    if (cell?.seat === 0) p0++;
    else if (cell?.seat === 1) p1++;
  }
  return [p0, p1];
}

/** The full rule set wired for the generic turn engine. */
export const rules: TurnRules<CheckersState, CheckersMove> = {
  seats: SEATS,
  initialState,
  currentSeat,
  legalMoves,
  applyMove,
  winner,
};
