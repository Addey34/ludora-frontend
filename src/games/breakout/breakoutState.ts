export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  row: number;
  hp: number;
  maxHp: number;
}

export interface BreakoutGameState {
  ball: Ball;
  paddleX: number;
  bricks: Brick[];
  lives: number;
  level: number;
  speed: number;
}

export type BreakoutEvent =
  | { type: 'brickDamaged'; index: number }
  | { type: 'ballLost' }
  | { type: 'levelComplete' };
