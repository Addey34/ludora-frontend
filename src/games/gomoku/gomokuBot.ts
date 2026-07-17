/**
 * Gomoku bot — the turn-based opponent (solo play and filling an empty online
 * seat). Pure and deterministic given its rng, so it is unit-testable
 * (`gomokuBot.test.ts`) like the rules.
 *
 * Same shape as the other board bots: with the difficulty's "smart" probability
 * ({@link rollChase}) it plays the heuristic {@link bestGomokuMove} (which always
 * completes its own five and blocks an enemy four / open three); otherwise it
 * plays a random legal cell. `easy` = random, `hard` = always the heuristic.
 */

import { Difficulty, rollChase } from '../../shared/bot/difficulty.js';
import { bestGomokuMove, type GomokuMove, type GomokuState } from './gomoku.js';

/** Chooses a move for the seat to play. `rng` is injectable for tests. */
export function decideMove(
  state: GomokuState,
  moves: GomokuMove[],
  difficulty: Difficulty,
  rng: () => number = Math.random
): GomokuMove {
  if (moves.length <= 1) return moves[0];
  if (!rollChase(difficulty, rng)) return moves[Math.floor(rng() * moves.length)];
  return bestGomokuMove(state) ?? moves[0];
}
