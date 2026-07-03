/**
 * Jeu de l'oie bot — purely luck-based, no decision exists beyond rolling.
 * `decideMove` returns a random legal move (2–12) or PASS when forced.
 */

import { type GooseState, type GooseMove } from './goose.js';

export function decideMove(
  _state: GooseState,
  moves: GooseMove[],
  rng: () => number = Math.random
): GooseMove {
  return moves[Math.floor(rng() * moves.length)];
}
