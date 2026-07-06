/**
 * Mancala bot — picks a move for any difficulty tier.
 *
 * Easy   → random legal move.
 * Medium → heuristic: prioritise extra-turn moves, then captures, then
 *          the pit that moves the most seeds toward the store.
 * Hard   → minimax / alpha-beta (depth 7).  The search correctly handles
 *          the extra-turn rule because it keys off `state.current`.
 */

import { Difficulty } from '../../shared/bot/difficulty.js';
import { MancalaState, MancalaMove, applyMove, legalMoves, storeOf } from './mancala.js';

const WIN = 100_000;
const DEPTH: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 7 };

export function decideMove(
  state: MancalaState,
  moves: MancalaMove[],
  difficulty: Difficulty,
  rng: () => number = Math.random
): MancalaMove {
  if (moves.length === 1) return moves[0];
  if (difficulty === 'easy') return moves[Math.floor(rng() * moves.length)];
  if (difficulty === 'medium') return heuristic(state, moves);
  return minimaxRoot(state, moves, DEPTH.hard);
}

// ---------------------------------------------------------------------------
// Medium: single-ply heuristic scoring
// ---------------------------------------------------------------------------

function scoreSingleMove(state: MancalaState, move: MancalaMove): number {
  const seat = state.current;
  const store = storeOf(seat);
  const next = applyMove(state, move);
  let score = next.pits[store] - state.pits[store]; // seeds gained this turn
  if (next.current === seat) score += 5; // bonus for earning an extra turn
  return score;
}

function heuristic(state: MancalaState, moves: MancalaMove[]): MancalaMove {
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const s = scoreSingleMove(state, move);
    if (s > bestScore) {
      bestScore = s;
      best = move;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Hard: minimax with alpha-beta pruning
// ---------------------------------------------------------------------------

function evaluate(state: MancalaState, maxSeat: number): number {
  if (state.gameOver) {
    if (state.winner === maxSeat) return WIN;
    if (state.winner !== null) return -WIN;
    return 0; // draw
  }
  return state.pits[storeOf(maxSeat)] - state.pits[storeOf(maxSeat === 0 ? 1 : 0)];
}

function search(
  state: MancalaState,
  depth: number,
  alpha: number,
  beta: number,
  maxSeat: number
): number {
  if (state.gameOver || depth === 0) return evaluate(state, maxSeat);
  const moves = legalMoves(state);
  if (moves.length === 0) return evaluate(state, maxSeat);

  const maximising = state.current === maxSeat;
  let best = maximising ? -Infinity : Infinity;

  for (const move of moves) {
    const next = applyMove(state, move);
    const v = search(next, depth - 1, alpha, beta, maxSeat);
    if (maximising) {
      if (v > best) best = v;
      if (v > alpha) alpha = v;
    } else {
      if (v < best) best = v;
      if (v < beta) beta = v;
    }
    if (beta <= alpha) break;
  }
  return best;
}

function minimaxRoot(state: MancalaState, moves: MancalaMove[], depth: number): MancalaMove {
  const maxSeat = state.current;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = applyMove(state, move);
    const score = search(next, depth - 1, -Infinity, Infinity, maxSeat);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}
