/**
 * Nine Men's Morris bot — the turn-based opponent (solo play and filling an empty
 * online seat). Pure and deterministic given its rng, so it is unit-testable
 * (`millBot.test.ts`) like the rules.
 *
 * Same shape as the other board bots: with the difficulty's "smart" probability
 * ({@link rollChase}) it plays the heuristic {@link bestMillMove} (which forms and
 * blocks mills and captures the most dangerous piece); otherwise it plays a random
 * legal move. `easy` = random, `hard` = always the heuristic.
 */

import { Difficulty, rollChase } from '../../shared/bot/difficulty.js';
import { bestMillMove, type MillMove, type MillState } from './mill.js';

/** Chooses a move for the seat to play. `rng` is injectable for tests. */
export function decideMove(
  state: MillState,
  moves: MillMove[],
  difficulty: Difficulty,
  rng: () => number = Math.random
): MillMove {
  if (moves.length <= 1) return moves[0];
  if (!rollChase(difficulty, rng)) return moves[Math.floor(rng() * moves.length)];
  return bestMillMove(state) ?? moves[0];
}
