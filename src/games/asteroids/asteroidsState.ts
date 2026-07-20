export interface AsteroidsVector {
  x: number;
  y: number;
}

export interface AsteroidsShip {
  position: AsteroidsVector;
  velocity: AsteroidsVector;
  angle: number;
  thrusting: boolean;
  invulnerableMs: number;
}

export type AsteroidSize = 'large' | 'medium' | 'small';

export interface Asteroid {
  id: number;
  position: AsteroidsVector;
  velocity: AsteroidsVector;
  angle: number;
  spin: number;
  size: AsteroidSize;
}

export interface AsteroidsBullet {
  id: number;
  position: AsteroidsVector;
  velocity: AsteroidsVector;
  ttlMs: number;
}

export interface AsteroidsState {
  ship: AsteroidsShip;
  asteroids: Asteroid[];
  bullets: AsteroidsBullet[];
  lives: number;
  level: number;
  shootCooldownMs: number;
  nextId: number;
}

export interface AsteroidsInput {
  turn: -1 | 0 | 1;
  thrust: boolean;
  shoot: boolean;
}

export type AsteroidsEvent =
  | { type: 'asteroidDestroyed'; asteroid: Asteroid; points: number }
  | { type: 'shipHit' }
  | { type: 'levelComplete' };
