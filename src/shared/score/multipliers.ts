/**
 * GamesZone Points multipliers — the single tuning hub for "this run is worth
 * more". Two independent boosts compose here, and they multiply together:
 *
 *   1. **Difficulty** — a harder variant earns more (easy ×1, medium ×1.5, hard ×2).
 *   2. **Spotlight** — the featured game of the week earns a flat bonus (see
 *      `src/shared/weekly/`). A game of the *month* slots in the same way.
 *
 * Everything tunable is a constant at the top so a balance change during an
 * update is a one-line edit here — no game code to touch. Pure and unit-tested.
 *
 * Only the cross-game GZP total is scaled; per-game leaderboards keep the raw
 * score (difficulty variants already have their own board via
 * `setLeaderboardVariant`), so scaling GZP is where "reward the harder run" fits.
 */

import { featuredGame, weekKey } from '../weekly/weekly.js';

type Tier = 'easy' | 'medium' | 'hard';

/* ─── Tuning knobs — edit these to rebalance rewards. ─────────────────────── */

/** GZP multiplier per difficulty tier. */
export const DIFFICULTY_MULT: Record<Tier, number> = { easy: 1, medium: 1.5, hard: 2 };

/** GZP multiplier for the featured game of the week. */
export const WEEKLY_MULT = 2;

// To add a "game of the month": set MONTHLY_MULT, give it its own picker in
// src/shared/weekly/ (a monthKey/featuredGame), and multiply it into
// runMultiplier() below — the composition already handles stacking.
// export const MONTHLY_MULT = 3;

/**
 * Games whose leaderboard variant is **not** a literal `easy`/`medium`/`hard`
 * tier (size- or option-based), mapped to the tier they correspond to. This is
 * where a game's difficulty "direction" is declared — e.g. a *smaller* 2048 board
 * is *harder*. Games absent here (or variants absent from their map) get no
 * difficulty bonus (×1): language/bankroll variants aren't difficulty.
 */
const VARIANT_TIERS: Record<string, Record<string, Tier>> = {
  '2048': { '5': 'easy', '4': 'medium', '3': 'hard' }, // fewer tiles = harder
  binairo: { '6': 'easy', '8': 'hard' }, // bigger grid = harder
  solitaire: { '1': 'easy', '3': 'hard' }, // draw-three = harder
};

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The difficulty tier of a run, or `null` when the variant isn't a difficulty.
 * Recognises a literal tier anywhere as the last `-`-segment (so `easy`, and the
 * `lang-difficulty` variants like `fr-hard`, both resolve), else the per-game
 * {@link VARIANT_TIERS} table.
 */
export function tierFor(game: string, variant: string | null): Tier | null {
  if (!variant) return null;
  const m = /(?:^|-)(easy|medium|hard)$/.exec(variant);
  if (m) return m[1] as Tier;
  return VARIANT_TIERS[game]?.[variant] ?? null;
}

/** The difficulty multiplier for a run (×1 when the variant isn't a difficulty). */
export function difficultyMultiplier(game: string, variant: string | null): number {
  const tier = tierFor(game, variant);
  return tier ? DIFFICULTY_MULT[tier] : 1;
}

/** The weekly-spotlight multiplier for `game` (×{@link WEEKLY_MULT} when featured). */
export function weeklyMultiplier(
  game: string,
  pool: readonly string[],
  key: string = weekKey()
): number {
  return featuredGame(pool, key) === game ? WEEKLY_MULT : 1;
}

/**
 * The full GZP multiplier for a run: difficulty × spotlight(s). The one place the
 * boosts are combined — add a monthly factor here when it ships.
 */
export function runMultiplier(
  game: string,
  variant: string | null,
  pool: readonly string[],
  key: string = weekKey()
): number {
  return difficultyMultiplier(game, variant) * weeklyMultiplier(game, pool, key);
}
