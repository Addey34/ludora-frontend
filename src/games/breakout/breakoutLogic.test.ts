import { describe, it, expect } from 'vitest';
import {
  BOARD,
  BALL_R,
  PADDLE_W,
  PADDLE_Y,
  BASE_SPEED,
  clampPaddle,
  movePaddle,
  collideBallWalls,
  collideBallPaddle,
  collideBallBricks,
  resetBall,
  buildBricksForLevel,
  createBreakoutState,
  stepBall,
} from './breakoutLogic.js';
import type { Ball, Brick } from './breakoutState.js';

const KEYS_NONE = { left: false, right: false };
const KEYS_LEFT = { left: true, right: false };
const KEYS_RIGHT = { left: false, right: true };

function makeBrick(overrides: Partial<Brick> = {}): Brick {
  return { x: 40, y: 20, w: 10, h: 3.5, alive: true, row: 0, hp: 1, maxHp: 1, ...overrides };
}

function makeBall(overrides: Partial<Ball> = {}): Ball {
  return { x: 50, y: 50, vx: 0.05, vy: -0.05, ...overrides };
}

describe('clampPaddle', () => {
  it('clamps to left edge', () => {
    expect(clampPaddle(0)).toBeCloseTo(PADDLE_W / 2);
  });
  it('clamps to right edge', () => {
    expect(clampPaddle(BOARD)).toBeCloseTo(BOARD - PADDLE_W / 2);
  });
  it('keeps values in the middle unchanged', () => {
    expect(clampPaddle(50)).toBe(50);
  });
});

describe('movePaddle', () => {
  it('does not move without keys', () => {
    expect(movePaddle(50, KEYS_NONE, 16)).toBe(50);
  });
  it('moves left', () => {
    expect(movePaddle(50, KEYS_LEFT, 16)).toBeLessThan(50);
  });
  it('moves right', () => {
    expect(movePaddle(50, KEYS_RIGHT, 16)).toBeGreaterThan(50);
  });
  it('clamps at the wall', () => {
    expect(movePaddle(0, KEYS_LEFT, 1000)).toBeCloseTo(PADDLE_W / 2);
  });
});

describe('collideBallWalls', () => {
  it('bounces off the left wall', () => {
    const b = collideBallWalls({ x: 0, y: 50, vx: -0.1, vy: 0 });
    expect(b.x).toBeCloseTo(BALL_R);
    expect(b.vx).toBeGreaterThan(0);
  });
  it('bounces off the right wall', () => {
    const b = collideBallWalls({ x: BOARD, y: 50, vx: 0.1, vy: 0 });
    expect(b.x).toBeCloseTo(BOARD - BALL_R);
    expect(b.vx).toBeLessThan(0);
  });
  it('bounces off the top wall', () => {
    const b = collideBallWalls({ x: 50, y: 0, vx: 0, vy: -0.1 });
    expect(b.y).toBeCloseTo(BALL_R);
    expect(b.vy).toBeGreaterThan(0);
  });
  it('leaves the bottom open (ball can be lost)', () => {
    const b = collideBallWalls({ x: 50, y: BOARD + 5, vx: 0, vy: 0.1 });
    expect(b.vy).toBeGreaterThan(0); // no bounce
  });
});

describe('collideBallPaddle', () => {
  it('does not bounce when ball moves up', () => {
    const ball = makeBall({ y: PADDLE_Y, vy: -0.05 });
    const result = collideBallPaddle(ball, 50, BASE_SPEED);
    expect(result).toBe(ball); // same reference = untouched
  });
  it('bounces when ball hits paddle from above', () => {
    const ball: Ball = { x: 50, y: PADDLE_Y + BALL_R - 0.1, vx: 0, vy: 0.05 };
    const result = collideBallPaddle(ball, 50, BASE_SPEED);
    expect(result.vy).toBeLessThan(0);
    expect(result.y).toBeCloseTo(PADDLE_Y - BALL_R);
  });
  it('applies an angle when hitting off-center', () => {
    const ball: Ball = { x: 50 + PADDLE_W / 4, y: PADDLE_Y + BALL_R - 0.1, vx: 0, vy: 0.05 };
    const result = collideBallPaddle(ball, 50, BASE_SPEED);
    expect(Math.abs(result.vx)).toBeGreaterThan(0);
  });
  it('preserves exact speed magnitude', () => {
    const ball: Ball = { x: 50, y: PADDLE_Y + BALL_R - 0.1, vx: 0, vy: 0.05 };
    const result = collideBallPaddle(ball, 50, BASE_SPEED);
    const mag = Math.sqrt(result.vx ** 2 + result.vy ** 2);
    expect(mag).toBeCloseTo(BASE_SPEED, 5);
  });
});

describe('collideBallBricks', () => {
  it('returns hitIndex -1 when no collision', () => {
    const ball = makeBall({ x: 10, y: 10 });
    const result = collideBallBricks(ball, [makeBrick()]);
    expect(result.hitIndex).toBe(-1);
    expect(result.ball).toBe(ball);
  });
  it('detects a collision from above (vy bounce)', () => {
    const ball: Ball = { x: 45, y: 20 - BALL_R + 0.1, vx: 0, vy: 0.05 };
    const result = collideBallBricks(ball, [makeBrick()]);
    expect(result.hitIndex).toBe(0);
    expect(result.ball.vy).toBeLessThan(0);
  });
  it('detects a collision from the side (vx bounce)', () => {
    const ball: Ball = { x: 40 - BALL_R + 0.1, y: 21.75, vx: 0.05, vy: 0 };
    const result = collideBallBricks(ball, [makeBrick()]);
    expect(result.hitIndex).toBe(0);
    expect(result.ball.vx).toBeLessThan(0);
  });
  it('decrements brick hp on hit', () => {
    const ball: Ball = { x: 45, y: 20 - BALL_R + 0.1, vx: 0, vy: 0.05 };
    const brick = makeBrick({ hp: 2, maxHp: 2 });
    const result = collideBallBricks(ball, [brick]);
    expect(result.bricks[0].hp).toBe(1);
    expect(result.bricks[0].alive).toBe(true);
  });
  it('marks brick as dead when hp reaches 0', () => {
    const ball: Ball = { x: 45, y: 20 - BALL_R + 0.1, vx: 0, vy: 0.05 };
    const brick = makeBrick({ hp: 1, maxHp: 1 });
    const result = collideBallBricks(ball, [brick]);
    expect(result.bricks[0].alive).toBe(false);
  });
  it('skips dead bricks', () => {
    const ball: Ball = { x: 45, y: 20 - BALL_R + 0.1, vx: 0, vy: 0.05 };
    const brick = makeBrick({ alive: false });
    const result = collideBallBricks(ball, [brick]);
    expect(result.hitIndex).toBe(-1);
  });
});

describe('resetBall', () => {
  it('places ball above the paddle', () => {
    const ball = resetBall(50, BASE_SPEED);
    expect(ball.y).toBeLessThan(PADDLE_Y);
    expect(ball.x).toBe(50);
  });
  it('launches upward', () => {
    const ball = resetBall(50, BASE_SPEED);
    expect(ball.vy).toBeLessThan(0);
  });
  it('has the correct speed magnitude', () => {
    const ball = resetBall(50, BASE_SPEED, () => 0.5);
    const mag = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
    expect(mag).toBeCloseTo(BASE_SPEED, 5);
  });
});

describe('buildBricksForLevel', () => {
  it('generates at least one brick', () => {
    const bricks = buildBricksForLevel(1);
    expect(bricks.length).toBeGreaterThan(0);
  });
  it('all bricks are alive and positioned within the board', () => {
    const bricks = buildBricksForLevel(1);
    for (const b of bricks) {
      expect(b.alive).toBe(true);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(BOARD);
    }
  });
  it('generates reinforced bricks in higher worlds', () => {
    // World 2+ should have at least some hp > 1
    const bricks = buildBricksForLevel(20); // world 2
    const hasReinforced = bricks.some((b) => b.maxHp > 1);
    expect(hasReinforced).toBe(true);
  });
});

describe('stepBall', () => {
  it('emits ballLost when the ball falls below the board', () => {
    const state = createBreakoutState(1, 3, BASE_SPEED, () => 0.5);
    const fallen = { ...state, ball: { x: 50, y: BOARD + 5, vx: 0, vy: 0.1 } };
    const { events } = stepBall(fallen, 16);
    expect(events.some((e) => e.type === 'ballLost')).toBe(true);
  });
  it('resets ball position after it is lost', () => {
    const state = createBreakoutState(1, 3, BASE_SPEED, () => 0.5);
    const fallen = { ...state, ball: { x: 50, y: BOARD + 5, vx: 0, vy: 0.1 } };
    const { state: next } = stepBall(fallen, 16);
    expect(next.ball.y).toBeLessThan(PADDLE_Y);
  });
  it('emits levelComplete when all bricks are destroyed', () => {
    const brick = makeBrick({ hp: 1 });
    const ball: Ball = { x: 45, y: 20 - BALL_R + 0.1, vx: 0, vy: 0.01 };
    const state = createBreakoutState(1, 3, BASE_SPEED);
    const oneLeft = { ...state, ball, bricks: [brick] };
    const { events } = stepBall(oneLeft, 16);
    expect(events.some((e) => e.type === 'levelComplete')).toBe(true);
  });
  it('does not emit levelComplete when starting fresh (all alive)', () => {
    const state = createBreakoutState(1, 3, BASE_SPEED);
    const { events } = stepBall(state, 16);
    expect(events.some((e) => e.type === 'levelComplete')).toBe(false);
  });
});
