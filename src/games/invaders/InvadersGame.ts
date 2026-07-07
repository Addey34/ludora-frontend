import { GameEngine } from '../../shared/engine/GameEngine.js';
import { keyboardDirection } from '../../shared/engine/input.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { setupSettingsPanel, difficultyField } from '../../shared/ui/settingsPanel.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import { playSound } from '../../shared/fx/sound.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { ParticleSystem } from '../../shared/fx/particles.js';

const W = 400;
const H = 400;
const COLS = 10;
const ROWS = 4;
const ALIEN_W = 28;
const ALIEN_H = 22;
const ALIEN_GAP_X = 10;
const ALIEN_GAP_Y = 14;
const ALIEN_START_X = 20;
const ALIEN_START_Y = 40;
const PLAYER_W = 34;
const PLAYER_H = 16;
const PLAYER_Y = H - 30;
const PLAYER_SPEED = 0.22;
const BULLET_SPEED = 0.38;
const BOMB_SPEED = 0.12;
const BULLET_W = 3;
const BULLET_H = 10;
const BOMB_INTERVAL_MIN = 1500;
const BOMB_INTERVAL_MAX = 3500;
const MOVE_INTERVAL_START = 600;
const MOVE_STEP_X = 10;
const MOVE_STEP_Y = 18;
const ALIEN_POINTS = [40, 30, 20, 10];
const BARRIER_COUNT = 3;

/** Per-difficulty tuning: starting lives and how often aliens drop bombs
 *  (`bombScale` > 1 = rarer, < 1 = more frequent). */
const TUNING: Record<Difficulty, { lives: number; bombScale: number }> = {
  easy: { lives: 4, bombScale: 1.4 },
  medium: { lives: 3, bombScale: 1.0 },
  hard: { lives: 2, bombScale: 0.65 },
};

interface Alien {
  x: number;
  y: number;
  row: number;
  alive: boolean;
}

interface Projectile {
  x: number;
  y: number;
}

interface Barrier {
  x: number;
  y: number;
  hp: number;
}

export class InvadersGame extends GameEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private fx: ParticleSystem | null = null;

  private aliens: Alien[] = [];
  private playerX = W / 2;
  private bullets: Projectile[] = [];
  private bombs: Projectile[] = [];
  private barriers: Barrier[] = [];
  private lives = 3;
  private level = 1;
  private difficulty: Difficulty = 'medium';

  private alienDir: 1 | -1 = 1;
  private moveInterval = MOVE_INTERVAL_START;
  private lastMoveTime = 0;
  private lastBombTime = 0;
  private nextBombInterval = BOMB_INTERVAL_MIN;
  private lastBulletTime = 0;
  private canShoot = true;

  private keys = { left: false, right: false, space: false };

  constructor() {
    super({ storageKey: 'invaders', leaderboardId: 'invaders' });
  }

  initialize(): void {
    const board = document.getElementById('board');
    if (!board) return;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.style.cssText = 'width:100%;height:100%;display:block;';
    board.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'score', icon: 'star', label: t('score') },
      { key: 'lives', icon: 'heart', label: t('hudLives') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);
    this.hud.set('high', this.scoreManager.getHighScore());
    setupSettingsPanel([
      difficultyField(this.difficulty, (v) => {
        this.difficulty = v as Difficulty;
        this.setLeaderboardVariant(this.difficulty, t(this.difficulty));
      }),
    ]);
    this.setLeaderboardVariant(this.difficulty, t(this.difficulty));
    this.setupEventListeners();
    this.canvas.addEventListener('click', () => this.shoot());
    this.buildLevel();
    this.render();
  }

  start(): void {
    if (this.state.isRunning) return;
    this.lives = TUNING[this.difficulty].lives;
    this.level = 1;
    this.playerX = W / 2;
    this.resetState();
    this.buildLevel();
    super.start();
  }

  reset(): void {
    this.lives = TUNING[this.difficulty].lives;
    this.level = 1;
    this.playerX = W / 2;
    this.resetState();
    this.buildLevel();
  }

  handleInput(e: KeyboardEvent): void {
    const down = e.type === 'keydown';
    const direction = keyboardDirection(e);
    if (direction === 'left') this.keys.left = down;
    if (direction === 'right') this.keys.right = down;

    const key = e.key.toLowerCase();
    if (e.key === ' ' || direction === 'up' || key === 'w' || key === 'z') {
      if (down && this.canShoot) this.shoot();
    }
  }

  protected setupEventListeners(): void {
    document.addEventListener('keydown', (e) => {
      if (this.isFormFieldTarget(e.target)) return;
      this.handleInput(e);
    });
    document.addEventListener('keyup', (e) => this.handleInput(e));
  }

  private buildLevel(): void {
    this.aliens = [];
    this.bullets = [];
    this.bombs = [];
    this.barriers = [];
    this.moveInterval = Math.max(100, MOVE_INTERVAL_START - (this.level - 1) * 60);
    this.alienDir = 1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.aliens.push({
          x: ALIEN_START_X + c * (ALIEN_W + ALIEN_GAP_X),
          y: ALIEN_START_Y + r * (ALIEN_H + ALIEN_GAP_Y),
          row: r,
          alive: true,
        });
      }
    }
    const barrierY = H - 80;
    const barrierSpacing = W / (BARRIER_COUNT + 1);
    for (let i = 0; i < BARRIER_COUNT; i++) {
      this.barriers.push({ x: barrierSpacing * (i + 1) - 20, y: barrierY, hp: 4 });
    }
  }

  update(dt: number): void {
    if (!this.state.isRunning || this.state.isGameOver) return;

    // Player movement
    if (this.keys.left) this.playerX = Math.max(PLAYER_W / 2, this.playerX - PLAYER_SPEED * dt);
    if (this.keys.right)
      this.playerX = Math.min(W - PLAYER_W / 2, this.playerX + PLAYER_SPEED * dt);

    // Move aliens as a group
    const now = performance.now();
    if (now - this.lastMoveTime > this.moveInterval) {
      this.lastMoveTime = now;
      this.moveAliens();
    }

    // Move bullets
    this.bullets = this.bullets.filter((b) => {
      b.y -= BULLET_SPEED * dt;
      return b.y > -BULLET_H;
    });

    // Move bombs
    this.bombs = this.bombs.filter((b) => {
      b.y += BOMB_SPEED * dt;
      return b.y < H + BULLET_H;
    });

    // Drop bombs
    if (now - this.lastBombTime > this.nextBombInterval) {
      this.lastBombTime = now;
      this.nextBombInterval =
        (BOMB_INTERVAL_MIN + Math.random() * (BOMB_INTERVAL_MAX - BOMB_INTERVAL_MIN)) *
        TUNING[this.difficulty].bombScale;
      const alive = this.aliens.filter((a) => a.alive);
      if (alive.length > 0) {
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        this.bombs.push({ x: shooter.x + ALIEN_W / 2, y: shooter.y + ALIEN_H });
      }
    }

    this.checkCollisions();
    this.hud?.set('lives', this.lives);
  }

  private moveAliens(): void {
    const alive = this.aliens.filter((a) => a.alive);
    if (alive.length === 0) return;

    let hitWall = false;
    for (const a of alive) {
      const nx = a.x + this.alienDir * MOVE_STEP_X;
      if (nx < 0 || nx + ALIEN_W > W) {
        hitWall = true;
        break;
      }
    }

    if (hitWall) {
      for (const a of alive) a.y += MOVE_STEP_Y;
      this.alienDir = (this.alienDir * -1) as 1 | -1;
      // Speed up as aliens are killed
      const remaining = alive.length / (ROWS * COLS);
      this.moveInterval = Math.max(80, MOVE_INTERVAL_START * remaining - (this.level - 1) * 40);
    } else {
      for (const a of alive) a.x += this.alienDir * MOVE_STEP_X;
    }

    // Check if aliens reached the player level
    for (const a of alive) {
      if (a.y + ALIEN_H >= PLAYER_Y) {
        this.endGame();
        return;
      }
    }
  }

  private checkCollisions(): void {
    const rect = (x: number, y: number, w: number, h: number, px: number, py: number): boolean =>
      px >= x && px <= x + w && py >= y && py <= y + h;

    // Bullets vs aliens
    for (const b of this.bullets) {
      for (const a of this.aliens) {
        if (!a.alive) continue;
        if (
          rect(a.x, a.y, ALIEN_W, ALIEN_H, b.x, b.y) ||
          rect(a.x, a.y, ALIEN_W, ALIEN_H, b.x, b.y + BULLET_H)
        ) {
          a.alive = false;
          b.y = -999;
          this.addScore(ALIEN_POINTS[a.row] ?? 10);
          this.spawnAlienParticles(a.x + ALIEN_W / 2, a.y + ALIEN_H / 2);
          playSound('hit');
          const remaining = this.aliens.filter((al) => al.alive).length;
          if (remaining === 0) {
            this.nextLevel();
            return;
          }
        }
      }
    }

    // Bombs vs player
    for (const bomb of this.bombs) {
      const px = this.playerX - PLAYER_W / 2;
      if (rect(px, PLAYER_Y, PLAYER_W, PLAYER_H, bomb.x, bomb.y)) {
        bomb.y = 999;
        this.playerHit();
      }
    }

    // Bombs vs barriers
    for (const bomb of this.bombs) {
      for (const bar of this.barriers) {
        if (bar.hp <= 0) continue;
        if (rect(bar.x, bar.y, 40, 20, bomb.x, bomb.y)) {
          bomb.y = 999;
          bar.hp--;
        }
      }
    }

    // Bullets vs barriers
    for (const b of this.bullets) {
      for (const bar of this.barriers) {
        if (bar.hp <= 0) continue;
        if (rect(bar.x, bar.y, 40, 20, b.x, b.y)) {
          b.y = -999;
          bar.hp--;
        }
      }
    }
  }

  private shoot(): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    const now = performance.now();
    if (now - this.lastBulletTime < 400) return;
    this.lastBulletTime = now;
    this.bullets.push({ x: this.playerX, y: PLAYER_Y });
    playSound('bounce');
  }

  private playerHit(): void {
    this.lives--;
    screenShake(8, 300);
    playSound('die');
    if (this.lives <= 0) {
      this.endGame();
    }
  }

  private nextLevel(): void {
    this.level++;
    this.playerX = W / 2;
    this.bullets = [];
    this.bombs = [];
    this.buildLevel();
    playSound('win');
  }

  private endGame(): void {
    this.gameOver();
  }

  private spawnAlienParticles(x: number, y: number): void {
    if (!this.fx || !this.canvas) return;
    const scaleX = this.canvas.clientWidth / W;
    const scaleY = this.canvas.clientHeight / H;
    const rect = this.canvas.getBoundingClientRect();
    this.fx.emit(rect.left + x * scaleX, rect.top + y * scaleY, {
      count: 8,
      speed: 3,
      spread: Math.PI * 2,
      gravity: 0.15,
      duration: 400,
      size: 4,
      colors: ['#22c55e', '#86efac', '#ffffff'],
    });
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137 + 17) % W;
      const sy = (i * 97 + 31) % H;
      ctx.fillRect(sx, sy, 1, 1);
    }

    // Barriers
    for (const bar of this.barriers) {
      if (bar.hp <= 0) continue;
      const alpha = bar.hp / 4;
      ctx.fillStyle = `rgba(34,197,94,${alpha})`;
      ctx.fillRect(bar.x, bar.y, 40, 20);
      ctx.fillRect(bar.x + 8, bar.y - 8, 24, 10);
    }

    // Aliens
    for (const a of this.aliens) {
      if (!a.alive) continue;
      const colors = ['#f87171', '#fb923c', '#facc15', '#34d399'];
      ctx.fillStyle = colors[a.row] ?? '#34d399';
      // Simple alien shape
      ctx.fillRect(a.x + 4, a.y + 2, ALIEN_W - 8, ALIEN_H - 4);
      ctx.fillRect(a.x, a.y + 8, 6, 8);
      ctx.fillRect(a.x + ALIEN_W - 6, a.y + 8, 6, 8);
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(a.x + 7, a.y + 6, 5, 5);
      ctx.fillRect(a.x + ALIEN_W - 12, a.y + 6, 5, 5);
    }

    // Player
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.moveTo(this.playerX, PLAYER_Y - 2);
    ctx.lineTo(this.playerX - PLAYER_W / 2, PLAYER_Y + PLAYER_H);
    ctx.lineTo(this.playerX + PLAYER_W / 2, PLAYER_Y + PLAYER_H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(this.playerX - 3, PLAYER_Y - 10, 6, 10);

    // Bullets
    ctx.fillStyle = '#fbbf24';
    for (const b of this.bullets) {
      ctx.fillRect(b.x - BULLET_W / 2, b.y, BULLET_W, BULLET_H);
    }

    // Bombs
    ctx.fillStyle = '#f87171';
    for (const b of this.bombs) {
      ctx.fillRect(b.x - 2, b.y, 4, 8);
    }

    // Lives display
    ctx.fillStyle = '#60a5fa';
    for (let i = 0; i < this.lives; i++) {
      ctx.fillRect(8 + i * 16, H - 12, 12, 6);
    }
  }
}
