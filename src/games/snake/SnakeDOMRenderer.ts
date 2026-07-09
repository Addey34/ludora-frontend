import type { IRenderer } from '../../shared/engine/IRenderer.js';
import type { SnakeRenderState } from './snakeState.js';

export class SnakeDOMRenderer implements IRenderer<SnakeRenderState> {
  readonly continuousRender = true;
  private segmentEls: HTMLElement[] = [];
  private foodEl: HTMLElement | null = null;

  constructor(private readonly playBoard: HTMLElement) {}

  render(state: SnakeRenderState): void {
    this.playBoard.style.setProperty('--move-ms', `${state.moveInterval}ms`);
    this.renderSnake(state);
    this.renderFood(state);
  }

  dispose(): void {
    this.segmentEls.forEach((el) => el.remove());
    this.segmentEls = [];
    this.foodEl?.remove();
    this.foodEl = null;
  }

  private renderSnake(state: SnakeRenderState): void {
    const { body, direction } = state.snake;

    body.forEach((segment, index) => {
      let el = this.segmentEls[index];
      const isNew = el === undefined;
      if (isNew) {
        el = document.createElement('div');
        this.playBoard.appendChild(el);
        this.segmentEls[index] = el;
      }
      el.className = index === 0 ? `snake-head ${direction}` : 'snake-body';

      this.placeCell(el, segment.x, segment.y);
    });

    while (this.segmentEls.length > body.length) {
      this.segmentEls.pop()?.remove();
    }
  }

  private renderFood(state: SnakeRenderState): void {
    if (!this.foodEl) {
      this.foodEl = document.createElement('div');
      this.foodEl.innerHTML = `
        <div class="food-ear left"></div>
        <div class="food-ear right"></div>
        <div class="food-body"></div>
        <div class="food-eye left"></div>
        <div class="food-eye right"></div>
        <div class="food-nose"></div>
        <div class="food-tail"></div>
      `;
      this.playBoard.appendChild(this.foodEl);
    }
    const { position, variant } = state.food;
    this.foodEl.className = `food food--${variant}`;
    this.placeCell(this.foodEl, position.x, position.y);
  }

  private placeCell(el: HTMLElement, x: number, y: number): void {
    el.style.transition = 'none';
    el.style.transform = 'translate(' + (x - 1) * 100 + '%, ' + (y - 1) * 100 + '%)';
    el.dataset.x = String(x);
    el.dataset.y = String(y);
  }
}
