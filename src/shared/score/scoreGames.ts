/**
 * Central registry of games that keep a score leaderboard, used by the
 * cross-game profile ("My scores"). Each game's own `storageKey` (its base
 * localStorage board) lives in its constructor; this list mirrors them so the
 * profile — which never instantiates a game — can read every board in one place.
 *
 * A parity test (`scoreGames.test.ts`) asserts every `leaderboard: true` game in
 * `vite.config.ts` has an entry here, so the list can't silently drift.
 *
 * Per-variant boards (difficulty/language) are stored under `<storageKey>-<variant>`
 * (see `GameEngine.setLeaderboardVariant`), so a game's real best is the max across
 * its base board **and** every variant board — {@link readBestScore} handles that.
 */
export interface ScoreGame {
  /** Game key (folder / route / icon name). */
  key: string;
  /** Base localStorage key the game writes its leaderboard to. */
  storageKey: string;
}

export const SCORE_GAMES: ScoreGame[] = [
  { key: 'typing', storageKey: 'typing-scores' },
  { key: 'snake', storageKey: 'snake-high-scores' },
  { key: '2048', storageKey: '2048-high-scores' },
  { key: 'simon', storageKey: 'simon-scores' },
  { key: 'motus', storageKey: 'motus-scores' },
  { key: 'tetris', storageKey: 'tetris-high-scores' },
  { key: 'minesweeper', storageKey: 'minesweeper-scores' },
  { key: 'breakout', storageKey: 'breakout-high-scores' },
  { key: 'math', storageKey: 'math-scores' },
  { key: 'geoquiz', storageKey: 'geoquiz-scores' },
  { key: 'trivia', storageKey: 'trivia-scores' },
  { key: 'conjugation', storageKey: 'conjugation-scores' },
  { key: 'anagram', storageKey: 'anagram-scores' },
  { key: 'hangman', storageKey: 'hangman-scores' },
  { key: 'mastermind', storageKey: 'mastermind-scores' },
  { key: 'wordsearch', storageKey: 'wordsearch-scores' },
  { key: 'sudoku', storageKey: 'sudoku-scores' },
  { key: 'taquin', storageKey: 'taquin-scores' },
  { key: 'flappy', storageKey: 'flappy-scores' },
  { key: 'solitaire', storageKey: 'solitaire' },
  { key: 'blackjack', storageKey: 'blackjack' },
  { key: 'invaders', storageKey: 'invaders' },
  { key: 'bubbles', storageKey: 'bubbles' },
  { key: 'binairo', storageKey: 'binairo' },
  { key: 'kakuro', storageKey: 'kakuro' },
];

/** The subset of `Storage` this reader needs (so tests can pass a fake). */
export type ScoreStore = Pick<Storage, 'length' | 'key' | 'getItem'>;

/**
 * Best score a player has locally for a game: the max across its base board and
 * every `<storageKey>-<variant>` board. Returns `null` when the game has no
 * stored score yet. Pure (takes the store) → unit-tested.
 */
export function readBestScore(store: ScoreStore, storageKey: string): number | null {
  let best: number | null = null;
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (!k || (k !== storageKey && !k.startsWith(`${storageKey}-`))) continue;
    const raw = store.getItem(k);
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const entry of parsed) {
        const score = (entry as { score?: unknown }).score;
        if (typeof score === 'number') best = best === null ? score : Math.max(best, score);
      }
    } catch {
      // Ignore unreadable board.
    }
  }
  return best;
}
