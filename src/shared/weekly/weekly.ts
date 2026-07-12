/**
 * Weekly spotlight core — pure, dependency-free, unit-tested.
 *
 * On top of the *daily* challenge (same puzzle every day, see
 * `src/shared/daily/`), the weekly spotlight rotates a single **featured game**
 * that earns bonus GamesZone Points all week. Like the daily, the pick is
 * deterministic from a date-derived seed — everyone sees the same spotlight the
 * same week, with no server round-trip or shared state.
 *
 * The week boundary is **UTC ISO-8601** (weeks start Monday), so the spotlight
 * rolls over at the same instant worldwide.
 */

/**
 * Today's ISO-8601 week key, `YYYY-Www` in UTC (e.g. `2026-W29`). The year is the
 * ISO week-year (the year owning that week's Thursday), so the last days of
 * December can belong to week 1 of the next year and vice-versa.
 */
export function weekKey(date: Date = new Date()): string {
  // Work on a UTC-midnight copy so time-of-day never shifts the week.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Move to the Thursday of this week: it alone decides the ISO week-year.
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const isoYear = d.getUTCFullYear();
  // January 4th is always in ISO week 1; find that week's Monday.
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4DayNum);
  const week = 1 + Math.round((d.getTime() - week1Monday.getTime()) / (7 * 86_400_000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/**
 * A stable 32-bit seed for a week key (FNV-1a) — the same week always yields the
 * same seed, so the featured game is fixed for the whole week.
 */
export function weeklySeed(key: string): number {
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The featured game for a given week: a deterministic pick from `pool`. Returns
 * `null` for an empty pool. The order of `pool` is part of the rotation, so keep
 * it stable (it is driven by the `SCORE_GAMES` registry).
 */
export function featuredGame(pool: readonly string[], key: string = weekKey()): string | null {
  if (pool.length === 0) return null;
  return pool[weeklySeed(key) % pool.length];
}

/** GamesZone Points multiplier awarded to a run of the week's featured game. */
export const WEEKLY_MULTIPLIER = 2;

/**
 * The GZP multiplier for a run of `game` this week: {@link WEEKLY_MULTIPLIER} when
 * it is the featured game, else 1. Applied to the incremental global submission
 * so the spotlight game literally "earns more" — the retention hook.
 */
export function gzpMultiplier(
  game: string,
  pool: readonly string[],
  key: string = weekKey()
): number {
  return featuredGame(pool, key) === game ? WEEKLY_MULTIPLIER : 1;
}
