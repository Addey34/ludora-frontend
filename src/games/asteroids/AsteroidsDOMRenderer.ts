import type { IRenderer } from '../../shared/engine/IRenderer.js';
import { t } from '../../shared/i18n/i18n.js';
import { asteroidRadius, BOARD_SIZE, SHIP_RADIUS } from './asteroidsLogic.js';
import type { Asteroid, AsteroidsState, AsteroidsVector } from './asteroidsState.js';

const CANVAS_SIZE = 600;
const STAR_COUNT = 90;
const STAR_ALPHA = 0.58;
const ASTEROID_VERTICES = 11;
const ASTEROID_JAGGEDNESS = 0.18;
const BULLET_RADIUS = 0.65;
const FLAME_LENGTH = 4.3;
const INVULNERABLE_BLINK_MS = 120;

interface Palette {
  space: string;
  star: string;
  rock: string;
  rockDetail: string;
  ship: string;
  flame: string;
  shot: string;
}

export class AsteroidsDOMRenderer implements IRenderer<AsteroidsState> {
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly palette: Palette;

  constructor(private readonly board: HTMLElement) {
    this.canvas.width = CANVAS_SIZE;
    this.canvas.height = CANVAS_SIZE;
    this.canvas.className = 'asteroids-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', t('asteroidsCanvasLabel'));
    this.context = this.canvas.getContext('2d')!;
    this.palette = readPalette();
    this.board.prepend(this.canvas);
  }

  render(state: AsteroidsState): void {
    const ctx = this.context;
    ctx.fillStyle = this.palette.space;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    this.drawStars();

    for (const asteroid of state.asteroids) {
      this.drawWrapped(asteroid.position, asteroidRadius(asteroid.size), (position) =>
        this.drawAsteroid(asteroid, position)
      );
    }
    for (const bullet of state.bullets) {
      this.drawWrapped(bullet.position, BULLET_RADIUS, (position) => this.drawBullet(position));
    }

    const visible =
      state.lives > 0 &&
      (state.ship.invulnerableMs === 0 ||
        Math.floor(state.ship.invulnerableMs / INVULNERABLE_BLINK_MS) % 2 === 0);
    if (visible) {
      this.drawWrapped(state.ship.position, SHIP_RADIUS + FLAME_LENGTH, (position) =>
        this.drawShip(state, position)
      );
    }
  }

  dispose(): void {
    this.canvas.remove();
  }

  private drawStars(): void {
    const ctx = this.context;
    ctx.fillStyle = this.palette.star;
    ctx.globalAlpha = STAR_ALPHA;
    for (let index = 0; index < STAR_COUNT; index++) {
      const x = (index * 173 + 29) % CANVAS_SIZE;
      const y = (index * 97 + 53) % CANVAS_SIZE;
      const size = index % 7 === 0 ? 2 : 1;
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;
  }

  private drawAsteroid(asteroid: Asteroid, position: AsteroidsVector): void {
    const ctx = this.context;
    const radius = this.toCanvas(asteroidRadius(asteroid.size));
    const center = this.positionToCanvas(position);
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(asteroid.angle);
    ctx.beginPath();
    for (let index = 0; index < ASTEROID_VERTICES; index++) {
      const angle = (index / ASTEROID_VERTICES) * Math.PI * 2;
      const noise = pseudoNoise(asteroid.id, index);
      const distance = radius * (1 - ASTEROID_JAGGEDNESS + noise * ASTEROID_JAGGEDNESS * 2);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = this.palette.rock;
    ctx.strokeStyle = this.palette.rockDetail;
    ctx.lineWidth = Math.max(1, radius * 0.08);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-radius * 0.2, -radius * 0.15, radius * 0.2, 0, Math.PI * 2);
    ctx.arc(radius * 0.25, radius * 0.2, radius * 0.13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawBullet(position: AsteroidsVector): void {
    const point = this.positionToCanvas(position);
    this.context.beginPath();
    this.context.arc(point.x, point.y, this.toCanvas(BULLET_RADIUS), 0, Math.PI * 2);
    this.context.fillStyle = this.palette.shot;
    this.context.fill();
  }

  private drawShip(state: AsteroidsState, position: AsteroidsVector): void {
    const ctx = this.context;
    const center = this.positionToCanvas(position);
    const radius = this.toCanvas(SHIP_RADIUS);
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(state.ship.angle);

    if (state.ship.thrusting) {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.9, -radius * 0.58);
      ctx.lineTo(-radius - this.toCanvas(FLAME_LENGTH), 0);
      ctx.lineTo(-radius * 0.9, radius * 0.58);
      ctx.fillStyle = this.palette.flame;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(radius * 1.45, 0);
    ctx.lineTo(-radius, radius);
    ctx.lineTo(-radius * 0.5, 0);
    ctx.lineTo(-radius, -radius);
    ctx.closePath();
    ctx.strokeStyle = this.palette.ship;
    ctx.lineWidth = Math.max(2, radius * 0.22);
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  private drawWrapped(
    position: AsteroidsVector,
    radius: number,
    draw: (position: AsteroidsVector) => void
  ): void {
    const xs = [position.x];
    const ys = [position.y];
    if (position.x < radius) xs.push(position.x + BOARD_SIZE);
    if (position.x > BOARD_SIZE - radius) xs.push(position.x - BOARD_SIZE);
    if (position.y < radius) ys.push(position.y + BOARD_SIZE);
    if (position.y > BOARD_SIZE - radius) ys.push(position.y - BOARD_SIZE);
    for (const x of xs) for (const y of ys) draw({ x, y });
  }

  private positionToCanvas(position: AsteroidsVector): AsteroidsVector {
    return { x: this.toCanvas(position.x), y: this.toCanvas(position.y) };
  }

  private toCanvas(value: number): number {
    return (value / BOARD_SIZE) * CANVAS_SIZE;
  }
}

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  return {
    space: token('--asteroids-space'),
    star: token('--asteroids-star'),
    rock: token('--asteroids-rock'),
    rockDetail: token('--asteroids-rock-detail'),
    ship: token('--asteroids-ship'),
    flame: token('--asteroids-flame'),
    shot: token('--asteroids-shot'),
  };
}

function pseudoNoise(seed: number, index: number): number {
  const value = Math.sin(seed * 91.7 + index * 37.1) * 43758.5453;
  return value - Math.floor(value);
}
