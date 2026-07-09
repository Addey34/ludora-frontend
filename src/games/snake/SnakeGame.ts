import { GameEngine, GameConfig } from '../../shared/engine/GameEngine.js';
import { setupHud } from '../../shared/ui/hud.js';
import {
  setupSettingsPanel,
  difficultyField,
  type SettingsField,
} from '../../shared/ui/settingsPanel.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import { t } from '../../shared/i18n/i18n.js';
import { keyboardDirection, setupSwipe, type Direction } from '../../shared/engine/input.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound } from '../../shared/fx/sound.js';
import { showToast } from '../../shared/ui/toast.js';
import { setupScoreRace, type ScoreRaceHandle } from '../../shared/versus/scoreRaceController.js';
import {
  buildSnakeRenderState,
  createSnakeGameState,
  hasSnakeCollision,
  increaseSnakeSpeed,
  queueSnakeDirection,
  recordSnakeEat,
  respawnFood,
  stepSnake,
} from './snakeLogic.js';
import type { IRenderer } from '../../shared/engine/IRenderer.js';
import type { Position, SnakeGameState, SnakeRenderState } from './snakeState.js';
import { SnakeDOMRenderer } from './SnakeDOMRenderer.js';

/**
 * Configuration specific to the Snake game.
 */
interface SnakeConfig extends GameConfig {
  /** Number of cells per side. A larger grid = easier game. */
  gridSize?: number;
  /** Initial interval between two moves, in ms. */
  baseSpeed?: number;
  /** Minimum interval (max speed) reached when accelerating, in ms. */
  minSpeed?: number;
  /** Factor applied to the interval on each food eaten (<1 = speeds up). */
  speedFactor?: number;
}

/** Per-difficulty move intervals (ms): base pace and the acceleration floor. */
const TUNING: Record<Difficulty, { base: number; min: number }> = {
  easy: { base: 175, min: 95 },
  medium: { base: 140, min: 70 },
  hard: { base: 105, min: 55 },
};

type SnakeVisualMode = '2d' | 'three';

const RELATIVE_TURNS: Record<Direction, { left: Direction; right: Direction }> = {
  up: { left: 'left', right: 'right' },
  down: { left: 'right', right: 'left' },
  left: { left: 'down', right: 'up' },
  right: { left: 'up', right: 'down' },
};

function currentHeading(state: SnakeGameState): Direction {
  return state.snake.directionQueue[state.snake.directionQueue.length - 1] ?? state.snake.direction;
}

function relativeDirection(state: SnakeGameState, turn: 'left' | 'right' | 'forward'): Direction {
  const heading = currentHeading(state);
  return turn === 'forward' ? heading : RELATIVE_TURNS[heading][turn];
}

function keyboardRelativeTurn(event: KeyboardEvent): 'left' | 'right' | 'forward' | null {
  switch (event.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
    case 'q':
    case 'Q':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    case 'ArrowUp':
    case 'w':
    case 'W':
    case 'z':
    case 'Z':
      return 'forward';
    default:
      return null;
  }
}

function swipeRelativeTurn(direction: Direction): 'left' | 'right' | 'forward' | null {
  if (direction === 'left' || direction === 'right') return direction;
  if (direction === 'up') return 'forward';
  return null;
}
const VISUAL_MODE_STORAGE_KEY = 'snake-visual-mode';

function readInitialVisualMode(): SnakeVisualMode {
  const renderer = new URLSearchParams(window.location.search).get('renderer');
  if (renderer === 'three' || renderer === '3d') return 'three';
  if (renderer === '2d' || renderer === 'dom') return '2d';
  return localStorage.getItem(VISUAL_MODE_STORAGE_KEY) === 'three' ? 'three' : '2d';
}

function visualModeField(
  value: SnakeVisualMode,
  onChange: (value: SnakeVisualMode) => void
): SettingsField {
  return {
    id: 'visualMode',
    label: t('visualMode'),
    value,
    choices: [
      { label: t('visualMode2d'), value: '2d' },
      { label: t('visualMode3d'), value: 'three' },
    ],
    onChange: (next) => onChange(next === 'three' ? 'three' : '2d'),
  };
}

async function createSnakeRenderer(
  playBoard: HTMLElement,
  visualMode: SnakeVisualMode
): Promise<IRenderer<SnakeRenderState>> {
  if (visualMode === 'three') {
    const { SnakeThreeRenderer } = await import('./SnakeThreeRenderer.js');
    return new SnakeThreeRenderer(playBoard);
  }
  return new SnakeDOMRenderer(playBoard);
}
/**
 * Snake game.
 *
 * The snake moves on a square grid at a fixed rate (independent of the render
 * loop's 60 fps); each food eaten earns points and speeds up the game down to a
 * speed floor.
 */
export class SnakeGame extends GameEngine {
  private snakeState: SnakeGameState;
  private previousSnakeState: SnakeGameState;
  private gridSize: number;
  private playBoard: HTMLElement | null = null;
  /** Effects layer overlaid on the board (not cleared every frame). */
  private fxLayer: HTMLElement | null = null;
  private fx: ParticleSystem | null = null;
  private renderer: IRenderer<SnakeRenderState> | null = null;
  private visualMode: SnakeVisualMode = readInitialVisualMode();
  private rendererRequestId = 0;
  private race: ScoreRaceHandle | null = null;

  /** Points earned per mouse eaten (base, before combo multiplier). */
  private static readonly FOOD_POINTS = 10;
  /** Time window (ms) within which consecutive eats build a combo. */
  private static readonly COMBO_WINDOW = 2500;
  /** Max multiplier cap. */
  private static readonly COMBO_MAX = 5;
  /** Base interval between two moves (ms). Lowered by a harder difficulty. */
  private baseInterval: number;
  /** Minimum interval reachable when accelerating (ms). */
  private minInterval: number;
  private difficulty: Difficulty = 'medium';
  /** Interval reduction factor on each food (<1 = speeds up). */
  private readonly speedFactor: number;
  /** Time accumulated since the last move (ms). */
  private moveAccumulator: number = 0;
  /**
   * Set when the board state actually changed (a move happened) so `render()`
   * skips the ~12 identical frames between two moves. The rAF loop calls render
   * at 60 fps, but the snake only steps every `moveInterval` ms: redrawing the
   * whole board every frame is pure DOM churn.
   */
  private dirty: boolean = true;

  /**
   * @param config Game configuration (grid size, speeds…).
   */
  constructor(config: SnakeConfig = {}) {
    super({ ...config, storageKey: 'snake-high-scores', leaderboardId: 'snake' });
    this.gridSize = config.gridSize || 25;
    this.baseInterval = config.baseSpeed || 140;
    this.minInterval = config.minSpeed || 70;
    this.speedFactor = config.speedFactor || 0.93;
    this.snakeState = createSnakeGameState(this.gridSize, this.baseInterval);
    this.previousSnakeState = this.snakeState;
  }

  /**
   * No "Play" overlay: the loop can run from load because the snake stays still
   * until the first direction input (see `Snake.started`), so an unintended
   * start is already blocked. Start the loop directly.
   */
  presentStartScreen(): void {
    this.start();
  }

  /**
   * Binds the DOM elements, sizes the CSS grid from the game's logical size,
   * wires up the keyboard and performs the first render.
   */
  async initialize(): Promise<void> {
    this.playBoard = document.querySelector('.play-board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'score', icon: 'star', label: t('score') },
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
        this.baseInterval = TUNING[this.difficulty].base;
        this.minInterval = TUNING[this.difficulty].min;
        this.setLeaderboardVariant(this.difficulty, t(this.difficulty));
        this.reset(); // restart at the new pace right away
      }),
      visualModeField(this.visualMode, (value) => {
        this.visualMode = value;
        localStorage.setItem(VISUAL_MODE_STORAGE_KEY, value);
        void this.recreateRenderer();
      }),
    ]);
    this.setLeaderboardVariant(this.difficulty, t(this.difficulty));

    if (this.playBoard) {
      this.playBoard.style.setProperty('--cell-size', `${100 / this.gridSize}%`);
      this.playBoard.style.setProperty('--move-ms', `${this.baseInterval}ms`);
      this.fxLayer = document.createElement('div');
      this.fxLayer.className = 'snake-fx';
      this.playBoard.appendChild(this.fxLayer);
      this.renderer = await createSnakeRenderer(this.playBoard, this.visualMode);

      setupSwipe(this.playBoard, {
        onSwipe: (direction) => {
          if (this.state.isGameOver) return;
          if (this.visualMode === 'three') {
            const turn = swipeRelativeTurn(direction);
            if (!turn) return;
            this.snakeState = queueSnakeDirection(
              this.snakeState,
              relativeDirection(this.snakeState, turn)
            );
            return;
          }
          this.snakeState = queueSnakeDirection(this.snakeState, direction);
        },
      });
    }

    this.setupEventListeners();
    this.updateScoreDisplay();
    this.renderScoreTable();
    this.render();
  }

  /**
   * Moves the snake at the `moveInterval` rate (not every frame): handles eating
   * food, acceleration and collision detection.
   */
  update(deltaTime: number): void {
    if (this.state.isPaused || this.state.isGameOver) return;

    this.moveAccumulator += deltaTime;
    if (this.moveAccumulator < this.snakeState.moveInterval) return;
    this.moveAccumulator = 0;

    this.dirty = true;
    this.previousSnakeState = this.snakeState;
    const move = stepSnake(this.snakeState);
    this.snakeState = move.state;

    if (move.ateFood) {
      const foodPosition = this.snakeState.food.position;
      this.snakeState = recordSnakeEat(
        this.snakeState,
        performance.now(),
        SnakeGame.COMBO_WINDOW,
        SnakeGame.COMBO_MAX
      );

      const multiplier = this.snakeState.comboCount;
      const points = SnakeGame.FOOD_POINTS * multiplier;
      this.addScore(points);
      this.spawnScoreFloat(foodPosition, points);
      this.snakeState = increaseSnakeSpeed(
        respawnFood(this.snakeState),
        this.minInterval,
        this.speedFactor
      );

      if (multiplier >= 2) {
        playSound('combo');
        showToast(`Combo ×${multiplier}!`, 'combo');
      } else {
        playSound('eat');
      }
    }

    if (hasSnakeCollision(this.snakeState.snake)) {
      this.spawnDeathParticles();
      screenShake(8, 320);
      playSound('die');
      this.gameOver();
    }
  }

  render(): void {
    if (!this.dirty && !this.renderer?.continuousRender) return;
    this.dirty = false;
    this.renderer?.render(this.renderState());
  }

  protected onScoreChange(newScore: number): void {
    super.onScoreChange(newScore);
    this.race?.reportProgress(newScore, !this.state.isGameOver);
  }

  protected onGameOver(): void {
    if (this.race?.reportFinished(this.state.score)) return;
    super.onGameOver();
  }

  /**
   * Spawns a floating "+N" on the given cell, in the effects layer. The element
   * removes itself at the end of its CSS animation.
   */
  private spawnScoreFloat(pos: Position, points: number): void {
    if (!this.fxLayer) return;

    const float = document.createElement('div');
    float.className = 'score-float';
    float.textContent = `+${points}`;
    float.style.left = `${((pos.x - 0.5) / this.gridSize) * 100}%`;
    float.style.top = `${((pos.y - 0.5) / this.gridSize) * 100}%`;
    float.addEventListener('animationend', () => float.remove());

    this.fxLayer.appendChild(float);
  }

  /**
   * Bursts particles from every snake segment on death.
   * Coordinates come from getBoundingClientRect so they land in viewport space,
   * matching the fixed-canvas particle system.
   */
  private spawnDeathParticles(): void {
    if (!this.fx || !this.playBoard) return;
    const board = this.playBoard.getBoundingClientRect();
    const cellPx = board.width / this.gridSize;
    const colors = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0'];

    this.snakeState.snake.body.forEach((seg) => {
      const cx = board.left + (seg.x - 0.5) * cellPx;
      const cy = board.top + (seg.y - 0.5) * cellPx;
      this.fx!.emit(cx, cy, {
        count: 5,
        speed: 3.5 + Math.random() * 2,
        spread: Math.PI * 2,
        gravity: 0.15,
        duration: 650,
        size: cellPx * 0.28,
        colors,
      });
    });
  }

  /**
   * Translates the key into a direction and steers the snake (arrows/ZQSD do
   * not scroll the page).
   */
  handleInput(event: KeyboardEvent): void {
    if (this.state.isGameOver) return;

    if (this.visualMode === 'three') {
      const turn = keyboardRelativeTurn(event);
      if (!turn) return;
      event.preventDefault();
      this.snakeState = queueSnakeDirection(
        this.snakeState,
        relativeDirection(this.snakeState, turn)
      );
      return;
    }

    const direction = keyboardDirection(event);
    if (direction) {
      event.preventDefault();
      this.snakeState = queueSnakeDirection(this.snakeState, direction);
    }
  }

  /**
   * Recreates the snake and the food and resets score, speed and state to zero.
   */
  reset(): void {
    this.snakeState = createSnakeGameState(this.gridSize, this.baseInterval);
    this.previousSnakeState = this.snakeState;
    this.previousSnakeState = this.snakeState;
    this.previousSnakeState = this.snakeState;
    this.resetState();
    this.moveAccumulator = 0;
    this.dirty = true;
    this.renderer?.reset?.();
    this.playBoard?.style.setProperty('--move-ms', `${this.baseInterval}ms`);
    if (this.fxLayer) this.fxLayer.innerHTML = '';
    this.race?.reset();
    this.updateScoreDisplay();
    this.render();
  }
  private renderState(): SnakeRenderState {
    const progress = this.snakeState.snake.started
      ? this.moveAccumulator / this.snakeState.moveInterval
      : 1;
    return buildSnakeRenderState(this.previousSnakeState, this.snakeState, progress);
  }
  private async recreateRenderer(): Promise<void> {
    if (!this.playBoard) return;
    const requestId = ++this.rendererRequestId;
    this.renderer?.dispose?.();
    this.renderer = null;
    const renderer = await createSnakeRenderer(this.playBoard, this.visualMode);
    if (requestId !== this.rendererRequestId) {
      renderer.dispose?.();
      return;
    }
    this.renderer = renderer;
    this.dirty = true;
    this.render();
  }
}
