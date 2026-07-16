import type { IRenderer } from '../../shared/engine/IRenderer.js';
import type { {{Class}}Position, {{Class}}State } from './{{key}}State.js';

export class {{Class}}DOMRenderer implements IRenderer<{{Class}}State> {
  private readonly player = document.createElement('div');
  private readonly target = document.createElement('div');

  constructor(private readonly board: HTMLElement) {
    this.player.className = '{{key}}-player';
    this.target.className = '{{key}}-target';
    this.player.setAttribute('aria-hidden', 'true');
    this.target.setAttribute('aria-hidden', 'true');
    this.board.append(this.target, this.player);
  }

  render(state: {{Class}}State): void {
    this.place(this.player, state.player);
    this.place(this.target, state.target);
  }

  dispose(): void {
    this.player.remove();
    this.target.remove();
  }

  private place(element: HTMLElement, position: {{Class}}Position): void {
    element.style.gridColumn = String(position.x + 1);
    element.style.gridRow = String(position.y + 1);
  }
}
