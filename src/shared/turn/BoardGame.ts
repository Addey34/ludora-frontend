import { GameEngine, GameConfig } from '../engine/GameEngine.js';
import { dismissStartOverlay } from '../ui/startOverlay.js';
import { CountdownTimer } from '../ui/countdownTimer.js';
import { GameOverlayButton } from '../ui/gameOverlay.js';
import { TurnRules } from './turnGame.js';
import { NetMatch, MatchMessage } from '../net/match.js';
import { setupMultiplayerPanel, MultiplayerHandle } from '../versus/multiplayerPanel.js';

/**
 * Host-authoritative, turn-based controller shared by every board game
 * (Connect 4, Ludo, Goose, Battleship). It is the turn-based counterpart of the
 * real-time {@link GameEngine} it extends: instead of a `requestAnimationFrame`
 * loop it drives an async **turn sequence** (via `setTimeout`), guarded by a
 * generation counter so a stale flow can never mutate a fresh game.
 *
 * What lives here (previously copy-pasted in each of the four games, ~150 lines
 * apiece): the `solo`/`net` mode + seat bookkeeping, the per-turn countdown, the
 * whole **relayed networking** — authoritative state broadcast ({@link OP_STATE}),
 * guest move relay ({@link OP_MOVE}), rematch ({@link OP_RESTART}) and timer
 * ticks ({@link OP_TIMER}) — plus the versus game-over overlay and the lobby
 * wiring. Legality is always gated through the game's {@link TurnRules}, so an
 * illegal or out-of-turn (remote or bot) move can never corrupt the state.
 *
 * A concrete game supplies only what is genuinely specific: its `rules`, its DOM
 * rendering ({@link renderState}/{@link updateTurnDisplay}), a bot
 * ({@link decideBotMove}) and its post-move visuals ({@link onMoveCommitted}).
 * The default {@link runTurn} covers deterministic games (Connect 4, Battleship's
 * combat); dice games (Ludo, Goose) override it to insert their roll phase while
 * reusing every helper here. Extra op codes (dice roll, ship placement) are
 * routed to {@link handleGameMessage}.
 *
 * @typeParam S board state (opaque, JSON-serialisable — travels over the wire).
 * @typeParam M a single move (a small value object: `{col}`, `{pawn}`, `{row,col}`).
 */
export abstract class BoardGame<S, M> extends GameEngine {
  /** host → all: `{ game, move }` authoritative snapshot (+ the move to animate). */
  protected static readonly OP_STATE = 1;
  /** guest → host: `{ seat, move }` the guest's chosen move. */
  protected static readonly OP_MOVE = 2;
  /** host → all: start a fresh round (rematch). */
  protected static readonly OP_RESTART = 3;
  /** host → all: `{ t }` current turn countdown (null clears it). */
  protected static readonly OP_TIMER = 4;
  /** host → all: `{ ... }` dice roll to animate (dice games). */
  protected static readonly OP_ROLL = 5;
  /** guest → host: `{ seat }` "I clicked the die, roll for me" (dice games). */
  protected static readonly OP_ROLL_REQUEST = 6;
  /** guest → host: `{ ... }` ship placement, phase-specific (Battleship). */
  protected static readonly OP_READY = 7;

  /** Pause before a bot plays, so a human can follow it. */
  protected botDelay = 550;
  /** Gap between two turns. */
  protected nextTurnDelay = 250;
  /** Beat after the last move before the result overlay. */
  protected endDelay = 550;
  /** Seconds a seat has before its move is played automatically. */
  protected turnSeconds = 20;

  protected rematchLabel = 'Rematch';
  protected quitLabel = 'Quit';
  protected waitingForRematchText = 'Waiting for a rematch from the host…';

  /** The authoritative board state (the host owns it; guests mirror it). */
  protected game: S;
  /** `'solo'` = local human (seat 0) vs bots; `'net'` = relayed session. */
  protected mode: 'solo' | 'net' = 'solo';
  protected net: NetMatch | null = null;
  protected multiplayer: MultiplayerHandle | null = null;
  /** This client's seat (0 in solo / for the host). */
  protected mySeat = 0;
  /** Seats driven by a human (all the others are bots). */
  protected humanSeats = new Set<number>([0]);
  /** Host-side: the seat whose network move we are awaiting, or null. */
  protected pendingSeat: number | null = null;
  /** True while waiting for the local human to play. */
  protected awaitingHuman = false;

  /** Bumped on every (re)start/reset/stop to abandon any in-flight async turn. */
  protected gen = 0;
  /** The single pending `setTimeout` (bot delay, next-turn gap, end beat). */
  protected timer: ReturnType<typeof setTimeout> | null = null;
  /** The per-turn countdown (auto-plays when it hits 0). */
  protected readonly turnTimer = new CountdownTimer();

  protected constructor(config: GameConfig = {}) {
    super(config);
    this.game = this.freshGame();
  }

  /** The pure rule set; the single source of truth for legality and outcome. */
  protected abstract get rules(): TurnRules<S, M>;
  /** Equality for two moves (used to gate a relayed move against the legal set). */
  protected abstract moveEquals(a: M, b: M): boolean;
  /** Chooses one move among `legalMoves` for the current seat. */
  protected abstract decideBotMove(legalMoves: M[]): M;
  /** Draws the current state into the DOM (called after every change). */
  protected abstract renderState(): void;
  /** Refreshes the "whose turn / status" readout. */
  protected abstract updateTurnDisplay(): void;

  /**
   * Post-move visuals (host and guest alike): highlight, token animation, sound,
   * particles. Runs after the state has advanced. `move` is null for state-only
   * updates a dice game may broadcast (a roll or a pass). Default: no visuals.
   */
  protected onMoveCommitted(_move: M | null): void {}
  /** Clears per-round derived UI state (winning line, dice…). Default: nothing. */
  protected onRoundReset(): void {}
  /** The seat roster (human vs bot) changed. Games with per-seat UI (player
   *  badges) rebuild it here. Called on entering/leaving a session. Default: nothing. */
  protected onRosterChanged(): void {}
  /** A fresh board for a new round. Default: `rules.initialState()`. */
  protected freshGame(): S {
    return this.rules.initialState();
  }
  /**
   * Whether the round is over (→ result overlay). Default: some seat has won.
   * Games with a draw (Connect 4's full board) widen it.
   */
  protected isRoundOver(): boolean {
    return this.rules.winner(this.game) !== null;
  }
  /** Routes a non-standard op code (dice roll, ship placement). Default: ignore. */
  protected handleGameMessage(_msg: MatchMessage): void {}
  /** Called when entering (`true`) or leaving (`false`) a net session. Default: nothing. */
  protected onNetActiveChanged(_active: boolean): void {}

  /**
   * Wires the "Multiplayer" panel to this controller: creating/joining a session
   * hands off to {@link beginNet}, leaving/tearing down to {@link endNet}. Call
   * once from `initialize()`. No-op markup absent → `multiplayer` stays null.
   */
  protected setupVersus(capacity: number): void {
    this.multiplayer = setupMultiplayerPanel({
      capacity,
      onSessionStart: (net) => this.beginNet(net),
      onSessionEnd: () => this.endNet(),
    });
  }

  /** Starts the solo/host turn sequence (no rAF; a fresh generation each time). */
  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.state.isRunning = true;
    this.state.isGameOver = false;
    this.state.isPaused = false;
    this.gen++;
    void this.runTurn();
  }

  stop(): void {
    super.stop();
    this.gen++;
    this.clearTimer();
    this.stopCountdown();
  }

  reset(): void {
    this.gen++;
    this.clearTimer();
    this.stopCountdown();
    this.awaitingHuman = false;
    this.pendingSeat = null;
    this.game = this.freshGame();
    this.resetState();
    this.onRoundReset();
    this.updateTurnDisplay();
    this.renderState();
  }

  update(_deltaTime: number): void {}
  render(): void {
    this.renderState();
  }

  /** Whether `seat` is a remote guest the host must wait on (not its own seat). */
  protected isRemoteHuman(seat: number): boolean {
    return this.mode === 'net' && this.humanSeats.has(seat) && seat !== this.mySeat;
  }

  /** Whether this client is a relay guest (follows the host's authority). */
  protected isGuest(): boolean {
    return this.mode === 'net' && this.net?.role === 'guest';
  }

  /**
   * One turn under host/solo authority for a **deterministic** game: enable the
   * local human (with an auto-play countdown), await a remote guest, or play a
   * bot. Dice games override this to roll first, reusing every helper below.
   */
  protected async runTurn(): Promise<void> {
    const gen = this.gen;
    if (!this.state.isRunning) return;
    this.awaitingHuman = false;
    this.pendingSeat = null;
    this.updateTurnDisplay();
    if (this.isRoundOver()) return;

    const seat = this.rules.currentSeat(this.game);
    const legal = this.rules.legalMoves(this.game);

    if (seat === this.mySeat) {
      this.awaitingHuman = true;
      this.renderState();
      this.startCountdown(() => {
        if (this.awaitingHuman) this.commitMove(this.decideBotMove(legal));
      });
    } else if (this.isRemoteHuman(seat)) {
      this.pendingSeat = seat;
      this.renderState();
      this.startCountdown(() => this.resolvePending(this.decideBotMove(legal)));
    } else {
      this.renderState();
      await this.delay(this.botDelay);
      if (gen !== this.gen || !this.state.isRunning) return;
      this.commitMove(this.decideBotMove(legal));
    }
  }

  /**
   * Plays a move chosen by the **local human**: relays it as a guest (the host
   * validates and echoes back the authoritative state), or applies it directly
   * (solo/host). Call from the game's click/key handler once it has a legal move.
   */
  protected playLocalMove(move: M): void {
    if (!this.awaitingHuman) return;
    this.awaitingHuman = false;
    if (this.isGuest()) {
      this.renderState();
      this.net?.send(BoardGame.OP_MOVE, { seat: this.mySeat, move });
      return;
    }
    this.stopCountdown();
    this.commitMove(move);
  }

  /** Host: a guest's move arrived — apply it only if it is that seat's legal move. */
  protected onGuestMove(seat: number, move: M): void {
    if (this.pendingSeat === null || seat !== this.pendingSeat) return;
    if (this.rules.currentSeat(this.game) !== seat) return;
    if (!this.rules.legalMoves(this.game).some((m) => this.moveEquals(m, move))) return;
    this.resolvePending(move);
  }

  /** Host: settle an awaited remote turn with `move` (a real or an auto bot move). */
  protected resolvePending(move: M): void {
    if (this.pendingSeat === null) return;
    this.pendingSeat = null;
    this.stopCountdown();
    this.commitMove(move);
  }

  /**
   * Applies a move to the authoritative state, plays its visuals, broadcasts the
   * new snapshot, then either ends the round or schedules the next turn. Host and
   * solo only — a guest never mutates the state (it relays via {@link playLocalMove}).
   */
  protected commitMove(move: M): void {
    this.stopCountdown();
    this.game = this.rules.applyMove(this.game, move);
    this.awaitingHuman = false;
    this.pendingSeat = null;
    this.updateTurnDisplay();
    this.renderState();
    this.onMoveCommitted(move);
    this.broadcastState(move);

    if (this.isRoundOver()) {
      this.clearTimer();
      this.timer = setTimeout(() => this.gameOver(), this.endDelay);
      return;
    }
    this.timer = setTimeout(() => void this.runTurn(), this.nextTurnDelay);
  }

  /** Sends `data` on `opCode` only when acting as the authoritative host. */
  protected broadcast(opCode: number, data: unknown): void {
    if (this.mode === 'net' && this.net?.role === 'host') this.net.send(opCode, data);
  }

  /** Broadcasts the authoritative snapshot plus the move to animate (host only). */
  protected broadcastState(move: M | null = null): void {
    this.broadcast(BoardGame.OP_STATE, { game: this.game, move });
  }

  /** Enters a relayed session: seat, roster, wiring; the host runs the loop. */
  protected beginNet(net: NetMatch): void {
    this.net = net;
    this.mode = 'net';
    this.mySeat = net.seat;
    this.onNetActiveChanged(true);
    net.onMessage((msg) => this.handleNetMessage(msg));
    net.onPeerLeave((seat) => this.onPeerLeave(seat));

    dismissStartOverlay();
    this.overlay.hide();
    this.stop();
    this.humanSeats = new Set(Array.from({ length: net.players }, (_, i) => i));
    this.onRosterChanged();
    this.game = this.rules.initialState();
    this.onRoundReset();

    if (net.role === 'host') {
      this.start();
    } else {
      this.state.isRunning = true;
      this.state.isGameOver = false;
      this.state.isPaused = false;
      this.gen++;
      this.updateTurnDisplay();
      this.renderState();
    }
  }

  /** Leaves multiplayer: back to a fresh solo game against the bot. */
  protected endNet(): void {
    this.net = null;
    this.mode = 'solo';
    this.mySeat = 0;
    this.humanSeats = new Set([0]);
    this.pendingSeat = null;
    this.onRosterChanged();
    this.onNetActiveChanged(false);
    this.stop();
    this.overlay.hide();
    this.reset();
    this.start();
  }

  /** Host-side: a seated guest left — settle any turn we were awaiting from it. */
  protected onPeerLeave(seat: number): void {
    this.humanSeats.delete(seat);
    if (this.pendingSeat === seat) {
      this.resolvePending(this.decideBotMove(this.rules.legalMoves(this.game)));
    }
  }

  /** Dispatches a relayed message according to this client's role. */
  protected handleNetMessage(msg: MatchMessage): void {
    if (this.net?.role === 'host') {
      if (msg.opCode === BoardGame.OP_MOVE) {
        const d = msg.data as { seat?: number; move?: M } | null;
        if (d && typeof d.seat === 'number' && d.move != null) this.onGuestMove(d.seat, d.move);
      } else {
        this.handleGameMessage(msg);
      }
      return;
    }
    if (msg.opCode === BoardGame.OP_STATE) {
      const d = msg.data as { game?: S; move?: M | null } | null;
      if (d?.game !== undefined) this.applyNetState(d.game, d.move ?? null);
    } else if (msg.opCode === BoardGame.OP_TIMER) {
      const d = msg.data as { t?: number | null } | null;
      this.setTimerDisplay(d && typeof d.t === 'number' ? d.t : null);
    } else if (msg.opCode === BoardGame.OP_RESTART) {
      this.guestRestart();
    } else {
      this.handleGameMessage(msg);
    }
  }

  /** Guest: adopts the host's snapshot, plays the move visuals, enables its turn. */
  protected applyNetState(game: S, move: M | null): void {
    this.game = game;
    const ended = this.isRoundOver();
    this.awaitingHuman = !ended && this.rules.currentSeat(game) === this.mySeat;
    this.updateTurnDisplay();
    this.renderState();
    this.onMoveCommitted(move);
    if (ended) {
      this.clearTimer();
      this.timer = setTimeout(() => this.gameOver(), this.endDelay);
    }
  }

  /** Guest: the host called a rematch — reset and wait for fresh snapshots. */
  protected guestRestart(): void {
    this.clearTimer();
    this.overlay.hide();
    this.game = this.rules.initialState();
    this.state.isRunning = true;
    this.state.isGameOver = false;
    this.awaitingHuman = false;
    this.onRoundReset();
    this.updateTurnDisplay();
    this.renderState();
  }

  /** Host: starts a fresh online round (rematch). */
  protected hostRematch(): void {
    this.broadcast(BoardGame.OP_RESTART, null);
    this.gen++;
    this.clearTimer();
    this.stopCountdown();
    this.overlay.hide();
    this.game = this.rules.initialState();
    this.awaitingHuman = false;
    this.pendingSeat = null;
    this.resetState();
    this.onRoundReset();
    this.updateTurnDisplay();
    this.renderState();
    this.start();
  }

  /** A promise that resolves after `ms`, recorded so a reset can cancel it. */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timer = setTimeout(resolve, ms);
    });
  }

  protected clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Shows the per-turn countdown; the host broadcasts each tick so all see it. */
  protected startCountdown(onExpire: () => void): void {
    this.turnTimer.start({
      seconds: this.turnSeconds,
      onTick: (remaining) => {
        this.setTimerDisplay(remaining);
        this.broadcast(BoardGame.OP_TIMER, { t: remaining });
      },
      onExpire,
    });
  }

  protected stopCountdown(): void {
    this.turnTimer.stop();
    this.setTimerDisplay(null);
    this.broadcast(BoardGame.OP_TIMER, { t: null });
  }

  /**
   * Paints the turn timer (the host's own ticks, or a guest's relayed value).
   * Default writes the `time` HUD stat with a `.is-low` warning under 5 s; games
   * without a `time` readout can override it.
   */
  protected setTimerDisplay(remaining: number | null): void {
    this.hud?.set('time', remaining === null ? null : `${remaining}s`);
    this.hud?.toggle('time', 'is-low', remaining !== null && remaining <= 5);
  }

  /** Solo uses the default overlay; a net session shows the versus result. */
  protected onGameOver(): void {
    if (this.mode === 'net') {
      this.showNetGameOver();
      return;
    }
    super.onGameOver();
  }

  /**
   * Versus result overlay: the host offers a Rematch, both can Quit. The title
   * and body come from the game's {@link getGameOverTitle}/{@link getGameOverContent}.
   */
  protected showNetGameOver(): void {
    const isHost = this.net?.role === 'host';
    const buttons: GameOverlayButton[] = [];
    if (isHost) {
      buttons.push({
        text: this.rematchLabel,
        primary: true,
        onClick: () => {
          this.overlay.hide();
          this.hostRematch();
        },
      });
    }
    buttons.push({
      text: this.quitLabel,
      primary: !isHost,
      onClick: () => {
        this.overlay.hide();
        this.multiplayer?.leave();
      },
    });
    const waiting = !isHost ? `<p class="mp-status">${this.waitingForRematchText}</p>` : '';
    this.overlay.show({
      title: this.getGameOverTitle(),
      bodyHtml: `${this.getGameOverContent() ?? ''}${waiting}`,
      buttons,
    });
  }
}
