import { t } from '../../shared/i18n/i18n.js';
import { BoardGame } from '../../shared/turn/BoardGame.js';
import type { TurnRules } from '../../shared/turn/turnGame.js';
import { setupHud } from '../../shared/ui/hud.js';
import {
  bestTictactoeMove,
  BOARD_WIDTH,
  isTictactoeDraw,
  tictactoeRules,
  type TictactoeMove,
  type TictactoeState,
} from './tictactoe.js';

const SYMBOLS = ['X', 'O'] as const;

export class TictactoeGame extends BoardGame<TictactoeState, TictactoeMove> {
  private board: HTMLElement | null = null;
  private cells: HTMLButtonElement[] = [];

  constructor() {
    super({ storageKey: 'tictactoe-scores' });
  }

  protected get rules(): TurnRules<TictactoeState, TictactoeMove> {
    return tictactoeRules;
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

  handleInput(event: KeyboardEvent): void {
    const index = Number(event.key) - 1;
    if (Number.isInteger(index) && index >= 0 && index < this.cells.length) {
      this.playCell(index);
    }
  }

  protected moveEquals(a: TictactoeMove, b: TictactoeMove): boolean {
    return a.index === b.index;
  }

  protected decideBotMove(_legalMoves: TictactoeMove[]): TictactoeMove {
    const move = bestTictactoeMove(this.game);
    if (!move) throw new Error('No legal move available');
    return move;
  }

  protected isRoundOver(): boolean {
    return this.game.winner !== null || isTictactoeDraw(this.game);
  }

  protected renderState(): void {
    this.cells.forEach((cell, index) => {
      const seat = this.game.cells[index];
      cell.textContent = seat === null ? '' : SYMBOLS[seat];
      cell.classList.toggle('is-seat-0', seat === 0);
      cell.classList.toggle('is-seat-1', seat === 1);
      cell.disabled =
        seat !== null ||
        !this.awaitingHuman ||
        this.game.current !== this.mySeat ||
        this.isRoundOver();
    });
  }

  protected updateTurnDisplay(): void {
    this.hud?.set('turn', this.isRoundOver() ? '-' : SYMBOLS[this.game.current]);
  }

  protected getGameOverTitle(): string {
    if (this.game.winner === null) return t('draw');
    return this.game.winner === this.mySeat ? t('youWin') : t('youLose');
  }

  private buildBoard(): void {
    if (!this.board) return;
    this.board.replaceChildren();
    this.cells = Array.from({ length: BOARD_WIDTH * BOARD_WIDTH }, (_, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'tictactoe-cell';
      cell.dataset.index = String(index);
      cell.setAttribute('aria-label', String(index + 1));
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
