import { nextSeat, type Seat, type TurnRules } from '../../shared/turn/turnGame.js';

export const BOARD_WIDTH = 3;
const SEAT_COUNT = 2;
/** Seat count, exported for the multiplayer panel capacity. */
export const SEATS = SEAT_COUNT;
const LINE_LENGTH = 3;
const CELL_COUNT = BOARD_WIDTH * BOARD_WIDTH;

export interface TictactoeMove {
  index: number;
}

export interface TictactoeState {
  cells: Array<Seat | null>;
  current: Seat;
  winner: Seat | null;
}

export function createTictactoeState(): TictactoeState {
  return {
    cells: Array.from({ length: CELL_COUNT }, () => null),
    current: 0,
    winner: null,
  };
}

export function legalTictactoeMoves(state: TictactoeState): TictactoeMove[] {
  if (state.winner !== null) return [];
  return state.cells.flatMap((cell, index) => (cell === null ? [{ index }] : []));
}

export function applyTictactoeMove(state: TictactoeState, move: TictactoeMove): TictactoeState {
  const cells = state.cells.slice();
  cells[move.index] = state.current;
  const winner = findTictactoeWinner(cells);
  return {
    cells,
    current: winner === null ? nextSeat(state.current, SEAT_COUNT) : state.current,
    winner,
  };
}

function findTictactoeWinner(cells: Array<Seat | null>): Seat | null {
  const lines: number[][] = [];
  for (let row = 0; row < BOARD_WIDTH; row++) {
    lines.push(Array.from({ length: LINE_LENGTH }, (_, column) => row * BOARD_WIDTH + column));
  }
  for (let column = 0; column < BOARD_WIDTH; column++) {
    lines.push(Array.from({ length: LINE_LENGTH }, (_, row) => row * BOARD_WIDTH + column));
  }
  lines.push(
    Array.from({ length: LINE_LENGTH }, (_, index) => index * (BOARD_WIDTH + 1)),
    Array.from({ length: LINE_LENGTH }, (_, index) => (index + 1) * (BOARD_WIDTH - 1))
  );

  for (const line of lines) {
    const seat = cells[line[0]];
    if (seat !== null && line.every((index) => cells[index] === seat)) return seat;
  }
  return null;
}

export function isTictactoeDraw(state: TictactoeState): boolean {
  return state.winner === null && state.cells.every((cell) => cell !== null);
}

function currentSeat(state: TictactoeState): Seat {
  return state.current;
}

function winner(state: TictactoeState): Seat | null {
  return state.winner;
}

/**
 * Optimal move for the seat on turn (perfect minimax). Tic-tac-toe's game tree is
 * tiny, so a full search is instant and the bot never loses. Depth-weighted so it
 * grabs the fastest win and stalls the slowest loss.
 */
export function bestTictactoeMove(state: TictactoeState): TictactoeMove | null {
  const moves = legalTictactoeMoves(state);
  if (moves.length === 0) return null;
  const me = state.current;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = scoreTictactoe(applyTictactoeMove(state, move), me, 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

function scoreTictactoe(
  state: TictactoeState,
  me: Seat,
  depth: number,
  alpha: number,
  beta: number
): number {
  if (state.winner !== null) return state.winner === me ? 10 - depth : depth - 10;
  if (isTictactoeDraw(state)) return 0;

  const maximizing = state.current === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of legalTictactoeMoves(state)) {
    const score = scoreTictactoe(applyTictactoeMove(state, move), me, depth + 1, alpha, beta);
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break; // this branch can't change the outcome
  }
  return best;
}

export const tictactoeRules: TurnRules<TictactoeState, TictactoeMove> = {
  seats: SEAT_COUNT,
  initialState: createTictactoeState,
  currentSeat,
  legalMoves: legalTictactoeMoves,
  applyMove: applyTictactoeMove,
  winner,
};
