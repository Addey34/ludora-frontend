/**
 * Battleship bot — chooses where to fire based on the visible state of the
 * opponent's fleet (shots + sunk). Pure, rng injectable for tests.
 *
 * Three strategies calibrated by {@link Difficulty} via {@link rollChase}:
 * - easy   : random shot (rollChase → always false)
 * - medium : hunt/target — random while hunting, adjacent to unsunk "hit"s
 *            while targeting
 * - hard   : parity + hunt/target — while hunting, only fires at cells where
 *            (row + col) % 2 === 0, which guarantees hitting every ship of
 *            size ≥ 2 in a minimum number of shots
 */

import { Difficulty, rollChase } from '../../shared/bot/difficulty.js';
import { BattleshipMove, Fleet, GRID_SIZE, cellKey } from './battleship.js';

function unshotCells(shots: Fleet['shots']): BattleshipMove[] {
  const cells: BattleshipMove[] = [];
  for (let row = 0; row < GRID_SIZE; row++)
    for (let col = 0; col < GRID_SIZE; col++)
      if (!shots[cellKey(row, col)]) cells.push({ row, col });
  return cells;
}

function randomFrom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Hit cells whose ship isn't sunk yet (priority targets). */
function unsunkHits(shots: Fleet['shots']): BattleshipMove[] {
  return Object.entries(shots)
    .filter(([, v]) => v === 'hit')
    .map(([k]) => {
      const [r, c] = k.split(',').map(Number);
      return { row: r, col: c };
    });
}

function adjacentUnshot(hits: BattleshipMove[], shots: Fleet['shots']): BattleshipMove[] {
  const result: BattleshipMove[] = [];
  const seen = new Set<string>();
  for (const { row, col } of hits) {
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) continue;
      const k = cellKey(r, c);
      if (shots[k] || seen.has(k)) continue;
      seen.add(k);
      result.push({ row: r, col: c });
    }
  }
  return result;
}

/**
 * Chooses the next cell to fire at.
 * `fleet` is the opponent's fleet as seen by the shooter (ships may be
 * empty/sanitized; only `shots` is used to decide).
 */
export function decideShot(
  fleet: Fleet,
  difficulty: Difficulty,
  rng: () => number = Math.random
): BattleshipMove {
  const unshot = unshotCells(fleet.shots);
  if (unshot.length === 0) return { row: 0, col: 0 };

  if (!rollChase(difficulty, rng)) return randomFrom(unshot, rng);

  const hits = unsunkHits(fleet.shots);
  if (hits.length > 0) {
    const adj = adjacentUnshot(hits, fleet.shots);
    if (adj.length > 0) return randomFrom(adj, rng);
  }

  if (difficulty === 'hard') {
    const parity = unshot.filter((c) => (c.row + c.col) % 2 === 0);
    if (parity.length > 0) return randomFrom(parity, rng);
  }

  return randomFrom(unshot, rng);
}
