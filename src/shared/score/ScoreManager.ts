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
 * Tracks the best score seen in the current page session — the value the in-game
 * HUD shows as "best". Scores are otherwise server-authoritative: runs are
 * recorded through Nakama (see {@link GameEngine.recordScore}) and the real
 * historical best is read back from the server for the profile / leaderboard.
 * This class holds no persistence and never touches localStorage.
 */
export class ScoreManager {
  /** Best score seen since the page loaded (resets on reload). */
  private sessionHighScore = 0;

  /**
   * Records a live score into the in-session high score. Safe to call on every
   * score change; without it the online "best" HUD would stay stuck at 0, since
   * runs are recorded through the server RPC rather than this class.
   */
  noteScore(score: number): void {
    this.sessionHighScore = Math.max(this.sessionHighScore, score);
  }

  /**
   * The best score seen this session. Resets to 0 on reload; Nakama holds the
   * real historical best (shown on the profile / leaderboard).
   */
  getHighScore(): number {
    return this.sessionHighScore;
  }
}
