import { readStorage, writeStorage } from '../net/nakama.js';

/**
 * Game-agnostic level / unlocking model.
 *
 * A game declares an ordered list of {@link LevelDef}s (each carrying its own
 * unlock rule), and the engine drives the rest: it loads the player's
 * {@link LevelProgress} from Nakama Storage (the single source of truth, shared
 * across devices), decides what is unlocked, and persists progress as the player
 * advances. The pure helpers below are unit-tested.
 */

/** How a level becomes available to play. */
export type UnlockRule =
  | { type: 'open' }
  | { type: 'sequential' }
  | { type: 'score'; threshold: number };

/** One level of a game. */
export interface LevelDef {
  /** 1-based number; also the stable id used in storage and the UI. */
  id: number;
  /** Short label shown in the panel (defaults to the id). */
  label?: string;
  /** How this level unlocks (default: sequential). */
  unlock?: UnlockRule;
}

/** A game's level set, declared by the game and passed to the engine. */
export interface LevelsConfig {
  /** Game key (e.g. 'pacman'); also used to key the stored progress. */
  gameKey: string;
  /** Levels in ascending order. */
  levels: LevelDef[];
}

/** A player's progress for one game. */
export interface LevelProgress {
  /** Highest level number cleared (0 = none yet). */
  cleared: number;
  /** Best score reached on this game (drives score-gated unlocks). */
  bestScore: number;
  /** Last level the player selected (restored on the next visit). */
  selected: number;
}

/** Fresh progress: nothing cleared, level 1 selected. */
export function defaultProgress(): LevelProgress {
  return { cleared: 0, bestScore: 0, selected: 1 };
}

/**
 * Whether a level is unlocked for the given progress. Pure.
 *
 * The first level is always reachable; `sequential` levels open once the
 * previous one is cleared, `score` levels once the best score reaches the
 * threshold, and `open` levels are always available.
 */
export function isLevelUnlocked(level: LevelDef, progress: LevelProgress): boolean {
  const rule = level.unlock ?? { type: 'sequential' };
  switch (rule.type) {
    case 'open':
      return true;
    case 'score':
      return progress.bestScore >= rule.threshold;
    case 'sequential':
      return level.id <= progress.cleared + 1;
  }
}

/** The highest currently-unlocked level number (at least 1). Pure. */
export function highestUnlocked(config: LevelsConfig, progress: LevelProgress): number {
  let max = 1;
  for (const level of config.levels) {
    if (isLevelUnlocked(level, progress)) max = Math.max(max, level.id);
  }
  return max;
}

/** Prefix of every per-game progress key in Nakama Storage. */
const PROGRESS_KEY_PREFIX = 'gz-levels-';

/** Nakama Storage key holding a game's progress. */
function progressKey(gameKey: string): string {
  return `${PROGRESS_KEY_PREFIX}${gameKey}`;
}

/**
 * Persists progress to the player's Nakama Storage (best-effort). The server is
 * the single source of truth for level progress — there is no local copy, so a
 * run made while the backend is unreachable is not saved (same policy as scores).
 */
export function saveProgress(gameKey: string, progress: LevelProgress): void {
  void writeStorage(progressKey(gameKey), progress);
}

/**
 * Loads progress from the player's Nakama Storage, completed with defaults for
 * any missing field. Returns fresh progress when nothing is stored yet or the
 * backend is unreachable.
 */
export async function loadProgress(gameKey: string): Promise<LevelProgress> {
  const remote = await readStorage<LevelProgress>(progressKey(gameKey));
  if (!remote) return defaultProgress();
  return { ...defaultProgress(), ...remote };
}
