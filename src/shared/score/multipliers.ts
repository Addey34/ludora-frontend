/**
 * GamesZone Points multipliers — the single tuning hub for "this run is worth
 * more". Two factors compose here, and they multiply together:
 *
 *   1. **Difficulty** — a harder variant earns more (easy ×1, medium ×1.5, hard ×2).
 *   2. **Spotlight** — GZP is earned **only** on a spotlit game (see
 *      `src/shared/spotlight/`): ×2 for the day's daily pick, ×1 for a weekly
 *      pick, and **×0 (no GZP at all)** for a game that is neither. This is the
 *      gate that funnels the season competition onto the rotating featured games.
 *
 * Everything tunable is a constant at the top so a balance change during an
 * update is a one-line edit here — no game code to touch. Pure and unit-tested.
 *
 * Only the cross-game GZP total is scaled; per-game leaderboards keep the raw
 * score (difficulty variants already have their own board via
 * `setLeaderboardVariant`), so scaling GZP is where "reward the harder run" fits.
 */

import { isSpotlit } from '../spotlight/spotlight.js';

type Tier = 'easy' | 'medium' | 'hard';

/* ─── Tuning knobs — edit these to rebalance rewards. ─────────────────────── */

/** GZP multiplier per difficulty tier. */
export const DIFFICULTY_MULT: Record<Tier, number> = { easy: 1, medium: 1.5, hard: 2 };

/**
 * GZP multiplier by spotlight status. `none` is 0 on purpose: a game that isn't
 * spotlit today or this week earns no GamesZone Points at all (the season gate).
 * The daily pick is worth more than the seven weekly picks.
 */
export const SPOTLIGHT_MULT = { daily: 2, weekly: 1, none: 0 } as const;

// To add a "game of the month": add a MONTHLY factor here (its own picker in
// src/shared/spotlight/) and multiply it into runMultiplier() below — the
// composition already handles stacking.

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

/**
 * The spotlight multiplier for `game`: ×{@link SPOTLIGHT_MULT.daily} for the
 * day's daily pick, ×{@link SPOTLIGHT_MULT.weekly} for a weekly pick, and
 * ×{@link SPOTLIGHT_MULT.none} (0 — earns no GZP) for a game that isn't spotlit.
 */
export function spotlightMultiplier(
  game: string,
  pool: readonly string[],
  date: Date = new Date()
): number {
  const { daily, weekly } = isSpotlit(pool, game, date);
  if (daily) return SPOTLIGHT_MULT.daily;
  if (weekly) return SPOTLIGHT_MULT.weekly;
  return SPOTLIGHT_MULT.none;
}

/**
 * The full GZP multiplier for a run: difficulty × spotlight. The one place the
 * factors are combined — add a monthly factor here when it ships. Note this is
 * 0 for a non-spotlit game, so a run earns GZP only on the featured games.
 */
export function runMultiplier(
  game: string,
  variant: string | null,
  pool: readonly string[],
  date: Date = new Date()
): number {
  return difficultyMultiplier(game, variant) * spotlightMultiplier(game, pool, date);
}
