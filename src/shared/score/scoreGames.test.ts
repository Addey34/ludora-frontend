import { describe, expect, it } from 'vitest';

import { SCORE_GAMES, readBestScore, type ScoreStore } from './scoreGames.js';

/** Minimal in-memory Storage-like for the reader. */
function fakeStore(data: Record<string, string>): ScoreStore {
  const keys = Object.keys(data);
  return {
    length: keys.length,
    key: (i) => keys[i] ?? null,
    getItem: (k) => data[k] ?? null,
  };
}

const board = (...scores: number[]) =>
  JSON.stringify(scores.map((score) => ({ username: 'x', score })));

describe('readBestScore', () => {
  it('returns null when the game has no stored board', () => {
    expect(readBestScore(fakeStore({}), 'tetris-high-scores')).toBeNull();
  });

  it('reads the best score from the base board', () => {
    const store = fakeStore({ 'tetris-high-scores': board(120, 300, 80) });
    expect(readBestScore(store, 'tetris-high-scores')).toBe(300);
  });

  it('takes the max across base and per-variant boards', () => {
    const store = fakeStore({
      'tetris-high-scores': board(120),
      'tetris-high-scores-easy': board(90),
      'tetris-high-scores-hard': board(540),
    });
    expect(readBestScore(store, 'tetris-high-scores')).toBe(540);
  });

  it('does not match a different game that shares a prefix boundary', () => {
    const store = fakeStore({ bubbles: board(50), bubblesX: board(9999) });
    expect(readBestScore(store, 'bubbles')).toBe(50);
  });

  it('ignores an unreadable board', () => {
    const store = fakeStore({ 'snake-high-scores': '{not json' });
    expect(readBestScore(store, 'snake-high-scores')).toBeNull();
  });
});

describe('SCORE_GAMES registry', () => {
  it('has unique keys and non-empty storage keys', () => {
    const keys = SCORE_GAMES.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const g of SCORE_GAMES) expect(g.storageKey.length).toBeGreaterThan(0);
  });
});
