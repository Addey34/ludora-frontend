import { describe, expect, it } from 'vitest';
import {
  addRecentGame,
  mergeGameLibraries,
  normalizeGameLibrary,
  setFavoriteGame,
} from './gameLibrary.js';

describe('gameLibrary', () => {
  it('sanitizes malformed, duplicate and excessive values', () => {
    const normalized = normalizeGameLibrary({
      favorites: ['snake', 'snake', '../bad', ...Array.from({ length: 30 }, (_, i) => `game-${i}`)],
      recent: [
        { key: 'pong', playedAt: 10 },
        { key: 'pong', playedAt: 5 },
        { key: 'snake', playedAt: 20 },
        { key: 'bad key', playedAt: 30 },
      ],
    });
    expect(normalized.favorites).toHaveLength(24);
    expect(normalized.favorites.slice(0, 2)).toEqual(['snake', 'game-0']);
    expect(normalized.recent).toEqual([
      { key: 'snake', playedAt: 20 },
      { key: 'pong', playedAt: 10 },
    ]);
  });

  it('merges guest data into cloud data without duplicates', () => {
    expect(
      mergeGameLibraries(
        { favorites: ['snake'], recent: [{ key: 'pong', playedAt: 10 }] },
        { favorites: ['pong'], recent: [{ key: 'pong', playedAt: 20 }] }
      )
    ).toEqual({
      favorites: ['snake', 'pong'],
      recent: [{ key: 'pong', playedAt: 20 }],
    });
  });

  it('moves a replayed game to the front and keeps eight entries', () => {
    const library = {
      favorites: [],
      recent: Array.from({ length: 8 }, (_, index) => ({ key: `game-${index}`, playedAt: index })),
    };
    expect(addRecentGame(library, 'game-2', 100).recent[0]).toEqual({
      key: 'game-2',
      playedAt: 100,
    });
    expect(addRecentGame(library, 'snake', 100).recent).toHaveLength(8);
  });

  it('adds and removes a favorite idempotently', () => {
    const base = { favorites: ['pong'], recent: [] };
    expect(setFavoriteGame(base, 'snake', true).favorites).toEqual(['snake', 'pong']);
    expect(setFavoriteGame(base, 'pong', false).favorites).toEqual([]);
  });
});
