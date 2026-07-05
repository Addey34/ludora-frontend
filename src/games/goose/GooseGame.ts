import { BoardGame } from '../../shared/turn/BoardGame.js';
import { t } from '../../shared/i18n/i18n.js';
import { TurnRules } from '../../shared/turn/turnGame.js';
import { MatchMessage } from '../../shared/net/match.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound } from '../../shared/fx/sound.js';
import {
  setupSettingsPanel,
  SettingsPanelHandle,
  difficultyField,
} from '../../shared/ui/settingsPanel.js';
import { createDice, DiceHandle } from '../../shared/ui/dice.js';
import { setupHud } from '../../shared/ui/hud.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import {
  GooseState,
  GooseMove,
  rules as gooseRules,
  eqMove,
  initialState,
  legalMoves,
  applyMove,
  squareToCell,
  SEATS,
  FINISH,
  OFF_BOARD,
  PASS,
  GOOSE_SQUARES,
  BRIDGE_FROM,
  INN,
  WELL,
  LABYRINTH_FROM,
  PRISON,
  DEATH,
} from './goose.js';

const SEAT_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'];

const BOT_ROLL_DELAY = 300;
const PASS_DELAY = 900;
const NEXT_TURN_DELAY = 350;
const TURN_SECONDS = 15;

/** Difficulty only affects bot delay: easy is slower (more readable). */
const BOT_DELAYS: Record<Difficulty, number> = { easy: 900, medium: 500, hard: 250 };

export class GooseGame extends BoardGame<GooseState, GooseMove> {
  protected nextTurnDelay = NEXT_TURN_DELAY;
  protected turnSeconds = TURN_SECONDS;
  protected rematchLabel = 'Rematch';
  protected quitLabel = 'Quit';
  protected waitingForRematchText = 'Waiting for the host to start a rematch…';

  private difficulty: Difficulty = 'medium';
  private settings: SettingsPanelHandle | null = null;
  private pendingRoll: { seat: number; resolve: () => void } | null = null;
  private bufferedRollSeat: number | null = null;
  private guestRollGen = 0;

  private fx: ParticleSystem | null = null;

  private boardEl: HTMLElement | null = null;
  private playersEl: HTMLElement | null = null;
  private logEl: HTMLElement | null = null;
  /** cells[sq] — the DOM element for square sq (1-63). */
  private cells: (HTMLElement | null)[] = Array(64).fill(null);
  private playerEls: HTMLElement[] = [];
  private dice1: DiceHandle | null = null;
  private dice2: DiceHandle | null = null;
  /** Overrides position for a seat during step-by-step animation. */
  private animPositions: Map<number, number> = new Map();

  constructor() {
    super({ storageKey: 'goose' });
  }

  protected get rules(): TurnRules<GooseState, GooseMove> {
    return gooseRules;
  }
  protected moveEquals(a: GooseMove, b: GooseMove): boolean {
    return eqMove(a, b);
  }
  /** Goose has no move choice — the roll fully determines the move (see runTurn). */
  protected decideBotMove(legalMoves: GooseMove[]): GooseMove {
    return legalMoves[0]!;
  }

  initialize(): void {
    this.fx = new ParticleSystem();
    this.boardEl = document.getElementById('board');
    this.playersEl = document.getElementById('goosePlayers');
    this.logEl = document.getElementById('gooseLog');
    this.hud = setupHud([{ key: 'time', icon: 'clock', label: t('hudTime') }]);

    this.buildBoard();
    this.buildPlayers();

    this.settings = setupSettingsPanel([
      difficultyField(
        this.difficulty,
        (v) => {
          this.difficulty = v as Difficulty;
        },
        t('bots')
      ),
    ]);

    this.setupVersus(SEATS);

    this.game = initialState();
    this.renderState();
  }

  private buildBoard(): void {
    const board = this.boardEl;
    if (!board) return;
    board.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'goose-grid';

    for (let sq = 1; sq <= 63; sq++) {
      const { row, col } = squareToCell(sq);
      const cell = document.createElement('div');
      cell.className = 'goose-cell' + this.cellClass(sq);
      cell.style.gridRow = String(row + 1);
      cell.style.gridColumn = String(col + 1);
      cell.dataset.sq = String(sq);

      const num = document.createElement('span');
      num.className = 'goose-cell-num';
      num.textContent = String(sq);

      cell.append(num);

      // Special squares get a glyph + a hover tooltip explaining their effect,
      // so the board reads at a glance without a separate legend.
      const decor = this.cellDecor(sq);
      if (decor) {
        cell.title = decor.tip;
        const icon = document.createElement('span');
        icon.className = 'goose-cell-icon';
        icon.textContent = decor.icon;
        icon.setAttribute('aria-hidden', 'true');
        cell.append(icon);
      }

      const tokens = document.createElement('div');
      tokens.className = 'goose-cell-tokens';

      cell.append(tokens);
      grid.append(cell);
      this.cells[sq] = cell;
    }

    const diceOverlay = document.createElement('div');
    diceOverlay.className = 'goose-dice-overlay';

    const d1El = document.createElement('div');
    d1El.className = 'goose-die-wrap';
    const d2El = document.createElement('div');
    d2El.className = 'goose-die-wrap';
    diceOverlay.append(d1El, d2El);

    board.append(grid, diceOverlay);

    this.dice1 = createDice(d1El);
    this.dice2 = createDice(d2El);
  }

  /** Glyph + tooltip for a special square (null for a plain square). */
  private cellDecor(sq: number): { icon: string; tip: string } | null {
    if (sq === FINISH) return { icon: '🏁', tip: 'Finish — land exactly here to win' };
    if (GOOSE_SQUARES.has(sq)) return { icon: '🪿', tip: 'Goose — move your roll again' };
    if (sq === BRIDGE_FROM) return { icon: '🌉', tip: 'Bridge — jump ahead to square 12' };
    if (sq === INN) return { icon: '🍺', tip: 'Inn — miss 1 turn' };
    if (sq === WELL) return { icon: '🕳️', tip: 'Well — miss 3 turns' };
    if (sq === LABYRINTH_FROM) return { icon: '🌀', tip: 'Labyrinth — go back to square 39' };
    if (sq === PRISON) return { icon: '🔒', tip: 'Prison — miss 3 turns' };
    if (sq === DEATH) return { icon: '💀', tip: 'Death — back to square 1' };
    return null;
  }

  private cellClass(sq: number): string {
    if (sq === FINISH) return ' is-finish';
    if (GOOSE_SQUARES.has(sq)) return ' is-goose';
    if (sq === BRIDGE_FROM) return ' is-bridge';
    if (sq === INN) return ' is-inn';
    if (sq === WELL) return ' is-well';
    if (sq === LABYRINTH_FROM) return ' is-labyrinth';
    if (sq === PRISON) return ' is-prison';
    if (sq === DEATH) return ' is-death';
    return '';
  }

  private buildPlayers(): void {
    if (!this.playersEl) return;
    this.playersEl.innerHTML = '';
    this.playerEls = [];
    for (let seat = 0; seat < SEATS; seat++) {
      const chip = document.createElement('div');
      chip.className = 'goose-player';
      chip.style.setProperty('--seat-color', SEAT_COLORS[seat]);

      const dot = document.createElement('span');
      dot.className = 'goose-player-dot';

      const nameEl = document.createElement('span');
      nameEl.className = 'goose-player-name';
      nameEl.textContent = this.seatLabel(seat);

      // Position lives in a tooltip revealed on hover, so the top bar keeps a
      // fixed height and stays on a single line whatever the players' progress.
      const posEl = document.createElement('span');
      posEl.className = 'goose-player-pos';
      posEl.textContent = t('startSquare');

      chip.append(dot, nameEl, posEl);
      this.playersEl.append(chip);
      this.playerEls.push(chip);
    }
  }

  /** Returns "P1"/"P2"… for human seats and "Bot1"/"Bot2"… for bot seats. */
  private seatName(seat: number): string {
    const humans = [0, 1, 2, 3].filter((s) => this.humanSeats.has(s));
    const bots = [0, 1, 2, 3].filter((s) => !this.humanSeats.has(s));
    const hi = humans.indexOf(seat);
    if (hi >= 0) return `P${hi + 1}`;
    return `Bot${bots.indexOf(seat) + 1}`;
  }

  private seatLabel(seat: number): string {
    const name = this.seatName(seat);
    if (seat === this.mySeat) return `${name} (me)`;
    return name;
  }

  private posLabel(seat: number): string {
    const pos = this.game.positions[seat];
    const skip = this.game.skipTurns[seat];
    if (this.game.winner === seat) return `Square ${pos} — Finish!`;
    if (pos === OFF_BOARD) return 'Start';
    if (skip > 0) return `Square ${pos} (blocked ×${skip})`;
    return `Square ${pos}`;
  }

  protected renderState(): void {
    for (let sq = 1; sq <= 63; sq++) {
      const cell = this.cells[sq];
      if (cell) cell.querySelector('.goose-cell-tokens')!.innerHTML = '';
    }

    for (let seat = 0; seat < SEATS; seat++) {
      const pos = this.animPositions.has(seat)
        ? this.animPositions.get(seat)!
        : this.game.positions[seat];
      if (pos !== OFF_BOARD && pos >= 1 && pos <= 63) {
        const cell = this.cells[pos];
        if (cell) {
          const tokens = cell.querySelector('.goose-cell-tokens')!;
          const tok = document.createElement('span');
          tok.className = `goose-token goose-token--s${seat}`;
          if (this.game.current === seat && !this.game.winner) {
            tok.classList.add('is-active');
          }
          tokens.append(tok);
        }
      }

      const badge = this.playerEls[seat];
      if (badge) {
        const active = this.game.winner === null && this.game.current === seat;
        badge.classList.toggle('is-active', active);
        badge.classList.toggle('is-penalised', this.game.skipTurns[seat] > 0);

        const nameEl = badge.querySelector<HTMLElement>('.goose-player-name');
        const posEl = badge.querySelector<HTMLElement>('.goose-player-pos');
        if (nameEl) {
          nameEl.textContent =
            this.game.winner === seat ? `${this.seatLabel(seat)} 🏁` : this.seatLabel(seat);
        }
        if (posEl) posEl.textContent = this.posLabel(seat);
      }
    }
  }

  private addLogEntry(text: string): void {
    const log = this.logEl;
    if (!log || !text) return;
    log.querySelector('.is-latest')?.classList.remove('is-latest');
    const entry = document.createElement('p');
    entry.className = 'goose-log-entry is-latest';
    entry.textContent = text;
    log.insertBefore(entry, log.firstChild);
    const all = log.querySelectorAll('.goose-log-entry');
    if (all.length > 24) all[all.length - 1].remove();
  }

  private clearLog(): void {
    if (this.logEl) this.logEl.innerHTML = '';
  }

  private buildMoveMsg(
    seat: number,
    d1: number,
    d2: number,
    oldPos: number,
    newState: GooseState
  ): string {
    const name = this.seatName(seat);
    const newPos = newState.positions[seat];
    let msg = `${name} : ${d1}+${d2}=${d1 + d2}`;

    for (let other = 0; other < SEATS; other++) {
      if (other !== seat && this.game.positions[other] !== newState.positions[other]) {
        msg += ` · Bumps ${this.seatName(other)} → square ${newState.positions[other]}`;
      }
    }

    if (newPos === FINISH) {
      msg += ' · WIN!';
    } else if (newState.skipTurns[seat] > 0 && oldPos !== newPos) {
      if (newPos === INN) msg += ` · Inn! (${newState.skipTurns[seat]} turn)`;
      else if (newPos === WELL) msg += ` · Well! (${newState.skipTurns[seat]} turns)`;
      else if (newPos === PRISON) msg += ` · Prison! (${newState.skipTurns[seat]} turns)`;
    } else if (newPos === 1 && oldPos > 10) {
      msg += ' · Death! → square 1';
    } else if (newPos !== oldPos + d1 + d2 && newPos > 0) {
      if (newPos === 12 && oldPos + d1 + d2 === 6) msg += ' → Bridge → 12';
      else msg += ` → square ${newPos}`;
    }

    return msg;
  }

  private animDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Moves a seat's token square by square, with optional backward bounce on overshoot. */
  private async animateGooseMove(
    seat: number,
    fromSq: number,
    roll: number,
    finalSq: number
  ): Promise<void> {
    if (fromSq === OFF_BOARD || fromSq < 1) return;
    const gen = this.gen;
    const STEP_MS = 130;
    const rawTarget = fromSq + roll;
    const forwardEnd = Math.min(rawTarget, 63);

    for (let sq = fromSq + 1; sq <= forwardEnd; sq++) {
      if (gen !== this.gen || !this.state.isRunning) {
        this.animPositions.delete(seat);
        return;
      }
      this.animPositions.set(seat, sq);
      this.renderState();
      await this.animDelay(STEP_MS);
    }

    if (rawTarget > 63) {
      for (let sq = 62; sq >= finalSq; sq--) {
        if (gen !== this.gen || !this.state.isRunning) {
          this.animPositions.delete(seat);
          return;
        }
        this.animPositions.set(seat, sq);
        this.renderState();
        await this.animDelay(STEP_MS);
      }
    }

    this.animPositions.delete(seat);
  }

  protected async runTurn(): Promise<void> {
    const gen = this.gen;
    if (!this.state.isRunning) return;

    this.pendingSeat = null;
    this.dice1?.hide();
    this.dice2?.hide();

    const seat = this.game.current;
    const moves = legalMoves(this.game);

    if (moves.length === 1 && moves[0] === PASS) {
      const skip = this.game.skipTurns[seat];
      this.addLogEntry(
        `${this.seatName(seat)} skips (blocked ×${skip} — ${skip} turn${skip > 1 ? 's' : ''} left)`
      );
      await this.delay(PASS_DELAY);
      if (gen !== this.gen || !this.state.isRunning) return;
      this.game = applyMove(this.game, PASS);
      this.broadcastState();
      this.renderState();
      if (gen !== this.gen) return;
      this.timer = setTimeout(() => void this.runTurn(), NEXT_TURN_DELAY);
      return;
    }

    const accent = `var(--ludo-seat-${seat})`;
    this.dice1?.setAccent(accent);
    this.dice2?.setAccent(accent);

    if (seat === this.mySeat) {
      await this.humanTimed(this.awaitAnyRoll());
    } else if (this.isRemoteHuman(seat)) {
      await this.awaitRemoteRoll(seat);
    } else {
      await this.delay(BOT_DELAYS[this.difficulty]);
    }
    if (gen !== this.gen || !this.state.isRunning) return;

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    this.broadcast(BoardGame.OP_ROLL, { d1, d2 });
    playSound('dice');

    await this.showDice(d1, d2);
    if (gen !== this.gen || !this.state.isRunning) return;

    const oldPos = this.game.positions[seat];
    const roll = d1 + d2;
    this.game = applyMove(this.game, roll);
    const newPos = this.game.positions[seat];
    this.addLogEntry(this.buildMoveMsg(seat, d1, d2, oldPos, this.game));
    this.broadcastState();

    await this.animateGooseMove(seat, oldPos, roll, newPos);
    if (gen !== this.gen || !this.state.isRunning) return;

    this.renderState();

    const cellEl = newPos >= 1 && newPos <= 63 ? this.cells[newPos] : null;
    const fxRect = this.fx && cellEl ? cellEl.getBoundingClientRect() : null;
    const cx = fxRect ? fxRect.left + fxRect.width / 2 : 0;
    const cy = fxRect ? fxRect.top + fxRect.height / 2 : 0;
    const seatColor = SEAT_COLORS[seat] ?? '#ffffff';

    if (this.game.winner === seat) {
      playSound('win');
      if (this.fx && fxRect) {
        this.fx.emit(cx, cy, {
          count: 50,
          speed: 5,
          spread: Math.PI * 2,
          colors: [seatColor, '#ffd700', '#ffffff'],
          gravity: 0.06,
          duration: 1400,
          size: 6,
        });
      }
    } else if (newPos === DEATH) {
      playSound('die');
      if (this.fx && fxRect) {
        this.fx.emit(cx, cy, {
          count: 20,
          speed: 4,
          spread: Math.PI * 2,
          colors: ['#6b21a8', '#ef4444', '#1e1e2e'],
          size: 5,
          duration: 700,
          gravity: 0.05,
        });
      }
      screenShake(8, 350);
    } else if (GOOSE_SQUARES.has(newPos)) {
      playSound('score');
      if (this.fx && fxRect) {
        this.fx.emit(cx, cy, {
          count: 12,
          speed: 2.5,
          spread: Math.PI,
          angle: -Math.PI / 2,
          colors: ['#22c55e', '#86efac', '#ffffff'],
          size: 4,
          duration: 500,
          gravity: 0.08,
        });
      }
    } else {
      playSound('move');
      if (this.fx && fxRect) {
        this.fx.emit(cx, cy, {
          count: 5,
          speed: 1.5,
          spread: Math.PI / 2,
          angle: -Math.PI / 2,
          colors: [seatColor, '#ffffff'],
          size: 3,
          duration: 300,
          gravity: 0.1,
        });
      }
    }

    if (this.game.winner !== null) {
      this.clearTimer();
      await this.delay(BOT_ROLL_DELAY);
      this.gameOver();
      return;
    }

    if (gen !== this.gen) return;
    this.timer = setTimeout(() => void this.runTurn(), NEXT_TURN_DELAY);
  }

  /** Prompts BOTH dice to roll (both pulse); resolves on the first one clicked. */
  private awaitAnyRoll(): Promise<void> {
    const p1 = this.dice1?.awaitRoll() ?? Promise.resolve();
    const p2 = this.dice2?.awaitRoll() ?? Promise.resolve();
    return Promise.race([p1, p2]);
  }

  private async showDice(d1: number, d2: number): Promise<void> {
    await Promise.all([
      this.dice1?.show(d1) ?? Promise.resolve(),
      this.dice2?.show(d2) ?? Promise.resolve(),
    ]);
  }

  /** Host-side: a seated guest left — settle any die roll we were awaiting. */
  protected onPeerLeave(seat: number): void {
    this.humanSeats.delete(seat);
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

  /** Routes the two-dice op codes on top of the standard turn protocol. */
  protected handleGameMessage(msg: MatchMessage): void {
    if (this.net?.role === 'host') {
      if (msg.opCode === BoardGame.OP_ROLL_REQUEST) {
        const d = msg.data as { seat?: number } | null;
        this.onGuestRollRequest(d?.seat);
      }
      return;
    }
    if (msg.opCode === BoardGame.OP_ROLL) {
      const d = msg.data as { d1?: number; d2?: number } | null;
      if (d?.d1 && d?.d2) void this.showDice(d.d1, d.d2);
    }
  }

  protected applyNetState(game: GooseState, _move: GooseMove | null): void {
    this.game = game;
    this.guestRollGen++;

    if (game.winner !== null) {
      this.dice1?.hide();
      this.dice2?.hide();
      this.renderState();
      this.gameOver();
      return;
    }

    const myTurn = game.current === this.mySeat;
    const mySkip = game.skipTurns[this.mySeat] > 0;

    if (myTurn && !mySkip) {
      this.renderState();
      this.promptGuestRoll();
    } else {
      this.dice1?.hide();
      this.dice2?.hide();
    }
    this.renderState();
  }

  private promptGuestRoll(): void {
    const gen = this.guestRollGen;
    const accent = `var(--ludo-seat-${this.mySeat})`;
    this.dice1?.setAccent(accent);
    this.dice2?.setAccent(accent);
    void this.awaitAnyRoll().then(() => {
      if (gen !== this.guestRollGen || this.mode !== 'net') return;
      this.net?.send(BoardGame.OP_ROLL_REQUEST, { seat: this.mySeat });
    });
  }

  private onGuestRollRequest(seat: number | undefined): void {
    if (typeof seat !== 'number') return;
    if (this.game.current !== seat) return;
    if (this.pendingRoll?.seat === seat) this.pendingRoll.resolve();
    else this.bufferedRollSeat = seat;
  }

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

  stop(): void {
    super.stop();
    this.pendingRoll?.resolve();
    this.pendingRoll = null;
    this.bufferedRollSeat = null;
  }

  /** Clears the two dice, the roll bookkeeping and the log between rounds. */
  protected onRoundReset(): void {
    this.pendingRoll?.resolve();
    this.pendingRoll = null;
    this.bufferedRollSeat = null;
    this.guestRollGen++;
    this.animPositions.clear();
    this.dice1?.hide();
    this.dice2?.hide();
    this.clearLog();
  }

  protected getGameOverTitle(): string {
    return this.game.winner === this.mySeat ? t('victory') : t('defeat');
  }

  protected getGameOverContent(): string {
    const w = this.game.winner ?? 0;
    const name = this.seatName(w);
    return w === this.mySeat ? t('gooseWin') : t('gooseLose', { name });
  }

  /** The turn is shown by the active player badge (see {@link renderState}). */
  protected updateTurnDisplay(): void {}

  handleInput(_event: KeyboardEvent): void {}
}
