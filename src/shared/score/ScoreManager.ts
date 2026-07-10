/**
 * One entry of a game's leaderboard.
 */
export interface ScoreEntry {
  /** Name entered by the player. */
  username: string;
  /** Score achieved. */
  score: number;
  /** Date the score was achieved (default: now). */
  date?: Date;
  /** Game-specific data (e.g. typing speed for Typing). */
  additionalData?: Record<string, number>;
}

/**
 * Handles leaderboard persistence.
 *
 * Two modes:
 * - **Local** (`online=false`, default): scores stored in `localStorage`. Used
 *   for games without an online backend (Breakout, Pong, Ludo, …).
 * - **Online** (`online=true`): Nakama is the single source of truth; no data
 *   is written to `localStorage`. `saveScore` tracks a session high score in
 *   memory only; `getScores` always returns `[]` (the engine fetches the global
 *   leaderboard from Nakama separately).
 */
export class ScoreManager {
  private storageKey: string;
  private maxScores: number;
  private readonly online: boolean;
  /** Best score seen in the current page session (online mode only). */
  private sessionHighScore: number = 0;

  constructor(storageKey: string, maxScores: number = 10, online: boolean = false) {
    this.storageKey = storageKey;
    this.maxScores = maxScores;
    this.online = online;
  }

  /**
   * Points the manager at another localStorage board (a per-variant leaderboard,
   * e.g. one board per difficulty/language). The session high score is reset so
   * the online best doesn't leak across variants.
   */
  setStorageKey(storageKey: string): void {
    this.storageKey = storageKey;
    this.sessionHighScore = 0;
  }

  /** The active localStorage board key (base or per-variant). */
  getStorageKey(): string {
    return this.storageKey;
  }

  /**
   * Records a live score into the in-session high score — what the in-game HUD
   * "best" reads in online mode (Nakama holds the real historical best, shown on
   * the profile/leaderboard). Never persists, so it is safe to call on every
   * score change. Without this the online HUD "best" would stay stuck at 0,
   * since runs are recorded through the server RPC, not {@link saveScore}.
   */
  noteScore(score: number): void {
    this.sessionHighScore = Math.max(this.sessionHighScore, score);
  }

  saveScore(entry: ScoreEntry): void {
    if (this.online) {
      this.sessionHighScore = Math.max(this.sessionHighScore, entry.score);
      return;
    }
    const scores = this.getScores();
    scores.push({ ...entry, date: entry.date || new Date() });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem(this.storageKey, JSON.stringify(scores.slice(0, this.maxScores)));
  }

  /**
   * Reads the persisted leaderboard. Returns an empty array if no data is
   * stored, the content is unreadable, or the game is in online mode.
   */
  getScores(): ScoreEntry[] {
    if (this.online) return [];
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return [];
    try {
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((raw): ScoreEntry => {
        const entry = raw as ScoreEntry;
        return { ...entry, date: entry.date ? new Date(entry.date) : new Date() };
      });
    } catch {
      return [];
    }
  }

  /**
   * Returns the best recorded score. In online mode, returns the session high
   * score (resets to 0 on page reload; Nakama holds the real historical best).
   */
  getHighScore(): number {
    if (this.online) return this.sessionHighScore;
    const scores = this.getScores();
    return scores.length > 0 ? scores[0].score : 0;
  }

  clearScores(): void {
    if (this.online) return;
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Whether a score deserves a save prompt. In online mode, any positive score
   * qualifies (Nakama decides the actual ranking). Locally, true as long as the
   * board is not full or the score beats the last entry.
   */
  isHighScore(score: number): boolean {
    if (this.online) return score > 0;
    const scores = this.getScores();
    if (scores.length < this.maxScores) return true;
    return score > scores[scores.length - 1].score;
  }
}
