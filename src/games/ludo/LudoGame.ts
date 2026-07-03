import { BoardGame } from '../../shared/turn/BoardGame.js';
import { TurnRules } from '../../shared/turn/turnGame.js';
import { MatchMessage } from '../../shared/net/match.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { playSound } from '../../shared/fx/sound.js';
import { setupSettingsPanel, SettingsPanelHandle } from '../../shared/ui/settingsPanel.js';
import { createDice, DiceHandle, DiceCorner } from '../../shared/ui/dice.js';
import { setupHud } from '../../shared/ui/hud.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import {
  LudoState,
  LudoMove,
  rules as ludoRules,
  eqMove,
  initialState,
  applyRoll,
  legalMoves,
  applyMove,
  passTurn,
  SEATS,
  PAWNS,
  STABLE,
  FINISH,
} from './ludo.js';
import { decideMove } from './ludoBot.js';
import { RING_PATH, HOME_LANES, STABLES, pawnCell, GRID, Cell } from './board.js';

/** Particle colours per seat (matches --ludo-seat-N tokens). */
const SEAT_FX_COLORS: string[][] = [
  ['#ef4444', '#f87171', '#fca5a5'],
  ['#3b82f6', '#60a5fa', '#93c5fd'],
  ['#f97316', '#fb923c', '#fdba74'],
  ['#22c55e', '#4ade80', '#86efac'],
];
/** Board corner of each seat's stable (matches the base corners in buildBoard),
 *  so the rolled die parks in the stable of whoever is playing. */
const SEAT_CORNERS: DiceCorner[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
const SVGNS = 'http://www.w3.org/2000/svg';

/** Pacing (ms) so a human can follow the dice and the bots' moves. */
const BOT_THINK = 500;
const BOT_MOVE_DELAY = 650;
const PASS_DELAY = 750;
const NEXT_TURN_DELAY = 300;
/** Seconds the human has to act before the move is played automatically. */
const TURN_SECONDS = 10;

/**
 * Ludo controller: drives the turn-based loop (roll → choose → apply → next),
 * playable **solo** (one human + bots) or **online for up to 4 players** over the
 * relay. It renders the cross board and handles the player clicking a horse.
 *
 * The roll is the shared animated {@link createDice} widget. It does **not** use
 * the engine's `requestAnimationFrame` loop (a board game has no continuous
 * simulation): the turn flow is an async sequence paced by timers, and a
 * generation counter cancels a stale flow on reset.
 *
 * Networking is **host-authoritative** (the natural fit for `TurnRules`): the
 * host owns the single `LudoState`, runs the loop (rolling, and playing every bot
 * / empty seat), and broadcasts the state after each change; guests render it and
 * send only their own move ({@link OP_MOVE}), which the host validates against the
 * legal moves before applying. Empty seats (and guests who leave) are filled by
 * bots, so the game always completes.
 */
export class LudoGame extends BoardGame<LudoState, LudoMove> {
  protected nextTurnDelay = NEXT_TURN_DELAY;
  protected turnSeconds = TURN_SECONDS;

  private difficulty: Difficulty = 'medium';
  private settings: SettingsPanelHandle | null = null;
  /** Host-side: the remote roll we are awaiting (its seat + settle callback). */
  private pendingRoll: { seat: number; resolve: () => void } | null = null;
  /** Host-side: a roll request that arrived before we started waiting (fast click). */
  private bufferedRollSeat: number | null = null;
  /** Guest-side: bumped on every snapshot to cancel a stale die-roll prompt. */
  private guestRollGen = 0;

  private fx: ParticleSystem | null = null;

  private boardEl: HTMLElement | null = null;
  private playersEl: HTMLElement | null = null;
  private dice: DiceHandle | null = null;
  /** The four player badges, indexed by seat. */
  private playerEls: HTMLElement[] = [];
  /** The faint seat label inside each base, indexed by seat. */
  private baseNumEls: HTMLElement[] = [];
  /** `pawnEls[seat][pawn]` — the DOM token of each horse. */
  private pawnEls: HTMLElement[][] = [];

  /** The legal moves currently offered to the local human (its clickable horses). */
  private humanMoves: LudoMove[] = [];

  constructor() {
    super({ storageKey: 'ludo' });
  }

  protected get rules(): TurnRules<LudoState, LudoMove> {
    return ludoRules;
  }
  protected moveEquals(a: LudoMove, b: LudoMove): boolean {
    return eqMove(a, b);
  }
  protected decideBotMove(legalMoves: LudoMove[]): LudoMove {
    return decideMove(this.game, legalMoves, this.difficulty);
  }

  initialize(): void {
    this.fx = new ParticleSystem();
    this.boardEl = document.getElementById('board');
    this.playersEl = document.getElementById('ludoPlayers');
    this.hud = setupHud([{ key: 'time', icon: 'clock', label: 'Time' }]);

    this.buildBoard();
    this.buildPlayers();
    if (this.boardEl) this.dice = createDice(this.boardEl);

    this.settings = setupSettingsPanel([
      {
        id: 'difficulty',
        label: 'Bots',
        choices: [
          { label: 'Easy', value: 'easy' },
          { label: 'Medium', value: 'medium' },
          { label: 'Hard', value: 'hard' },
        ],
        value: this.difficulty,
        onChange: (value) => {
          this.difficulty = value as Difficulty;
        },
      },
    ]);
    this.setupVersus(SEATS);

    this.game = initialState();
    this.renderState();
  }

  /** Builds the static board (bases, centre triangles, cells, slots, tokens). */
  private buildBoard(): void {
    const board = this.boardEl;
    if (!board) return;
    board.innerHTML = '';

    const div = (className: string): HTMLDivElement => {
      const el = document.createElement('div');
      el.className = className;
      return el;
    };

    const baseCorners: Cell[] = [
      [0, 0],
      [0, 9],
      [9, 9],
      [9, 0],
    ];
    this.baseNumEls = [];
    baseCorners.forEach((corner, seat) => {
      const base = div(`ludo-base ludo-base--s${seat}`);
      this.place(base, corner, 6, 6);
      const num = document.createElement('span');
      num.className = 'ludo-base-num';
      num.textContent = this.seatLabel(seat);
      num.style.color = `var(--ludo-seat-${seat})`;
      base.appendChild(num);
      board.append(base);
      this.baseNumEls[seat] = num;
    });

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'ludo-center');
    this.place(svg, [6, 6], 3, 3);
    const triangles: [string, number][] = [
      ['0,0 0,100 50,50', 0],
      ['0,0 100,0 50,50', 1],
      ['100,0 100,100 50,50', 2],
      ['0,100 100,100 50,50', 3],
    ];
    for (const [points, seat] of triangles) {
      const poly = document.createElementNS(SVGNS, 'polygon');
      poly.setAttribute('points', points);
      poly.setAttribute('class', `ludo-center-tri ludo-center-tri--s${seat}`);
      svg.appendChild(poly);
    }
    board.append(svg);

    RING_PATH.forEach((cell, i) => {
      const start = i % 13 === 0;
      const cls = start ? `ludo-cell ludo-cell--start ludo-cell--s${i / 13}` : 'ludo-cell';
      const el = div(cls);
      this.place(el, cell);
      board.append(el);
    });
    HOME_LANES.forEach((lane, seat) => {
      for (const cell of lane) {
        const el = div(`ludo-cell ludo-cell--home ludo-cell--s${seat}`);
        this.place(el, cell);
        board.append(el);
      }
    });
    STABLES.forEach((slots, seat) => {
      for (const cell of slots) {
        const el = div(`ludo-slot ludo-slot--s${seat}`);
        this.place(el, cell);
        board.append(el);
      }
    });

    this.pawnEls = [];
    for (let seat = 0; seat < SEATS; seat++) {
      const row: HTMLElement[] = [];
      for (let pawn = 0; pawn < PAWNS; pawn++) {
        const el = div(`ludo-pawn ludo-pawn--s${seat}`);
        el.addEventListener('click', () => this.onPawnClick(seat, pawn));
        board.append(el);
        row.push(el);
      }
      this.pawnEls.push(row);
    }
  }

  /** Positions an element on the grid (top-left cell + optional cell span), in %. */
  private place(el: HTMLElement | SVGElement, cell: Cell, rows = 1, cols = 1): void {
    const size = 100 / GRID;
    el.style.top = `${cell[0] * size}%`;
    el.style.left = `${cell[1] * size}%`;
    el.style.width = `${cols * size}%`;
    el.style.height = `${rows * size}%`;
  }

  /** Builds the four coloured, compactly-labelled player badges (see seatLabel). */
  private buildPlayers(): void {
    if (!this.playersEl) return;
    this.playersEl.innerHTML = '';
    this.playerEls = [];
    for (let seat = 0; seat < SEATS; seat++) {
      const chip = document.createElement('span');
      chip.className = 'ludo-player';
      chip.style.setProperty('--seat-color', `var(--ludo-seat-${seat})`);
      const dot = document.createElement('span');
      dot.className = 'ludo-player-dot';
      const label = document.createElement('span');
      label.textContent = this.seatLabel(seat) + (seat === this.mySeat ? ' (me)' : '');
      chip.append(dot, label);
      this.playersEl.append(chip);
      this.playerEls.push(chip);
    }
    this.updateBaseLabels();
  }

  /** Refreshes the faint seat label shown inside each base. */
  private updateBaseLabels(): void {
    for (let seat = 0; seat < SEATS; seat++) {
      const el = this.baseNumEls[seat];
      if (el) el.textContent = this.seatLabel(seat);
    }
  }

  /**
   * Short label for a seat, kept compact (used by both the top-bar badges and the
   * in-base tag): "P1"…"P4" for humans, "bot1"…"botN" for the bot-filled seats.
   * The badge appends "(you)" for the local seat. Once Google sign-in carries
   * player names, the human branch can return the player's name instead of "P{n}".
   */
  private seatLabel(seat: number): string {
    if (this.humanSeats.has(seat)) return `P${seat + 1}`;
    return `Bot ${seat - this.humanSeats.size + 1}`;
  }

  /** Moves the horse tokens to match the state, and refreshes the status line. */
  protected renderState(): void {
    const size = 100 / GRID;
    const pawnSize = size * 0.66;
    for (let seat = 0; seat < SEATS; seat++) {
      for (let pawn = 0; pawn < PAWNS; pawn++) {
        const el = this.pawnEls[seat]?.[pawn];
        if (!el) continue;
        const pos = this.pawnPosition(seat, pawn, size, pawnSize);
        el.style.top = `${pos.top}%`;
        el.style.left = `${pos.left}%`;
        el.style.width = `${pawnSize}%`;
        el.style.height = `${pawnSize}%`;
        const movable =
          this.awaitingHuman &&
          seat === this.mySeat &&
          this.humanMoves.some((m) => m.pawn === pawn);
        el.classList.toggle('is-movable', movable);
      }
    }

    for (let seat = 0; seat < SEATS; seat++) {
      const active = this.game.winner === null && this.game.current === seat;
      this.playerEls[seat]?.classList.toggle('is-active', active);
    }
  }

  /** Top-left (%) of a horse token at distance `d`, arranging finished ones in their triangle. */
  private pawnPositionAt(
    seat: number,
    pawn: number,
    d: number,
    size: number,
    pawnSize: number
  ): { top: number; left: number } {
    if (d === FINISH) {
      const top0 = 6 * size;
      const left0 = 6 * size;
      const anchors = [
        { x: left0 + 0.55 * size, y: top0 + 1.5 * size },
        { x: left0 + 1.5 * size, y: top0 + 0.55 * size },
        { x: left0 + 2.45 * size, y: top0 + 1.5 * size },
        { x: left0 + 1.5 * size, y: top0 + 2.45 * size },
      ];
      const a = anchors[seat]!;
      const dx = ((pawn % 2) - 0.5) * 0.62 * size;
      const dy = (Math.floor(pawn / 2) - 0.5) * 0.62 * size;
      return { top: a.y + dy - pawnSize / 2, left: a.x + dx - pawnSize / 2 };
    }
    const cell = pawnCell(seat, pawn, d);
    return {
      top: cell[0] * size + (size - pawnSize) / 2,
      left: cell[1] * size + (size - pawnSize) / 2,
    };
  }

  /** Top-left (%) of a horse token from current game state. */
  private pawnPosition(
    seat: number,
    pawn: number,
    size: number,
    pawnSize: number
  ): { top: number; left: number } {
    return this.pawnPositionAt(seat, pawn, this.game.pawns[seat][pawn]!, size, pawnSize);
  }

  /** Steps a pawn element cell by cell from `dFrom+1` to `dTo` using CSS transitions.
   *  Aborts cleanly on reset (gen change). */
  private async animatePawnMove(
    seat: number,
    pawn: number,
    dFrom: number,
    dTo: number
  ): Promise<void> {
    const el = this.pawnEls[seat]?.[pawn];
    if (!el || dFrom === STABLE || dTo <= dFrom) return;
    const size = 100 / GRID;
    const pawnSize = size * 0.66;
    const gen = this.gen;
    const STEP_MS = 210;
    for (let d = dFrom + 1; d <= dTo; d++) {
      if (gen !== this.gen) return;
      const pos = this.pawnPositionAt(seat, pawn, d, size, pawnSize);
      el.style.top = `${pos.top}%`;
      el.style.left = `${pos.left}%`;
      await this.animDelay(STEP_MS);
    }
  }

  private animDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * One full turn (host/solo authority): roll (clicked by the local human, auto
   * for everyone else), then act — local human, remote guest, or bot.
   */
  protected async runTurn(): Promise<void> {
    const gen = this.gen;
    if (!this.state.isRunning) return;
    this.awaitingHuman = false;
    this.humanMoves = [];
    this.pendingSeat = null;
    this.dice?.hide();
    this.renderState();

    const seat = this.game.current;
    this.setDiceAccent();
    if (seat === this.mySeat) {
      await this.humanTimed(this.dice?.awaitRoll() ?? Promise.resolve());
    } else if (this.isRemoteHuman(seat)) {
      await this.awaitRemoteRoll(seat);
    } else {
      await this.delay(BOT_THINK);
    }
    if (gen !== this.gen || !this.state.isRunning) return;

    const value = 1 + Math.floor(Math.random() * 6);
    this.game = applyRoll(this.game, value);
    this.broadcast(BoardGame.OP_ROLL, { value });
    playSound('dice');
    await this.dice?.show(value);
    if (gen !== this.gen || !this.state.isRunning) return;
    this.broadcastState();

    const moves = legalMoves(this.game);
    if (moves.length === 0) {
      await this.delay(PASS_DELAY);
      if (gen !== this.gen || !this.state.isRunning) return;
      this.game = passTurn(this.game);
      this.broadcastState();
      void this.runTurn();
      return;
    }

    if (seat === this.mySeat) {
      this.parkDice();
      this.awaitingHuman = true;
      this.humanMoves = moves;
      this.renderState();
      this.startCountdown(() => {
        if (this.awaitingHuman)
          this.commitMove(decideMove(this.game, this.humanMoves, this.difficulty));
      });
    } else if (this.isRemoteHuman(seat)) {
      this.parkDice();
      this.pendingSeat = seat;
      this.humanMoves = moves;
      this.startCountdown(() => this.resolvePending(decideMove(this.game, moves, this.difficulty)));
    } else {
      await this.delay(BOT_MOVE_DELAY);
      if (gen !== this.gen || !this.state.isRunning) return;
      this.commitMove(decideMove(this.game, moves, this.difficulty));
    }
  }

  /** Player clicked a horse: hand it to the coordinator (plays it or relays it). */
  private onPawnClick(seat: number, pawn: number): void {
    if (!this.awaitingHuman || seat !== this.mySeat) return;
    if (!this.humanMoves.some((m) => m.pawn === pawn)) return;
    this.playLocalMove({ pawn });
  }

  /**
   * Host: waits for a remote seat to click its die ({@link OP_ROLL_REQUEST}); a
   * countdown auto-rolls so an idle or vanished guest never hangs the game.
   * The state snapshot sent at the end of the previous turn already told the guest
   * it is its turn to roll (current seat, no die yet), so it shows the prompt.
   */
  private awaitRemoteRoll(seat: number): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        this.pendingRoll = null;
        this.stopCountdown();
        resolve();
      };
      if (this.bufferedRollSeat === seat) {
        this.bufferedRollSeat = null;
        finish();
        return;
      }
      this.pendingRoll = { seat, resolve: finish };
      this.startCountdown(finish);
    });
  }

  /** Host: a guest clicked its die — let the authoritative roll proceed. */
  private onGuestRollRequest(seat: number | undefined): void {
    if (typeof seat !== 'number') return;
    if (this.game.current !== seat || this.game.die !== null) return;
    if (this.pendingRoll?.seat === seat) this.pendingRoll.resolve();
    else this.bufferedRollSeat = seat;
  }

  /** Applies a move, animates the pawn case-by-case, then ends the game or schedules the next turn. */
  protected async commitMove(move: LudoMove): Promise<void> {
    this.stopCountdown();
    this.dice?.hide();
    const movingSeat = this.game.current;
    const dFrom = this.game.pawns[movingSeat][move.pawn]!;
    const gen = this.gen;
    this.game = applyMove(this.game, move);
    const dTo = this.game.pawns[movingSeat][move.pawn]!;
    this.awaitingHuman = false;
    this.humanMoves = [];
    this.pendingSeat = null;
    this.broadcastState();

    await this.animatePawnMove(movingSeat, move.pawn, dFrom, dTo);
    if (gen !== this.gen || !this.state.isRunning) return;

    this.renderState();

    if (this.game.winner !== null) {
      playSound('win');
      if (this.fx) {
        const winEl = this.pawnEls[movingSeat]?.[move.pawn];
        if (winEl) {
          const rect = winEl.getBoundingClientRect();
          this.fx.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
            count: 50,
            speed: 5,
            spread: Math.PI * 2,
            colors: [...(SEAT_FX_COLORS[movingSeat] ?? []), '#ffd700', '#ffffff'],
            gravity: 0.06,
            duration: 1400,
            size: 6,
          });
        }
        const boardRect = this.boardEl?.getBoundingClientRect();
        if (boardRect) {
          this.fx.emit(boardRect.left + boardRect.width / 2, boardRect.top + boardRect.height / 2, {
            count: 30,
            speed: 6,
            spread: Math.PI * 2,
            colors: ['#ffd700', '#ff6b35', '#ffffff', '#22c55e'],
            gravity: 0.06,
            duration: 1600,
          });
        }
      }
      this.clearTimer();
      this.gameOver();
      return;
    }

    if (this.game.pawns[movingSeat][move.pawn] > 0) playSound('move');
    if (this.fx && this.game.pawns[movingSeat][move.pawn] > 0) {
      const el = this.pawnEls[movingSeat]?.[move.pawn];
      if (el) {
        const rect = el.getBoundingClientRect();
        this.fx.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
          count: 6,
          speed: 1.5,
          spread: Math.PI / 2,
          angle: -Math.PI / 2,
          colors: SEAT_FX_COLORS[movingSeat] ?? ['#ffffff'],
          size: 3,
          duration: 350,
          gravity: 0.1,
        });
      }
    }

    this.timer = setTimeout(() => void this.runTurn(), NEXT_TURN_DELAY);
  }

  /** Host-side: a seated guest left — its seat becomes a bot from now on. */
  protected onPeerLeave(seat: number): void {
    super.onPeerLeave(seat);
    if (this.pendingRoll?.seat === seat) this.pendingRoll.resolve();
  }

  /** Rebuilds the player badges when the roster changes (session start/end). */
  protected onRosterChanged(): void {
    this.buildPlayers();
  }

  /** Multiplayer freezes the solo-only settings (bot difficulty). */
  protected onNetActiveChanged(active: boolean): void {
    this.settings?.setDisabled(active);
  }

  /** Routes the dice op codes on top of the standard turn protocol. */
  protected handleGameMessage(msg: MatchMessage): void {
    if (this.net?.role === 'host') {
      if (msg.opCode === BoardGame.OP_ROLL_REQUEST) {
        const d = msg.data as { seat?: number } | null;
        this.onGuestRollRequest(d?.seat);
      }
      return;
    }
    if (msg.opCode === BoardGame.OP_ROLL) {
      const d = msg.data as { value?: number } | null;
      if (d?.value) void this.dice?.show(d.value);
    }
  }

  /**
   * Guest: adopts the host's snapshot, then drives its own turn — prompt the die
   * when it is up and hasn't rolled yet, or highlight movable horses once it has.
   */
  protected applyNetState(game: LudoState, _move: LudoMove | null): void {
    this.game = game;
    this.setDiceAccent();
    this.guestRollGen++;

    if (game.winner !== null) {
      this.awaitingHuman = false;
      this.humanMoves = [];
      this.dice?.hide();
      this.renderState();
      this.gameOver();
      return;
    }

    const myTurn = game.current === this.mySeat;
    if (myTurn && game.die === null) {
      this.awaitingHuman = false;
      this.humanMoves = [];
      this.renderState();
      this.promptGuestRoll();
      return;
    }
    if (myTurn) {
      this.awaitingHuman = true;
      this.humanMoves = legalMoves(game);
      this.parkDice();
      this.renderState();
      return;
    }
    this.awaitingHuman = false;
    this.humanMoves = [];
    if (game.die !== null) this.parkDice();
    else this.dice?.hide();
    this.renderState();
  }

  /** Guest: show the die prompt; clicking it asks the host to roll for this seat. */
  private promptGuestRoll(): void {
    const gen = this.guestRollGen;
    void (this.dice?.awaitRoll() ?? Promise.resolve()).then(() => {
      if (gen !== this.guestRollGen || this.mode !== 'net') return;
      this.net?.send(BoardGame.OP_ROLL_REQUEST, { seat: this.mySeat });
    });
  }

  /** Resolves when `action` (the human's click) settles OR the timer fires. */
  private humanTimed(action: Promise<void>): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        this.stopCountdown();
        resolve();
      };
      void action.then(finish);
      this.startCountdown(finish);
    });
  }

  /** Parks the die into the stable of the seat currently playing. */
  private parkDice(): void {
    this.dice?.park(SEAT_CORNERS[this.game.current]);
  }

  /** Tints the die's outline with the colour of the seat currently playing. */
  private setDiceAccent(): void {
    this.dice?.setAccent(`var(--ludo-seat-${this.game.current})`);
  }

  stop(): void {
    super.stop();
    this.pendingRoll?.resolve();
    this.pendingRoll = null;
    this.bufferedRollSeat = null;
  }

  /** Clears the dice widget and roll bookkeeping between rounds. */
  protected onRoundReset(): void {
    this.pendingRoll?.resolve();
    this.pendingRoll = null;
    this.bufferedRollSeat = null;
    this.guestRollGen++;
    this.humanMoves = [];
    this.dice?.hide();
  }

  protected getGameOverTitle(): string {
    return this.game.winner === this.mySeat ? 'You win! 🏆' : 'You lose…';
  }

  protected getGameOverContent(): string {
    const w = this.game.winner ?? 0;
    return w === this.mySeat
      ? '<p>Well done, your 4 horses are home in the center!</p>'
      : `<p>${this.seatLabel(w)} brought all 4 horses home.</p>`;
  }

  /** The turn is shown by the active player badge (see {@link renderState}). */
  protected updateTurnDisplay(): void {}

  handleInput(_event: KeyboardEvent): void {}
}
