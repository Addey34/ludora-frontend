import { GameEngine, GameConfig } from '../../shared/engine/GameEngine.js';
import { setupHud } from '../../shared/ui/hud.js';
import { Direction, keyboardDirection, setupSwipe } from '../../shared/engine/input.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { playSound } from '../../shared/fx/sound.js';

/**
 * Configuration specific to the 2048 game.
 */
interface Game2048Config extends GameConfig {
  /** Number of cells per grid side (default: 4). */
  gridSize?: number;
}

/**
 * Result of sliding a row to the left.
 */
interface SlideResult {
  /** Row after compression and merges. */
  row: number[];
  /** Points earned by this row's merges. */
  gained: number;
  /** Whether the row changed compared to the original. */
  changed: boolean;
  /** Column indices in the result row that are the product of a merge. */
  mergedCols: number[];
}

/**
 * 2048 game.
 *
 * On a square grid, the arrows slide all the tiles in one direction; two tiles
 * of the same value that meet merge into their sum (a single merge per tile per
 * move) and credit that sum to the score. After each valid move, a new tile (2
 * at 90%, 4 at 10%) appears on a free cell. The game ends when no move is
 * possible anymore.
 *
 * Like the typing game, this game is event-driven and does not use the engine's
 * `requestAnimationFrame` loop: {@link start} merely activates the state, and the
 * render is triggered after each move.
 */
export class Game2048 extends GameEngine {
  private readonly gridSize: number;
  /** Grid of values; 0 = empty cell, otherwise a power of two. */
  private board: number[][] = [];

  private boardElement: HTMLElement | null = null;
  private fx: ParticleSystem | null = null;
  /** Board-space coordinates of tiles that resulted from a merge (set by move(), consumed by render()). */
  private pendingMerged: { row: number; col: number }[] = [];
  /** Position of the tile spawned by the last spawnTile() call (consumed by render()). */
  private pendingSpawn: { row: number; col: number } | null = null;

  /**
   * @param config Game configuration (grid size).
   */
  constructor(config: Game2048Config = {}) {
    super({ ...config, storageKey: '2048-high-scores', leaderboardId: '2048' });
    this.gridSize = config.gridSize || 4;
  }

  /**
   * Binds the DOM elements, wires up the keyboard, initializes the grid with two
   * tiles then performs the first render.
   */
  initialize(): void {
    this.boardElement = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'score', icon: 'star', label: 'Score' },
      { key: 'high', icon: 'trophy', label: 'Best' },
    ]);

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

  /**
   * Rebuilds the grid display from {@link board}. Newly spawned tiles get
   * `is-new` (pop-in animation) and merge-destination tiles get `is-merged`
   * (flash + scale pop). Merge particles are emitted after the DOM is built
   * so getBoundingClientRect() returns the final tile positions.
   */
  render(): void {
    if (!this.boardElement) return;

    this.boardElement.innerHTML = '';

    const mergedSet = new Set(this.pendingMerged.map(({ row, col }) => `${row},${col}`));

    this.board.forEach((row, r) => {
      row.forEach((value, c) => {
        const tile = document.createElement('div');
        tile.className = this.tileClass(value);
        tile.textContent = value > 0 ? value.toString() : '';

        if (this.pendingSpawn?.row === r && this.pendingSpawn?.col === c) {
          tile.classList.add('is-new');
        } else if (mergedSet.has(`${r},${c}`)) {
          tile.classList.add('is-merged');
        }

        this.boardElement!.appendChild(tile);
      });
    });

    if (this.fx && this.pendingMerged.length > 0) {
      this.emitMergeParticles();
    }

    this.pendingMerged = [];
    this.pendingSpawn = null;
  }

  /**
   * Emits an orange particle burst from each merged tile's screen position.
   */
  private emitMergeParticles(): void {
    if (!this.boardElement || !this.fx) return;
    const tileEls = this.boardElement.querySelectorAll<HTMLElement>('.tile');
    const colors = ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fff7ed'];

    this.pendingMerged.forEach(({ row, col }) => {
      const tileEl = tileEls[row * this.gridSize + col];
      if (!tileEl) return;
      const rect = tileEl.getBoundingClientRect();
      this.fx!.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
        count: 8,
        speed: 4,
        spread: Math.PI * 2,
        gravity: 0.12,
        duration: 580,
        size: rect.width * 0.17,
        colors,
      });
    });
  }

  /**
   * CSS class of a tile based on its value and its number of digits (large
   * numbers shrink the font size).
   */
  private tileClass(value: number): string {
    if (value === 0) return 'tile';

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
   * Plays a move in the given direction (keyboard or swipe). If the grid
   * changes, spawns a tile, refreshes the display and checks for game over.
   */
  private applyMove(direction: Direction): void {
    if (this.state.isGameOver) return;

    if (this.move(direction)) {
      const hasMerge = this.pendingMerged.length > 0;
      this.spawnTile();
      this.render();
      playSound(hasMerge ? 'score' : 'move');
      if (!this.canMove()) {
        playSound('die');
        this.gameOver();
      }
    }
  }

  /**
   * Slides and merges all the tiles in the given direction, crediting the score
   * with the merges.
   *
   * All directions reduce to a leftward slide via rotation/reflection of the
   * grid, followed by the inverse transformation. Merge positions are transformed
   * back to original board space and stored in `pendingMerged` for render().
   *
   * @returns `true` if the grid changed (valid move).
   */
  private move(direction: Direction): boolean {
    const rotated = this.toLeftOriented(this.board, direction);

    let changed = false;
    let gained = 0;
    const merges: { row: number; col: number }[] = [];

    const slid = rotated.map((row, r) => {
      const result = this.slideRow(row);
      if (result.changed) changed = true;
      gained += result.gained;
      result.mergedCols.forEach((c) => merges.push(this.fromLeftOrientedPos(r, c, direction)));
      return result.row;
    });

    if (changed) {
      this.board = this.fromLeftOriented(slid, direction);
      this.addScore(gained);
      this.pendingMerged = merges;
    }

    return changed;
  }

  /**
   * Maps a position (r, c) in the left-oriented grid back to original board coordinates.
   * Inverse of the transformations applied by toLeftOriented().
   */
  private fromLeftOrientedPos(
    r: number,
    c: number,
    direction: Direction
  ): { row: number; col: number } {
    const n = this.gridSize;
    switch (direction) {
      case 'left':
        return { row: r, col: c };
      case 'right':
        return { row: r, col: n - 1 - c };
      case 'up':
        return { row: c, col: r };
      case 'down':
        return { row: n - 1 - c, col: r };
    }
  }

  /**
   * Orients the grid so that a "leftward" slide corresponds to the requested
   * direction.
   */
  private toLeftOriented(board: number[][], direction: Direction): number[][] {
    switch (direction) {
      case 'left':
        return board.map((row) => [...row]);
      case 'right':
        return this.reverseRows(board);
      case 'up':
        return this.transpose(board);
      case 'down':
        return this.reverseRows(this.transpose(board));
    }
  }

  /**
   * Inverse transformation of {@link toLeftOriented}: brings the slid grid back
   * to its original orientation.
   */
  private fromLeftOriented(board: number[][], direction: Direction): number[][] {
    switch (direction) {
      case 'left':
        return board;
      case 'right':
        return this.reverseRows(board);
      case 'up':
        return this.transpose(board);
      case 'down':
        return this.transpose(this.reverseRows(board));
    }
  }

  /**
   * Compresses a row to the left then merges equal adjacent tiles (one merge per
   * tile), and pads on the right with empty cells. Also records which columns in
   * the result came from a merge, so the caller can propagate FX.
   */
  private slideRow(row: number[]): SlideResult {
    const nonZero = row.filter((value) => value !== 0);
    const merged: number[] = [];
    const mergedCols: number[] = [];
    let gained = 0;

    for (let i = 0; i < nonZero.length; i++) {
      if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
        const value = nonZero[i] * 2;
        merged.push(value);
        mergedCols.push(merged.length - 1);
        gained += value;
        i++;
      } else {
        merged.push(nonZero[i]);
      }
    }

    while (merged.length < row.length) merged.push(0);

    const changed = merged.some((value, index) => value !== row[index]);
    return { row: merged, gained, changed, mergedCols };
  }

  /**
   * Transposes the grid (swaps rows and columns).
   */
  private transpose(board: number[][]): number[][] {
    return board[0].map((_, col) => board.map((row) => row[col]));
  }

  /**
   * Returns a copy of the grid with each row reversed.
   */
  private reverseRows(board: number[][]): number[][] {
    return board.map((row) => [...row].reverse());
  }

  /**
   * Spawns a tile (2 at 90%, 4 at 10%) on a randomly chosen free cell. No-op if
   * the grid is full. Records the spawn position in `pendingSpawn` for render().
   */
  private spawnTile(): void {
    const empty: Array<{ x: number; y: number }> = [];
    this.board.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value === 0) empty.push({ x, y });
      });
    });

    if (empty.length === 0) return;

    const cell = empty[Math.floor(Math.random() * empty.length)];
    this.board[cell.y][cell.x] = Math.random() < 0.9 ? 2 : 4;
    this.pendingSpawn = { row: cell.y, col: cell.x };
  }

  /**
   * Tells whether a move is still possible: a free cell, or two equal adjacent
   * tiles (horizontally or vertically).
   */
  private canMove(): boolean {
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const value = this.board[y][x];
        if (value === 0) return true;
        if (x + 1 < this.gridSize && value === this.board[y][x + 1]) return true;
        if (y + 1 < this.gridSize && value === this.board[y + 1][x]) return true;
      }
    }
    return false;
  }

  /**
   * Creates an empty grid and places the two starting tiles on it.
   */
  private resetBoard(): void {
    this.board = Array.from({ length: this.gridSize }, () =>
      Array.from({ length: this.gridSize }, () => 0)
    );
    this.spawnTile();
    this.spawnTile();
  }

  /**
   * Resets the grid, the score and the state, then performs the render.
   */
  reset(): void {
    this.pendingMerged = [];
    this.pendingSpawn = null;
    this.resetState();
    this.resetBoard();
    this.updateScoreDisplay();
    this.render();
  }
}
