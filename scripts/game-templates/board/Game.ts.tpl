import { t } from '../../shared/i18n/i18n.js';
import { BoardGame } from '../../shared/turn/BoardGame.js';
import type { TurnRules } from '../../shared/turn/turnGame.js';
import { setupHud } from '../../shared/ui/hud.js';
import {
  BOARD_WIDTH,
  is{{Class}}Draw,
  {{camel}}Rules,
  type {{Class}}Move,
  type {{Class}}State,
} from './{{key}}.js';

const SYMBOLS = ['X', 'O'] as const;

export class {{Class}}Game extends BoardGame<{{Class}}State, {{Class}}Move> {
  private board: HTMLElement | null = null;
  private cells: HTMLButtonElement[] = [];

  constructor() {
    super({ storageKey: '{{key}}-scores' });
  }

  protected get rules(): TurnRules<{{Class}}State, {{Class}}Move> {
    return {{camel}}Rules;
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

  protected moveEquals(a: {{Class}}Move, b: {{Class}}Move): boolean {
    return a.index === b.index;
  }

  protected decideBotMove(legalMoves: {{Class}}Move[]): {{Class}}Move {
    const move = legalMoves[0];
    if (!move) throw new Error('No legal move available');
    return move;
  }

  protected isRoundOver(): boolean {
    return this.game.winner !== null || is{{Class}}Draw(this.game);
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
      cell.className = '{{key}}-cell';
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
