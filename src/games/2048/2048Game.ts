import { GameEngine, GameConfig } from '../../shared/engine/GameEngine.js';
import { setupHud } from '../../shared/ui/hud.js';
import { setupSettingsPanel } from '../../shared/ui/settingsPanel.js';
import { t } from '../../shared/i18n/i18n.js';
import { Direction, keyboardDirection, setupSwipe } from '../../shared/engine/input.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { playSound } from '../../shared/fx/sound.js';
import { canMove, emptyCells, orientFromLeft, orientToLeft, planLine } from './2048Logic.js';

/**
 * Configuration specific to the 2048 game.
 */
interface Game2048Config extends GameConfig {
  /** Number of cells per grid side (default: 4). */
  gridSize?: number;
}

/**
 * A tile living on the board. Its `id` is stable across moves so the DOM element
 * persists and its position transitions (slide) instead of being rebuilt. `row`
 * /`col` are updated to the destination on a move; one-shot `isNew`/`merged`
 * flags drive the pop animations and are cleared once rendered.
 */
interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
  merged?: boolean;
  /** Set on the tile consumed by a merge: it slides to the cell then is removed. */
  removing?: boolean;
}

/** Outcome of a move: whether it changed the grid, the score gained, and the merges. */
interface MoveResult {
  changed: boolean;
  gained: number;
  merged: boolean;
  /** Survivor tile id → its new (doubled) value, applied after the slide. */
  merges: { id: number; value: number }[];
  /** The resulting value grid (authoritative for the game logic). */
  board: number[][];
}

/** Slide duration (ms) — kept in sync with the CSS `top`/`left` transition. */
const SLIDE_MS = 125;

/**
 * 2048 game.
 *
 * On a square grid, the arrows slide all the tiles in one direction; two tiles
 * of the same value that meet merge into their sum (a single merge per tile per
 * move) and credit that sum to the score. After each valid move, a new tile (2
 * at 90%, 4 at 10%) appears on a free cell. The game ends when no move is
 * possible anymore.
 *
 * Tiles keep a stable identity ({@link Tile.id}) and are absolutely positioned,
 * so a move slides them to their destination (CSS transition) rather than
 * rebuilding the grid. A move therefore plays in two beats: first the slide,
 * then — after {@link SLIDE_MS} — the merges resolve (doubled value + pop),
 * consumed tiles are dropped and a fresh tile spawns.
 *
 * Like the typing game, this game is event-driven and does not use the engine's
 * `requestAnimationFrame` loop: {@link start} merely activates the state, and the
 * render is triggered after each move.
 */
export class Game2048 extends GameEngine {
  private gridSize: number;
  /** Grid of values; 0 = empty cell, otherwise a power of two. */
  private board: number[][] = [];

  private boardElement: HTMLElement | null = null;
  private tileLayer: HTMLElement | null = null;
  private fx: ParticleSystem | null = null;

  /** Live tiles, keyed by id to their DOM element in {@link tileLayer}. */
  private tiles: Tile[] = [];
  private tileEls = new Map<number, HTMLElement>();
  private nextTileId = 1;

  /** True while a move's slide is in flight; further input is ignored until it resolves. */
  private animating = false;
  private slideTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param config Game configuration (grid size).
   */
  constructor(config: Game2048Config = {}) {
    super({ ...config, storageKey: '2048-high-scores', leaderboardId: '2048' });
    this.gridSize = config.gridSize || 4;
  }

  /**
   * Binds the DOM elements, builds the static background + tile layer, wires up
   * the keyboard/swipe, seeds the grid with two tiles then performs the first render.
   */
  initialize(): void {
    this.boardElement = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'score', icon: 'star', label: t('score') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);

    setupSettingsPanel([
      {
        id: 'size',
        label: t('size'),
        value: String(this.gridSize),
        choices: [
          { label: '3×3', value: '3' },
          { label: '4×4', value: '4' },
          { label: '5×5', value: '5' },
        ],
        onChange: (v) => {
          this.gridSize = Number(v);
          this.setLeaderboardVariant(String(this.gridSize), `${this.gridSize}×${this.gridSize}`);
          this.buildScaffold();
          this.reset();
        },
      },
    ]);
    this.setLeaderboardVariant(String(this.gridSize), `${this.gridSize}×${this.gridSize}`);

    this.buildScaffold();
    this.setupEventListeners();

    if (this.boardElement) {
      setupSwipe(this.boardElement, {
        onSwipe: (direction) => this.applyMove(direction),
      });
    }

    this.resetBoard();
    this.renderScoreTable();
    this.updateScoreDisplay();
    this.render();
  }

  /**
   * Lays out the board once: the `--n` custom property, the static background
   * slots, and the (initially empty) tile layer that holds the moving tiles.
   */
  private buildScaffold(): void {
    const board = this.boardElement;
    if (!board) return;
    board.innerHTML = '';
    board.style.setProperty('--n', String(this.gridSize));

    const cells = document.createElement('div');
    cells.className = 'grid-cells';
    for (let i = 0; i < this.gridSize * this.gridSize; i++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cells.appendChild(cell);
    }
    board.appendChild(cells);

    this.tileLayer = document.createElement('div');
    this.tileLayer.className = 'tile-layer';
    board.appendChild(this.tileLayer);
  }

  /**
   * Activates the game state without starting the `requestAnimationFrame` loop:
   * 2048 is driven by keyboard events (see {@link handleInput}).
   */
  start(): void {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.state.isGameOver = false;
    this.state.isPaused = false;
  }

  /**
   * No "Play" overlay: 2048 is purely keyboard-driven (`update()` is a no-op),
   * so nothing happens until the first key — an unintended start is already
   * blocked. Activate the game state directly.
   */
  presentStartScreen(): void {
    this.start();
  }

  /**
   * No-op: no continuous logic to update (event-driven game). Required by the
   * {@link GameEngine} contract.
   */
  update(_deltaTime: number): void {}

  /** Reconciles the tile DOM with {@link tiles} (see {@link renderTiles}). */
  render(): void {
    this.renderTiles();
  }

  /**
   * Diffs {@link tiles} against their DOM elements: updates value/position (so a
   * changed `--row`/`--col` transitions), creates missing tiles (pop-in) and
   * removes gone ones. One-shot `isNew`/`merged` flags are consumed here.
   */
  private renderTiles(): void {
    const layer = this.tileLayer;
    if (!layer) return;

    const seen = new Set<number>();
    for (const tile of this.tiles) {
      seen.add(tile.id);
      let el = this.tileEls.get(tile.id);
      if (!el) {
        el = document.createElement('div');
        layer.appendChild(el);
        this.tileEls.set(tile.id, el);
      }
      el.className = this.tileClass(tile.value);
      el.textContent = tile.value > 0 ? tile.value.toString() : '';
      el.style.setProperty('--row', String(tile.row));
      el.style.setProperty('--col', String(tile.col));
      if (tile.isNew) {
        el.classList.add('is-new');
        tile.isNew = false;
      }
      if (tile.merged) {
        el.classList.add('is-merged');
        tile.merged = false;
      }
    }

    for (const [id, el] of this.tileEls) {
      if (!seen.has(id)) {
        el.remove();
        this.tileEls.delete(id);
      }
    }
  }

  /**
   * Emits an orange particle burst from each merged tile's screen position.
   */
  private emitMergeParticles(ids: number[]): void {
    if (!this.fx) return;
    const colors = ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fff7ed'];
    for (const id of ids) {
      const el = this.tileEls.get(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) continue;
      this.fx.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
        count: 8,
        speed: 4,
        spread: Math.PI * 2,
        gravity: 0.12,
        duration: 580,
        size: rect.width * 0.17,
        colors,
      });
    }
  }

  /**
   * CSS class of a tile based on its value and its number of digits (large
   * numbers shrink the font size).
   */
  private tileClass(value: number): string {
    const digits = value.toString().length;
    const sizeModifier = digits >= 4 ? ' tile--4digits' : digits === 3 ? ' tile--3digits' : '';
    const colorClass = value <= 2048 ? `tile--${value}` : 'tile--super';
    return `tile ${colorClass}${sizeModifier}`;
  }

  /**
   * Applies the move matching the pressed key. If the grid changes, spawns a new
   * tile, updates the display and checks for game over.
   */
  handleInput(event: KeyboardEvent): void {
    const direction = keyboardDirection(event);
    if (!direction) return;

    event.preventDefault();
    this.applyMove(direction);
  }

  /**
   * Plays a move in the given direction (keyboard or swipe). The tiles slide to
   * their destinations immediately; the merges/spawn/game-over resolve once the
   * slide has finished ({@link finalizeMove}). Ignored while a slide is running.
   */
  private applyMove(direction: Direction): void {
    if (this.state.isGameOver || this.animating) return;

    const result = this.move(direction);
    if (!result.changed) return;

    this.board = result.board;
    this.addScore(result.gained);
    this.animating = true;
    this.renderTiles();
    playSound(result.merged ? 'score' : 'move');

    this.slideTimer = setTimeout(() => this.finalizeMove(result.merges), SLIDE_MS);
  }

  /**
   * Second beat of a move: applies the doubled values to the merge survivors
   * (with a pop), removes the consumed tiles, spawns a fresh tile, then checks
   * whether the game is over.
   */
  private finalizeMove(merges: { id: number; value: number }[]): void {
    this.slideTimer = null;

    for (const { id, value } of merges) {
      const tile = this.tiles.find((t) => t.id === id);
      if (tile) {
        tile.value = value;
        tile.merged = true;
      }
    }
    this.tiles = this.tiles.filter((t) => !t.removing);

    this.spawnTile();
    this.animating = false;
    this.renderTiles();
    this.emitMergeParticles(merges.map((m) => m.id));

    if (!canMove(this.board)) {
      playSound('die');
      this.gameOver();
    }
  }

  /**
   * Computes the move in `direction`: every tile is oriented into a leftward
   * slide, compacted and merged within its row (one merge per tile), then mapped
   * back to board space. Tile positions are mutated to their destinations here so
   * the render can transition them; merge survivors keep their old value until
   * {@link finalizeMove}. No side effect when the grid doesn't change.
   */
  private move(direction: Direction): MoveResult {
    const n = this.gridSize;
    const grid: (Tile | null)[][] = Array.from({ length: n }, () =>
      new Array<Tile | null>(n).fill(null)
    );
    for (const tile of this.tiles) {
      if (tile.removing) continue;
      const p = orientToLeft(tile.row, tile.col, direction, n);
      grid[p.r][p.c] = tile;
    }

    let changed = false;
    let gained = 0;
    const merges: { id: number; value: number }[] = [];

    for (let r = 0; r < n; r++) {
      const line = grid[r].filter((t): t is Tile => t !== null);
      const { outputs, gained: rowGained } = planLine(line.map((t) => t.value));
      gained += rowGained;

      let li = 0;
      outputs.forEach((out, outCol) => {
        const dest = orientFromLeft(r, outCol, direction, n);
        const tile = line[li++];
        if (out.merged) {
          const next = line[li++];
          this.setTilePos(tile, dest);
          this.setTilePos(next, dest);
          tile.removing = false;
          next.removing = true;
          merges.push({ id: tile.id, value: out.value });
          changed = true;
        } else {
          if (tile.row !== dest.row || tile.col !== dest.col) changed = true;
          this.setTilePos(tile, dest);
        }
      });
    }

    const board = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (const tile of this.tiles) {
      if (tile.removing) continue;
      const merge = merges.find((m) => m.id === tile.id);
      board[tile.row][tile.col] = merge ? merge.value : tile.value;
    }

    return { changed, gained, merged: merges.length > 0, merges, board };
  }

  /** Moves a tile to a board position (mutates in place). */
  private setTilePos(tile: Tile, pos: { row: number; col: number }): void {
    tile.row = pos.row;
    tile.col = pos.col;
  }

  /**
   * Spawns a tile (2 at 90%, 4 at 10%) on a randomly chosen free cell. No-op if
   * the grid is full.
   */
  private spawnTile(): void {
    const empty = emptyCells(this.board);
    if (empty.length === 0) return;

    const cell = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    this.board[cell.y][cell.x] = value;
    this.tiles.push({ id: this.nextTileId++, value, row: cell.y, col: cell.x, isNew: true });
  }

  /**
   * Creates an empty grid + a fresh tile set and places the two starting tiles.
   */
  private resetBoard(): void {
    this.board = Array.from({ length: this.gridSize }, () =>
      new Array<number>(this.gridSize).fill(0)
    );
    this.tiles = [];
    this.tileLayer?.replaceChildren();
    this.tileEls.clear();
    this.spawnTile();
    this.spawnTile();
  }

  /**
   * Resets the grid, the score and the state, then performs the render.
   */
  reset(): void {
    if (this.slideTimer !== null) {
      clearTimeout(this.slideTimer);
      this.slideTimer = null;
    }
    this.animating = false;
    this.resetState();
    this.resetBoard();
    this.updateScoreDisplay();
    this.render();
  }

  /** Stops the game and cancels a pending slide resolution. */
  stop(): void {
    super.stop();
    if (this.slideTimer !== null) {
      clearTimeout(this.slideTimer);
      this.slideTimer = null;
    }
  }
}
