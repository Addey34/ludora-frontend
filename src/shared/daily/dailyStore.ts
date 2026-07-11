/**
 * Persistence for the daily-challenge streak, per game. Uses Nakama storage
 * (like level progress) so a streak follows the account across devices; a signed
 * -out player still gets a device-scoped record. Best-effort: on a backend error
 * the streak simply reads as empty rather than breaking the game.
 */
import { readStorage, writeStorage } from '../net/nakama.js';
import {
  type DailyProgress,
  emptyProgress,
  recordDailySolve,
  currentStreak,
  isSolvedToday,
  dayKey,
} from './daily.js';

const storageKey = (game: string): string => `daily-${game}`;

/** Loads this player's daily-streak record for a game (empty if none/offline). */
export async function loadDailyProgress(game: string): Promise<DailyProgress> {
  try {
    return (await readStorage<DailyProgress>(storageKey(game))) ?? emptyProgress();
  } catch {
    return emptyProgress();
  }
}

/**
 * Records a solve of today's daily and persists the updated streak. Idempotent
 * for the day (a replay doesn't inflate the streak). Returns the new record;
 * best-effort persistence (a write failure still returns the computed record).
 */
export async function recordDailyWin(game: string): Promise<DailyProgress> {
  const today = dayKey();
  const prev = await loadDailyProgress(game);
  if (isSolvedToday(prev, today)) return prev;
  const next = recordDailySolve(prev, today);
  try {
    await writeStorage(storageKey(game), next);
  } catch {
    // best-effort: keep the in-memory record even if the write failed
  }
  return next;
}

/** The live streak as of today (0 if it has lapsed). */
export function streakToday(progress: DailyProgress): number {
  return currentStreak(progress, dayKey());
}
