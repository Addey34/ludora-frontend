import { BoardGame } from '../../shared/turn/BoardGame.js';
import { t } from '../../shared/i18n/i18n.js';
import { TurnRules } from '../../shared/turn/turnGame.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { playSound } from '../../shared/fx/sound.js';
import {
  setupSettingsPanel,
  SettingsPanelHandle,
  difficultyField,
} from '../../shared/ui/settingsPanel.js';
import { setupHud } from '../../shared/ui/hud.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import {
  CheckersState,
  CheckersMove,
  SIZE,
  SEATS,
  rules as checkersRules,
  eqMove,
  initialState,
  isDark,
  countPieces,
} from './checkers.js';
import { decideMove } from './checkersBot.js';

/**
 * Checkers controller: a deterministic turn-based game playable **solo** (human =
 * seat 0, bot = seat 1) or **1-v-1 online** over the relay. It owns only the 8×8
 * board rendering and the click-to-move input (select a piece → its legal squares
 * light up → click one). Mandatory captures and multi-jumps are handled by the
 * rules; when a jump chains, the rules keep the same seat and the UI auto-selects
 * the chaining piece. Everything turn/host-authoritative lives in {@link BoardGame}.
 */
export class CheckersGame extends BoardGame<CheckersState, CheckersMove> {
  protected botDelay = 550;
  protected nextTurnDelay = 250;
  protected endDelay = 550;
  protected turnSeconds = 30;

  private difficulty: Difficulty = 'medium';
  private settings: SettingsPanelHandle | null = null;
  /** Solo only: whether the bot takes the first move (Settings). */
  private botStarts = false;

  private boardEl: HTMLElement | null = null;
  private cellEls: HTMLElement[] = [];
  /** The human's currently selected piece (board index), or null. */
  private selected: number | null = null;
  private fx: ParticleSystem | null = null;

  constructor() {
    super({ storageKey: 'checkers' });
  }

  protected get rules(): TurnRules<CheckersState, CheckersMove> {
    return checkersRules;
  }
  protected moveEquals(a: CheckersMove, b: CheckersMove): boolean {
    return eqMove(a, b);
  }
  protected decideBotMove(legalMoves: CheckersMove[]): CheckersMove {
    return decideMove(this.game, legalMoves, this.difficulty);
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'turn', icon: 'circle-dot', label: t('hudTurn') },
      { key: 'time', icon: 'clock', label: t('hudTime') },
    ]);

    this.buildBoard();
    this.boardEl?.addEventListener('click', (event) => {
      const index = this.cellIndexOf(event.target);
      if (index !== null) this.onCellClick(index);
    });

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
            this.reset();
            if (this.state.isRunning) this.start();
          }
        },
      },
    ]);
    this.setupVersus(SEATS);

    this.game = this.freshGame();
    this.updateTurnDisplay();
    this.renderState();
  }

  /** A fresh board; in solo the bot takes the first turn when configured. */
  protected freshGame(): CheckersState {
    const state = initialState();
    if (this.mode === 'solo' && this.botStarts) state.current = 1;
    return state;
  }

  /** Clears the current selection between rounds. */
  protected onRoundReset(): void {
    this.selected = null;
  }

  /** Multiplayer freezes the solo-only settings (difficulty / first move). */
  protected onNetActiveChanged(active: boolean): void {
    this.settings?.setDisabled(active);
  }

  /** Builds the 8×8 grid of cells once (pieces are painted in render). */
  private buildBoard(): void {
    const board = this.boardEl;
    if (!board) return;
    board.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'checkers-grid';

    this.cellEls = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('div');
        const dark = isDark(r, c);
        cell.className = `checkers-cell ${dark ? 'is-dark' : 'is-light'}`;
        cell.dataset.index = String(r * SIZE + c);
        const piece = document.createElement('span');
        piece.className = 'checkers-piece';
        cell.appendChild(piece);
        grid.appendChild(cell);
        this.cellEls.push(cell);
      }
    }
    board.appendChild(grid);
  }

  /** Keyboard: Escape clears the current selection (the game is click-driven). */
  handleInput(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.selected !== null && this.game.chain === null) {
      this.selected = null;
      this.renderState();
    }
  }

  /** The board index under an event target, or null. */
  private cellIndexOf(target: EventTarget | null): number | null {
    const cell = (target as HTMLElement | null)?.closest<HTMLElement>('.checkers-cell');
    return cell?.dataset.index !== undefined ? Number(cell.dataset.index) : null;
  }

  /** Groups the current legal moves by their origin square. */
  private legalByFrom(): Map<number, number[]> {
    const map = new Map<number, number[]>();
    if (!this.awaitingHuman || this.game.current !== this.mySeat) return map;
    for (const move of this.rules.legalMoves(this.game)) {
      const list = map.get(move.from) ?? [];
      list.push(move.to);
      map.set(move.from, list);
    }
    return map;
  }

  /** Select a movable piece, or (if one is selected) play a highlighted target. */
  private onCellClick(index: number): void {
    if (!this.awaitingHuman || this.game.current !== this.mySeat) return;
    const legal = this.legalByFrom();

    // Mid multi-jump: the chaining piece is forced; only its targets are clickable.
    if (this.game.chain !== null) {
      const targets = legal.get(this.game.chain) ?? [];
      if (targets.includes(index)) {
        this.selected = null;
        this.playLocalMove({ from: this.game.chain, to: index });
      }
      return;
    }

    if (legal.has(index)) {
      this.selected = index; // (re)select one of my movable pieces
      this.renderState();
      return;
    }
    if (this.selected !== null && (legal.get(this.selected) ?? []).includes(index)) {
      const from = this.selected;
      this.selected = null;
      this.playLocalMove({ from, to: index });
      return;
    }
    this.selected = null;
    this.renderState();
  }

  /** Paints the pieces, plus the selection and its legal-target dots. */
  protected renderState(): void {
    const legal = this.legalByFrom();
    // A chaining piece is always the (forced) selection.
    let sel = this.game.chain !== null ? this.game.chain : this.selected;
    if (sel !== null && !legal.has(sel)) sel = null;
    this.selected = sel;
    const targets = sel !== null ? (legal.get(sel) ?? []) : [];
    const targetSet = new Set(targets);
    const movable = legal.size > 0;

    for (let i = 0; i < this.cellEls.length; i++) {
      const cell = this.cellEls[i];
      const piece = this.game.board[i];
      cell.classList.toggle('is-p0', piece?.seat === 0);
      cell.classList.toggle('is-p1', piece?.seat === 1);
      cell.classList.toggle('is-king', piece?.king ?? false);
      cell.classList.toggle('is-selected', i === sel);
      cell.classList.toggle('is-target', targetSet.has(i));
      // A subtle hint on the pieces the human may pick up this turn.
      cell.classList.toggle('is-movable', movable && sel === null && legal.has(i));
    }
  }

  /** Writes whose turn it is into the HUD. */
  protected updateTurnDisplay(): void {
    const seat = this.game.current;
    let text: string;
    if (this.game.winner !== null) text = '—';
    else if (seat === this.mySeat) text = 'My turn';
    else if (this.humanSeats.has(seat)) text = 'Your turn';
    else text = "Bot's turn";
    this.hud?.set('turn', text);
  }

  /** Post-move visuals (host and guest): move/capture sound, particles, win burst. */
  protected onMoveCommitted(move: CheckersMove | null): void {
    if (move) {
      const captured = Math.abs(Math.floor(move.to / SIZE) - Math.floor(move.from / SIZE)) === 2;
      playSound(captured ? 'hit' : 'move');
      if (captured) this.spawnCaptureParticles(move);
    }
    if (this.game.winner !== null) {
      playSound('win');
      this.spawnWinParticles();
    }
  }

  private colorsFor(seat: number): string[] {
    return seat === 0
      ? ['#dc2626', '#f87171', '#fca5a5', '#ffffff']
      : ['#334155', '#64748b', '#94a3b8', '#ffffff'];
  }

  /** A small burst on the jumped square (its midpoint between from and to). */
  private spawnCaptureParticles(move: CheckersMove): void {
    const mid = (move.from + move.to) / 2;
    const cell = this.cellEls[mid];
    if (!this.fx || !cell) return;
    const rect = cell.getBoundingClientRect();
    // The captured piece belonged to the opponent of whoever now sits on `to`.
    const mover = this.game.board[move.to]?.seat ?? 0;
    this.fx.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
      count: 8,
      speed: 4,
      spread: Math.PI * 2,
      gravity: 0.25,
      duration: 700,
      size: rect.width * 0.18,
      colors: this.colorsFor(mover === 0 ? 1 : 0),
    });
  }

  /** Confetti from each of the winner's surviving pieces. */
  private spawnWinParticles(): void {
    const winner = this.game.winner;
    if (!this.fx || winner === null) return;
    const colors = this.colorsFor(winner);
    for (let i = 0; i < this.game.board.length; i++) {
      if (this.game.board[i]?.seat !== winner) continue;
      const rect = this.cellEls[i]?.getBoundingClientRect();
      if (!rect) continue;
      this.fx.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
        count: 6,
        speed: 5,
        spread: Math.PI * 2,
        gravity: 0.2,
        duration: 900,
        size: rect.width * 0.2,
        colors,
      });
    }
  }

  protected getGameOverTitle(): string {
    return this.game.winner === this.mySeat ? t('youWin') : t('youLose');
  }

  protected getGameOverContent(): string {
    const [p0, p1] = countPieces(this.game.board);
    const mine = this.mySeat === 0 ? p0 : p1;
    const theirs = this.mySeat === 0 ? p1 : p0;
    return this.game.winner === this.mySeat
      ? `<p>You cleared the board — ${mine} pieces still standing.</p>`
      : `<p>Your opponent had ${theirs} pieces left.</p>`;
  }
}
