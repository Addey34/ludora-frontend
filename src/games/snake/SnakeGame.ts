import { GameEngine, GameConfig } from '../../shared/engine/GameEngine.js';
import { setupHud } from '../../shared/ui/hud.js';
import {
  Direction,
  DIRECTION_DELTAS,
  OPPOSITE_DIRECTION,
  keyboardDirection,
  setupSwipe,
} from '../../shared/engine/input.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound } from '../../shared/fx/sound.js';
import { showToast } from '../../shared/ui/toast.js';

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

/**
 * Coordinates of a cell on the grid (1-indexed).
 */
interface Position {
  x: number;
  y: number;
}

/**
 * The snake: its queue of segments, its direction and its movement logic.
 *
 * The body "wraps" at the grid edges (crossing a wall = reappearing on the
 * opposite side).
 */
export class Snake {
  private body: Position[];
  /** Direction actually travelled on the last move (the "committed" one). */
  private direction: Direction;
  /**
   * Pending turns, applied one per move. A short queue (max 2) is what makes the
   * controls feel responsive: pressing two turns in quick succession (e.g. ↑ then
   * ← to round a corner) registers BOTH — on successive moves — instead of the
   * first being overwritten and lost. Each entry is validated against the
   * projected heading on enqueue, so a 180° reversal can never sneak in.
   */
  private directionQueue: Direction[] = [];
  /** Becomes true on the first input: the snake stays still until then. */
  private started: boolean = false;
  private gridSize: number;

  /** Max pending turns: enough to round a corner, small enough to feel direct. */
  private static readonly MAX_QUEUED = 2;

  /**
   * Creates a one-segment snake at a random position, facing right.
   * @param gridSize Grid size (number of cells per side).
   */
  constructor(gridSize: number) {
    this.gridSize = gridSize;
    this.body = [
      {
        x: Math.floor(Math.random() * gridSize) + 1,
        y: Math.floor(Math.random() * gridSize) + 1,
      },
    ];
    this.direction = 'right';
  }

  /**
   * Moves the snake forward by one cell. Grows the body if the food is eaten,
   * otherwise removes the last segment (constant length).
   * @returns `true` if the food was eaten on this move.
   */
  move(food: Position): boolean {
    if (this.started && this.directionQueue.length > 0) {
      this.direction = this.directionQueue.shift() as Direction;
    }

    const step = this.started ? DIRECTION_DELTAS[this.direction] : { x: 0, y: 0 };
    const head = this.body[0];
    const newHead: Position = {
      x: this.wrapPosition(head.x + step.x),
      y: this.wrapPosition(head.y + step.y),
    };

    this.body.unshift(newHead);
    const hasEaten = this.checkFoodCollision(food);
    if (!hasEaten) {
      this.body.pop();
    }
    return hasEaten;
  }

  /**
   * Folds an off-grid coordinate back onto the opposite edge ("wrap" effect).
   */
  private wrapPosition(pos: number): number {
    if (pos <= 0) return this.gridSize;
    if (pos > this.gridSize) return 1;
    return pos;
  }

  /**
   * Detects a collision of the head with the body. The first four segments
   * (indices 0 to 3) are ignored: since the U-turn is forbidden, it takes at
   * least a 2×2-cell loop (4 moves) for the head to reach a body cell — segment
   * at index 4 is therefore the first one that can coincide.
   */
  checkCollision(): boolean {
    const head = this.body[0];
    for (let i = 4; i < this.body.length; i++) {
      const segment = this.body[i];
      if (head.x === segment.x && head.y === segment.y) {
        return true;
      }
    }
    return false;
  }

  /**
   * Tells whether the head is on the food cell.
   */
  private checkFoodCollision(food: Position): boolean {
    const head = this.body[0];
    return head.x === food.x && head.y === food.y;
  }

  /**
   * Changes the snake's direction. The U-turn is ignored: the snake cannot turn
   * back on itself.
   */
  setDirection(newDirection: Direction): void {
    this.started = true;
    const reference =
      this.directionQueue.length > 0
        ? this.directionQueue[this.directionQueue.length - 1]
        : this.direction;
    if (newDirection === reference || OPPOSITE_DIRECTION[newDirection] === reference) return;
    if (this.directionQueue.length >= Snake.MAX_QUEUED) return;
    this.directionQueue.push(newDirection);
  }

  /** Returns the body segments (head at the front of the list). */
  getBody(): Position[] {
    return this.body;
  }

  /** Returns the current direction. */
  getDirection(): Direction {
    return this.direction;
  }
}

/**
 * The food: a cell that never overlaps the snake.
 */
export class Food {
  /** Available mouse variants (match the CSS classes .food--*). */
  private static readonly VARIANTS = ['gray', 'brown', 'white'] as const;

  private position: Position;
  private snake: Snake;
  private gridSize: number;
  /** Current mouse variant, drawn at random on each respawn. */
  private variant: string = Food.VARIANTS[0];

  /**
   * @param snake Snake to avoid when placing.
   * @param gridSize Grid size.
   */
  constructor(snake: Snake, gridSize: number) {
    this.snake = snake;
    this.gridSize = gridSize;
    this.position = { x: 0, y: 0 };
    this.randomize();
  }

  /**
   * Moves the food to a random free cell (outside the snake body) and draws a
   * new mouse variant.
   */
  randomize(): void {
    do {
      this.position = {
        x: Math.floor(Math.random() * this.gridSize) + 1,
        y: Math.floor(Math.random() * this.gridSize) + 1,
      };
    } while (this.isOnSnake());

    this.variant = Food.VARIANTS[Math.floor(Math.random() * Food.VARIANTS.length)];
  }

  /**
   * Tells whether the current position overlaps a snake segment.
   */
  private isOnSnake(): boolean {
    return this.snake
      .getBody()
      .some((segment) => segment.x === this.position.x && segment.y === this.position.y);
  }

  /** Returns the food position. */
  getPosition(): Position {
    return this.position;
  }

  /** Returns the current mouse variant (CSS class suffix .food--*). */
  getVariant(): string {
    return this.variant;
  }
}

/**
 * Snake game.
 *
 * The snake moves on a square grid at a fixed rate (independent of the render
 * loop's 60 fps); each food eaten earns points and speeds up the game down to a
 * speed floor.
 */
export class SnakeGame extends GameEngine {
  private snake: Snake;
  private food: Food;
  private gridSize: number;
  private playBoard: HTMLElement | null = null;
  /** Effects layer overlaid on the board (not cleared every frame). */
  private fxLayer: HTMLElement | null = null;
  private fx: ParticleSystem | null = null;
  /** Persistent snake segment nodes, reused across moves so they can glide. */
  private segmentEls: HTMLElement[] = [];
  /** Persistent mouse node (its sub-divs are built once, then repositioned). */
  private foodEl: HTMLElement | null = null;

  /** Points earned per mouse eaten (base, before combo multiplier). */
  private static readonly FOOD_POINTS = 10;
  /** Time window (ms) within which consecutive eats build a combo. */
  private static readonly COMBO_WINDOW = 2500;
  /** Max multiplier cap. */
  private static readonly COMBO_MAX = 5;

  /** Timestamp of the last food eaten (for combo tracking). */
  private lastEatTime: number = 0;
  /** Number of consecutive eats within COMBO_WINDOW. */
  private comboCount: number = 0;

  /** Base interval between two moves (ms). */
  private readonly baseInterval: number;
  /** Minimum interval reachable when accelerating (ms). */
  private readonly minInterval: number;
  /** Interval reduction factor on each food (<1 = speeds up). */
  private readonly speedFactor: number;
  /** Current move interval (ms). */
  private moveInterval: number;
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
    this.moveInterval = this.baseInterval;

    this.snake = new Snake(this.gridSize);
    this.food = new Food(this.snake, this.gridSize);
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
  initialize(): void {
    this.playBoard = document.querySelector('.play-board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'score', icon: 'star', label: 'Score' },
      { key: 'high', icon: 'trophy', label: 'Best' },
    ]);

    if (this.playBoard) {
      this.playBoard.style.setProperty('--cell-size', `${100 / this.gridSize}%`);
      this.playBoard.style.setProperty('--move-ms', `${this.baseInterval}ms`);
      this.fxLayer = document.createElement('div');
      this.fxLayer.className = 'snake-fx';
      this.playBoard.appendChild(this.fxLayer);

      setupSwipe(this.playBoard, {
        onSwipe: (direction) => {
          if (!this.state.isGameOver) this.snake.setDirection(direction);
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
    if (this.moveAccumulator < this.moveInterval) return;
    this.moveAccumulator = 0;

    this.dirty = true;
    const hasEaten = this.snake.move(this.food.getPosition());

    if (hasEaten) {
      const now = performance.now();
      const elapsed = now - this.lastEatTime;
      if (this.lastEatTime > 0 && elapsed <= SnakeGame.COMBO_WINDOW) {
        this.comboCount = Math.min(this.comboCount + 1, SnakeGame.COMBO_MAX);
      } else {
        this.comboCount = 1;
      }
      this.lastEatTime = now;

      const multiplier = this.comboCount;
      const points = SnakeGame.FOOD_POINTS * multiplier;
      this.addScore(points);
      this.spawnScoreFloat(this.food.getPosition(), points);
      this.food.randomize();
      this.increaseSpeed();

      if (multiplier >= 2) {
        playSound('combo');
        showToast(`Combo ×${multiplier}!`, 'combo');
      } else {
        playSound('eat');
      }
    }

    if (this.snake.checkCollision()) {
      this.spawnDeathParticles();
      screenShake(8, 320);
      playSound('die');
      this.gameOver();
    }
  }

  /**
   * Reduces the move interval (progressive difficulty), without going below
   * `minInterval` to stay playable.
   */
  private increaseSpeed(): void {
    this.moveInterval = Math.max(this.minInterval, this.moveInterval * this.speedFactor);
  }

  /**
   * Rebuilds the board: snake segments (head vs body) then the food, positioned
   * via the CSS grid.
   */
  render(): void {
    if (!this.playBoard) return;
    if (!this.dirty) return;
    this.dirty = false;

    this.playBoard.style.setProperty('--move-ms', `${this.moveInterval}ms`);

    this.renderSnake();
    this.renderFood();
  }

  /**
   * Positions the snake by reusing persistent nodes and moving each with a CSS
   * `transform`, so the body glides one cell forward per move. A node whose
   * target is more than one cell away — a wall wrap, or a freshly created node —
   * is snapped without animation so it doesn't slide across the whole board.
   */
  private renderSnake(): void {
    const body = this.snake.getBody();
    const direction = this.snake.getDirection();

    body.forEach((segment, index) => {
      let el = this.segmentEls[index];
      const isNew = el === undefined;
      if (isNew) {
        el = document.createElement('div');
        this.playBoard!.appendChild(el);
        this.segmentEls[index] = el;
      }
      el.className = index === 0 ? `snake-head ${direction}` : 'snake-body';

      const snap =
        isNew ||
        Math.abs(segment.x - Number(el.dataset.x)) > 1 ||
        Math.abs(segment.y - Number(el.dataset.y)) > 1;
      this.placeCell(el, segment.x, segment.y, snap);
    });

    while (this.segmentEls.length > body.length) {
      this.segmentEls.pop()?.remove();
    }
  }

  /** Creates the mouse once (its sub-divs), then repositions it (no glide). */
  private renderFood(): void {
    if (!this.foodEl) {
      this.foodEl = document.createElement('div');
      this.foodEl.innerHTML = `
        <div class="food-ear left"></div>
        <div class="food-ear right"></div>
        <div class="food-body"></div>
        <div class="food-eye left"></div>
        <div class="food-eye right"></div>
        <div class="food-nose"></div>
        <div class="food-tail"></div>
      `;
      this.playBoard!.appendChild(this.foodEl);
    }
    const pos = this.food.getPosition();
    this.foodEl.className = `food food--${this.food.getVariant()}`;
    this.placeCell(this.foodEl, pos.x, pos.y, true);
  }

  /**
   * Places an element on cell (x, y) via `transform` (one cell = 100% of its own
   * size). When `snap`, the transition is briefly disabled so the element jumps
   * instead of sliding (used for wraps and the first placement).
   */
  private placeCell(el: HTMLElement, x: number, y: number, snap: boolean): void {
    const transform = `translate(${(x - 1) * 100}%, ${(y - 1) * 100}%)`;
    if (snap) {
      el.style.transition = 'none';
      el.style.transform = transform;
      void el.offsetWidth;
      el.style.transition = '';
    } else {
      el.style.transform = transform;
    }
    el.dataset.x = String(x);
    el.dataset.y = String(y);
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

    this.snake.getBody().forEach((seg) => {
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

    const direction = keyboardDirection(event);
    if (direction) {
      event.preventDefault();
      this.snake.setDirection(direction);
    }
  }

  /**
   * Recreates the snake and the food and resets score, speed and state to zero.
   */
  reset(): void {
    this.snake = new Snake(this.gridSize);
    this.food = new Food(this.snake, this.gridSize);
    this.resetState();
    this.moveInterval = this.baseInterval;
    this.moveAccumulator = 0;
    this.dirty = true;
    this.lastEatTime = 0;
    this.comboCount = 0;
    this.segmentEls.forEach((el) => el.remove());
    this.segmentEls = [];
    this.foodEl?.remove();
    this.foodEl = null;
    this.playBoard?.style.setProperty('--move-ms', `${this.baseInterval}ms`);
    if (this.fxLayer) this.fxLayer.innerHTML = '';
    this.updateScoreDisplay();
    this.render();
  }
}
