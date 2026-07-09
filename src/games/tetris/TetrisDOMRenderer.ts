import type { IRenderer } from '../../shared/engine/IRenderer.js';
import type { TetrisGameState } from './tetrisState.js';
import { composeBoard } from './tetrisLogic.js';

export class TetrisDOMRenderer implements IRenderer<TetrisGameState> {
  constructor(private readonly boardElement: HTMLElement) {}

  render(state: TetrisGameState): void {
    const cells = composeBoard(state);
    this.boardElement.innerHTML = cells
      .map((row, y) => {
        const flash = state.clearingRows.includes(y) ? ' cell--clearing' : '';
        return row
          .map((type) => {
            if (!type) return `<div class="cell${flash}"></div>`;
            if (type === 'ghost') return `<div class="cell cell--ghost${flash}"></div>`;
            return `<div class="cell cell--${type}${flash}"></div>`;
          })
          .join('');
      })
      .join('');

    this.updateDangerState(state);
  }

  dispose(): void {
    this.boardElement.innerHTML = '';
    this.boardElement.classList.remove('is-danger');
  }

  private updateDangerState(state: TetrisGameState): void {
    const highestFilledRow = state.grid.findIndex((row) => row.some((cell) => cell !== null));
    const isDanger = highestFilledRow !== -1 && highestFilledRow <= Math.floor(state.rows * 0.35);
    this.boardElement.classList.toggle('is-danger', isDanger);
  }
}
