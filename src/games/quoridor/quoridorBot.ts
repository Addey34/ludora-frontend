import { rollChase, type Difficulty } from '../../shared/bot/difficulty.js';
import { nextSeat } from '../../shared/turn/turnGame.js';
import {
  applyQuoridorMove,
  SEATS,
  shortestPathLength,
  type QuoridorMove,
  type QuoridorState,
} from './quoridor.js';

const WIN_SCORE = 10_000;
const DISTANCE_WEIGHT = 10;
const PROGRESS_WEIGHT = 8;
const BLOCK_WEIGHT = 14;
const SELF_BLOCK_WEIGHT = 8;

export function decideMove(
  state: QuoridorState,
  legalMoves: QuoridorMove[],
  difficulty: Difficulty,
  rng: () => number = Math.random
): QuoridorMove {
  if (legalMoves.length === 0) throw new Error('No legal Quoridor move available');
  if (!rollChase(difficulty, rng)) {
    return legalMoves[Math.floor(rng() * legalMoves.length)] ?? legalMoves[0];
  }

  const seat = state.current;
  const opponent = nextSeat(seat, SEATS);
  const ownBefore = shortestPathLength(state, seat);
  const opponentBefore = shortestPathLength(state, opponent);
  let best = legalMoves[0];
  let bestScore = -Infinity;

  for (const move of legalMoves) {
    const next = applyQuoridorMove(state, move);
    let score = next.winner === seat ? WIN_SCORE : 0;
    const ownAfter = shortestPathLength(next, seat);
    const opponentAfter = shortestPathLength(next, opponent);
    score += (opponentAfter - ownAfter) * DISTANCE_WEIGHT;
    score += (ownBefore - ownAfter) * PROGRESS_WEIGHT;
    if (move.type === 'wall') {
      score += (opponentAfter - opponentBefore) * BLOCK_WEIGHT;
      score -= (ownAfter - ownBefore) * SELF_BLOCK_WEIGHT;
    }
    if (score > bestScore) {
      best = move;
      bestScore = score;
    }
  }

  return best;
}
