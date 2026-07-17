import { BoardGame } from '../../shared/turn/BoardGame.js';
import { t } from '../../shared/i18n/i18n.js';
import { TurnRules } from '../../shared/turn/turnGame.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { playSound } from '../../shared/fx/sound.js';
import { showToast } from '../../shared/ui/toast.js';
import {
  setupSettingsPanel,
  SettingsPanelHandle,
  difficultyField,
} from '../../shared/ui/settingsPanel.js';
import { setupHud } from '../../shared/ui/hud.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import {
  ReversiState,
  ReversiMove,
  SIZE,
  SEATS,
  rules as reversiRules,
  eqMove,
  initialState,
  flips,
  countDiscs,
} from './reversi.js';
import { decideMove } from './reversiBot.js';

/**
 * Reversi controller: a deterministic turn-based game playable **solo** (human =
 * seat 0 black, bot = seat 1 white) or **1-v-1 online** over the relay. It owns
 * the 8×8 board rendering and the click input (the empty squares that would flip
 * discs light up; click one to play). Passing and the draw are handled by the
 * rules; this class only reads the {@link ReversiState.done} flag to end a round.
 * Everything turn/host-authoritative lives in {@link BoardGame}.
 */
export class ReversiGame extends BoardGame<ReversiState, ReversiMove> {
  protected botDelay = 550;
  protected nextTurnDelay = 250;
  protected endDelay = 650;
  protected turnSeconds = 30;

  private difficulty: Difficulty = 'medium';
  private settings: SettingsPanelHandle | null = null;
  /** Solo only: whether the bot (white) takes the first move (Settings). */
  private botStarts = false;

  private boardEl: HTMLElement | null = null;
  private cellEls: HTMLElement[] = [];
  private fx: ParticleSystem | null = null;

  constructor() {
    super({ storageKey: 'reversi' });
  }

  protected get rules(): TurnRules<ReversiState, ReversiMove> {
    return reversiRules;
  }
  protected moveEquals(a: ReversiMove, b: ReversiMove): boolean {
    return eqMove(a, b);
  }
  protected decideBotMove(legalMoves: ReversiMove[]): ReversiMove {
    return decideMove(this.game, legalMoves, this.difficulty);
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'turn', icon: 'circle-dot', label: t('hudTurn') },
      { key: 'score', icon: 'circle-half-stroke', label: t('hudDiscs') },
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

  /** A fresh board; in solo the bot (seat 1) takes the first turn when configured. */
  protected freshGame(): ReversiState {
    const state = initialState();
    if (this.mode === 'solo' && this.botStarts) state.current = 1;
    return state;
  }

  /** Reversi ends on the rules' `done` flag (covers both a win and a draw). */
  protected isRoundOver(): boolean {
    return this.game.done;
  }

  /** Multiplayer freezes the solo-only settings (difficulty / first move). */
  protected onNetActiveChanged(active: boolean): void {
    this.settings?.setDisabled(active);
  }

  /** Builds the 8×8 grid of cells once (discs are painted in render). */
  private buildBoard(): void {
    const board = this.boardEl;
    if (!board) return;
    board.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'reversi-grid';

    this.cellEls = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement('div');
      cell.className = 'reversi-cell';
      cell.dataset.index = String(i);
      const disc = document.createElement('span');
      disc.className = 'reversi-disc';
      cell.appendChild(disc);
      grid.appendChild(cell);
      this.cellEls.push(cell);
    }
    board.appendChild(grid);
  }

  /** The board index under an event target, or null. */
  private cellIndexOf(target: EventTarget | null): number | null {
    const cell = (target as HTMLElement | null)?.closest<HTMLElement>('.reversi-cell');
    return cell?.dataset.index !== undefined ? Number(cell.dataset.index) : null;
  }

  /** The legal target squares for the human this turn. */
  private legalSet(): Set<number> {
    if (!this.awaitingHuman || this.game.current !== this.mySeat) return new Set();
    return new Set(this.rules.legalMoves(this.game).map((m) => m.index));
  }

  handleInput(): void {}

  /** Play a highlighted (legal) empty square. */
  private onCellClick(index: number): void {
    if (!this.awaitingHuman || this.game.current !== this.mySeat) return;
    if (this.game.board[index] !== null) return;
    if (flips(this.game.board, index, this.mySeat).length === 0) return;
    this.playLocalMove({ index });
  }

  /** Paints the discs plus the legal-move hints for the side to move. */
  protected renderState(): void {
    const legal = this.legalSet();
    for (let i = 0; i < this.cellEls.length; i++) {
      const cell = this.cellEls[i];
      const disc = this.game.board[i];
      cell.classList.toggle('is-p0', disc === 0);
      cell.classList.toggle('is-p1', disc === 1);
      cell.classList.toggle('is-hint', legal.has(i));
    }
  }

  /** Writes whose turn it is, plus the live disc score, into the HUD. */
  protected updateTurnDisplay(): void {
    super.updateTurnDisplay();
    const [b, w] = countDiscs(this.game.board);
    this.hud?.set('score', `${b} – ${w}`);
  }

  /** Post-move visuals: place sound, a flip burst, a pass notice, win confetti. */
  protected onMoveCommitted(move: ReversiMove | null): void {
    if (move) {
      playSound('connect');
      this.spawnFlipParticles(move.index);
      // If the turn came straight back to the mover, the opponent had to pass.
      if (!this.game.done && this.game.board[move.index] === this.game.current) {
        showToast(t('opponentPassed'), 'info');
      }
    }
    if (this.game.done) {
      if (this.game.winner !== null) {
        playSound('win');
        this.spawnWinParticles();
      }
    }
  }

  private colorsFor(seat: number): string[] {
    return seat === 0
      ? ['#1f2937', '#374151', '#6b7280', '#ffffff']
      : ['#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8'];
  }

  /** A small burst on the square just played, in the mover's colour. */
  private spawnFlipParticles(index: number): void {
    const cell = this.cellEls[index];
    const seat = this.game.board[index];
    if (!this.fx || !cell || seat === null) return;
    const rect = cell.getBoundingClientRect();
    this.fx.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
      count: 8,
      speed: 4,
      spread: Math.PI * 2,
      gravity: 0.2,
      duration: 650,
      size: rect.width * 0.18,
      colors: this.colorsFor(seat),
    });
  }

  /** Confetti from each of the winner's discs. */
  private spawnWinParticles(): void {
    const winner = this.game.winner;
    if (!this.fx || winner === null) return;
    const colors = this.colorsFor(winner);
    for (let i = 0; i < this.game.board.length; i++) {
      if (this.game.board[i] !== winner) continue;
      const rect = this.cellEls[i]?.getBoundingClientRect();
      if (!rect) continue;
      this.fx.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
        count: 4,
        speed: 5,
        spread: Math.PI * 2,
        gravity: 0.2,
        duration: 850,
        size: rect.width * 0.18,
        colors,
      });
    }
  }

  protected getGameOverTitle(): string {
    if (this.game.winner === null) return t('draw');
    return this.game.winner === this.mySeat ? t('youWin') : t('youLose');
  }

  protected getGameOverContent(): string {
    const [b, w] = countDiscs(this.game.board);
    const mine = this.mySeat === 0 ? b : w;
    const theirs = this.mySeat === 0 ? w : b;
    return `<p>Discs — you ${mine}, opponent ${theirs}.</p>`;
  }
}
