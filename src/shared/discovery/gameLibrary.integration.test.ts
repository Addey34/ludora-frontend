import { beforeEach, describe, expect, it, vi } from 'vitest';

const nakama = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readStorage: vi.fn(),
  writeStorage: vi.fn(),
}));

vi.mock('../net/nakama.js', () => nakama);

describe('gameLibrary persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('keeps guest favorites in localStorage', async () => {
    nakama.getCurrentUser.mockResolvedValue({ displayName: 'Guest', loggedIn: false });
    const { loadGameLibrary, toggleFavoriteGame } = await import('./gameLibrary.js');

    expect((await loadGameLibrary()).storage).toBe('local');
    await toggleFavoriteGame('snake');

    expect(JSON.parse(localStorage.getItem('ludora-game-library') ?? '{}').favorites).toEqual([
      'snake',
    ]);
    expect(nakama.writeStorage).not.toHaveBeenCalled();
  });

  it('merges pending guest data into private account storage', async () => {
    localStorage.setItem(
      'ludora-game-library',
      JSON.stringify({ favorites: ['snake'], recent: [{ key: 'snake', playedAt: 20 }] })
    );
    nakama.getCurrentUser.mockResolvedValue({ displayName: 'Ada', loggedIn: true });
    nakama.readStorage.mockResolvedValue({
      favorites: ['pong'],
      recent: [{ key: 'pong', playedAt: 10 }],
    });
    nakama.writeStorage.mockResolvedValue(true);
    const { loadGameLibrary } = await import('./gameLibrary.js');

    const library = await loadGameLibrary();

    expect(library).toEqual({
      favorites: ['pong', 'snake'],
      recent: [
        { key: 'snake', playedAt: 20 },
        { key: 'pong', playedAt: 10 },
      ],
      storage: 'cloud',
    });
    expect(nakama.writeStorage).toHaveBeenCalledWith('game-library', {
      favorites: ['pong', 'snake'],
      recent: [
        { key: 'snake', playedAt: 20 },
        { key: 'pong', playedAt: 10 },
      ],
    });
    expect(localStorage.getItem('ludora-game-library')).toBeNull();
  });

  it('keeps the local retry copy when cloud storage is unavailable', async () => {
    nakama.getCurrentUser.mockResolvedValue({ displayName: 'Ada', loggedIn: true });
    nakama.readStorage.mockResolvedValue({ favorites: [], recent: [] });
    nakama.writeStorage.mockResolvedValue(false);
    const { loadGameLibrary, toggleFavoriteGame } = await import('./gameLibrary.js');

    await loadGameLibrary();
    await toggleFavoriteGame('snake');

    expect(JSON.parse(localStorage.getItem('ludora-game-library') ?? '{}').favorites).toEqual([
      'snake',
    ]);
  });
});
