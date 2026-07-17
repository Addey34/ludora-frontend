/**
 * Backgammon bot — the turn-based opponent (solo play and filling an empty online
 * seat). Pure and deterministic given its rng, so it is unit-testable
 * (`backgammonBot.test.ts`) like the rules.
 *
 * Same shape as the other board bots: with the difficulty's "smart" probability
 * ({@link rollChase}) it plays the greedy {@link bestBackgammonMove} (best
 * resulting position: lower pip, opponent hits, fewer blots); otherwise it plays a
 * random legal step. `easy` = random, `hard` = always the greedy pick.
 */

import { Difficulty, rollChase } from '../../shared/bot/difficulty.js';
import { bestBackgammonMove, type BackgammonMove, type BackgammonState } from './backgammon.js';

/** Chooses a die step for the seat to play. `rng` is injectable for tests. */
export function decideMove(
  state: BackgammonState,
  moves: BackgammonMove[],
  difficulty: Difficulty,
  rng: () => number = Math.random
): BackgammonMove {
  if (moves.length <= 1) return moves[0];
  if (!rollChase(difficulty, rng)) return moves[Math.floor(rng() * moves.length)];
  return bestBackgammonMove(state) ?? moves[0];
}
