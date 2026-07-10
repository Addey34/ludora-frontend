import {
  PONG_BALL_RADIUS,
  PONG_BASE_SPEED,
  PONG_BOARD,
  PONG_MAX_BOUNCE_ANGLE,
  PONG_OPPONENT_X,
  PONG_PADDLE_HEIGHT,
  PONG_PADDLE_THICKNESS,
  PONG_PLAYER_X,
  PONG_SERVE_DELAY,
  PONG_SPEED_PER_HIT,
  type PongBall,
  type PongGameState,
} from './pongState.js';

type RandomSource = () => number;

interface PongServe {
  ball: PongBall;
  speed: number;
  serveTimer: number;
}

interface PongPaddles {
  playerY: number;
  opponentY: number;
}

interface PongBallStepResult {
  ball: PongBall;
  speed: number;
  scored: 'player' | 'opponent' | null;
  wallBounce: boolean;
  paddleBounceDir: 1 | -1 | null;
}
export function createPongGameState(random: RandomSource = Math.random): PongGameState {
  const serve = createPongServe(true, random);
  return {
    ball: serve.ball,
    playerY: PONG_BOARD / 2,
    opponentY: PONG_BOARD / 2,
    opponentScore: 0,
    speed: serve.speed,
    serveTimer: serve.serveTimer,
  };
}

export function clampPongPaddle(y: number): number {
  return Math.max(PONG_PADDLE_HEIGHT / 2, Math.min(PONG_BOARD - PONG_PADDLE_HEIGHT / 2, y));
}

export function approachPongPaddle(value: number, target: number, maxStep: number): number {
  const delta = target - value;
  if (Math.abs(delta) <= maxStep) return clampPongPaddle(target);
  return clampPongPaddle(value + Math.sign(delta) * maxStep);
}

export function createPongServe(toPlayer: boolean, random: RandomSource = Math.random): PongServe {
  const speed = PONG_BASE_SPEED;
  const angle = (random() * 2 - 1) * (PONG_MAX_BOUNCE_ANGLE / 2);
  const dirX = toPlayer ? -1 : 1;

  return {
    speed,
    serveTimer: PONG_SERVE_DELAY,
    ball: {
      x: PONG_BOARD / 2,
      y: PONG_BOARD / 2,
      vx: dirX * speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
    },
  };
}

export function hitsPongPaddle(ball: PongBall, paddleX: number, paddleY: number): boolean {
  const withinX = Math.abs(ball.x - paddleX) <= PONG_PADDLE_THICKNESS / 2 + PONG_BALL_RADIUS;
  const withinY = Math.abs(ball.y - paddleY) <= PONG_PADDLE_HEIGHT / 2 + PONG_BALL_RADIUS;
  return withinX && withinY;
}

export function bouncePongBallOffPaddle(
  ball: PongBall,
  paddleY: number,
  speed: number,
  dirX: number
): { ball: PongBall; speed: number } {
  const offset = (ball.y - paddleY) / (PONG_PADDLE_HEIGHT / 2);
  const angle = Math.max(-1, Math.min(1, offset)) * PONG_MAX_BOUNCE_ANGLE;
  const nextSpeed = speed * PONG_SPEED_PER_HIT;

  return {
    speed: nextSpeed,
    ball: {
      ...ball,
      vx: dirX * nextSpeed * Math.cos(angle),
      vy: nextSpeed * Math.sin(angle),
    },
  };
}

export function stepPongBall(
  ball: PongBall,
  speed: number,
  paddles: PongPaddles,
  dt: number
): PongBallStepResult {
  let nextBall = { ...ball };
  let nextSpeed = speed;
  let wallBounce = false;
  let paddleBounceDir: 1 | -1 | null = null;
  const distance = Math.max(Math.abs(nextBall.vx), Math.abs(nextBall.vy)) * dt;
  const steps = Math.max(1, Math.ceil(distance / PONG_BALL_RADIUS));
  const stepDt = dt / steps;

  for (let i = 0; i < steps; i++) {
    nextBall = {
      ...nextBall,
      x: nextBall.x + nextBall.vx * stepDt,
      y: nextBall.y + nextBall.vy * stepDt,
    };

    const wallResult = collidePongWalls(nextBall);
    nextBall = wallResult.ball;
    wallBounce = wallBounce || wallResult.bounced;

    const paddleResult = collidePongPaddles(nextBall, nextSpeed, paddles);
    nextBall = paddleResult.ball;
    nextSpeed = paddleResult.speed;
    paddleBounceDir = paddleResult.bounceDir ?? paddleBounceDir;

    if (nextBall.x < -PONG_BALL_RADIUS) {
      return { ball: nextBall, speed: nextSpeed, scored: 'opponent', wallBounce, paddleBounceDir };
    }
    if (nextBall.x > PONG_BOARD + PONG_BALL_RADIUS) {
      return { ball: nextBall, speed: nextSpeed, scored: 'player', wallBounce, paddleBounceDir };
    }
  }

  return { ball: nextBall, speed: nextSpeed, scored: null, wallBounce, paddleBounceDir };
}

function collidePongWalls(ball: PongBall): { ball: PongBall; bounced: boolean } {
  if (ball.y - PONG_BALL_RADIUS <= 0) {
    return {
      bounced: true,
      ball: { ...ball, y: PONG_BALL_RADIUS, vy: Math.abs(ball.vy) },
    };
  }
  if (ball.y + PONG_BALL_RADIUS >= PONG_BOARD) {
    return {
      bounced: true,
      ball: { ...ball, y: PONG_BOARD - PONG_BALL_RADIUS, vy: -Math.abs(ball.vy) },
    };
  }
  return { ball, bounced: false };
}

function collidePongPaddles(
  ball: PongBall,
  speed: number,
  paddles: PongPaddles
): { ball: PongBall; speed: number; bounceDir: 1 | -1 | null } {
  if (ball.vx < 0 && hitsPongPaddle(ball, PONG_PLAYER_X, paddles.playerY)) {
    const result = bouncePongBallOffPaddle(ball, paddles.playerY, speed, 1);
    return {
      ball: {
        ...result.ball,
        x: PONG_PLAYER_X + PONG_PADDLE_THICKNESS / 2 + PONG_BALL_RADIUS,
      },
      speed: result.speed,
      bounceDir: 1,
    };
  }
  if (ball.vx > 0 && hitsPongPaddle(ball, PONG_OPPONENT_X, paddles.opponentY)) {
    const result = bouncePongBallOffPaddle(ball, paddles.opponentY, speed, -1);
    return {
      ball: {
        ...result.ball,
        x: PONG_OPPONENT_X - PONG_PADDLE_THICKNESS / 2 - PONG_BALL_RADIUS,
      },
      speed: result.speed,
      bounceDir: -1,
    };
  }
  return { ball, speed, bounceDir: null };
}
