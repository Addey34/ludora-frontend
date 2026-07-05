/**
 * Checkers bot — the turn-based opponent (solo play and filling an empty online
 * seat). Pure and deterministic given its rng, so it is unit-testable
 * (`checkersBot.test.ts`) like the rules.
 *
 * Same shape as {@link ../connect4/connect4Bot}: with the difficulty's "smart"
 * probability ({@link rollChase}) it runs a **minimax / alpha-beta** search
 * (deeper = stronger), otherwise it plays a random legal move — so `easy` is
 * mostly random, `hard` searches every time, `medium` slips up. A multi-jump is a
 * chain of same-seat moves, which the search follows for free because it keys off
 * `state.current`. Forced single replies (the common case with mandatory capture)
 * short-circuit the search.
 */

import { Difficulty, rollChase } from '../../shared/bot/difficulty.js';
import { Seat, nextSeat } from '../../shared/turn/turnGame.js';
import { CheckersState, CheckersMove, SEATS, SIZE, applyMove, legalMoves } from './checkers.js';

/** Search depth per tier. */
const DEPTH: Record<Difficulty, number> = { easy: 2, medium: 4, hard: 6 };
const WIN = 1_000_000;

/** Chooses a move for the seat to play. `rng` is injectable for tests. */
export function decideMove(
  state: CheckersState,
  moves: CheckersMove[],
  difficulty: Difficulty,
  rng: () => number = Math.random
): CheckersMove {
  if (moves.length === 0) return { from: 0, to: 0 };
  if (moves.length === 1) return moves[0]; // forced reply (mandatory capture)
  if (!rollChase(difficulty, rng)) return moves[Math.floor(rng() * moves.length)];
  return bestMove(state, moves, DEPTH[difficulty]);
}

/** The move the search prefers for `state.current`. */
function bestMove(state: CheckersState, moves: CheckersMove[], depth: number): CheckersMove {
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
  state: CheckersState,
  depth: number,
  alpha: number,
  beta: number,
  me: Seat
): number {
  if (state.winner !== null) return state.winner === me ? WIN + depth : -WIN - depth;
  if (depth === 0) return evaluate(state, me);
  const moves = legalMoves(state);
  if (moves.length === 0) return state.current === me ? -WIN : WIN; // stuck side loses

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

/** Heuristic: material (kings worth more) plus advancement toward promotion. */
function evaluate(state: CheckersState, me: Seat): number {
  const opp = nextSeat(me, SEATS);
  let score = 0;
  for (let i = 0; i < state.board.length; i++) {
    const p = state.board[i];
    if (!p) continue;
    const row = Math.floor(i / SIZE);
    const value = p.king ? 50 : 30 + advancement(p.seat, row);
    if (p.seat === me) score += value;
    else if (p.seat === opp) score -= value;
  }
  return score;
}

/** How far a man has advanced toward its crowning row (0 = start … 7 = far row). */
function advancement(seat: Seat, row: number): number {
  return seat === 0 ? SIZE - 1 - row : row;
}
