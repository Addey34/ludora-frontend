/**
 * Daily challenge core — pure, dependency-free, unit-tested.
 *
 * A "daily challenge" gives every player the SAME puzzle each day and rewards a
 * consecutive-day streak (the Wordle retention loop). Everyone gets the same
 * puzzle because it is generated from a **date-derived seed** fed through a
 * deterministic PRNG — no server round-trip, no shared state. The streak is
 * plain data persisted per game (via Nakama storage, like level progress).
 *
 * The day boundary is **UTC**, so the puzzle rolls over at the same instant
 * worldwide and two players never disagree about "today's" puzzle.
 */

/** Today's day key, `YYYY-MM-DD` in UTC. Stable for the whole UTC day. */
export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** The day key immediately after the given one (UTC), for streak-continuity checks. */
export function nextDay(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return dayKey(d);
}

/**
 * A stable 32-bit seed for a given day key: the same date always yields the same
 * seed, so `dailySeed('2026-07-11')` picks one deterministic puzzle for that day.
 */
export function dailySeed(key: string): number {
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Mulberry32 PRNG: a small, fast, well-distributed generator. Returns a function
 * yielding floats in [0, 1). Deterministic for a given seed — the engine behind
 * a reproducible daily puzzle. Use it wherever a game would call `Math.random()`.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A player's daily-streak record for one game. */
export interface DailyProgress {
  /** Day key of the last solved daily, or '' if none. */
  lastSolved: string;
  /** Current consecutive-day streak. */
  streak: number;
  /** Best streak ever reached. */
  best: number;
}

/** A fresh, empty progress record. */
export function emptyProgress(): DailyProgress {
  return { lastSolved: '', streak: 0, best: 0 };
}

/** Whether today's daily has already been solved (idempotent guard). */
export function isSolvedToday(progress: DailyProgress, today: string): boolean {
  return progress.lastSolved === today;
}

/**
 * Applies a solve of *today's* daily: extends the streak when today directly
 * follows the last solved day, resets to 1 after a gap, and is a no-op if today
 * was already solved. Pure — returns a new record. Updates the best streak.
 */
export function recordDailySolve(progress: DailyProgress, today: string): DailyProgress {
  if (progress.lastSolved === today) return progress; // already counted
  const continued = progress.lastSolved !== '' && nextDay(progress.lastSolved) === today;
  const streak = continued ? progress.streak + 1 : 1;
  return { lastSolved: today, streak, best: Math.max(progress.best, streak) };
}

/**
 * The streak as it stands *today*: a streak whose last solve is neither today nor
 * yesterday has lapsed and reads as 0 (so the UI shows a broken streak before the
 * player has solved again). Does not mutate — display helper.
 */
export function currentStreak(progress: DailyProgress, today: string): number {
  if (progress.lastSolved === today) return progress.streak;
  if (progress.lastSolved !== '' && nextDay(progress.lastSolved) === today) return progress.streak;
  return 0;
}
