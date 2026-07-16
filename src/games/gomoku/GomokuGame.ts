import { t } from '../../shared/i18n/i18n.js';
import { BoardGame } from '../../shared/turn/BoardGame.js';
import type { TurnRules } from '../../shared/turn/turnGame.js';
import { setupHud } from '../../shared/ui/hud.js';
import {
  bestGomokuMove,
  BOARD_SIZE,
  gomokuRules,
  isGomokuDraw,
  type GomokuMove,
  type GomokuState,
} from './gomoku.js';

const STONES = ['●', '○'] as const;

export class GomokuGame extends BoardGame<GomokuState, GomokuMove> {
  private board: HTMLElement | null = null;
  private cells: HTMLButtonElement[] = [];

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
    this.updateTurnDisplay();
    this.renderState();
  }

  handleInput(_event: KeyboardEvent): void {
    // Gomoku is played by clicking a cell; no keyboard mapping on a 15×15 grid.
  }

  protected moveEquals(a: GomokuMove, b: GomokuMove): boolean {
    return a.index === b.index;
  }

  protected decideBotMove(_legalMoves: GomokuMove[]): GomokuMove {
    const move = bestGomokuMove(this.game);
    if (!move) throw new Error('No legal move available');
    return move;
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

  protected updateTurnDisplay(): void {
    this.hud?.set('turn', this.isRoundOver() ? '-' : STONES[this.game.current]);
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
