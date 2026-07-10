import { Client, Session } from '@heroiclabs/nakama-js';
import { ScoreEntry } from '../score/ScoreManager.js';

/**
 * Thin wrapper around the Nakama client used for the online leaderboards.
 *
 * The backend is a self-hosted Nakama server (see project memory). Everything
 * here is best-effort: if the server is unreachable, callers fall back to the
 * local `localStorage` leaderboard, so the games keep working offline.
 *
 * It is game-agnostic: a whole {@link ScoreEntry} is stored, with the score in
 * the record's score field and every other field (username + game-specific
 * extras like Typing's wpm/lpm) carried in the record metadata. So a
 * game's custom leaderboard columns work online exactly like they do locally.
 */

/** Public connection settings of the Nakama backend. */
const HOST = '82-70-233-45.sslip.io';
const PORT = '443';
const USE_SSL = true;
/**
 * The Nakama "server key" (NOT a secret password): it is the client-side key
 * games use to talk to the server, and is meant to live in front-end code.
 */
const SERVER_KEY = 'cFmiblnZCHyu3JRSs9jeQEBLUxwI';

/** localStorage key holding this browser's stable device id (one player). */
const DEVICE_ID_KEY = 'gz-nakama-device-id';

/**
 * localStorage keys persisting the authenticated session across reloads, so a
 * page load resumes the SAME account (crucially the Google one) instead of
 * always falling back to anonymous device auth.
 */
const SESSION_TOKEN_KEY = 'gz-nakama-session';
const SESSION_REFRESH_KEY = 'gz-nakama-refresh';

/** Entry fields owned by the record itself, hence not duplicated in metadata. */
const RECORD_OWNED_FIELDS = ['score', 'date'];

/** Minimal shape of a leaderboard record we read back from Nakama. */
interface RawLeaderboardRecord {
  score?: number;
  username?: string;
  metadata?: object;
  update_time?: string;
}

/**
 * Builds the metadata stored alongside a score: every entry field except the
 * ones the record owns natively (score, date). Keeps the username and any
 * game-specific extras (e.g. Typing's wpm/lpm). Pure → unit-tested.
 */
export function buildScoreMetadata(entry: ScoreEntry): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!RECORD_OWNED_FIELDS.includes(key)) metadata[key] = value;
  }
  return metadata;
}

/**
 * Rebuilds a {@link ScoreEntry} from a leaderboard record: score and date come
 * from the record, the username and extras from its metadata. Pure → unit-tested.
 */
export function recordToScoreEntry(record: RawLeaderboardRecord): ScoreEntry {
  const meta = (record.metadata ?? {}) as Record<string, unknown>;
  const entry: ScoreEntry = {
    username: typeof meta.username === 'string' ? meta.username : record.username || 'Player',
    score: record.score ?? 0,
    date: record.update_time ? new Date(record.update_time) : undefined,
  };
  for (const [key, value] of Object.entries(meta)) {
    if (key !== 'username') (entry as unknown as Record<string, unknown>)[key] = value;
  }
  return entry;
}

/** Best-effort decode of the "name" (or email) claim from a Google ID token. */
export function googleTokenName(idToken: string): string | undefined {
  try {
    const part = idToken.split('.')[1];
    if (!part) return undefined;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as { name?: string; email?: string };
    return claims.name || claims.email;
  } catch {
    return undefined;
  }
}

let client: Client | null = null;
/** Cached authentication so we only sign in once per page load. */
let sessionPromise: Promise<Session> | null = null;

/** Lazily builds the singleton client. Exported so the realtime layer
 * (`match.ts`) reuses the same client/connection settings. */
export function getClient(): Client {
  if (!client) {
    client = new Client(SERVER_KEY, HOST, PORT, USE_SSL);
  }
  return client;
}

/**
 * Returns this browser's device id, generating and persisting one on first use.
 * The same id always maps to the same Nakama account ("device authentication").
 */
function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `gz-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Persists a session so a later page load resumes the SAME account. */
function storeSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, session.token);
    localStorage.setItem(SESSION_REFRESH_KEY, session.refresh_token);
  } catch {} // eslint-disable-line no-empty
}

/** Restores a persisted session, refreshing it if expired. Null if none/invalid. */
async function restoreSession(): Promise<Session | null> {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  const refresh = localStorage.getItem(SESSION_REFRESH_KEY);
  if (!token) return null;
  let session = Session.restore(token, refresh ?? '');
  const now = Date.now() / 1000;
  if (session.isexpired(now)) {
    if (!refresh || session.isrefreshexpired(now)) return null;
    try {
      session = await getClient().sessionRefresh(session);
      storeSession(session);
    } catch {
      return null;
    }
  }
  return session;
}

/**
 * Returns the current session, reused within a page. Resumes a persisted session
 * first (so a signed-in Google account survives reloads), and only falls back to
 * anonymous device auth when there is no valid stored session.
 *
 * Exported so the realtime layer (`match.ts`) authenticates the socket with the
 * same account the rest of the app uses.
 */
export function getSession(): Promise<Session> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const restored = await restoreSession();
      if (restored) return restored;
      const session = await getClient().authenticateDevice(getDeviceId(), true);
      storeSession(session);
      return session;
    })().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

/**
 * Submits a full score entry to the given leaderboard. The score goes to the
 * record's score field; the username and any game-specific extras travel in the
 * metadata. Rejects if the backend is unreachable (callers should catch).
 */
export async function submitLeaderboardScore(
  leaderboardId: string,
  entry: ScoreEntry
): Promise<void> {
  const session = await getSession();
  await getClient().writeLeaderboardRecord(session, leaderboardId, {
    score: String(entry.score),
    metadata: buildScoreMetadata(entry),
  });
}

/**
 * Fetches the top `limit` entries of a leaderboard, sorted by the server, each
 * rebuilt as a {@link ScoreEntry} (extras restored from metadata so custom
 * columns render). Rejects if the backend is unreachable (callers fall back).
 */
export async function listLeaderboardScores(
  leaderboardId: string,
  limit = 10
): Promise<ScoreEntry[]> {
  const session = await getSession();
  const result = await getClient().listLeaderboardRecords(session, leaderboardId, undefined, limit);
  return (result.records ?? []).map(recordToScoreEntry);
}

/** Id of the cross-game "GamesZone Points" leaderboard (incremental, desc). */
export const GLOBAL_LEADERBOARD = 'global';

/** An entry of the global cross-game ranking. */
export interface GlobalRankEntry {
  username: string;
  score: number;
  rank: number;
  /** True for the current player's own row. */
  isMe: boolean;
}

/** Shape of the global leaderboard records we read back (superset of the base). */
interface RawGlobalRecord {
  score?: number;
  username?: string;
  metadata?: object;
  rank?: number | string;
  owner_id?: string;
}

function toGlobalEntry(
  record: RawGlobalRecord,
  myId: string,
  fallbackRank: number
): GlobalRankEntry {
  const meta = (record.metadata ?? {}) as Record<string, unknown>;
  const name = typeof meta.username === 'string' ? meta.username : record.username || 'Player';
  return {
    username: name,
    score: record.score ?? 0,
    rank: Number(record.rank) || fallbackRank,
    isMe: record.owner_id === myId,
  };
}

/**
 * Adds GamesZone Points to the player's global total (incremental leaderboard).
 * Rejects if the backend is unreachable or the 'global' board isn't created yet,
 * so callers should swallow errors (best-effort, like the per-game submit).
 */
export async function submitGlobalScore(points: number, username?: string): Promise<void> {
  if (points <= 0) return;
  const session = await getSession();
  // Show the player's Google display name on the board (their chosen name),
  // not the old local pseudo. Each incr write refreshes the record's metadata,
  // so a renamed player's board row updates on their next run.
  const name = username ?? cachedUser?.displayName;
  await getClient().writeLeaderboardRecord(session, GLOBAL_LEADERBOARD, {
    score: String(points),
    metadata: name ? { username: name } : {},
  });
}

/** Top `limit` of the global ranking. Returns [] on any error/backend issue. */
export async function listGlobalRanking(limit = 20): Promise<GlobalRankEntry[]> {
  try {
    const session = await getSession();
    const result = await getClient().listLeaderboardRecords(
      session,
      GLOBAL_LEADERBOARD,
      undefined,
      limit
    );
    const myId = session.user_id ?? '';
    return (result.records ?? []).map((r, i) => toGlobalEntry(r, myId, i + 1));
  } catch {
    return [];
  }
}

/** The current player's own global rank, or null if unranked/unavailable. */
export async function getMyGlobalRank(): Promise<GlobalRankEntry | null> {
  try {
    const session = await getSession();
    const myId = session.user_id ?? '';
    const result = await getClient().listLeaderboardRecordsAroundOwner(
      session,
      GLOBAL_LEADERBOARD,
      myId,
      1
    );
    const mine = (result.records ?? []).find((r) => r.owner_id === myId);
    return mine ? toGlobalEntry(mine, myId, 0) : null;
  } catch {
    return null;
  }
}

/**
 * Sends a player's feedback on a game to the backend. Calls the server-side
 * `submit_feedback` RPC (registered in the Nakama runtime module), which stores
 * it in the private `feedback` collection for the developer to read in the
 * Nakama console. Rejects if the backend is unreachable, so the caller can tell
 * the user it did not go through (unlike scores, feedback should confirm).
 */
export async function submitFeedback(game: string, rating: number, text: string): Promise<void> {
  const session = await getSession();
  await getClient().rpc(session, 'submit_feedback', { game, rating, text });
}

/** Nakama Storage collection holding this player's per-game progress. */
const PROGRESS_COLLECTION = 'progress';

/**
 * Reads a JSON value from this player's private Nakama Storage. Returns null if
 * the object is absent or the backend is unreachable, so callers fall back to
 * `localStorage`. Best-effort: never throws.
 */
export async function readStorage<T extends object>(key: string): Promise<T | null> {
  try {
    const session = await getSession();
    const result = await getClient().readStorageObjects(session, {
      object_ids: [{ collection: PROGRESS_COLLECTION, key, user_id: session.user_id }],
    });
    const value = result.objects?.[0]?.value;
    return value ? (value as T) : null;
  } catch {
    return null;
  }
}

/**
 * Writes a JSON value to this player's private Nakama Storage (owner-only
 * read/write). Best-effort: swallows failures so a backend issue never blocks
 * gameplay.
 */
export async function writeStorage<T extends object>(key: string, value: T): Promise<void> {
  try {
    const session = await getSession();
    await getClient().writeStorageObjects(session, [
      { collection: PROGRESS_COLLECTION, key, value, permission_read: 1, permission_write: 1 },
    ]);
  } catch {} // eslint-disable-line no-empty
}

/** Google OAuth client id (public) used by the front-end sign-in flow. */
export const GOOGLE_CLIENT_ID =
  '678823080002-dbu42nv5qagaknoh7s7haqotos8s4ma4.apps.googleusercontent.com';

/** The current player, as shown in the UI. */
export interface CurrentUser {
  displayName: string;
  /** true once a Google account is linked (i.e. signed in, not anonymous). */
  loggedIn: boolean;
}

/**
 * Signs in with a Google ID token. First tries to LINK Google to the current
 * (anonymous device) account so existing scores carry over; if that Google
 * identity already belongs to another account (e.g. the player signed in before
 * on another device), switches to that account instead. Sets the display name
 * from the Google profile. Rejects if the backend is unreachable.
 *
 * Returns `true` when it switched to a different existing account (rather than
 * linking the current anonymous one), so the caller can drop this browser's
 * local caches that belonged to the previous player.
 */
export async function loginWithGoogleToken(idToken: string): Promise<boolean> {
  const nakama = getClient();
  let session = await getSession();
  let switched = false;
  try {
    await nakama.linkGoogle(session, { token: idToken });
  } catch {
    session = await nakama.authenticateGoogle(idToken, true);
    switched = true;
  }
  const name = googleTokenName(idToken);
  if (name) {
    try {
      await nakama.updateAccount(session, { display_name: name });
    } catch {} // eslint-disable-line no-empty
  }
  sessionPromise = Promise.resolve(session);
  storeSession(session);
  return switched;
}

/** Last resolved player, cached so the game-over overlay can read it synchronously. */
let cachedUser: CurrentUser | null = null;

/** The last-known player, or null if not fetched yet this page. Synchronous. */
export function getCachedUser(): CurrentUser | null {
  return cachedUser;
}

/** Whether the last-known player is signed in with Google. Synchronous. */
export function isLoggedInCached(): boolean {
  return cachedUser?.loggedIn === true;
}

/** Returns the current player (display name + whether Google is linked). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const session = await getSession();
    const account = await getClient().getAccount(session);
    cachedUser = {
      displayName: account.user?.display_name || account.user?.username || 'Player',
      loggedIn: Boolean(account.user?.google_id),
    };
    return cachedUser;
  } catch {
    return null;
  }
}

/**
 * Renames the player: updates their Nakama account display name (used on the
 * leaderboards) and the local cache, so future scores show the new name.
 * Rejects if the backend is unreachable.
 */
export async function updateDisplayName(name: string): Promise<void> {
  const clean = name.trim().slice(0, 20);
  if (!clean) return;
  const session = await getSession();
  await getClient().updateAccount(session, { display_name: clean });
  if (cachedUser) cachedUser.displayName = clean;
}

/**
 * "Logs out" by abandoning this browser's stored session and anonymous device
 * id: the next session starts as a fresh anonymous player. Signing in with
 * Google again re-attaches to the same Google account (and its scores).
 */
export function logout(): void {
  localStorage.removeItem(DEVICE_ID_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(SESSION_REFRESH_KEY);
  client = null;
  sessionPromise = null;
}
