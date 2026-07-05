/**
 * Reversi bot — the turn-based opponent (solo play and filling an empty online
 * seat). Pure and deterministic given its rng, so it is unit-testable
 * (`reversiBot.test.ts`) like the rules.
 *
 * Same shape as the other board bots: with the difficulty's "smart" probability
 * ({@link rollChase}) it runs a **minimax / alpha-beta** search (deeper =
 * stronger); otherwise it plays a random legal move. Reversi is highly
 * positional, so the leaf {@link evaluate} is a **weight matrix** (corners are
 * gold, the squares next to them are traps) plus a small mobility term — a much
 * better guide than raw disc count in the mid-game.
 */

import { Difficulty, rollChase } from '../../shared/bot/difficulty.js';
import { Seat, nextSeat } from '../../shared/turn/turnGame.js';
import {
  ReversiState,
  ReversiMove,
  SEATS,
  applyMove,
  legalMoves,
  movesForSeat,
  countDiscs,
} from './reversi.js';

/** Search depth per tier. */
const DEPTH: Record<Difficulty, number> = { easy: 1, medium: 3, hard: 5 };
const WIN = 1_000_000;

/** Classic 8×8 positional weights: corners high, adjacent X/C squares negative. */
const WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120, -20, -40, -5, -5, -5, -5, -40, -20, 20, -5, 15, 3, 3, 15, -5,
  20, 5, -5, 3, 3, 3, 3, -5, 5, 5, -5, 3, 3, 3, 3, -5, 5, 20, -5, 15, 3, 3, 15, -5, 20, -20, -40,
  -5, -5, -5, -5, -40, -20, 120, -20, 20, 5, 5, 20, -20, 120,
];

/** Chooses a move for the seat to play. `rng` is injectable for tests. */
export function decideMove(
  state: ReversiState,
  moves: ReversiMove[],
  difficulty: Difficulty,
  rng: () => number = Math.random
): ReversiMove {
  if (moves.length === 0) return { index: 0 };
  if (moves.length === 1) return moves[0];
  if (!rollChase(difficulty, rng)) return moves[Math.floor(rng() * moves.length)];
  return bestMove(state, moves, DEPTH[difficulty]);
}

/** The move the search prefers for `state.current`. */
function bestMove(state: ReversiState, moves: ReversiMove[], depth: number): ReversiMove {
  const me = state.current;
  let best = -Infinity;
  let chosen = moves[0];
  let alpha = -Infinity;
  for (const move of moves) {
    const score = minimax(applyMove(state, move), depth - 1, alpha, Infinity, me);
    if (score > best) {
      best = score;
      chosen = move;
    }
    alpha = Math.max(alpha, score);
  }
  return chosen;
}

/** Alpha-beta from `me`'s point of view (higher = better for me). */
function minimax(
  state: ReversiState,
  depth: number,
  alpha: number,
  beta: number,
  me: Seat
): number {
  if (state.done) {
    if (state.winner === null) return 0; // draw
    return state.winner === me ? WIN : -WIN;
  }
  if (depth === 0) return evaluate(state, me);
  const moves = legalMoves(state);

  const maximizing = state.current === me;
  let value = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    const child = minimax(applyMove(state, move), depth - 1, alpha, beta, me);
    if (maximizing) {
      value = Math.max(value, child);
      alpha = Math.max(alpha, value);
    } else {
      value = Math.min(value, child);
      beta = Math.min(beta, value);
    }
    if (alpha >= beta) break;
  }
  return value;
}

/** Positional value of a non-terminal board for `me`, plus a mobility bonus. */
function evaluate(state: ReversiState, me: Seat): number {
  const opp = nextSeat(me, SEATS);
  let score = 0;
  for (let i = 0; i < state.board.length; i++) {
    const cell = state.board[i];
    if (cell === me) score += WEIGHTS[i];
    else if (cell === opp) score -= WEIGHTS[i];
  }
  // A small edge for having more replies than the opponent.
  const myMoves = movesForSeat(state.board, me).length;
  const oppMoves = movesForSeat(state.board, opp).length;
  score += 4 * (myMoves - oppMoves);
  // Endgame: raw disc majority starts to matter.
  const [b, w] = countDiscs(state.board);
  if (b + w >= 54) score += 3 * (me === 0 ? b - w : w - b);
  return score;
}
