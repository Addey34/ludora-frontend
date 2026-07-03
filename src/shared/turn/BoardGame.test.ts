import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BoardGame } from './BoardGame.js';
import { TurnRules } from './turnGame.js';
import { NetMatch, MatchMessage, MatchRole } from '../net/match.js';

/* --- A trivial 2-seat game used purely to drive the coordinator ------------ */
interface ToyState {
  current: number;
  played: number[];
  done: boolean;
}
interface ToyMove {
  v: number;
}

const toyRules: TurnRules<ToyState, ToyMove> = {
  seats: 2,
  initialState: () => ({ current: 0, played: [], done: false }),
  currentSeat: (s) => s.current,
  legalMoves: (s) => (s.done ? [] : [{ v: 1 }, { v: 2 }]),
  applyMove: (s, m) => ({
    current: 1 - s.current,
    played: [...s.played, m.v],
    done: s.played.length + 1 >= 3,
  }),
  winner: (s) => (s.done ? 0 : null),
};

/** A fake relayed match capturing what the game sends and letting tests inject. */
class FakeNet implements NetMatch {
  matchId = 'm';
  code = 'TEST';
  capacity = 2;
  selfId = 'self';
  seat = 0;
  players = 2;
  sent: { op: number; data: unknown }[] = [];
  private msgCb: ((m: MatchMessage) => void) | null = null;

  constructor(public role: MatchRole) {}
  startMatch(): void {}
  lobby() {
    return { count: 2, capacity: 2, started: true };
  }
  send(op: number, data: unknown): void {
    this.sent.push({ op, data });
  }
  onMessage(cb: (m: MatchMessage) => void): void {
    this.msgCb = cb;
  }
  onLobby(): void {}
  onPeerLeave(): void {}
  onClose(): void {}
  async leave(): Promise<void> {}
  /** Test helper: simulate a message arriving from a peer. */
  deliver(opCode: number, data: unknown): void {
    this.msgCb?.({ opCode, data, senderId: 'peer' });
  }
}

/** Exposes the protected surface so tests can drive the coordinator directly. */
class ToyGame extends BoardGame<ToyState, ToyMove> {
  constructor() {
    super({ storageKey: 'toy-test' });
  }
  protected get rules(): TurnRules<ToyState, ToyMove> {
    return toyRules;
  }
  protected moveEquals(a: ToyMove, b: ToyMove): boolean {
    return a.v === b.v;
  }
  protected decideBotMove(legal: ToyMove[]): ToyMove {
    return legal[0]!;
  }
  protected renderState(): void {}
  protected updateTurnDisplay(): void {}
  initialize(): void {}
  handleInput(): void {}

  // Test seams
  get board(): ToyState {
    return this.game;
  }
  setNet(net: FakeNet | null, mode: 'solo' | 'net', mySeat = 0): void {
    this.net = net;
    this.mode = mode;
    this.mySeat = mySeat;
    if (net) net.onMessage((m) => this.handleNetMessage(m));
  }
  enableHuman(): void {
    this.awaitingHuman = true;
  }
  awaitSeat(seat: number): void {
    this.pendingSeat = seat;
  }
  callPlayLocal(m: ToyMove): void {
    this.playLocalMove(m);
  }
  callCommit(m: ToyMove): void {
    this.commitMove(m);
  }
  deliverNet(msg: MatchMessage): void {
    this.handleNetMessage(msg);
  }
}

describe('BoardGame coordinator', () => {
  let game: ToyGame;

  beforeEach(() => {
    vi.useFakeTimers();
    game = new ToyGame();
    game.initialize();
  });
  afterEach(() => {
    game.stop();
    vi.useRealTimers();
  });

  it('the host broadcasts the authoritative snapshot after a move', () => {
    const net = new FakeNet('host');
    game.setNet(net, 'net');
    game.callCommit({ v: 2 });
    const snap = net.sent.find((s) => s.op === 1); // OP_STATE
    expect(snap).toBeDefined();
    expect((snap!.data as { game: ToyState }).game.played).toEqual([2]);
    expect((snap!.data as { move: ToyMove }).move).toEqual({ v: 2 });
  });

  it('a guest relays its move instead of applying it', () => {
    const net = new FakeNet('guest');
    net.seat = 1;
    game.setNet(net, 'net', 1);
    game.enableHuman();
    game.callPlayLocal({ v: 1 });
    // The guest must not mutate the authoritative state locally…
    expect(game.board.played).toEqual([]);
    // …it sends an OP_MOVE with its seat and move.
    const move = net.sent.find((s) => s.op === 2);
    expect(move?.data).toEqual({ seat: 1, move: { v: 1 } });
  });

  it('the host rejects an out-of-turn guest move but applies a legal one', () => {
    const net = new FakeNet('host');
    game.setNet(net, 'net');
    // Not awaiting seat 1 yet → ignored.
    game.deliverNet({ opCode: 2, data: { seat: 1, move: { v: 1 } }, senderId: 'p' });
    expect(game.board.played).toEqual([]);
    // Now awaiting seat 1's move → the legal move is applied authoritatively.
    game.awaitSeat(1);
    // seat 1 only plays on its turn: advance current to 1 first.
    game.callCommit({ v: 1 }); // seat 0 plays, current → 1
    game.awaitSeat(1);
    game.deliverNet({ opCode: 2, data: { seat: 1, move: { v: 2 } }, senderId: 'p' });
    expect(game.board.played).toEqual([1, 2]);
  });

  it('a guest adopts a snapshot pushed by the host', () => {
    const net = new FakeNet('guest');
    net.seat = 1;
    game.setNet(net, 'net', 1);
    const hostState: ToyState = { current: 1, played: [5], done: false };
    game.deliverNet({ opCode: 1, data: { game: hostState, move: { v: 5 } }, senderId: 'host' });
    expect(game.board.played).toEqual([5]);
    // It is now the guest's seat (1) → it may play.
    expect(game.getState().isGameOver).toBe(false);
  });
});
