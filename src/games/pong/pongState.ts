/** Board coordinates use a square 0-100 logical space. */
export const PONG_BOARD = 100;

export const PONG_BALL_RADIUS = 1.8;
export const PONG_PADDLE_HEIGHT = 18;
export const PONG_PADDLE_THICKNESS = 2.4;
export const PONG_PLAYER_X = 4;
export const PONG_OPPONENT_X = PONG_BOARD - 4;

export const PONG_BASE_SPEED = 0.05;
export const PONG_SPEED_PER_HIT = 1.08;
export const PONG_FIRE_SPEED = 0.18;
export const PONG_PLAYER_SPEED = 0.115;
export const PONG_BOT_SPEED = 0.092;
export const PONG_MAX_BOUNCE_ANGLE = (50 * Math.PI) / 180;
export const PONG_SERVE_DELAY = 800;
export const PONG_END_DELAY = 800;

export const PONG_WIN_SCORES = [3, 5, 11] as const;
export const PONG_DEFAULT_WIN_SCORE = 5;

/**
 * The ball, in logical board coordinates. `vx`/`vy` are in units per millisecond.
 */
export interface PongBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Authoritative snapshot the host broadcasts (host = left paddle). */
export interface PongGameState {
  ball: PongBall;
  playerY: number;
  opponentY: number;
  opponentScore: number;
  speed: number;
  serveTimer: number;
}

export type PongRenderState = Pick<PongGameState, 'ball' | 'playerY' | 'opponentY' | 'speed'>;
export interface PongHostState {
  bx: number;
  by: number;
  bvx: number;
  bvy: number;
  hy: number;
  hs: number;
  gs: number;
  sv: boolean;
}
