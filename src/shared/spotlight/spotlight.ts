/**
 * Spotlight core — pure, deterministic, dependency-free, unit-tested.
 *
 * Each day one game is the **daily** pick and each week seven games are the
 * **weekly** set, chosen deterministically over the scoreable catalogue
 * (`SCORE_GAMES`). Everyone worldwide sees the same picks the same day/week with
 * no server round-trip. The picks are what earn Ludora Points (gated in
 * `src/shared/score/multipliers.ts` — LP is earned *only* on a spotlit game)
 * and what carry the home-tile / sidebar badges (`weeklyFeature.ts`).
 *
 * Rotation avoids repeats: the pool is shuffled once (a fixed seed) into a stable
 * permutation, then paged by a monotonic day/week index — so a game does not
 * recur until the whole catalogue has been cycled through. Daily and weekly use
 * distinct permutations, so a game can be both (or neither) without lockstep.
 */

import { mulberry32 } from '../daily/daily.js';

const MS_PER_DAY = 86_400_000;

// Distinct fixed seeds so the daily and weekly permutations aren't in lockstep.
const DAILY_PERM_SEED = 0x9e3779b1;
const WEEKLY_PERM_SEED = 0x85ebca6b;

/** Default size of the weekly set. */
export const WEEKLY_COUNT = 7;

/** Whole UTC days since the epoch — a monotonic day counter for daily rotation. */
export function dayIndex(date: Date = new Date()): number {
  return Math.floor(date.getTime() / MS_PER_DAY);
}

/** Whole 7-day blocks since the epoch — a monotonic week counter for weekly rotation. */
export function weekIndex(date: Date = new Date()): number {
  return Math.floor(dayIndex(date) / 7);
}

/** A deterministic Fisher–Yates shuffle of `pool` for `seed` (pure, stable). */
function permutation(pool: readonly string[], seed: number): string[] {
  const a = [...pool];
  const rng = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The single spotlighted game for the day, or `null` for an empty pool. */
export function dailyGame(pool: readonly string[], date: Date = new Date()): string | null {
  if (pool.length === 0) return null;
  const perm = permutation(pool, DAILY_PERM_SEED);
  return perm[dayIndex(date) % perm.length];
}

/**
 * The `count` spotlighted games for the week (default {@link WEEKLY_COUNT}),
 * distinct, taken as a window from a fixed permutation paged by week — so
 * consecutive weeks don't repeat until the pool is exhausted. Returns fewer than
 * `count` only when the pool is smaller.
 */
export function weeklyGames(
  pool: readonly string[],
  count: number = WEEKLY_COUNT,
  date: Date = new Date()
): string[] {
  const n = pool.length;
  if (n === 0) return [];
  const perm = permutation(pool, WEEKLY_PERM_SEED);
  const k = Math.min(count, n);
  const start = (weekIndex(date) * k) % n;
  const out: string[] = [];
  for (let i = 0; i < k; i++) out.push(perm[(start + i) % n]);
  return out;
}

/** Whether `game` is spotlit today (daily) and/or this week (weekly). */
export function isSpotlit(
  pool: readonly string[],
  game: string,
  date: Date = new Date()
): { daily: boolean; weekly: boolean } {
  return {
    daily: dailyGame(pool, date) === game,
    weekly: weeklyGames(pool, WEEKLY_COUNT, date).includes(game),
  };
}
