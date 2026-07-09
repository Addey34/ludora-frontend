/**
 * Deferred score save for the "sign in to save" flow. When a guest finishes a
 * run and chooses to save, we can't record it yet (recording requires a Google
 * account). We stash the run here, trigger sign-in (which reloads the page), and
 * on the next load — now signed in — {@link flushPendingScore} records it under
 * the Google name: to its local board, its online leaderboard (if any) and the
 * global GamesZone Points total.
 */
import { ScoreManager, ScoreEntry } from './ScoreManager.js';
import { getCurrentUser, submitGlobalScore, submitLeaderboardScore } from '../net/nakama.js';

const PENDING_KEY = 'gz-pending-score';

export interface PendingScore {
  /** Active local board key (base or per-variant). */
  storageKey: string;
  maxScores: number;
  /** Online leaderboard id, when the game has one. */
  leaderboardId?: string;
  score: number;
  /** Game-specific extras (e.g. Typing's wpm/lpm). */
  extra?: Record<string, number>;
  /** GamesZone Points this run is worth. */
  gzp: number;
}

/** Stashes a run to record after the imminent sign-in. */
export function storePendingScore(pending: PendingScore): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // storage full / unavailable — nothing to do
  }
}

/**
 * Records a stashed run once the player is signed in. Best-effort and idempotent
 * (clears the stash when done). Returns true when a run was flushed, so the
 * caller can confirm to the player.
 */
export async function flushPendingScore(): Promise<boolean> {
  const raw = localStorage.getItem(PENDING_KEY);
  if (!raw) return false;

  let pending: PendingScore;
  try {
    pending = JSON.parse(raw) as PendingScore;
  } catch {
    localStorage.removeItem(PENDING_KEY);
    return false;
  }

  const user = await getCurrentUser();
  if (!user?.loggedIn) return false; // wait until the sign-in actually completed

  const entry: ScoreEntry = { username: user.displayName, score: pending.score, date: new Date() };
  if (pending.extra) entry.additionalData = pending.extra;

  try {
    new ScoreManager(pending.storageKey, pending.maxScores, false).saveScore(entry);
  } catch {
    // local save is best-effort
  }
  try {
    if (pending.leaderboardId) await submitLeaderboardScore(pending.leaderboardId, entry);
  } catch {
    // online save is best-effort
  }
  try {
    await submitGlobalScore(pending.gzp);
  } catch {
    // global save is best-effort
  }

  localStorage.removeItem(PENDING_KEY);
  return true;
}
