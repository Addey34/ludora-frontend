import { describe, expect, it } from 'vitest';
import {
  approachPongPaddle,
  bouncePongBallOffPaddle,
  clampPongPaddle,
  createPongServe,
  hitsPongPaddle,
  stepPongBall,
} from './pongLogic.js';
import {
  PONG_BALL_RADIUS,
  PONG_BASE_SPEED,
  PONG_BOARD,
  PONG_OPPONENT_X,
  PONG_PLAYER_X,
} from './pongState.js';

describe('pongLogic', () => {
  it('clamps paddle centers inside the board', () => {
    expect(clampPongPaddle(-100)).toBe(9);
    expect(clampPongPaddle(PONG_BOARD + 100)).toBe(91);
    expect(clampPongPaddle(50)).toBe(50);
  });

  it('approaches a target without overshooting', () => {
    expect(approachPongPaddle(50, 70, 5)).toBe(55);
    expect(approachPongPaddle(50, 52, 5)).toBe(52);
  });

  it('serves from center toward the requested side', () => {
    const towardPlayer = createPongServe(true, () => 0.5);
    const towardOpponent = createPongServe(false, () => 0.5);

    expect(towardPlayer.ball).toMatchObject({ x: 50, y: 50, vy: 0 });
    expect(towardPlayer.ball.vx).toBeLessThan(0);
    expect(towardOpponent.ball.vx).toBeGreaterThan(0);
    expect(towardPlayer.speed).toBe(PONG_BASE_SPEED);
  });

  it('detects paddle overlap', () => {
    expect(hitsPongPaddle({ x: PONG_PLAYER_X, y: 50, vx: -1, vy: 0 }, PONG_PLAYER_X, 50)).toBe(
      true
    );
    expect(hitsPongPaddle({ x: PONG_OPPONENT_X, y: 10, vx: 1, vy: 0 }, PONG_OPPONENT_X, 50)).toBe(
      false
    );
  });

  it('bounces from a paddle and accelerates', () => {
    const result = bouncePongBallOffPaddle({ x: PONG_PLAYER_X, y: 50, vx: -1, vy: 0 }, 50, 0.1, 1);

    expect(result.speed).toBeGreaterThan(0.1);
    expect(result.ball.vx).toBeGreaterThan(0);
    expect(result.ball.vy).toBe(0);
  });
  it('bounces the ball off walls', () => {
    const result = stepPongBall(
      { x: 50, y: PONG_BALL_RADIUS / 2, vx: 0, vy: -0.1 },
      0.1,
      { playerY: 50, opponentY: 50 },
      16
    );

    expect(result.wallBounce).toBe(true);
    expect(result.ball.y).toBe(PONG_BALL_RADIUS);
    expect(result.ball.vy).toBeGreaterThan(0);
  });

  it('bounces the ball off paddles and reports the bounce direction', () => {
    const result = stepPongBall(
      { x: PONG_PLAYER_X, y: 50, vx: -0.1, vy: 0 },
      0.1,
      { playerY: 50, opponentY: 50 },
      1
    );

    expect(result.scored).toBeNull();
    expect(result.paddleBounceDir).toBe(1);
    expect(result.speed).toBeGreaterThan(0.1);
    expect(result.ball.vx).toBeGreaterThan(0);
  });

  it('reports scoring when the ball exits either side', () => {
    const opponentPoint = stepPongBall(
      { x: -PONG_BALL_RADIUS - 0.1, y: 50, vx: -0.1, vy: 0 },
      0.1,
      { playerY: 50, opponentY: 50 },
      1
    );
    const playerPoint = stepPongBall(
      { x: PONG_BOARD + PONG_BALL_RADIUS + 0.1, y: 50, vx: 0.1, vy: 0 },
      0.1,
      { playerY: 50, opponentY: 50 },
      1
    );

    expect(opponentPoint.scored).toBe('opponent');
    expect(playerPoint.scored).toBe('player');
  });
});
