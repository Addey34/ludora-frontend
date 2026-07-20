import { describe, expect, it } from 'vitest';
import { createAsteroidsState, stepAsteroids } from './asteroidsLogic.js';
import type { Asteroid, AsteroidsState } from './asteroidsState.js';

const idle = { turn: 0 as const, thrust: false, shoot: false };

function asteroid(size: Asteroid['size'] = 'large'): Asteroid {
  return {
    id: 1,
    position: { x: 20, y: 20 },
    velocity: { x: 0, y: 0 },
    angle: 0,
    spin: 0,
    size,
  };
}

function stateWith(overrides: Partial<AsteroidsState> = {}): AsteroidsState {
  return {
    ship: {
      position: { x: 50, y: 50 },
      velocity: { x: 0, y: 0 },
      angle: 0,
      thrusting: false,
      invulnerableMs: 0,
    },
    asteroids: [asteroid()],
    bullets: [],
    lives: 3,
    level: 1,
    shootCooldownMs: 0,
    nextId: 2,
    ...overrides,
  };
}

describe('asteroids logic', () => {
  it('creates a level with more large asteroids as progression increases', () => {
    const first = createAsteroidsState({ level: 1, lives: 4 }, () => 0);
    const fourth = createAsteroidsState({ level: 4 }, () => 0);

    expect(first.asteroids).toHaveLength(4);
    expect(first.lives).toBe(4);
    expect(fourth.asteroids).toHaveLength(7);
    expect(first.asteroids.every((item) => item.size === 'large')).toBe(true);
  });

  it('rotates, accelerates and wraps the ship around the arena', () => {
    const current = stateWith({
      ship: {
        position: { x: 99.5, y: 50 },
        velocity: { x: 0.04, y: 0 },
        angle: 0,
        thrusting: false,
        invulnerableMs: 0,
      },
    });
    const result = stepAsteroids(current, { turn: 1, thrust: true, shoot: false }, 50).state;

    expect(result.ship.position.x).toBeLessThan(5);
    expect(result.ship.angle).toBeGreaterThan(0);
    expect(result.ship.thrusting).toBe(true);
  });

  it('rate-limits shots and expires bullets', () => {
    const fired = stepAsteroids(stateWith(), { ...idle, shoot: true }, 0).state;
    const held = stepAsteroids(fired, { ...idle, shoot: true }, 10).state;
    const expired = stepAsteroids(held, idle, 50);

    expect(fired.bullets).toHaveLength(1);
    expect(held.bullets).toHaveLength(1);
    expect(expired.state.bullets[0].ttlMs).toBeLessThan(fired.bullets[0].ttlMs);
  });

  it('splits a large asteroid and awards its point value', () => {
    const current = stateWith({
      bullets: [
        {
          id: 2,
          position: { x: 20, y: 20 },
          velocity: { x: 0, y: 0 },
          ttlMs: 100,
        },
      ],
      nextId: 3,
    });
    const result = stepAsteroids(current, idle, 0);

    expect(result.state.bullets).toHaveLength(0);
    expect(result.state.asteroids.map((item) => item.size)).toEqual(['medium', 'medium']);
    expect(result.events).toContainEqual({
      type: 'asteroidDestroyed',
      asteroid: current.asteroids[0],
      points: 20,
    });
  });

  it('completes a level when its final small asteroid is destroyed', () => {
    const rock = asteroid('small');
    const current = stateWith({
      asteroids: [rock],
      bullets: [
        {
          id: 2,
          position: { ...rock.position },
          velocity: { x: 0, y: 0 },
          ttlMs: 100,
        },
      ],
    });
    const result = stepAsteroids(current, idle, 0);

    expect(result.state.asteroids).toHaveLength(0);
    expect(result.events.map((event) => event.type)).toEqual([
      'asteroidDestroyed',
      'levelComplete',
    ]);
  });

  it('removes a life on collision but protects the respawned ship', () => {
    const rock = { ...asteroid('small'), position: { x: 50, y: 50 } };
    const hit = stepAsteroids(stateWith({ asteroids: [rock], lives: 2 }), idle, 0);
    const protectedStep = stepAsteroids(hit.state, idle, 0);

    expect(hit.state.lives).toBe(1);
    expect(hit.events).toContainEqual({ type: 'shipHit' });
    expect(hit.state.ship.invulnerableMs).toBeGreaterThan(0);
    expect(protectedStep.state.lives).toBe(1);
  });
});
