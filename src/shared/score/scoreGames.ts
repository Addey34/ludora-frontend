/**
 * Central registry of games that keep a score leaderboard, used by the
 * cross-game /leaderboard "Personal" tab to know which games to list. The bests
 * themselves are read from the server (`getMyBestScores`, keyed by game key) —
 * this list only enumerates the games.
 *
 * A parity test (`scoreGames.test.ts`) asserts every `leaderboard: true` game in
 * `vite.config.ts` has an entry here, so the list can't silently drift.
 */
interface ScoreGame {
  /** Game key (folder / route / icon name), also the server best-scores key. */
  key: string;
}

export const SCORE_GAMES: ScoreGame[] = [
  { key: 'typing' },
  { key: 'snake' },
  { key: '2048' },
  { key: 'simon' },
  { key: 'motus' },
  { key: 'tetris' },
  { key: 'minesweeper' },
  { key: 'breakout' },
  { key: 'math' },
  { key: 'geoquiz' },
  { key: 'trivia' },
  { key: 'conjugation' },
  { key: 'anagram' },
  { key: 'hangman' },
  { key: 'mastermind' },
  { key: 'wordsearch' },
  { key: 'sudoku' },
  { key: 'taquin' },
  { key: 'flappy' },
  { key: 'solitaire' },
  { key: 'blackjack' },
  { key: 'invaders' },
  { key: 'asteroids' },
  { key: 'bubbles' },
  { key: 'binairo' },
  { key: 'kakuro' },
  // Level games: their "score" is the level reached (GameEngine.getRecordedScore).
  { key: 'pacman' },
  { key: 'sokoban' },
  { key: 'nonogram' },
];
