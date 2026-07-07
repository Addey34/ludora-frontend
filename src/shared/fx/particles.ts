export interface ParticleOptions {
  count?: number;
  speed?: number;
  /** Full spread angle in radians (default = full circle). */
  spread?: number;
  /** Base emission angle in radians (default = upward, -PI/2). */
  angle?: number;
  gravity?: number;
  /** Particle lifetime in ms. */
  duration?: number;
  size?: number;
  colors?: string[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

/**
 * Lightweight canvas-based particle system.
 *
 * The canvas is fixed over the entire viewport so it works with any game layout:
 * callers pass viewport coordinates (from getBoundingClientRect()).
 * One instance per game page is enough — create it in initialize() and keep it alive.
 */
export class ParticleSystem {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private rafId: number | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fx-particles';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * Emits a burst of particles at (x, y) in viewport coordinates.
   */
  emit(x: number, y: number, options: ParticleOptions = {}): void {
    const {
      count = 12,
      speed = 5,
      spread = Math.PI * 2,
      angle = -Math.PI / 2,
      gravity = 0.18,
      duration = 750,
      size = 5,
      colors = ['#4361ee', '#6366f1', '#818cf8', '#a5b4fc'],
    } = options;

    const decay = 1 / ((duration / 1000) * 60);

    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.5 + Math.random() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        gravity,
        size: size * (0.5 + Math.random() * 0.7),
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay,
      });
    }

    this.startLoop();
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    const loop = (): void => {
      const { width, height } = this.canvas;
      this.ctx.clearRect(0, 0, width, height);

      this.particles = this.particles.filter((p) => {
        p.vx *= 0.98;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0) return false;

        this.ctx.globalAlpha = Math.max(0, p.alpha);
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * Math.max(0.1, p.alpha), 0, Math.PI * 2);
        this.ctx.fill();
        return true;
      });

      this.ctx.globalAlpha = 1;

      if (this.particles.length > 0) {
        this.rafId = requestAnimationFrame(loop);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.canvas.remove();
  }
}

/** A festive multi-colour palette shared by every victory burst. */
export const CELEBRATION_COLORS = ['#e11d48', '#fbbf24', '#ffffff', '#34d399', '#4361ee'];

/**
 * Fires a celebratory confetti burst centred on `element` — the shared "you
 * won" flourish so games don't each hand-roll the same emit() call. No-op if the
 * element isn't laid out yet (e.g. hidden), so it's safe to call unconditionally.
 */
export function celebrate(
  fx: ParticleSystem | null,
  element: HTMLElement | null,
  options: ParticleOptions = {}
): void {
  if (!fx || !element) return;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0) return;
  fx.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
    count: 28,
    speed: 5,
    spread: Math.PI * 2,
    colors: CELEBRATION_COLORS,
    size: 6,
    duration: 1100,
    gravity: 0.06,
    ...options,
  });
}
