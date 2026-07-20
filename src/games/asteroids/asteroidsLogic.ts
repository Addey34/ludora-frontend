import type {
  Asteroid,
  AsteroidSize,
  AsteroidsBullet,
  AsteroidsEvent,
  AsteroidsInput,
  AsteroidsShip,
  AsteroidsState,
  AsteroidsVector,
} from './asteroidsState.js';

export const BOARD_SIZE = 100;
export const SHIP_RADIUS = 2.4;

const INITIAL_SHIP_ANGLE = -Math.PI / 2;
const ROTATION_SPEED = 0.0042;
const THRUST_ACCELERATION = 0.000035;
const VELOCITY_DAMPING_PER_MS = 0.99965;
const MAX_SHIP_SPEED = 0.045;
const BULLET_SPEED = 0.075;
const BULLET_LIFETIME_MS = 1250;
const SHOOT_COOLDOWN_MS = 190;
const RESPAWN_INVULNERABILITY_MS = 1800;
const MAX_STEP_MS = 50;
const LARGE_ASTEROIDS_BASE = 3;
const LARGE_ASTEROIDS_MAX = 8;
const ASTEROID_MIN_SPEED = 0.007;
const ASTEROID_SPEED_RANGE = 0.006;
const LEVEL_SPEED_INCREASE = 0.055;
const SPLIT_ANGLE = 0.72;
const SPLIT_SPEED_MULTIPLIER = 1.18;
const ASTEROID_RADII: Record<AsteroidSize, number> = {
  large: 7.5,
  medium: 4.6,
  small: 2.6,
};
const ASTEROID_POINTS: Record<AsteroidSize, number> = {
  large: 20,
  medium: 50,
  small: 100,
};

type RandomSource = () => number;

interface CreateAsteroidsOptions {
  level?: number;
  lives?: number;
  speedMultiplier?: number;
}

export function createAsteroidsState(
  options: CreateAsteroidsOptions = {},
  random: RandomSource = Math.random
): AsteroidsState {
  const level = Math.max(1, Math.floor(options.level ?? 1));
  const lives = Math.max(0, Math.floor(options.lives ?? 3));
  const speedMultiplier = Math.max(0.5, options.speedMultiplier ?? 1);
  const count = Math.min(LARGE_ASTEROIDS_MAX, LARGE_ASTEROIDS_BASE + level);
  const asteroids: Asteroid[] = [];

  for (let index = 0; index < count; index++) {
    asteroids.push(createLargeAsteroid(index + 1, level, speedMultiplier, random));
  }

  return {
    ship: createShip(),
    asteroids,
    bullets: [],
    lives,
    level,
    shootCooldownMs: 0,
    nextId: count + 1,
  };
}

export function stepAsteroids(
  current: AsteroidsState,
  input: AsteroidsInput,
  deltaTime: number
): { state: AsteroidsState; events: AsteroidsEvent[] } {
  const dt = Math.max(0, Math.min(MAX_STEP_MS, deltaTime));
  const events: AsteroidsEvent[] = [];
  let nextId = current.nextId;
  let shootCooldownMs = Math.max(0, current.shootCooldownMs - dt);
  let ship = moveShip(current.ship, input, dt);
  let bullets = current.bullets
    .map((bullet) => moveBullet(bullet, dt))
    .filter((bullet) => bullet.ttlMs > 0);
  let asteroids = current.asteroids.map((asteroid) => moveAsteroid(asteroid, dt));

  if (input.shoot && shootCooldownMs === 0 && current.lives > 0) {
    bullets.push(createBullet(nextId++, ship));
    shootCooldownMs = SHOOT_COOLDOWN_MS;
  }

  const consumedBullets = new Set<number>();
  const destroyedAsteroids = new Set<number>();
  const fragments: Asteroid[] = [];

  for (const bullet of bullets) {
    const hit = asteroids.find(
      (asteroid) =>
        !destroyedAsteroids.has(asteroid.id) &&
        collides(bullet.position, asteroid.position, ASTEROID_RADII[asteroid.size])
    );
    if (!hit) continue;

    consumedBullets.add(bullet.id);
    destroyedAsteroids.add(hit.id);
    events.push({
      type: 'asteroidDestroyed',
      asteroid: hit,
      points: ASTEROID_POINTS[hit.size],
    });

    const split = splitAsteroid(hit, nextId);
    nextId += split.length;
    fragments.push(...split);
  }

  bullets = bullets.filter((bullet) => !consumedBullets.has(bullet.id));
  asteroids = [
    ...asteroids.filter((asteroid) => !destroyedAsteroids.has(asteroid.id)),
    ...fragments,
  ];

  let lives = current.lives;
  if (
    ship.invulnerableMs === 0 &&
    asteroids.some((asteroid) =>
      collides(ship.position, asteroid.position, SHIP_RADIUS + ASTEROID_RADII[asteroid.size])
    )
  ) {
    lives = Math.max(0, lives - 1);
    ship = createShip();
    events.push({ type: 'shipHit' });
  }

  if (current.asteroids.length > 0 && asteroids.length === 0) {
    events.push({ type: 'levelComplete' });
  }

  return {
    state: {
      ship,
      asteroids,
      bullets,
      lives,
      level: current.level,
      shootCooldownMs,
      nextId,
    },
    events,
  };
}

export function asteroidRadius(size: AsteroidSize): number {
  return ASTEROID_RADII[size];
}

function createShip(): AsteroidsShip {
  return {
    position: { x: BOARD_SIZE / 2, y: BOARD_SIZE / 2 },
    velocity: { x: 0, y: 0 },
    angle: INITIAL_SHIP_ANGLE,
    thrusting: false,
    invulnerableMs: RESPAWN_INVULNERABILITY_MS,
  };
}

function createLargeAsteroid(
  id: number,
  level: number,
  speedMultiplier: number,
  random: RandomSource
): Asteroid {
  const edge = Math.min(3, Math.floor(random() * 4));
  const offset = random() * BOARD_SIZE;
  const position: AsteroidsVector =
    edge === 0
      ? { x: offset, y: 0 }
      : edge === 1
        ? { x: BOARD_SIZE, y: offset }
        : edge === 2
          ? { x: offset, y: BOARD_SIZE }
          : { x: 0, y: offset };
  const heading = random() * Math.PI * 2;
  const levelMultiplier = 1 + (level - 1) * LEVEL_SPEED_INCREASE;
  const speed =
    (ASTEROID_MIN_SPEED + random() * ASTEROID_SPEED_RANGE) * levelMultiplier * speedMultiplier;

  return {
    id,
    position,
    velocity: vectorFromAngle(heading, speed),
    angle: random() * Math.PI * 2,
    spin: (random() * 2 - 1) * 0.001,
    size: 'large',
  };
}

function moveShip(ship: AsteroidsShip, input: AsteroidsInput, dt: number): AsteroidsShip {
  const angle = normalizeAngle(ship.angle + input.turn * ROTATION_SPEED * dt);
  let velocity = { ...ship.velocity };
  if (input.thrust) {
    velocity.x += Math.cos(angle) * THRUST_ACCELERATION * dt;
    velocity.y += Math.sin(angle) * THRUST_ACCELERATION * dt;
  }
  const damping = Math.pow(VELOCITY_DAMPING_PER_MS, dt);
  velocity.x *= damping;
  velocity.y *= damping;
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed > MAX_SHIP_SPEED) {
    velocity = scaleVector(velocity, MAX_SHIP_SPEED / speed);
  }

  return {
    position: wrapPosition({
      x: ship.position.x + velocity.x * dt,
      y: ship.position.y + velocity.y * dt,
    }),
    velocity,
    angle,
    thrusting: input.thrust,
    invulnerableMs: Math.max(0, ship.invulnerableMs - dt),
  };
}

function createBullet(id: number, ship: AsteroidsShip): AsteroidsBullet {
  const direction = vectorFromAngle(ship.angle, 1);
  return {
    id,
    position: wrapPosition({
      x: ship.position.x + direction.x * (SHIP_RADIUS + 0.8),
      y: ship.position.y + direction.y * (SHIP_RADIUS + 0.8),
    }),
    velocity: {
      x: ship.velocity.x + direction.x * BULLET_SPEED,
      y: ship.velocity.y + direction.y * BULLET_SPEED,
    },
    ttlMs: BULLET_LIFETIME_MS,
  };
}

function moveBullet(bullet: AsteroidsBullet, dt: number): AsteroidsBullet {
  return {
    ...bullet,
    position: wrapPosition({
      x: bullet.position.x + bullet.velocity.x * dt,
      y: bullet.position.y + bullet.velocity.y * dt,
    }),
    ttlMs: bullet.ttlMs - dt,
  };
}

function moveAsteroid(asteroid: Asteroid, dt: number): Asteroid {
  return {
    ...asteroid,
    position: wrapPosition({
      x: asteroid.position.x + asteroid.velocity.x * dt,
      y: asteroid.position.y + asteroid.velocity.y * dt,
    }),
    angle: normalizeAngle(asteroid.angle + asteroid.spin * dt),
  };
}

function splitAsteroid(asteroid: Asteroid, firstId: number): Asteroid[] {
  const childSize: AsteroidSize | null =
    asteroid.size === 'large' ? 'medium' : asteroid.size === 'medium' ? 'small' : null;
  if (!childSize) return [];

  const heading = Math.atan2(asteroid.velocity.y, asteroid.velocity.x);
  const speed = Math.hypot(asteroid.velocity.x, asteroid.velocity.y) * SPLIT_SPEED_MULTIPLIER;
  return [-SPLIT_ANGLE, SPLIT_ANGLE].map((offset, index) => ({
    id: firstId + index,
    position: { ...asteroid.position },
    velocity: vectorFromAngle(heading + offset, speed),
    angle: asteroid.angle + offset,
    spin: asteroid.spin === 0 ? (index === 0 ? -0.001 : 0.001) : asteroid.spin * -1,
    size: childSize,
  }));
}

function collides(a: AsteroidsVector, b: AsteroidsVector, radius: number): boolean {
  const rawX = Math.abs(a.x - b.x);
  const rawY = Math.abs(a.y - b.y);
  const dx = Math.min(rawX, BOARD_SIZE - rawX);
  const dy = Math.min(rawY, BOARD_SIZE - rawY);
  return dx * dx + dy * dy <= radius * radius;
}

function vectorFromAngle(angle: number, magnitude: number): AsteroidsVector {
  return { x: Math.cos(angle) * magnitude, y: Math.sin(angle) * magnitude };
}

function scaleVector(vector: AsteroidsVector, scale: number): AsteroidsVector {
  return { x: vector.x * scale, y: vector.y * scale };
}

function wrapPosition(position: AsteroidsVector): AsteroidsVector {
  return { x: wrap(position.x), y: wrap(position.y) };
}

function wrap(value: number): number {
  return ((value % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
}

function normalizeAngle(angle: number): number {
  return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}
