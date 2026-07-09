import type { IRenderer } from '../../shared/engine/IRenderer.js';
import {
  PONG_BALL_RADIUS,
  PONG_FIRE_SPEED,
  PONG_OPPONENT_X,
  PONG_PADDLE_HEIGHT,
  PONG_PADDLE_THICKNESS,
  PONG_PLAYER_X,
  type PongRenderState,
} from './pongState.js';

export class PongDOMRenderer implements IRenderer<PongRenderState> {
  private ballElement: HTMLElement | null = null;
  private playerPaddleEl: HTMLElement | null = null;
  private opponentPaddleEl: HTMLElement | null = null;

  constructor(private readonly boardElement: HTMLElement) {
    this.buildBoard();
  }

  render(state: PongRenderState): void {
    if (this.ballElement) {
      this.ballElement.style.left = `${state.ball.x - PONG_BALL_RADIUS}%`;
      this.ballElement.style.top = `${state.ball.y - PONG_BALL_RADIUS}%`;
      this.ballElement.classList.toggle('is-onfire', state.speed >= PONG_FIRE_SPEED);
    }
    if (this.playerPaddleEl) {
      this.playerPaddleEl.style.top = `${state.playerY - PONG_PADDLE_HEIGHT / 2}%`;
    }
    if (this.opponentPaddleEl) {
      this.opponentPaddleEl.style.top = `${state.opponentY - PONG_PADDLE_HEIGHT / 2}%`;
    }
  }

  getBallElement(): HTMLElement | null {
    return this.ballElement;
  }

  dispose(): void {
    this.boardElement.innerHTML = '';
    this.ballElement = null;
    this.playerPaddleEl = null;
    this.opponentPaddleEl = null;
  }

  private buildBoard(): void {
    this.boardElement.innerHTML = `
      <div class="pong-net" aria-hidden="true"></div>
      <div class="pong-paddle pong-paddle--player"></div>
      <div class="pong-paddle pong-paddle--opponent"></div>
      <div class="pong-ball"></div>`;

    this.playerPaddleEl = this.boardElement.querySelector('.pong-paddle--player');
    this.opponentPaddleEl = this.boardElement.querySelector('.pong-paddle--opponent');
    this.ballElement = this.boardElement.querySelector('.pong-ball');

    for (const [el, x] of [
      [this.playerPaddleEl, PONG_PLAYER_X],
      [this.opponentPaddleEl, PONG_OPPONENT_X],
    ] as const) {
      if (!el) continue;
      el.style.width = `${PONG_PADDLE_THICKNESS}%`;
      el.style.height = `${PONG_PADDLE_HEIGHT}%`;
      el.style.left = `${x - PONG_PADDLE_THICKNESS / 2}%`;
    }
    if (this.ballElement) {
      this.ballElement.style.width = `${PONG_BALL_RADIUS * 2}%`;
      this.ballElement.style.height = `${PONG_BALL_RADIUS * 2}%`;
    }
  }
}
