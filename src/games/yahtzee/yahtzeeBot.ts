/**
 * Yahtzee bot: a simple, deterministic-ish opponent living with its game (like
 * the other board-game bots). Two decisions — which dice to keep between rolls,
 * and which category to score — kept pure so they're easy to reason about.
 */
import { Die, ScoreKey, scoreFor } from './yahtzee.js';
import { YState, YMove } from './yahtzeeRules.js';

/** Keeps the dice showing the most common face (ties → the higher value). */
export function chooseHolds(dice: Die[]): boolean[] {
  const counts = new Map<Die, number>();
  for (const d of dice) counts.set(d, (counts.get(d) ?? 0) + 1);
  let bestFace: Die = dice[0];
  let bestCount = 0;
  for (const [face, count] of counts) {
    if (count > bestCount || (count === bestCount && face > bestFace)) {
      bestFace = face;
      bestCount = count;
    }
  }
  return dice.map((d) => d === bestFace);
}

/** Order in which to dump a zero when no category scores. */
const SACRIFICE_ORDER: ScoreKey[] = [
  'ones',
  'twos',
  'yahtzee',
  'largeStraight',
  'smallStraight',
  'fourOfKind',
  'fullHouse',
  'threes',
  'threeOfKind',
  'fours',
  'fives',
  'sixes',
  'chance',
];

/** Picks the highest-scoring open category; if none scores, sacrifices one. */
export function decideCategory(state: YState, legalMoves: YMove[]): YMove {
  let best = legalMoves[0];
  let bestScore = -1;
  for (const m of legalMoves) {
    const s = scoreFor(m.category, state.dice);
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  if (bestScore > 0) return best;
  for (const k of SACRIFICE_ORDER) {
    const m = legalMoves.find((mv) => mv.category === k);
    if (m) return m;
  }
  return legalMoves[0];
}
