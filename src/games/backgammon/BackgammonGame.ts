import { Difficulty } from '../../shared/bot/difficulty.js';
import { playSound } from '../../shared/fx/sound.js';
import { t } from '../../shared/i18n/i18n.js';
import { BoardGame } from '../../shared/turn/BoardGame.js';
import type { TurnRules } from '../../shared/turn/turnGame.js';
import { dieFaceHtml } from '../../shared/ui/dicePips.js';
import { setupHud } from '../../shared/ui/hud.js';
import {
  difficultyField,
  setupSettingsPanel,
  SettingsPanelHandle,
} from '../../shared/ui/settingsPanel.js';
import {
  backgammonRules,
  BAR,
  type BackgammonMove,
  type BackgammonState,
  CHECKERS_PER_PLAYER,
  createBackgammonState,
  OFF,
  owner,
  pipCount,
  POINT_COUNT,
  SEATS,
} from './backgammon.js';
import { decideMove } from './backgammonBot.js';

/** Checker colour per seat, mirrored by `.bg-checker.is-seat-*` in the CSS. */
const SEAT_COLORS = ['var(--color-backgammon)', 'var(--accent)'] as const;
const DIE_SIDES = 6;
const ROLL_PAUSE_MS = 650;
const MAX_RENDERED_CHECKERS = 5;
/** Point indices per board quadrant, left → right as rendered. */
const QUADS: Record<string, number[]> = {
  tl: [12, 13, 14, 15, 16, 17],
  tr: [18, 19, 20, 21, 22, 23],
  bl: [11, 10, 9, 8, 7, 6],
  br: [5, 4, 3, 2, 1, 0],
};

export class BackgammonGame extends BoardGame<BackgammonState, BackgammonMove> {
  private points: HTMLButtonElement[] = [];
  private bar: HTMLElement | null = null;
  private offTray: HTMLButtonElement | null = null;
  private offStacks: [HTMLElement | null, HTMLElement | null] = [null, null];
  private diceBox: HTMLElement | null = null;
  private selected: number | null = null;
  /** True while waiting for the local human to click the dice to roll. */
  private awaitingRoll = false;
  private rollResolve: (() => void) | null = null;

  private difficulty: Difficulty = 'medium';
  private settings: SettingsPanelHandle | null = null;
  /** Solo only: whether the bot (seat 1) takes the first move (Settings). */
  private botStarts = false;

  protected rollPause = ROLL_PAUSE_MS;

  constructor() {
    super({ storageKey: 'backgammon-scores' });
  }

  protected get rules(): TurnRules<BackgammonState, BackgammonMove> {
    return backgammonRules;
  }

  initialize(): void {
    this.hud = setupHud([
      { key: 'turn', icon: 'circle-dot', label: t('hudTurn') },
      { key: 'pip', icon: 'route', label: t('hudPip') },
      { key: 'off', icon: 'arrow-right-from-bracket', label: t('hudBorneOff') },
      { key: 'time', icon: 'clock', label: t('hudTime') },
    ]);
    this.buildBoard();
    this.setupEventListeners();

    this.settings = setupSettingsPanel([
      difficultyField(this.difficulty, (value) => {
        this.difficulty = value as Difficulty;
      }),
      {
        id: 'first',
        label: t('firstMove'),
        choices: [
          { label: t('me'), value: 'me' },
          { label: t('you'), value: 'you' },
        ],
        value: this.botStarts ? 'you' : 'me',
        onChange: (value) => {
          this.botStarts = value === 'you';
          if (this.mode === 'solo') {
            // stop() clears isRunning so the following start() isn't a no-op
            // (start() early-returns while running); reset() alone leaves it set.
            const wasRunning = this.state.isRunning;
            this.stop();
            this.reset();
            if (wasRunning) this.start();
          }
        },
      },
    ]);
    this.setupVersus(SEATS);

    this.game = this.freshGame();
    this.updateTurnDisplay();
    this.renderState();
  }

  handleInput(_event: KeyboardEvent): void {
    // Pointer-driven game; no keyboard mapping.
  }

  /** A fresh board; in solo the bot (seat 1) takes the first turn when configured. */
  protected freshGame(): BackgammonState {
    const state = createBackgammonState();
    if (this.mode === 'solo' && this.botStarts) state.current = 1;
    return state;
  }

  /** Multiplayer freezes the solo-only settings (difficulty / first move). */
  protected onNetActiveChanged(active: boolean): void {
    this.settings?.setDisabled(active);
  }

  protected onRoundReset(): void {
    this.resolveRoll();
    this.selected = null;
  }

  /** Unblock a pending roll prompt so an abandoned turn can't hang the flow. */
  stop(): void {
    this.resolveRoll();
    super.stop();
  }

  protected moveEquals(a: BackgammonMove, b: BackgammonMove): boolean {
    return a.from === b.from && a.to === b.to && a.die === b.die;
  }

  protected decideBotMove(legalMoves: BackgammonMove[]): BackgammonMove {
    return decideMove(this.game, legalMoves, this.difficulty);
  }

  protected getGameOverTitle(): string {
    if (this.game.winner === null) return t('draw');
    return this.game.winner === this.mySeat ? t('youWin') : t('youLose');
  }

  /**
   * A dice turn (host/solo authority): roll when the turn starts, forfeit it if
   * nothing is playable, else let the local human move a checker per die, await a
   * remote guest, or play a bot. Overrides the deterministic default; `commitMove`
   * applies one die and re-enters here. The host broadcasts the rolled snapshot so
   * the guest sees the dice, and sets `pendingSeat` **before** broadcasting a
   * guest's turn so the guest's relayed move can never race an unset seat.
   */
  protected async runTurn(): Promise<void> {
    const gen = this.gen;
    if (!this.state.isRunning) return;
    this.awaitingHuman = false;
    this.pendingSeat = null;
    if (this.isRoundOver()) {
      this.updateTurnDisplay();
      return;
    }

    if (this.game.dice.length === 0) {
      // The local human clicks the dice to roll; bots and remote seats auto-roll.
      if (this.game.current === this.mySeat) {
        await this.awaitRollClick();
        if (gen !== this.gen || !this.state.isRunning) return;
      }
      this.rollDice();
      playSound('dice');
      this.updateTurnDisplay();
      this.renderState();
      this.diceBox?.classList.add('is-rolling');
      await this.delay(this.rollPause);
      this.diceBox?.classList.remove('is-rolling');
      if (gen !== this.gen || !this.state.isRunning) return;
    }

    const legal = this.rules.legalMoves(this.game);
    if (legal.length === 0) {
      this.passTurn();
      this.updateTurnDisplay();
      this.renderState();
      this.broadcastState();
      this.timer = setTimeout(() => void this.runTurn(), this.nextTurnDelay);
      return;
    }

    this.updateTurnDisplay();
    const seat = this.game.current;
    if (seat === this.mySeat) {
      this.awaitingHuman = true;
      this.renderState();
      this.broadcastState();
      this.startCountdown(() => {
        if (this.awaitingHuman) this.commitMove(this.decideBotMove(legal));
      });
    } else if (this.isRemoteHuman(seat)) {
      this.pendingSeat = seat;
      this.renderState();
      this.broadcastState();
      this.startCountdown(() => this.resolvePending(this.decideBotMove(legal)));
    } else {
      this.renderState();
      this.broadcastState();
      await this.delay(this.botDelay);
      if (gen !== this.gen || !this.state.isRunning) return;
      this.commitMove(this.decideBotMove(legal));
    }
  }

  /**
   * Shows the clickable "roll" prompt and resolves once the local human clicks
   * the dice. A countdown auto-rolls so an idle player never hangs the turn,
   * exactly like every seat's timed auto-play elsewhere.
   */
  private awaitRollClick(): Promise<void> {
    return new Promise((resolve) => {
      this.awaitingRoll = true;
      this.rollResolve = resolve;
      this.updateTurnDisplay();
      this.renderState();
      this.startCountdown(() => this.resolveRoll());
    });
  }

  /** Settles a pending roll prompt (a click, the countdown, or a reset/stop). */
  private resolveRoll(): void {
    if (!this.awaitingRoll) return;
    this.awaitingRoll = false;
    this.stopCountdown();
    const resolve = this.rollResolve;
    this.rollResolve = null;
    resolve?.();
  }

  private rollDice(): void {
    const a = 1 + Math.floor(Math.random() * DIE_SIDES);
    const b = 1 + Math.floor(Math.random() * DIE_SIDES);
    this.game = { ...this.game, dice: a === b ? [a, a, a, a] : [a, b] };
    this.selected = null;
  }

  private passTurn(): void {
    this.game = { ...this.game, current: this.game.current === 0 ? 1 : 0, dice: [] };
  }

  protected updateTurnDisplay(): void {
    super.updateTurnDisplay();
    this.hud?.set('pip', String(pipCount(this.game, this.mySeat)));
    this.hud?.set('off', `${this.game.off[this.mySeat]}/${CHECKERS_PER_PLAYER}`);
  }

  /** Post-move audio (host and guest alike): checker step, then the win jingle. */
  protected onMoveCommitted(move: BackgammonMove | null): void {
    if (move) playSound('move');
    if (this.game.winner !== null) playSound('win');
  }

  protected renderState(): void {
    const myTurn = this.awaitingHuman && this.game.current === this.mySeat && !this.isRoundOver();
    if (this.selected !== null && owner(this.game.points[this.selected]) !== this.mySeat) {
      this.selected = null;
    }
    // Targets: while on the bar every legal move is an entry (no selection
    // needed), otherwise the selected checker's destinations.
    const targets = new Set<number>();
    if (myTurn && this.game.bar[this.mySeat] > 0) {
      for (const move of this.rules.legalMoves(this.game)) targets.add(move.to);
    } else if (this.selected !== null) {
      for (const move of this.rules.legalMoves(this.game)) {
        if (move.from === this.selected) targets.add(move.to);
      }
    }

    // Hint which checkers can actually move (only when nothing is selected and
    // no checker is on the bar, which would force a re-entry first).
    const origins =
      myTurn && this.selected === null && this.game.bar[this.mySeat] === 0
        ? this.legalOrigins()
        : new Set<number>();

    this.points.forEach((point, index) => {
      this.renderStack(point, this.game.points[index]);
      point.classList.toggle('is-selected', this.selected === index);
      point.classList.toggle('is-target', targets.has(index));
      point.classList.toggle('is-movable', origins.has(index));
      point.disabled = !myTurn;
    });

    if (this.bar) {
      this.renderBar();
      this.bar.classList.toggle('is-active', myTurn && this.game.bar[this.mySeat] > 0);
    }
    if (this.offTray) {
      this.renderOffTray();
      this.offTray.classList.toggle('is-target', targets.has(OFF));
      this.offTray.disabled = !myTurn;
    }
    if (this.diceBox) {
      // The dice sit on the roller's half of the board and wear the roller's
      // checker colour, so a glance shows whose turn it is.
      const rolling = this.awaitingRoll && this.game.current === this.mySeat;
      this.diceBox.classList.toggle('is-prompt', rolling);
      this.diceBox.classList.toggle('is-away', !rolling && this.game.current !== this.mySeat);
      this.diceBox.style.setProperty('--dice-accent', SEAT_COLORS[this.game.current]);
      this.diceBox.innerHTML = rolling
        ? '<span class="dice-face bg-dice-prompt"><i class="fas fa-dice" aria-hidden="true"></i></span>'
        : this.game.dice
            .map((die) => `<span class="dice-face">${dieFaceHtml(die)}</span>`)
            .join('');
    }
  }

  /** Origin points that have at least one legal move for the current dice. */
  private legalOrigins(): Set<number> {
    const origins = new Set<number>();
    for (const move of this.rules.legalMoves(this.game)) origins.add(move.from);
    return origins;
  }

  /** Shows each side's borne-off total as one counted disc (seat 1 top, seat 0 bottom). */
  private renderOffTray(): void {
    for (const seat of [0, 1] as const) {
      const host = this.offStacks[seat];
      if (!host) continue;
      host.replaceChildren();
      const count = this.game.off[seat];
      if (count === 0) continue;
      const disc = document.createElement('span');
      disc.className = `bg-checker is-seat-${seat}`;
      disc.textContent = String(count);
      host.append(disc);
    }
  }

  /** Draws up to five stacked discs for a signed checker count (sign = owner). */
  private renderStack(host: HTMLElement, value: number): void {
    host.replaceChildren();
    const seat = owner(value);
    if (seat === null) return;
    const count = Math.abs(value);
    const shown = Math.min(count, MAX_RENDERED_CHECKERS);
    for (let i = 0; i < shown; i++) {
      const disc = document.createElement('span');
      disc.className = `bg-checker is-seat-${seat}`;
      if (i === shown - 1 && count > MAX_RENDERED_CHECKERS) disc.textContent = String(count);
      host.append(disc);
    }
  }

  /** Keeps both seats visible when a hit leaves checkers from each on the bar. */
  private renderBar(): void {
    if (!this.bar) return;
    this.bar.replaceChildren();
    for (const seat of [0, 1] as const) {
      const count = this.game.bar[seat];
      if (count === 0) continue;
      const stack = document.createElement('span');
      stack.className = 'bg-bar-stack';
      this.renderStack(stack, seat === 0 ? count : -count);
      this.bar.append(stack);
    }
  }

  private buildBoard(): void {
    this.bar = document.getElementById('bg-bar');
    this.offTray = document.getElementById('bg-off') as HTMLButtonElement | null;
    this.offStacks = [document.getElementById('bg-off-0'), document.getElementById('bg-off-1')];
    this.diceBox = document.getElementById('bg-dice');
    this.points = new Array(POINT_COUNT);

    for (const [quad, indices] of Object.entries(QUADS)) {
      const host = document.querySelector<HTMLElement>(`.bg-${quad}`);
      if (!host) continue;
      const top = quad.startsWith('t');
      for (const index of indices) {
        const point = document.createElement('button');
        point.type = 'button';
        point.className = `bg-point ${top ? 'is-top' : 'is-bottom'}`;
        point.dataset.index = String(index);
        point.setAttribute('aria-label', String(index + 1));
        point.addEventListener('click', () => this.onPoint(index));
        host.append(point);
        this.points[index] = point;
      }
    }
    this.offTray?.addEventListener('click', () => this.onOff());
    this.diceBox?.addEventListener('click', () => this.resolveRoll());
  }

  private myTurn(): boolean {
    return this.awaitingHuman && this.game.current === this.mySeat && !this.isRoundOver();
  }

  private onPoint(index: number): void {
    if (!this.myTurn()) return;
    // A checker on the bar must re-enter first: any point click is an entry attempt.
    if (this.game.bar[this.mySeat] > 0) {
      this.tryMove(BAR, index);
      return;
    }
    if (owner(this.game.points[index]) === this.mySeat) {
      // Deselecting is always fine; selecting requires a checker that can move.
      if (this.selected !== index && !this.legalOrigins().has(index)) return;
      this.selected = this.selected === index ? null : index;
      this.renderState();
      return;
    }
    if (this.selected !== null) this.tryMove(this.selected, index);
  }

  private onOff(): void {
    if (!this.myTurn() || this.selected === null) return;
    this.tryMove(this.selected, OFF);
  }

  private tryMove(from: number, to: number): void {
    const move = this.rules.legalMoves(this.game).find((m) => m.from === from && m.to === to);
    if (!move) return;
    this.selected = null;
    this.playLocalMove(move);
  }
}
