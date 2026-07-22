import { getCurrentUser, readStorage, writeStorage } from '../net/nakama.js';

const LOCAL_KEY = 'ludora-game-library';
const REMOTE_KEY = 'game-library';
const MAX_FAVORITES = 24;
const MAX_RECENT = 8;

interface RecentGame {
  key: string;
  playedAt: number;
}

interface GameLibrary {
  favorites: string[];
  recent: RecentGame[];
}

export interface LoadedGameLibrary extends GameLibrary {
  storage: 'local' | 'cloud';
}

const emptyLibrary = (): GameLibrary => ({ favorites: [], recent: [] });

function validKey(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
}

export function normalizeGameLibrary(value: unknown): GameLibrary {
  if (!value || typeof value !== 'object') return emptyLibrary();
  const candidate = value as Partial<GameLibrary>;
  const favorites = Array.isArray(candidate.favorites)
    ? [...new Set(candidate.favorites.filter(validKey))].slice(0, MAX_FAVORITES)
    : [];
  const recent = Array.isArray(candidate.recent)
    ? candidate.recent
        .filter(
          (item): item is RecentGame =>
            Boolean(item) && validKey(item.key) && Number.isFinite(item.playedAt)
        )
        .sort((a, b) => b.playedAt - a.playedAt)
        .filter(
          (item, index, items) => items.findIndex((other) => other.key === item.key) === index
        )
        .slice(0, MAX_RECENT)
    : [];
  return { favorites, recent };
}

export function mergeGameLibraries(primary: GameLibrary, pending: GameLibrary): GameLibrary {
  return normalizeGameLibrary({
    favorites: [...primary.favorites, ...pending.favorites],
    recent: [...primary.recent, ...pending.recent],
  });
}

export function addRecentGame(
  library: GameLibrary,
  key: string,
  playedAt = Date.now()
): GameLibrary {
  if (!validKey(key)) return normalizeGameLibrary(library);
  return normalizeGameLibrary({
    ...library,
    recent: [{ key, playedAt }, ...library.recent.filter((item) => item.key !== key)],
  });
}

export function setFavoriteGame(library: GameLibrary, key: string, favorite: boolean): GameLibrary {
  if (!validKey(key)) return normalizeGameLibrary(library);
  const favorites = favorite
    ? [key, ...library.favorites.filter((candidate) => candidate !== key)]
    : library.favorites.filter((candidate) => candidate !== key);
  return normalizeGameLibrary({ ...library, favorites });
}

function readLocal(): GameLibrary {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? normalizeGameLibrary(JSON.parse(raw)) : emptyLibrary();
  } catch {
    return emptyLibrary();
  }
}

function writeLocal(library: GameLibrary): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(normalizeGameLibrary(library)));
  } catch {} // eslint-disable-line no-empty
}

function clearLocal(): void {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {} // eslint-disable-line no-empty
}

let current: LoadedGameLibrary | null = null;
let loading: Promise<LoadedGameLibrary> | null = null;

export function loadGameLibrary(): Promise<LoadedGameLibrary> {
  if (current) return Promise.resolve(current);
  if (loading) return loading;
  loading = (async () => {
    const pending = readLocal();
    const user = await getCurrentUser();
    if (!user?.loggedIn) {
      current = { ...pending, storage: 'local' };
      return current;
    }

    const remote = normalizeGameLibrary(await readStorage<GameLibrary>(REMOTE_KEY));
    const merged = mergeGameLibraries(remote, pending);
    current = { ...merged, storage: 'cloud' };
    if (pending.favorites.length || pending.recent.length) {
      if (await writeStorage(REMOTE_KEY, merged)) clearLocal();
    }
    return current;
  })().finally(() => {
    loading = null;
  });
  return loading;
}

async function persist(library: LoadedGameLibrary): Promise<void> {
  current = library;
  writeLocal(library);
  const stored = { favorites: library.favorites, recent: library.recent };
  if (library.storage === 'cloud' && (await writeStorage(REMOTE_KEY, stored))) clearLocal();
  window.dispatchEvent(new CustomEvent('ludora-library-change', { detail: library }));
}

export async function recordRecentlyPlayed(key: string): Promise<void> {
  const library = await loadGameLibrary();
  await persist({ ...addRecentGame(library, key), storage: library.storage });
}

export async function toggleFavoriteGame(key: string): Promise<LoadedGameLibrary> {
  const library = await loadGameLibrary();
  const favorite = !library.favorites.includes(key);
  const next = { ...setFavoriteGame(library, key, favorite), storage: library.storage };
  await persist(next);
  return next;
}
