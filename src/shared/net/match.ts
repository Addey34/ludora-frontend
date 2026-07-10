import { Socket, Match, MatchData, MatchPresenceEvent } from '@heroiclabs/nakama-js';
import { getClient, getSession } from './nakama.js';

/**
 * Relayed realtime match layer (best-effort), game-agnostic, **N-player**.
 *
 * Nakama relays match-state messages between the players; no server-side match
 * handler is needed. We exploit Nakama's **named matches**:
 * `socket.createMatch(name)` is de-duplicated by name, so the *same* short code
 * used as the match name puts everyone in the *same* match — the host calls it
 * after generating a code, each guest after typing it. There is therefore no
 * code→match mapping to store, and **no server change** to ship.
 *
 * Authority is decided by the UI, not the server: whoever pressed "Create" is the
 * `host` (authoritative simulation), everyone who pressed "Join" is a `guest`.
 *
 * Seats & lobby: the match opens in a **lobby**. The host is the source of truth
 * for the roster (it watches presence and broadcasts the player count). When the
 * host presses "Start", it freezes the roster, assigns **seats by join order**
 * (host = seat 0, guests 1…n in the order they joined) and broadcasts the seat
 * map; every client then derives its own seat. Late joiners after the start get
 * no seat (the lobby is locked). These lobby messages travel on a **reserved
 * op-code range** ({@link SYS_OP_BASE}+) that is handled internally and never
 * forwarded to the game, so game op codes (which must stay below it) can't clash.
 *
 * Everything here swallows failures so a backend issue never crashes the game
 * (the page keeps working in solo/bot mode).
 */

/** Connection over TLS (mirrors the setting in nakama.ts). */
const USE_SSL = true;
/** Code alphabet without look-alikes (no 0/O, 1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;
const DEFAULT_SCOPE = 'gameszone';

/**
 * Op codes at or above this are **reserved** for the lobby/seat protocol and are
 * consumed internally (never delivered to the game's {@link NetMatch.onMessage}).
 * Game op codes MUST stay below it (Pong uses 1–4, Memory 1–2).
 */
const SYS_OP_BASE = 1000;
const OP_SYS_LOBBY = SYS_OP_BASE;
const OP_SYS_START = SYS_OP_BASE + 1;

/** Roles, kept for authority (host simulates, guests follow). */
export type MatchRole = 'host' | 'guest';

/** A decoded game message received from a peer. */
export interface MatchMessage {
  opCode: number;
  data: unknown;
  senderId: string;
}

/** Lobby roster snapshot, surfaced to the panel. */
export interface LobbySnapshot {
  /** Humans present (including self), capped at {@link capacity}. */
  count: number;
  /** Maximum human seats for this match. */
  capacity: number;
  /** Whether the host has started (the lobby is then locked). */
  started: boolean;
}

/** A live relayed match the game drives. */
interface MatchPresenceLike {
  session_id?: string;
}

export function hasRemotePresence(
  presences: readonly MatchPresenceLike[] | undefined,
  selfId: string
): boolean {
  return (presences ?? []).some(
    (presence) => presence.session_id !== undefined && presence.session_id !== selfId
  );
}

export interface NetMatch {
  role: MatchRole;
  matchId: string;
  /** The short session code (match name) shared between players. */
  code: string;
  /** Maximum human seats. */
  capacity: number;
  /** This client's session id (stable per connection — distinct per tab). */
  selfId: string;
  /** Assigned seat once started (host = 0), or -1 while still in the lobby. */
  seat: number;
  /** Number of seated **human** players, fixed at start (seats 0…players-1 are
   *  humans, the rest are bots). 0 while still in the lobby. */
  players: number;
  /** Host only: lock the lobby, assign seats by join order, and start. */
  startMatch(): void;
  /** Current lobby snapshot (for the panel's first paint). */
  lobby(): LobbySnapshot;
  /** Sends a JSON-serialisable game payload (op code must be < {@link SYS_OP_BASE}). */
  send(opCode: number, data: unknown): void;
  /** Registers a game message handler (lobby traffic is filtered out). */
  onMessage(cb: (msg: MatchMessage) => void): void;
  /** Registers a lobby-change handler (roster count / started). */
  onLobby(cb: (snap: LobbySnapshot) => void): void;
  /** A *seated* peer left after the start (seat → e.g. bot takeover). */
  onPeerLeave(cb: (seat: number) => void): void;
  /** The session is no longer a viable versus (host gone, or the 1-v-1 peer gone). */
  onClose(cb: () => void): void;
  /** Leaves the match (best-effort). */
  leave(): Promise<void>;
}

let socket: Socket | null = null;

function dropSocket(s: Socket): void {
  if (socket !== s) return;
  socket = null;
}

/** Lazily opens and connects the singleton socket with the app's session. */
async function getSocket(): Promise<Socket> {
  if (socket) return socket;

  const session = await getSession();
  const nextSocket = getClient().createSocket(USE_SSL, false);
  nextSocket.ondisconnect = () => dropSocket(nextSocket);
  try {
    await nextSocket.connect(session, true);
  } catch (err) {
    try {
      nextSocket.disconnect(false);
    } catch {} // eslint-disable-line no-empty
    throw err;
  }
  socket = nextSocket;
  return nextSocket;
}

async function createNamedMatch(name: string): Promise<{ socket: Socket; match: Match }> {
  const s = await getSocket();
  try {
    return { socket: s, match: await s.createMatch(name) };
  } catch (err) {
    dropSocket(s);
    throw err;
  }
}

/** Generates a short, human-friendly session code. */
function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function scopedMatchName(scope: string | undefined, code: string): string {
  const safeScope = (scope ?? DEFAULT_SCOPE)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-');
  return `${safeScope || DEFAULT_SCOPE}:${code}`;
}

/** Wraps a joined Nakama match into a {@link NetMatch}. */
async function buildNetMatch(
  match: Match,
  code: string,
  role: MatchRole,
  capacity: number
): Promise<NetMatch> {
  const s = await getSocket();
  const selfId = match.self?.session_id ?? '';

  const messageCbs: ((msg: MatchMessage) => void)[] = [];
  const lobbyCbs: ((snap: LobbySnapshot) => void)[] = [];
  const peerLeaveCbs: ((seat: number) => void)[] = [];
  const closeCbs: (() => void)[] = [];

  const joinOrder: string[] = [];
  for (const p of match.presences ?? []) {
    if (p.session_id !== selfId) joinOrder.push(p.session_id);
  }

  const handle: {
    seat: number;
    started: boolean;
    hostId: string;
    order: string[];
    remoteCount: number;
    closed: boolean;
  } = {
    seat: -1,
    started: false,
    hostId: role === 'host' ? selfId : '',
    order: [],
    remoteCount: 1,
    closed: false,
  };

  const countHumans = (): number =>
    role === 'host' ? Math.min(capacity, 1 + joinOrder.length) : handle.remoteCount;
  const snapshot = (): LobbySnapshot => ({
    count: handle.started ? Math.min(capacity, handle.order.length) : countHumans(),
    capacity,
    started: handle.started,
  });
  const fireLobby = (): void => {
    const snap = snapshot();
    for (const cb of lobbyCbs) cb(snap);
  };
  const fireClose = (): void => {
    if (handle.closed) return;
    handle.closed = true;
    for (const cb of closeCbs) cb();
  };

  /** Host: tells everyone the current roster (and who the host is). */
  const broadcastLobby = (): void => {
    send(OP_SYS_LOBBY, { hostId: selfId, count: countHumans() });
  };

  function send(opCode: number, data: unknown): void {
    try {
      s.sendMatchState(match.match_id, opCode, JSON.stringify(data ?? null));
    } catch {} // eslint-disable-line no-empty
  }

  /** Applies a received START: derive this client's seat, then mark started. */
  const applyStart = (order: string[]): void => {
    if (handle.started) return;
    handle.order = order;
    handle.seat = order.indexOf(selfId);
    if (handle.seat < 0) {
      fireClose();
      return;
    }
    handle.started = true;
    net.seat = handle.seat;
    net.players = order.length;
    fireLobby();
  };

  s.onmatchdata = (d: MatchData): void => {
    if (d.match_id !== match.match_id) return;
    const text = d.data ? new TextDecoder().decode(d.data) : '';
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (d.op_code >= SYS_OP_BASE) {
      if (role !== 'guest') return;
      if (d.op_code === OP_SYS_LOBBY) {
        const m = data as { hostId?: string; count?: number } | null;
        if (m?.hostId) handle.hostId = m.hostId;
        if (typeof m?.count === 'number') handle.remoteCount = Math.min(capacity, m.count);
        fireLobby();
      } else if (d.op_code === OP_SYS_START) {
        const m = data as { order?: string[] } | null;
        if (Array.isArray(m?.order)) applyStart(m.order);
      }
      return;
    }

    const msg: MatchMessage = { opCode: d.op_code, data, senderId: d.presence?.session_id ?? '' };
    for (const cb of messageCbs) cb(msg);
  };

  s.onmatchpresence = (e: MatchPresenceEvent): void => {
    if (e.match_id !== match.match_id) return;
    const joins = (e.joins ?? []).filter((p) => p.session_id !== selfId).map((p) => p.session_id);
    const leaves = (e.leaves ?? []).filter((p) => p.session_id !== selfId).map((p) => p.session_id);
    if (!joins.length && !leaves.length) return;

    if (role === 'host') {
      if (!handle.started) {
        for (const id of joins) if (!joinOrder.includes(id)) joinOrder.push(id);
        for (const id of leaves) {
          const i = joinOrder.indexOf(id);
          if (i >= 0) joinOrder.splice(i, 1);
        }
        broadcastLobby();
        fireLobby();
      } else {
        for (const id of leaves) {
          const seat = handle.order.indexOf(id);
          if (seat > 0) for (const cb of peerLeaveCbs) cb(seat);
        }
        if (capacity === 2 && leaves.length) fireClose();
      }
      return;
    }

    if (leaves.includes(handle.hostId)) {
      fireClose();
      return;
    }
    if (handle.started) {
      for (const id of leaves) {
        const seat = handle.order.indexOf(id);
        if (seat >= 0) for (const cb of peerLeaveCbs) cb(seat);
      }
    }
  };

  const net: NetMatch = {
    role,
    matchId: match.match_id,
    code,
    capacity,
    selfId,
    seat: -1,
    players: 0,
    startMatch() {
      if (role !== 'host' || handle.started) return;
      const order = [selfId, ...joinOrder].slice(0, capacity);
      send(OP_SYS_START, { order });
      applyStart(order);
    },
    lobby: snapshot,
    send,
    onMessage(cb) {
      messageCbs.push(cb);
    },
    onLobby(cb) {
      lobbyCbs.push(cb);
    },
    onPeerLeave(cb) {
      peerLeaveCbs.push(cb);
    },
    onClose(cb) {
      closeCbs.push(cb);
    },
    async leave() {
      try {
        await s.leaveMatch(match.match_id);
      } catch {} // eslint-disable-line no-empty
    },
  };
  return net;
}

/**
 * Creates a new session: generates a code, opens the named match and returns the
 * host-side {@link NetMatch}. Rejects if the backend is unreachable.
 *
 * @param capacity Maximum human seats (default 2 for 1-v-1 games).
 * @param scope Internal game/session namespace. The visible code stays short.
 */
export async function createSession(capacity = 2, scope?: string): Promise<NetMatch> {
  const code = generateCode();
  const { match } = await createNamedMatch(scopedMatchName(scope, code));
  return buildNetMatch(match, code, 'host', capacity);
}

/**
 * Joins an existing session by its code (the match name). Returns the guest-side
 * {@link NetMatch}. Rejects if the backend is unreachable.
 *
 * @param capacity Maximum human seats (must match the host's).
 * @param scope Internal game/session namespace. Must match the host's scope.
 */
export async function joinSession(code: string, capacity = 2, scope?: string): Promise<NetMatch> {
  const normalized = code.trim().toUpperCase();
  const { socket: s, match } = await createNamedMatch(scopedMatchName(scope, normalized));
  const selfId = match.self?.session_id ?? '';

  if (!hasRemotePresence(match.presences, selfId)) {
    try {
      await s.leaveMatch(match.match_id);
    } catch {} // eslint-disable-line no-empty
    throw new Error('Session not found');
  }

  return buildNetMatch(match, normalized, 'guest', capacity);
}
