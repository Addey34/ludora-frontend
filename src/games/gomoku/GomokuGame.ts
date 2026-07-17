import { Difficulty } from '../../shared/bot/difficulty.js';
import { t } from '../../shared/i18n/i18n.js';
import { BoardGame } from '../../shared/turn/BoardGame.js';
import type { TurnRules } from '../../shared/turn/turnGame.js';
import { setupHud } from '../../shared/ui/hud.js';
import {
  difficultyField,
  setupSettingsPanel,
  SettingsPanelHandle,
} from '../../shared/ui/settingsPanel.js';
import {
  BOARD_SIZE,
  createGomokuState,
  gomokuRules,
  isGomokuDraw,
  SEATS,
  type GomokuMove,
  type GomokuState,
} from './gomoku.js';
import { decideMove } from './gomokuBot.js';

const STONES = ['●', '○'] as const;

/**
 * Gomoku controller: a deterministic turn-based game playable **solo** (human =
 * seat 0 black, bot = seat 1 white) or **1-v-1 online** over the relay. It only
 * owns the 15×15 board rendering and click input; the whole turn/host-authoritative
 * networking lives in {@link BoardGame}. Bot difficulty + first move live in the
 * Settings panel; the online seat is wired through the Multiplayer panel.
 */
export class GomokuGame extends BoardGame<GomokuState, GomokuMove> {
  private board: HTMLElement | null = null;
  private cells: HTMLButtonElement[] = [];

  private difficulty: Difficulty = 'medium';
  private settings: SettingsPanelHandle | null = null;
  /** Solo only: whether the bot (white) takes the first move (Settings). */
  private botStarts = false;

  constructor() {
    super({ storageKey: 'gomoku-scores' });
  }

  protected get rules(): TurnRules<GomokuState, GomokuMove> {
    return gomokuRules;
  }

  initialize(): void {
    this.board = document.getElementById('board');
    this.hud = setupHud([
      { key: 'turn', icon: 'circle-dot', label: t('hudTurn') },
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
  protected freshGame(): GomokuState {
    const state = createGomokuState();
    if (this.mode === 'solo' && this.botStarts) state.current = 1;
    return state;
  }

  /** Multiplayer freezes the solo-only settings (difficulty / first move). */
  protected onNetActiveChanged(active: boolean): void {
    this.settings?.setDisabled(active);
  }

  handleInput(_event: KeyboardEvent): void {
    // Gomoku is played by clicking a cell; no keyboard mapping on a 15×15 grid.
  }

  protected moveEquals(a: GomokuMove, b: GomokuMove): boolean {
    return a.index === b.index;
  }

  protected decideBotMove(legalMoves: GomokuMove[]): GomokuMove {
    return decideMove(this.game, legalMoves, this.difficulty);
  }

  protected isRoundOver(): boolean {
    return this.game.winner !== null || isGomokuDraw(this.game);
  }

  protected renderState(): void {
    this.cells.forEach((cell, index) => {
      const seat = this.game.cells[index];
      cell.textContent = seat === null ? '' : STONES[seat];
      cell.classList.toggle('is-seat-0', seat === 0);
      cell.classList.toggle('is-seat-1', seat === 1);
      cell.classList.toggle('is-last', index === this.game.last);
      cell.disabled =
        seat !== null ||
        !this.awaitingHuman ||
        this.game.current !== this.mySeat ||
        this.isRoundOver();
    });
  }

  protected getGameOverTitle(): string {
    if (this.game.winner === null) return t('draw');
    return this.game.winner === this.mySeat ? t('youWin') : t('youLose');
  }

  private buildBoard(): void {
    if (!this.board) return;
    this.board.replaceChildren();
    this.cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
      const column = (index % BOARD_SIZE) + 1;
      const row = Math.floor(index / BOARD_SIZE) + 1;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'gomoku-cell';
      cell.dataset.index = String(index);
      cell.setAttribute('aria-label', `${column}, ${row}`);
      cell.addEventListener('click', () => this.playCell(index));
      this.board?.append(cell);
      return cell;
    });
  }

  private playCell(index: number): void {
    if (!this.awaitingHuman || this.game.current !== this.mySeat) return;
    if (!this.rules.legalMoves(this.game).some((move) => move.index === index)) return;
    this.playLocalMove({ index });
  }
}
