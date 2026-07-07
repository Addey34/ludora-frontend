import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { setupSettingsPanel, difficultyField } from '../../shared/ui/settingsPanel.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import { playSound } from '../../shared/fx/sound.js';
import { screenShake } from '../../shared/fx/screenShake.js';

// Logical canvas dimensions (CSS scales to fill the board).
const W = 400;
const H = 400;

const GROUND_Y = 372; // y-coordinate of the ground surface
const GROUND_H = H - GROUND_Y; // height of the grass strip

const BIRD_X = 90; // fixed horizontal position
const BIRD_R = 14; // bird radius
const GRAVITY = 0.42; // px per frame at 60fps
const JUMP_VY = -8.0; // px per frame at 60fps (negative = up)

const PIPE_W = 52;
const GAP_CENTER_MIN = 115; // minimum y-center of the gap
const GAP_CENTER_MAX = 275; // maximum y-center of the gap

/** Per-difficulty tuning: a tighter gap and faster, more frequent pipes. */
interface FlappyTuning {
  gap: number; // vertical gap between top and bottom pipe
  speed: number; // px per frame at 60fps
  interval: number; // frames between consecutive pipes (at 60fps)
}
const TUNING: Record<Difficulty, FlappyTuning> = {
  easy: { gap: 165, speed: 2.1, interval: 108 },
  medium: { gap: 135, speed: 2.4, interval: 95 },
  hard: { gap: 112, speed: 2.9, interval: 82 },
};

interface Pipe {
  x: number;
  gapCenter: number;
  scored: boolean;
}

/**
 * Flappy Bird: tap/click or press Space to flap and fly the bird through the
 * gaps between the pipes. Each pipe pair passed scores one point; the game ends
 * when the bird hits a pipe or the ground. Physics is frame-rate normalised
 * via the GameEngine deltaTime. Rendered entirely on a 2D canvas.
 */
export class FlappyBirdGame extends GameEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private birdY = H / 2;
  private birdVY = 0;
  private birdAngle = 0; // visual tilt in radians
  private pipes: Pipe[] = [];
  private frameAccum = 0; // accumulated frame-equivalent ticks for pipe spawning
  private difficulty: Difficulty = 'medium';
  /** Active tuning for the current round (frozen at start). */
  private tuning: FlappyTuning = TUNING.medium;

  constructor() {
    super({ storageKey: 'flappy-scores', leaderboardId: 'flappy' });
  }

  initialize(): void {
    const board = document.getElementById('board');
    if (!board) return;

    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.style.cssText = 'width:100%;height:100%;display:block;cursor:pointer;';
    this.canvas.addEventListener('click', () => this.jump());
    board.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    this.hud = setupHud([
      { key: 'score', icon: 'star', label: t('score') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);

    setupSettingsPanel([
      difficultyField(this.difficulty, (v) => {
        this.difficulty = v as Difficulty;
        this.setLeaderboardVariant(this.difficulty, t(this.difficulty));
      }),
    ]);
    this.setLeaderboardVariant(this.difficulty, t(this.difficulty));

    this.setupEventListeners();
    this.resetGame();
    this.render();
  }

  start(): void {
    if (this.state.isRunning) return;
    this.resetGame();
    super.start();
  }

  reset(): void {
    this.resetGame();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.start();
  }

  private resetGame(): void {
    this.birdY = H / 2 - 20;
    this.birdVY = 0;
    this.birdAngle = 0;
    this.pipes = [];
    this.frameAccum = 0;
    this.tuning = TUNING[this.difficulty]; // freeze difficulty for the round
    this.hud?.set('score', 0);
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  private jump(): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    this.birdVY = JUMP_VY;
    playSound('bounce');
  }

  handleInput(event: KeyboardEvent): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    if (event.code === 'Space' || event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
      event.preventDefault();
      this.jump();
    }
  }

  update(dt: number): void {
    if (this.state.isGameOver) return;

    // Normalise physics to 60fps equivalent
    const scale = dt / (1000 / 60);

    // Bird physics
    this.birdVY += GRAVITY * scale;
    this.birdY += this.birdVY * scale;

    // Tilt: nose up on rise, nose down on fall
    const targetAngle = Math.max(-0.45, Math.min(Math.PI / 2.2, this.birdVY * 0.07));
    this.birdAngle += (targetAngle - this.birdAngle) * 0.18 * scale;

    // Pipe spawning
    this.frameAccum += scale;
    if (this.frameAccum >= this.tuning.interval) {
      this.frameAccum -= this.tuning.interval;
      this.pipes.push({
        x: W + 10,
        gapCenter: GAP_CENTER_MIN + Math.random() * (GAP_CENTER_MAX - GAP_CENTER_MIN),
        scored: false,
      });
    }

    // Move pipes & score
    for (const pipe of this.pipes) {
      pipe.x -= this.tuning.speed * scale;
      if (!pipe.scored && pipe.x + PIPE_W < BIRD_X - BIRD_R) {
        pipe.scored = true;
        this.addScore(1);
        playSound('score');
      }
    }
    this.pipes = this.pipes.filter((p) => p.x + PIPE_W > -5);

    // Collision
    if (this.birdY + BIRD_R >= GROUND_Y || this.birdY - BIRD_R <= 0) {
      this.onDeath();
      return;
    }
    for (const pipe of this.pipes) {
      if (BIRD_X + BIRD_R > pipe.x && BIRD_X - BIRD_R < pipe.x + PIPE_W) {
        const half = this.tuning.gap / 2;
        if (
          this.birdY - BIRD_R < pipe.gapCenter - half ||
          this.birdY + BIRD_R > pipe.gapCenter + half
        ) {
          this.onDeath();
          return;
        }
      }
    }
  }

  private onDeath(): void {
    playSound('die');
    screenShake(6, 280);
    this.gameOver();
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    // --- Sky ---
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#87ceeb');
    sky.addColorStop(1, '#c9e8f5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // --- Pipes ---
    for (const pipe of this.pipes) {
      this.drawPipe(ctx, pipe);
    }

    // --- Ground ---
    ctx.fillStyle = '#5d8a3c';
    ctx.fillRect(0, GROUND_Y, W, GROUND_H);
    ctx.fillStyle = '#7ab648';
    ctx.fillRect(0, GROUND_Y, W, 8);

    // --- Bird ---
    ctx.save();
    ctx.translate(BIRD_X, this.birdY);
    ctx.rotate(this.birdAngle);

    // Body
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Wing
    ctx.beginPath();
    ctx.ellipse(-3, 3, 9, 5, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#fde68a';
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(6, -4, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(7, -4, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(10, -1);
    ctx.lineTo(17, 1);
    ctx.lineTo(10, 4);
    ctx.closePath();
    ctx.fillStyle = '#f97316';
    ctx.fill();

    ctx.restore();
  }

  private drawPipe(ctx: CanvasRenderingContext2D, pipe: Pipe): void {
    const half = this.tuning.gap / 2;
    const topH = pipe.gapCenter - half;
    const botY = pipe.gapCenter + half;
    const botH = GROUND_Y - botY;
    const capH = 18;
    const capW = PIPE_W + 8;
    const capOff = (capW - PIPE_W) / 2;

    // Top pipe body + cap
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(pipe.x, 0, PIPE_W, topH - capH);
    ctx.fillStyle = '#22c55e';
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 1.5;
    ctx.fillRect(pipe.x - capOff, topH - capH, capW, capH);
    ctx.strokeRect(pipe.x - capOff, topH - capH, capW, capH);

    // Bottom pipe body + cap
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(pipe.x, botY + capH, PIPE_W, botH - capH);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(pipe.x - capOff, botY, capW, capH);
    ctx.strokeRect(pipe.x - capOff, botY, capW, capH);

    // Pipe sheen (thin lighter strip on the left edge)
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(pipe.x + 4, 0, 6, topH - capH);
    ctx.fillRect(pipe.x + 4, botY + capH, 6, botH - capH);
  }

  protected updateScoreDisplay(): void {
    this.hud?.set('score', this.state.score);
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  protected getGameOverContent(): string {
    return t('flappyRecap', { score: String(this.state.score) });
  }
}
