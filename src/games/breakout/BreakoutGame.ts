import { GameEngine, GameConfig } from '../../shared/engine/GameEngine.js';
import type { IRenderer } from '../../shared/engine/IRenderer.js';
import { setupHud } from '../../shared/ui/hud.js';
import { setupScoreRace, type ScoreRaceHandle } from '../../shared/versus/scoreRaceController.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupSettingsPanel, difficultyField } from '../../shared/ui/settingsPanel.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import { setupPaddlePointer } from '../../shared/engine/pointerControl.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound } from '../../shared/fx/sound.js';
import {
  BASE_SPEED,
  BOARD,
  SPEED_PER_LEVEL,
  buildBricksForLevel,
  clampPaddle,
  createBreakoutState,
  movePaddle,
  resetBall,
  stepBall,
} from './breakoutLogic.js';
import type { Brick, BreakoutEvent, BreakoutGameState } from './breakoutState.js';
import { BreakoutDOMRenderer } from './BreakoutDOMRenderer.js';
import { worldOf } from './breakoutLevels.js';

interface BreakoutConfig extends GameConfig {
  lives?: number;
}

/** Per-difficulty tuning: starting lives and ball-speed multiplier. */
const TUNING: Record<Difficulty, { lives: number; speedMul: number }> = {
  easy: { lives: 5, speedMul: 0.85 },
  medium: { lives: 3, speedMul: 1.0 },
  hard: { lives: 2, speedMul: 1.2 },
};

export class BreakoutGame extends GameEngine {
  private difficulty: Difficulty = 'medium';
  private maxLives = 3;
  private speedMul = 1;

  private breakoutState: BreakoutGameState;
  private readonly keys = { left: false, right: false };

  private boardElement: HTMLElement | null = null;
  private fx: ParticleSystem | null = null;
  private renderer: IRenderer<BreakoutGameState> | null = null;
  private race: ScoreRaceHandle | null = null;

  constructor(config: BreakoutConfig = {}) {
    super({ ...config, storageKey: 'breakout-high-scores', leaderboardId: 'breakout' });
    this.maxLives = config.lives ?? 3;
    this.breakoutState = createBreakoutState(1, this.maxLives, BASE_SPEED);
  }

  initialize(): void {
    this.boardElement = document.getElementById('board');
    this.fx = new ParticleSystem();
    if (this.boardElement) this.renderer = new BreakoutDOMRenderer(this.boardElement);

    this.hud = setupHud([
      { key: 'level', icon: 'layer-group', label: t('hudLevel') },
      { key: 'lives', icon: 'heart', label: t('hudLives') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
      { key: 'opponent', icon: 'users', label: t('scoreRaceOpponent') },
    ]);

    this.race = setupScoreRace(this, {
      finish: { kind: 'toDeath' },
      getScore: () => this.state.score,
      isAlive: () => !this.state.isGameOver,
      finishLocalRace: () => this.gameOver(),
      restartLocalRace: () => {
        this.overlay.hide();
        this.reset();
        this.start();
      },
      onOpponentProgress: (score) => this.hud?.set('opponent', score),
      onSessionEnd: () => {
        this.reset();
        this.start();
      },
    });

    setupSettingsPanel([
      difficultyField(this.difficulty, (v) => {
        this.difficulty = v as Difficulty;
        this.setLeaderboardVariant(this.difficulty, t(this.difficulty));
      }),
    ]);
    this.setLeaderboardVariant(this.difficulty, t(this.difficulty));

    this.setupEventListeners();
    this.updateScoreDisplay();
    this.render();
  }

  protected setupEventListeners(): void {
    document.addEventListener('keydown', (e) => this.setKey(e, true));
    document.addEventListener('keyup', (e) => this.setKey(e, false));
    if (this.boardElement) {
      setupPaddlePointer({
        board: this.boardElement,
        axis: 'x',
        onMove: (ratio) => {
          const newX = clampPaddle(ratio * BOARD);
          this.breakoutState = { ...this.breakoutState, paddleX: newX };
        },
        getRatio: () => this.breakoutState.paddleX / BOARD,
      });
    }
  }

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

  handleInput(_event: KeyboardEvent): void {}

  update(deltaTime: number): void {
    if (this.state.isPaused || this.state.isGameOver) return;
    const dt = Math.min(deltaTime, 32);
    const newPaddleX = movePaddle(this.breakoutState.paddleX, this.keys, dt);
    const stateWithPaddle = { ...this.breakoutState, paddleX: newPaddleX };
    const { state, events } = stepBall(stateWithPaddle, dt);
    this.breakoutState = state;
    this.handleEvents(events);
  }

  render(): void {
    this.renderer?.render(this.breakoutState);
  }

  start(): void {
    this.applyDifficulty();
    super.start();
  }

  reset(): void {
    this.resetState();
    this.applyDifficulty();
    if (this.boardElement) {
      this.renderer?.dispose?.();
      this.renderer = new BreakoutDOMRenderer(this.boardElement);
    }
    this.breakoutState = createBreakoutState(1, this.maxLives, BASE_SPEED * this.speedMul);
    this.race?.reset();
    this.addScore(1); // score mirrors the level reached, starts at 1
    this.updateScoreDisplay();
    this.render();
  }

  protected onScoreChange(newScore: number): void {
    super.onScoreChange(newScore);
    this.race?.reportProgress(newScore, !this.state.isGameOver);
  }

  protected onGameOver(): void {
    if (this.race?.reportFinished(this.state.score)) return;
    super.onGameOver();
  }

  protected updateScoreDisplay(): void {
    this.hud?.set('level', this.breakoutState.level);
    this.hud?.set('lives', this.breakoutState.lives);
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  protected getGameOverContent(): string {
    return `<div>${t('hudLevel')}: ${this.breakoutState.level}</div><div>${t('bkWorld')}: ${worldOf(this.breakoutState.level) + 1}</div>`;
  }

  // --- private orchestration ---

  private applyDifficulty(): void {
    const tune = TUNING[this.difficulty];
    this.maxLives = tune.lives;
    this.speedMul = tune.speedMul;
  }

  private handleEvents(events: BreakoutEvent[]): void {
    for (const event of events) {
      if (event.type === 'brickDamaged') {
        playSound('bounce');
        const brick = this.breakoutState.bricks[event.index];
        if (!brick.alive) this.emitBrickParticles(brick);
      } else if (event.type === 'ballLost') {
        this.executeLoseLife();
      } else if (event.type === 'levelComplete') {
        this.executeNextLevel();
      }
    }
  }

  private executeLoseLife(): void {
    const lives = this.breakoutState.lives - 1;
    playSound(lives <= 0 ? 'die' : 'miss');
    screenShake(lives <= 0 ? 10 : 5, 250);
    if (lives <= 0) {
      this.breakoutState = { ...this.breakoutState, lives: 0 };
      this.gameOver();
      return;
    }
    const paddleX = BOARD / 2;
    this.breakoutState = {
      ...this.breakoutState,
      lives,
      paddleX,
      ball: resetBall(paddleX, this.breakoutState.speed),
    };
    this.updateScoreDisplay();
  }

  private executeNextLevel(): void {
    const newLevel = this.breakoutState.level + 1;
    const newSpeed = this.breakoutState.speed * SPEED_PER_LEVEL;
    this.addScore(1);
    playSound('score');
    const bricks = buildBricksForLevel(newLevel);
    const paddleX = this.breakoutState.paddleX;
    this.breakoutState = {
      ...this.breakoutState,
      level: newLevel,
      speed: newSpeed,
      bricks,
      ball: resetBall(paddleX, newSpeed),
    };
    this.updateScoreDisplay();
  }

  private emitBrickParticles(brick: Brick): void {
    if (!this.fx || !this.boardElement) return;
    const boardRect = this.boardElement.getBoundingClientRect();
    const cx = boardRect.left + ((brick.x + brick.w / 2) / 100) * boardRect.width;
    const cy = boardRect.top + ((brick.y + brick.h / 2) / 100) * boardRect.height;
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
      size: ((boardRect.height * brick.h) / 100) * 0.7,
      colors: rowColors[brick.row % 5] ?? rowColors[0],
    });
  }
}
