/**
 * Tic-Tac-Toe bot — the turn-based opponent (solo play and filling an empty
 * online seat). Pure and deterministic given its rng, so it is unit-testable
 * (`tictactoeBot.test.ts`) like the rules.
 *
 * Same shape as the other board bots: with the difficulty's "smart" probability
 * ({@link rollChase}) it plays the perfect {@link bestTictactoeMove} minimax
 * (which never loses); otherwise it plays a random legal move. `hard` is the
 * unbeatable engine, `easy` is fully random, `medium` slips up now and then.
 */

import { Difficulty, rollChase } from '../../shared/bot/difficulty.js';
import { bestTictactoeMove, type TictactoeMove, type TictactoeState } from './tictactoe.js';

/** Chooses a move for the seat to play. `rng` is injectable for tests. */
export function decideMove(
  state: TictactoeState,
  moves: TictactoeMove[],
  difficulty: Difficulty,
  rng: () => number = Math.random
): TictactoeMove {
  if (moves.length <= 1) return moves[0];
  if (!rollChase(difficulty, rng)) return moves[Math.floor(rng() * moves.length)];
  return bestTictactoeMove(state) ?? moves[0];
}
