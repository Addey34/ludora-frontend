import { GameEngine, GameConfig } from '../../shared/engine/GameEngine.js';
import { setupHud } from '../../shared/ui/hud.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupSettingsPanel, difficultyField } from '../../shared/ui/settingsPanel.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import { setupPaddlePointer } from '../../shared/engine/pointerControl.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound } from '../../shared/fx/sound.js';
import { generateLevel, worldOf } from './breakoutLevels.js';

/**
 * Configuration specific to Breakout.
 */
interface BreakoutConfig extends GameConfig {
  /** Number of lives at the start (default: 3). */
  lives?: number;
}

/**
 * The ball, in logical board coordinates (0–100 on each axis). `vx`/`vy` are
 * expressed in units per millisecond.
 */
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * A brick: its logical position/size, its state and its row (color/points).
 * Reinforced bricks start with `hp > 1` and take several hits to break.
 */
interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  row: number;
  hp: number;
  maxHp: number;
}

const BOARD = 100;
const BALL_R = 1.6;
const PADDLE_W = 16;
const PADDLE_H = 2.5;
const PADDLE_Y = 93;
const SIDE_MARGIN = 3;
const TOP_MARGIN = 8;
const BRICK_GAP = 1;
const BRICK_H = 3.5;

/** Base ball speed (units/ms) and acceleration per level. */
const BASE_SPEED = 0.055;
const SPEED_PER_LEVEL = 1.06;

/** Per-difficulty tuning: starting lives and a ball-speed multiplier. */
const TUNING: Record<Difficulty, { lives: number; speedMul: number }> = {
  easy: { lives: 5, speedMul: 0.85 },
  medium: { lives: 3, speedMul: 1.0 },
  hard: { lives: 2, speedMul: 1.2 },
};
/** Paddle movement speed with the keyboard (units/ms). */
const PADDLE_SPEED = 0.12;
/** Maximum bounce angle on the paddle edges (radians). */
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;

/**
 * Breakout.
 *
 * A ball bounces in a square board; the player moves a paddle at the bottom
 * (arrows/A-D or mouse) to send it back and destroy all the bricks. The return
 * angle depends on the impact point on the paddle. Missing the ball costs a
 * life; clearing the board moves to the next level (bricks regenerated, faster
 * ball). The game ends when no life is left.
 *
 * The game reuses the engine's `requestAnimationFrame` loop: the ball advances
 * proportionally to the `deltaTime` (in small steps to avoid going through a
 * brick at high speed), independently of the render's 60 fps.
 */
export class BreakoutGame extends GameEngine {
  private maxLives: number;
  private difficulty: Difficulty = 'medium';
  /** Ball-speed multiplier from the chosen difficulty (frozen per round). */
  private speedMul = 1;

  private ball: Ball = { x: 50, y: 80, vx: 0, vy: 0 };
  /** Position of the paddle's center on the x axis. */
  private paddleX = 50;
  private bricks: Brick[] = [];
  private lives: number;
  private level = 1;
  private speed = BASE_SPEED;

  /** Movement keys held down. */
  private readonly keys = { left: false, right: false };

  private boardElement: HTMLElement | null = null;
  private brickLayer: HTMLElement | null = null;
  private ballElement: HTMLElement | null = null;
  private paddleElement: HTMLElement | null = null;
  private brickElements: HTMLElement[] = [];
  private fx: ParticleSystem | null = null;

  /**
   * @param config Game configuration (brick rows/columns, lives).
   */
  constructor(config: BreakoutConfig = {}) {
    super({ ...config, storageKey: 'breakout-high-scores' });
    this.maxLives = config.lives || 3;
    this.lives = this.maxLives;
  }

  /**
   * Binds the DOM elements, builds the board (paddle, ball, bricks), wires up
   * the controls, then performs the first render and launches the ball.
   */
  initialize(): void {
    this.boardElement = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'level', icon: 'layer-group', label: t('hudLevel') },
      { key: 'lives', icon: 'heart', label: t('hudLives') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);

    setupSettingsPanel([
      difficultyField(this.difficulty, (v) => {
        this.difficulty = v as Difficulty;
        this.setLeaderboardVariant(this.difficulty, t(this.difficulty));
      }),
    ]);
    this.setLeaderboardVariant(this.difficulty, t(this.difficulty));

    this.buildBoard();
    this.setupEventListeners();
    this.updateScoreDisplay();
    this.resetBall();
    this.render();
  }

  /**
   * Wires up the controls specific to this game: holding the arrows/A-D
   * (continuous movement handled in {@link update}) and following the mouse/finger
   * (via the shared {@link setupPaddlePointer}, which keeps tracking off-board and
   * grabs the pointer in immersive mode), instead of the engine's one-shot
   * keyboard listening.
   */
  protected setupEventListeners(): void {
    document.addEventListener('keydown', (e) => this.setKey(e, true));
    document.addEventListener('keyup', (e) => this.setKey(e, false));
    if (this.boardElement) {
      setupPaddlePointer({
        board: this.boardElement,
        axis: 'x',
        onMove: (ratio) => {
          this.paddleX = this.clampPaddle(ratio * BOARD);
        },
        getRatio: () => this.paddleX / BOARD,
      });
    }
  }

  /**
   * Updates the state of a movement key (and prevents the page from scrolling on
   * the arrows).
   */
  private setKey(event: KeyboardEvent, pressed: boolean): void {
    if (this.isFormFieldTarget(event.target)) return;

    if (event.code === 'ArrowLeft' || event.code === 'KeyA' || event.code === 'KeyQ') {
      this.keys.left = pressed;
      event.preventDefault();
    } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
      this.keys.right = pressed;
      event.preventDefault();
    }
  }

  /**
   * Required by the {@link GameEngine} contract: keyboard movement is handled
   * continuously (held keys) in {@link update}, not here.
   */
  handleInput(_event: KeyboardEvent): void {}

  /**
   * Moves the paddle according to the held keys, then advances the ball (in
   * small steps) with bounce and life-loss handling.
   */
  update(deltaTime: number): void {
    if (this.state.isPaused || this.state.isGameOver) return;

    const dt = Math.min(deltaTime, 32);
    this.movePaddle(dt);
    this.moveBall(dt);
  }

  /**
   * Moves the paddle left/right according to the held keys, clamped to the
   * board.
   */
  private movePaddle(dt: number): void {
    let dir = 0;
    if (this.keys.left) dir -= 1;
    if (this.keys.right) dir += 1;
    if (dir !== 0) {
      this.paddleX = this.clampPaddle(this.paddleX + dir * PADDLE_SPEED * dt);
    }
  }

  /**
   * Clamps the paddle's center so it stays entirely within the board.
   */
  private clampPaddle(x: number): number {
    return Math.max(PADDLE_W / 2, Math.min(BOARD - PADDLE_W / 2, x));
  }

  /**
   * Advances the ball by `dt` ms in several sub-steps (at most ~one radius per
   * step) to make collisions reliable at high speed.
   */
  private moveBall(dt: number): void {
    const distance = Math.max(Math.abs(this.ball.vx), Math.abs(this.ball.vy)) * dt;
    const steps = Math.max(1, Math.ceil(distance / BALL_R));
    const stepDt = dt / steps;

    for (let i = 0; i < steps; i++) {
      this.ball.x += this.ball.vx * stepDt;
      this.ball.y += this.ball.vy * stepDt;

      this.collideWalls();
      this.collidePaddle();
      this.collideBricks();

      if (this.ball.y - BALL_R > BOARD) {
        this.loseLife();
        return;
      }
    }
  }

  /**
   * Bounces off the left, right and top walls (repositions the ball on contact
   * and inverts the relevant velocity component).
   */
  private collideWalls(): void {
    if (this.ball.x - BALL_R <= 0) {
      this.ball.x = BALL_R;
      this.ball.vx = Math.abs(this.ball.vx);
    } else if (this.ball.x + BALL_R >= BOARD) {
      this.ball.x = BOARD - BALL_R;
      this.ball.vx = -Math.abs(this.ball.vx);
    }
    if (this.ball.y - BALL_R <= 0) {
      this.ball.y = BALL_R;
      this.ball.vy = Math.abs(this.ball.vy);
    }
  }

  /**
   * Bounce on the paddle: the return angle depends on the impact point (center =
   * vertical, edges = very steep), which gives the player control.
   */
  private collidePaddle(): void {
    if (this.ball.vy <= 0) return;

    const withinX =
      this.ball.x >= this.paddleX - PADDLE_W / 2 && this.ball.x <= this.paddleX + PADDLE_W / 2;
    const atPaddle =
      this.ball.y + BALL_R >= PADDLE_Y && this.ball.y - BALL_R <= PADDLE_Y + PADDLE_H;

    if (withinX && atPaddle) {
      const offset = (this.ball.x - this.paddleX) / (PADDLE_W / 2);
      const angle = offset * MAX_BOUNCE_ANGLE;
      this.ball.vx = this.speed * Math.sin(angle);
      this.ball.vy = -this.speed * Math.cos(angle);
      this.ball.y = PADDLE_Y - BALL_R;
    }
  }

  /**
   * Destroys the first brick hit and bounces the ball on the axis of least
   * penetration (side vs top/bottom).
   */
  private collideBricks(): void {
    for (let i = 0; i < this.bricks.length; i++) {
      const brick = this.bricks[i];
      if (!brick.alive) continue;

      const overlapsX = this.ball.x + BALL_R > brick.x && this.ball.x - BALL_R < brick.x + brick.w;
      const overlapsY = this.ball.y + BALL_R > brick.y && this.ball.y - BALL_R < brick.y + brick.h;
      if (!overlapsX || !overlapsY) continue;

      const penLeft = this.ball.x + BALL_R - brick.x;
      const penRight = brick.x + brick.w - (this.ball.x - BALL_R);
      const penTop = this.ball.y + BALL_R - brick.y;
      const penBottom = brick.y + brick.h - (this.ball.y - BALL_R);
      const minX = Math.min(penLeft, penRight);
      const minY = Math.min(penTop, penBottom);

      if (minX < minY) {
        this.ball.vx = -this.ball.vx;
      } else {
        this.ball.vy = -this.ball.vy;
      }

      playSound('bounce');
      this.hitBrick(i);
      return;
    }
  }

  /**
   * Damages a brick. Reinforced bricks (`hp > 1`) only crack and survive; a brick
   * at 0 hp breaks, spawns particles and may trigger the next level.
   */
  private hitBrick(index: number): void {
    const brick = this.bricks[index];
    const brickEl = this.brickElements[index];
    brick.hp--;
    if (brick.hp > 0) {
      brickEl?.setAttribute('data-hp', String(brick.hp));
      return; // still standing
    }
    brick.alive = false;

    const rect = brickEl?.getBoundingClientRect();
    brickEl?.classList.add('is-broken');

    if (this.fx && rect && rect.width > 0) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rowColors = [
        ['#ef476f', '#f9607e', '#fda7b5', '#fff'],
        ['#f78c6b', '#fab897', '#fde0d3', '#fff'],
        ['#ffd166', '#ffe19a', '#fff3cc', '#fff'],
        ['#06d6a0', '#3de8b8', '#a7f3e0', '#fff'],
        ['#118ab2', '#40b4d8', '#a0d8ed', '#fff'],
      ];
      this.fx.emit(cx, cy, {
        count: 10,
        speed: 4.5,
        spread: Math.PI * 2,
        gravity: 0.16,
        duration: 550,
        size: rect.height * 0.7,
        colors: rowColors[brick.row] ?? rowColors[0],
      });
    }

    if (this.bricks.every((b) => !b.alive)) {
      this.nextLevel();
    }
  }

  /**
   * Moves to the next level: regenerates the bricks, speeds up the ball and
   * relaunches it from the paddle.
   */
  private nextLevel(): void {
    this.level++;
    // The leaderboard tracks the level reached: bump the score by one per level.
    this.addScore(1);
    this.speed *= SPEED_PER_LEVEL;
    playSound('score');
    this.buildBricks();
    this.resetBall();
    this.updateScoreDisplay();
  }

  /**
   * Loses a life: ends the game if none are left, otherwise recenters the paddle
   * and relaunches the ball.
   */
  private loseLife(): void {
    this.lives--;
    this.updateScoreDisplay();
    playSound(this.lives <= 0 ? 'die' : 'miss');
    screenShake(this.lives <= 0 ? 10 : 5, 250);

    if (this.lives <= 0) {
      this.gameOver();
      return;
    }
    this.paddleX = BOARD / 2;
    this.resetBall();
  }

  /**
   * Places the ball above the paddle and launches it upward with a slight random
   * angle, at the current speed.
   */
  private resetBall(): void {
    const angle = (Math.random() * 2 - 1) * (MAX_BOUNCE_ANGLE / 2);
    this.ball = {
      x: this.paddleX,
      y: PADDLE_Y - BALL_R - 1,
      vx: this.speed * Math.sin(angle),
      vy: -this.speed * Math.cos(angle),
    };
  }

  /**
   * Builds the board's persistent structure (brick layer, paddle, ball) only
   * once, then fills the bricks.
   */
  private buildBoard(): void {
    if (!this.boardElement) return;

    this.boardElement.innerHTML = `
      <div class="brick-layer"></div>
      <div class="paddle"></div>
      <div class="ball"></div>`;

    this.brickLayer = this.boardElement.querySelector('.brick-layer');
    this.paddleElement = this.boardElement.querySelector('.paddle');
    this.ballElement = this.boardElement.querySelector('.ball');

    if (this.paddleElement) {
      this.paddleElement.style.width = `${PADDLE_W}%`;
      this.paddleElement.style.height = `${PADDLE_H}%`;
      this.paddleElement.style.top = `${PADDLE_Y}%`;
    }
    if (this.ballElement) {
      this.ballElement.style.width = `${BALL_R * 2}%`;
      this.ballElement.style.height = `${BALL_R * 2}%`;
    }

    this.buildBricks();
  }

  /**
   * (Re)creates the model and the DOM elements of the bricks, laid out in a grid
   * centered at the top of the board.
   */
  private buildBricks(): void {
    const spec = generateLevel(this.level);
    const cols = spec.cols;
    const usableWidth = BOARD - 2 * SIDE_MARGIN - (cols - 1) * BRICK_GAP;
    const brickW = usableWidth / cols;

    this.bricks = spec.bricks.map((b) => ({
      x: SIDE_MARGIN + b.col * (brickW + BRICK_GAP),
      y: TOP_MARGIN + b.row * (BRICK_H + BRICK_GAP),
      w: brickW,
      h: BRICK_H,
      alive: true,
      row: b.row,
      hp: b.hp,
      maxHp: b.hp,
    }));

    if (this.brickLayer) {
      this.brickLayer.innerHTML = this.bricks.map((brick) => this.brickMarkup(brick)).join('');
      this.brickElements = Array.from(this.brickLayer.querySelectorAll<HTMLElement>('.brick'));
    }
  }

  /** A brick's DOM: colour by row, a data-hp for the reinforced (multi-hit) look. */
  private brickMarkup(brick: Brick): string {
    const colorRow = (brick.row % 5) + 1;
    return (
      `<div class="brick brick--${colorRow}" data-hp="${brick.hp}"` +
      ` style="left:${brick.x}%;top:${brick.y}%;width:${brick.w}%;height:${brick.h}%"></div>`
    );
  }

  /**
   * Positions ball and paddle according to their logical state (the bricks are
   * updated when destroyed, not every frame).
   */
  render(): void {
    if (this.ballElement) {
      this.ballElement.style.left = `${this.ball.x - BALL_R}%`;
      this.ballElement.style.top = `${this.ball.y - BALL_R}%`;
    }
    if (this.paddleElement) {
      this.paddleElement.style.left = `${this.paddleX - PADDLE_W / 2}%`;
    }
  }

  /**
   * Resets bricks, ball, paddle, lives, level, speed and state, then performs
   * the render.
   */
  /** Applies the chosen difficulty (lives + speed) before a round begins. */
  start(): void {
    this.applyDifficulty();
    super.start();
  }

  private applyDifficulty(): void {
    const tune = TUNING[this.difficulty];
    this.maxLives = tune.lives;
    this.speedMul = tune.speedMul;
    this.lives = this.maxLives;
    this.speed = BASE_SPEED * this.speedMul;
    this.updateScoreDisplay();
  }

  reset(): void {
    this.resetState();
    this.applyDifficulty();
    this.level = 1;
    this.addScore(1); // score mirrors the level reached (starts at 1)
    this.paddleX = BOARD / 2;
    this.buildBricks();
    this.resetBall();
    this.updateScoreDisplay();
    this.render();
  }

  /**
   * Shows the current level, remaining lives and best level in the game header.
   */
  protected updateScoreDisplay(): void {
    this.hud?.set('level', this.level);
    this.hud?.set('lives', this.lives);
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  /**
   * Details shown in the game-over modal: the level and world reached.
   */
  protected getGameOverContent(): string {
    return `<div>${t('hudLevel')}: ${this.level}</div><div>${t('bkWorld')}: ${worldOf(this.level) + 1}</div>`;
  }
}
