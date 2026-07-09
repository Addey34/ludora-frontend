import type { IRenderer } from '../../shared/engine/IRenderer.js';
import type { BreakoutGameState, Brick } from './breakoutState.js';
import { BALL_R, PADDLE_W, PADDLE_H, PADDLE_Y } from './breakoutLogic.js';

export class BreakoutDOMRenderer implements IRenderer<BreakoutGameState> {
  private readonly ballEl: HTMLElement;
  private readonly paddleEl: HTMLElement;
  private readonly brickLayer: HTMLElement;
  private brickEls: HTMLElement[] = [];
  private lastLevel = 0;
  private lastBrickHps: number[] = [];

  constructor(boardEl: HTMLElement) {
    boardEl.innerHTML = `
      <div class="brick-layer"></div>
      <div class="paddle"></div>
      <div class="ball"></div>`;

    this.brickLayer = boardEl.querySelector('.brick-layer')!;
    this.paddleEl = boardEl.querySelector('.paddle')!;
    this.ballEl = boardEl.querySelector('.ball')!;

    this.paddleEl.style.width = `${PADDLE_W}%`;
    this.paddleEl.style.height = `${PADDLE_H}%`;
    this.paddleEl.style.top = `${PADDLE_Y}%`;
    this.ballEl.style.width = `${BALL_R * 2}%`;
    this.ballEl.style.height = `${BALL_R * 2}%`;
  }

  render(state: BreakoutGameState): void {
    this.ballEl.style.left = `${state.ball.x - BALL_R}%`;
    this.ballEl.style.top = `${state.ball.y - BALL_R}%`;
    this.paddleEl.style.left = `${state.paddleX - PADDLE_W / 2}%`;

    if (state.level !== this.lastLevel) {
      this.rebuildBricks(state.bricks, state.level);
    } else {
      this.reconcileBricks(state.bricks);
    }
  }

  dispose(): void {
    this.brickEls = [];
    this.lastLevel = 0;
    this.lastBrickHps = [];
  }

  private rebuildBricks(bricks: Brick[], level: number): void {
    this.brickLayer.innerHTML = bricks.map(brickMarkup).join('');
    this.brickEls = Array.from(this.brickLayer.querySelectorAll<HTMLElement>('.brick'));
    this.lastBrickHps = bricks.map((b) => b.hp);
    this.lastLevel = level;
  }

  private reconcileBricks(bricks: Brick[]): void {
    bricks.forEach((brick, i) => {
      const el = this.brickEls[i];
      if (!el || this.lastBrickHps[i] === brick.hp) return;
      if (!brick.alive) {
        el.classList.add('is-broken');
      } else {
        el.setAttribute('data-hp', String(brick.hp));
      }
      this.lastBrickHps[i] = brick.hp;
    });
  }
}

function brickMarkup(brick: Brick): string {
  const colorRow = (brick.row % 5) + 1;
  return (
    `<div class="brick brick--${colorRow}" data-hp="${brick.hp}"` +
    ` style="left:${brick.x}%;top:${brick.y}%;width:${brick.w}%;height:${brick.h}%"></div>`
  );
}
