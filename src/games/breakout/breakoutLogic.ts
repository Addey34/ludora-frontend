import { generateLevel } from './breakoutLevels.js';
import type { Ball, Brick, BreakoutEvent, BreakoutGameState } from './breakoutState.js';

type RandomSource = () => number;

// --- Board constants (exported for renderers) ---
export const BOARD = 100;
export const BALL_R = 1.6;
export const PADDLE_W = 16;
export const PADDLE_H = 2.5;
export const PADDLE_Y = 93;

const SIDE_MARGIN = 3;
const TOP_MARGIN = 8;
const BRICK_GAP = 1;
const BRICK_H = 3.5;

export const BASE_SPEED = 0.055;
export const SPEED_PER_LEVEL = 1.06;
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;
const PADDLE_SPEED = 0.12;

// --- Pure helpers ---

export function clampPaddle(x: number): number {
  return Math.max(PADDLE_W / 2, Math.min(BOARD - PADDLE_W / 2, x));
}

export function movePaddle(
  paddleX: number,
  keys: { left: boolean; right: boolean },
  dt: number
): number {
  let dir = 0;
  if (keys.left) dir -= 1;
  if (keys.right) dir += 1;
  if (dir === 0) return paddleX;
  return clampPaddle(paddleX + dir * PADDLE_SPEED * dt);
}

export function collideBallWalls(ball: Ball): Ball {
  let { x, y, vx, vy } = ball;
  if (x - BALL_R <= 0) {
    x = BALL_R;
    vx = Math.abs(vx);
  } else if (x + BALL_R >= BOARD) {
    x = BOARD - BALL_R;
    vx = -Math.abs(vx);
  }
  if (y - BALL_R <= 0) {
    y = BALL_R;
    vy = Math.abs(vy);
  }
  return { x, y, vx, vy };
}

export function collideBallPaddle(ball: Ball, paddleX: number, speed: number): Ball {
  if (ball.vy <= 0) return ball;
  const withinX = ball.x >= paddleX - PADDLE_W / 2 && ball.x <= paddleX + PADDLE_W / 2;
  const atPaddle = ball.y + BALL_R >= PADDLE_Y && ball.y - BALL_R <= PADDLE_Y + PADDLE_H;
  if (!withinX || !atPaddle) return ball;
  const offset = (ball.x - paddleX) / (PADDLE_W / 2);
  const angle = offset * MAX_BOUNCE_ANGLE;
  return {
    x: ball.x,
    y: PADDLE_Y - BALL_R,
    vx: speed * Math.sin(angle),
    vy: -speed * Math.cos(angle),
  };
}

export function collideBallBricks(
  ball: Ball,
  bricks: Brick[]
): { ball: Ball; bricks: Brick[]; hitIndex: number } {
  for (let i = 0; i < bricks.length; i++) {
    const brick = bricks[i];
    if (!brick.alive) continue;
    const overlapsX = ball.x + BALL_R > brick.x && ball.x - BALL_R < brick.x + brick.w;
    const overlapsY = ball.y + BALL_R > brick.y && ball.y - BALL_R < brick.y + brick.h;
    if (!overlapsX || !overlapsY) continue;

    const penLeft = ball.x + BALL_R - brick.x;
    const penRight = brick.x + brick.w - (ball.x - BALL_R);
    const penTop = ball.y + BALL_R - brick.y;
    const penBottom = brick.y + brick.h - (ball.y - BALL_R);
    const newBall =
      Math.min(penLeft, penRight) < Math.min(penTop, penBottom)
        ? { ...ball, vx: -ball.vx }
        : { ...ball, vy: -ball.vy };

    const newHp = brick.hp - 1;
    const newBricks = bricks.map((b, j) => (j === i ? { ...b, hp: newHp, alive: newHp > 0 } : b));
    return { ball: newBall, bricks: newBricks, hitIndex: i };
  }
  return { ball, bricks, hitIndex: -1 };
}

export function resetBall(
  paddleX: number,
  speed: number,
  random: RandomSource = Math.random
): Ball {
  const angle = (random() * 2 - 1) * (MAX_BOUNCE_ANGLE / 2);
  return {
    x: paddleX,
    y: PADDLE_Y - BALL_R - 1,
    vx: speed * Math.sin(angle),
    vy: -speed * Math.cos(angle),
  };
}

export function buildBricksForLevel(level: number): Brick[] {
  const spec = generateLevel(level);
  const cols = spec.cols;
  const usableWidth = BOARD - 2 * SIDE_MARGIN - (cols - 1) * BRICK_GAP;
  const brickW = usableWidth / cols;
  return spec.bricks.map((b) => ({
    x: SIDE_MARGIN + b.col * (brickW + BRICK_GAP),
    y: TOP_MARGIN + b.row * (BRICK_H + BRICK_GAP),
    w: brickW,
    h: BRICK_H,
    alive: true,
    row: b.row,
    hp: b.hp,
    maxHp: b.hp,
  }));
}

export function createBreakoutState(
  level: number,
  lives: number,
  speed: number,
  random: RandomSource = Math.random
): BreakoutGameState {
  const bricks = buildBricksForLevel(level);
  const paddleX = BOARD / 2;
  return { ball: resetBall(paddleX, speed, random), paddleX, bricks, lives, level, speed };
}

export function stepBall(
  state: BreakoutGameState,
  dt: number,
  random: RandomSource = Math.random
): { state: BreakoutGameState; events: BreakoutEvent[] } {
  const events: BreakoutEvent[] = [];
  let { ball, bricks } = state;
  const { paddleX, speed } = state;

  const distance = Math.max(Math.abs(ball.vx), Math.abs(ball.vy)) * dt;
  const steps = Math.max(1, Math.ceil(distance / BALL_R));
  const stepDt = dt / steps;

  for (let i = 0; i < steps; i++) {
    ball = { ...ball, x: ball.x + ball.vx * stepDt, y: ball.y + ball.vy * stepDt };
    ball = collideBallWalls(ball);
    ball = collideBallPaddle(ball, paddleX, speed);

    const hit = collideBallBricks(ball, bricks);
    if (hit.hitIndex >= 0) {
      ball = hit.ball;
      bricks = hit.bricks;
      events.push({ type: 'brickDamaged', index: hit.hitIndex });
    }

    if (ball.y - BALL_R > BOARD) {
      events.push({ type: 'ballLost' });
      ball = resetBall(paddleX, speed, random);
      break;
    }
  }

  // Level complete: all bricks dead now, and at least one was alive before this step.
  if (bricks.every((b) => !b.alive) && state.bricks.some((b) => b.alive)) {
    events.push({ type: 'levelComplete' });
  }

  return { state: { ...state, ball, bricks }, events };
}
