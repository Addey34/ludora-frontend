import type { IRenderer } from '../../shared/engine/IRenderer.js';
import type { TemplatePosition, TemplateRenderState } from './templateState.js';

export class TemplateDOMRenderer implements IRenderer<TemplateRenderState> {
  private readonly playerEl = document.createElement('div');
  private readonly targetEl = document.createElement('div');

  constructor(private readonly playBoard: HTMLElement) {
    this.playerEl.className = 'template-player';
    this.targetEl.className = 'template-target';
    this.playBoard.append(this.targetEl, this.playerEl);
  }

  render(state: TemplateRenderState): void {
    this.playBoard.style.setProperty('--template-cell-size', `${100 / state.gridSize}%`);
    this.placeCell(this.playerEl, state.player);
    this.placeCell(this.targetEl, state.target);
  }

  dispose(): void {
    this.playerEl.remove();
    this.targetEl.remove();
  }

  private placeCell(el: HTMLElement, position: TemplatePosition): void {
    el.style.transform = `translate(${(position.x - 1) * 100}%, ${(position.y - 1) * 100}%)`;
  }
}
