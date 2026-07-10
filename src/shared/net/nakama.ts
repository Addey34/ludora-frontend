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
    // Google tokens are UTF-8 encoded, so decode the bytes through TextDecoder;
    // a plain atob() would mangle accented names (e.g. "François" → "FranÃ§ois").
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { name?: string; email?: string };
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
 * Resolves each owner id to its CURRENT account display name in a single batch
 * call, so a leaderboard always shows the player's latest nickname: renaming on
 * /profile updates the Nakama account, and every board reflects it immediately
 * instead of the name that was baked into the record's metadata at write time.
 * Returns an id→name map; ids that can't be resolved are simply absent, so
 * callers keep the metadata name as a fallback. Best-effort: never throws.
 */
async function resolveDisplayNames(
  session: Session,
  ownerIds: Array<string | undefined>
): Promise<Map<string, string>> {
  const ids = [...new Set(ownerIds.filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (ids.length === 0) return names;
  try {
    const result = await getClient().getUsers(session, ids);
    for (const user of result.users ?? []) {
      const name = user.display_name || user.username;
      if (user.id && name) names.set(user.id, name);
    }
  } catch {
    // Fall back to each record's metadata name.
  }
  return names;
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
 * Records a run authoritatively through the server `write_score` RPC. The RPC
 * creates each target leaderboard on demand (so per-variant boards like
 * `snake-easy` never need pre-provisioning), keeps only the player's best per
 * board, and maintains the server-owned per-game best-score summary the profile
 * reads. The client never writes any of this to localStorage. Rejects if the
 * backend is unreachable, so the caller can warn the player the run was lost.
 *
 * @param game   Base game key (e.g. `snake`) — the summary is keyed by it.
 * @param boards Every leaderboard to write to (base + active variant).
 */
export async function recordRun(run: {
  game: string;
  boards: string[];
  score: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const session = await getSession();
  await getClient().rpc(session, 'write_score', {
    game: run.game,
    boards: run.boards,
    score: run.score,
    metadata: run.metadata ?? {},
  });
}

/** Storage key of the per-player "best score per game" summary (server-owned). */
const BEST_SCORES_KEY = 'bestscores';

/**
 * The player's best score in each game, as maintained server-side by the
 * `write_score` RPC — read in a single call by the profile / personal
 * leaderboard (no per-board fan-out). Returns `{}` on any error/backend issue.
 */
export async function getMyBestScores(): Promise<Record<string, number>> {
  const best = await readStorage<Record<string, number>>(BEST_SCORES_KEY);
  return best ?? {};
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
  const records = result.records ?? [];
  const names = await resolveDisplayNames(
    session,
    records.map((r) => r.owner_id)
  );
  return records.map((record) => {
    const entry = recordToScoreEntry(record);
    const resolved = record.owner_id ? names.get(record.owner_id) : undefined;
    if (resolved) entry.username = resolved;
    return entry;
  });
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
    const records = result.records ?? [];
    const names = await resolveDisplayNames(
      session,
      records.map((r) => r.owner_id)
    );
    return records.map((r, i) => {
      const entry = toGlobalEntry(r, myId, i + 1);
      const resolved = r.owner_id ? names.get(r.owner_id) : undefined;
      if (resolved) entry.username = resolved;
      return entry;
    });
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
    if (!mine) return null;
    const entry = toGlobalEntry(mine, myId, 0);
    const names = await resolveDisplayNames(session, [mine.owner_id]);
    const resolved = mine.owner_id ? names.get(mine.owner_id) : undefined;
    if (resolved) entry.username = resolved;
    return entry;
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
  const previousUserId = session.user_id;
  try {
    await nakama.linkGoogle(session, { token: idToken });
  } catch {
    // Linking can fail because this Google identity belongs to a DIFFERENT
    // existing account, OR because it's already linked to the current one (a
    // plain re-login). Authenticating with Google resolves the real account in
    // both cases; whether we actually switched is decided by the user id below,
    // not by the mere fact that linking threw — otherwise a same-account
    // re-login would wrongly look like a switch and wipe local progress.
    session = await nakama.authenticateGoogle(idToken, true);
  }
  const switched = session.user_id !== previousUserId;
  // Seed the display name from the Google profile ONLY the first time (when the
  // account has none yet). Never overwrite a name the player later chose on
  // /profile — otherwise every re-login would wipe their custom name.
  try {
    const account = await nakama.getAccount(session);
    if (!account.user?.display_name) {
      const name = googleTokenName(idToken);
      if (name) await nakama.updateAccount(session, { display_name: name });
    }
  } catch {} // eslint-disable-line no-empty
  sessionPromise = Promise.resolve(session);
  userPromise = null; // force a fresh identity read with the new session
  rememberLoggedIn(true);
  storeSession(session);
  return switched;
}

/** Last resolved player, cached so the game-over overlay can read it synchronously. */
let cachedUser: CurrentUser | null = null;
/**
 * In-flight/resolved `getCurrentUser` result, shared for the whole page so every
 * consumer (sidebar, auth guard, profile editor…) gets ONE consistent answer
 * from ONE backend round-trip — instead of each racing its own `getAccount` and
 * some flipping the UI to "logged out" on a transient failure.
 */
let userPromise: Promise<CurrentUser | null> | null = null;

/**
 * Persisted hint that the last confirmed state was "signed in with Google". Lets
 * a transient backend hiccup keep showing the player as signed in instead of
 * wrongly bouncing them out of /profile or /leaderboard.
 */
const LOGGED_IN_KEY = 'gz-logged-in';

function rememberLoggedIn(loggedIn: boolean): void {
  try {
    if (loggedIn) localStorage.setItem(LOGGED_IN_KEY, '1');
    else localStorage.removeItem(LOGGED_IN_KEY);
  } catch {} // eslint-disable-line no-empty
}

function wasLoggedIn(): boolean {
  try {
    return localStorage.getItem(LOGGED_IN_KEY) === '1';
  } catch {
    return false;
  }
}

/** The last-known player, or null if not fetched yet this page. Synchronous. */
export function getCachedUser(): CurrentUser | null {
  return cachedUser;
}

/** Whether the last-known player is signed in with Google. Synchronous. */
export function isLoggedInCached(): boolean {
  return cachedUser?.loggedIn === true;
}

/**
 * Returns the current player (display name + whether Google is linked). Memoised
 * per page so repeated/concurrent calls share one round-trip and one answer. On
 * a backend error it keeps the last known player (or the persisted "was signed
 * in" hint) rather than reporting a signed-in user as logged out.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (userPromise) return userPromise;
  userPromise = (async () => {
    try {
      const session = await getSession();
      const account = await getClient().getAccount(session);
      const loggedIn = Boolean(account.user?.google_id);
      cachedUser = {
        displayName: account.user?.display_name || account.user?.username || 'Player',
        loggedIn,
      };
      rememberLoggedIn(loggedIn);
      return cachedUser;
    } catch {
      userPromise = null; // allow a later call to retry the network
      if (cachedUser) return cachedUser;
      // Transient failure before we ever resolved: trust the persisted hint so a
      // signed-in player isn't kicked out of an account-only page by a hiccup.
      if (wasLoggedIn()) {
        cachedUser = { displayName: 'Player', loggedIn: true };
        return cachedUser;
      }
      return null;
    }
  })();
  return userPromise;
}

async function requireGoogleLinkedSession(): Promise<Session> {
  const session = await getSession();
  // Reuse the single, memoised, hiccup-tolerant identity check so the friends
  // flow gates exactly like /profile and /leaderboard — no separate getAccount
  // that could wrongly report a signed-in player as logged out.
  const user = await getCurrentUser();
  if (!user?.loggedIn) throw new Error('Google sign-in required');
  return session;
}

/** A friend of the current player (from Nakama's friend graph). */
export interface Friend {
  /** Their Nakama user id — used to look up their global score. */
  userId: string;
  /** Their friend code (Nakama username) — used to add them. */
  code: string;
  displayName: string;
  online: boolean;
  /** Nakama friend state: 0 = mutual, 1 = invite sent, 2 = invite received. */
  state: number;
}

/** Nakama friend-graph states, named so the UI can branch readably. */
export const FRIEND_STATE = {
  mutual: 0,
  invitePending: 1, // I sent a request, awaiting their acceptance.
  inviteReceived: 2, // They sent me a request, awaiting my acceptance.
} as const;

/** This player's shareable friend code (their Nakama username), or null. */
export async function getFriendCode(): Promise<string | null> {
  try {
    const session = await requireGoogleLinkedSession();
    const account = await getClient().getAccount(session);
    return account.user?.username ?? null;
  } catch {
    return null;
  }
}

/** Sends a friend request by code (the other player's friend code / username). */
export async function addFriendByCode(code: string): Promise<void> {
  const clean = code.trim();
  if (!clean) return;
  const session = await requireGoogleLinkedSession();
  await getClient().addFriends(session, [], [clean]);
}

/** The current player's friends (mutual, pending and received), with presence. */
export async function listMyFriends(): Promise<Friend[]> {
  try {
    const session = await requireGoogleLinkedSession();
    const result = await getClient().listFriends(session, undefined, 100);
    return (result.friends ?? []).map((f) => ({
      userId: f.user?.id ?? '',
      code: f.user?.username ?? '',
      displayName: f.user?.display_name || f.user?.username || 'Player',
      online: f.user?.online ?? false,
      state: f.state ?? 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Accepts a friend request (or confirms a mutual add): calling `addFriends` with
 * a username that already sent us an invite promotes it to a mutual friendship.
 */
export async function acceptFriend(code: string): Promise<void> {
  const clean = code.trim();
  if (!clean) return;
  const session = await requireGoogleLinkedSession();
  await getClient().addFriends(session, [], [clean]);
}

/**
 * Removes a friend or rejects/cancels a pending request (Nakama treats all three
 * as deleting the edge). Rejects if the backend is unreachable.
 */
export async function removeFriend(code: string): Promise<void> {
  const clean = code.trim();
  if (!clean) return;
  const session = await requireGoogleLinkedSession();
  await getClient().deleteFriends(session, [], [clean]);
}

/**
 * The friends-only GamesZone Points ranking: the current player plus their mutual
 * friends, sorted by GZP (desc) and freshly ranked among themselves. Reads the
 * same global leaderboard as {@link listGlobalRanking} but filtered to the friend
 * graph's owner ids. Returns [] on any error/backend issue.
 */
export async function listFriendRanking(): Promise<GlobalRankEntry[]> {
  try {
    const session = await requireGoogleLinkedSession();
    const myId = session.user_id ?? '';
    const friends = await listMyFriends();
    const ids = [
      myId,
      ...friends.filter((f) => f.state === FRIEND_STATE.mutual).map((f) => f.userId),
    ]
      .filter(Boolean)
      // De-dupe in case the graph ever returns the owner among the friends.
      .filter((id, i, all) => all.indexOf(id) === i);
    if (ids.length === 0) return [];
    const result = await getClient().listLeaderboardRecords(
      session,
      GLOBAL_LEADERBOARD,
      ids,
      ids.length
    );
    const records = result.records ?? [];
    const names = await resolveDisplayNames(
      session,
      records.map((r) => r.owner_id)
    );
    const entries = records.map((r) => {
      const entry = toGlobalEntry(r, myId, 0);
      const resolved = r.owner_id ? names.get(r.owner_id) : undefined;
      if (resolved) entry.username = resolved;
      return entry;
    });
    entries.sort((a, b) => b.score - a.score);
    entries.forEach((entry, i) => (entry.rank = i + 1));
    return entries;
  } catch {
    return [];
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
  const session = await requireGoogleLinkedSession();
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
  localStorage.removeItem(LOGGED_IN_KEY);
  client = null;
  sessionPromise = null;
  userPromise = null;
  cachedUser = null;
}
