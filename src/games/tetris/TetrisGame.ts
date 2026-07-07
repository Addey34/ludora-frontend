import { GameEngine, GameConfig } from '../../shared/engine/GameEngine.js';
import { setupHud } from '../../shared/ui/hud.js';
import { setupSettingsPanel, difficultyField } from '../../shared/ui/settingsPanel.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import { t } from '../../shared/i18n/i18n.js';
import { keyboardDirection, setupSwipe } from '../../shared/engine/input.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound } from '../../shared/fx/sound.js';

/**
 * Configuration specific to the Tetris game.
 */
interface TetrisConfig extends GameConfig {
  /** Number of board columns (default: 10). */
  cols?: number;
  /** Number of board rows (default: 20). */
  rows?: number;
  /** Initial drop interval, in ms. */
  baseDropInterval?: number;
  /** Minimum drop interval (max speed), in ms. */
  minDropInterval?: number;
}

/** Identifier of a piece, also used as a CSS color key. */
type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

/** Cell value: piece type, ghost, or empty. */
type CellValue = TetrominoType | 'ghost' | null;

/**
 * Definition of a piece: its square matrix (1 = filled cell) and its type.
 */
interface Tetromino {
  type: TetrominoType;
  matrix: number[][];
}

/**
 * Piece currently falling: its matrix (current orientation), its type and the
 * position of its top-left corner in the grid.
 */
interface ActivePiece {
  type: TetrominoType;
  matrix: number[][];
  x: number;
  y: number;
}

/**
 * The seven tetrominoes in their starting orientation.
 */
const TETROMINOES: Tetromino[] = [
  {
    type: 'I',
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    type: 'O',
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  {
    type: 'T',
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    type: 'S',
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  {
    type: 'Z',
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    type: 'J',
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    type: 'L',
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
];

/**
 * Points awarded based on the number of lines cleared at once (index = lines),
 * multiplied by the current level.
 */
const LINE_SCORES = [0, 40, 100, 300, 1200];

/** Horizontal offsets tried during a rotation (basic "wall kicks"). */
const ROTATION_KICKS = [0, -1, 1, -2, 2];

/**
 * Tetris game.
 *
 * Pieces fall at a regular rate into a grid; the player moves and rotates them
 * to complete lines, which clear and earn points. The drop speed increases with
 * the level (every 10 lines). The game ends when a new piece can no longer
 * appear.
 *
 * The game reuses the engine's `requestAnimationFrame` loop: the fall is paced
 * by a time accumulator (like Snake), independently of the render's 60 fps.
 */
export class TetrisGame extends GameEngine {
  private readonly cols: number;
  private readonly rows: number;

  /** Grid of frozen cells; `null` = empty, otherwise the type of the placed piece. */
  private grid: (TetrominoType | null)[][] = [];
  private current: ActivePiece | null = null;

  /** Drop rate (ms). */
  private readonly baseDropInterval: number;
  private readonly minDropInterval: number;
  private dropInterval: number;
  /** Time accumulated since the last descent (ms). */
  private dropAccumulator: number = 0;

  private lines: number = 0;
  private level: number = 1;
  private difficulty: Difficulty = 'easy';

  private boardElement: HTMLElement | null = null;
  private fx: ParticleSystem | null = null;
  /** Row indices cleared in the last lockPiece(), consumed by render(). */
  private pendingLineClears: number[] = [];
  /** Full rows currently flashing white before they collapse (line-clear delay). */
  private clearingRows: number[] = [];
  /** Timestamp (ms) at which the flashing rows collapse. */
  private clearingUntil: number = 0;

  /**
   * @param config Game configuration (dimensions, drop rate).
   */
  constructor(config: TetrisConfig = {}) {
    super({ ...config, storageKey: 'tetris-high-scores', leaderboardId: 'tetris' });
    this.cols = config.cols || 10;
    this.rows = config.rows || 20;
    this.baseDropInterval = config.baseDropInterval || 800;
    this.minDropInterval = config.minDropInterval || 120;
    this.dropInterval = this.baseDropInterval;
  }

  /**
   * Binds the DOM elements, wires up the keyboard, prepares an empty grid with a
   * first piece, then performs the first render.
   */
  initialize(): void {
    this.boardElement = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'score', icon: 'star', label: t('score') },
      { key: 'lines', icon: 'grip-lines', label: t('hudLines') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);

    setupSettingsPanel([
      difficultyField(this.difficulty, (v) => {
        this.difficulty = v as Difficulty;
        this.setLeaderboardVariant(this.difficulty, t(this.difficulty));
        this.reset();
      }),
    ]);
    this.setLeaderboardVariant(this.difficulty, t(this.difficulty));

    this.setupEventListeners();

    if (this.boardElement) {
      setupSwipe(this.boardElement, {
        onSwipe: (direction) => {
          if (this.state.isGameOver || !this.current) return;
          if (direction === 'left') this.moveHorizontal(-1);
          else if (direction === 'right') this.moveHorizontal(1);
          else if (direction === 'down') this.softDrop();
          else if (direction === 'up') this.rotate();
        },
        onTap: () => {
          if (this.state.isGameOver || !this.current) return;
          this.rotate();
        },
      });
    }

    this.resetBoard();
    this.renderScoreTable();
    this.updateScoreDisplay();
    this.render();
  }

  /**
   * Drops the piece by one cell at the `dropInterval` rate (not every frame).
   * When it can no longer descend, the piece is frozen.
   */
  update(deltaTime: number): void {
    if (this.state.isPaused || this.state.isGameOver) return;

    // Line-clear delay: while full rows flash, the fall is frozen and no piece
    // is active; once the delay elapses the rows collapse and play resumes.
    if (this.clearingRows.length > 0) {
      if (performance.now() >= this.clearingUntil) this.finalizeClear();
      return;
    }

    this.dropAccumulator += deltaTime;
    if (this.dropAccumulator < this.dropInterval) return;
    this.dropAccumulator = 0;

    this.step();
  }

  /**
   * Drops the current piece by one cell, or freezes it if it has reached the
   * bottom or another piece.
   */
  private step(): void {
    if (!this.current) return;

    if (this.canPlace(this.current.matrix, this.current.x, this.current.y + 1)) {
      this.current.y++;
    } else {
      this.lockPiece();
    }
  }

  /**
   * Rebuilds the board display: frozen cells, ghost piece, and current piece merged.
   * When line clears are pending (from `clearLines()`), particles are emitted from
   * the old DOM cells before the board is rebuilt.
   */
  render(): void {
    if (!this.boardElement) return;

    if (this.pendingLineClears.length > 0) {
      this.emitLineClearParticles();
      this.pendingLineClears = [];
    }

    const cells = this.composeBoard();
    this.boardElement.innerHTML = cells
      .map((row, y) => {
        const flash = this.clearingRows.includes(y) ? ' cell--clearing' : '';
        return row
          .map((type) => {
            if (!type) return `<div class="cell${flash}"></div>`;
            if (type === 'ghost') return `<div class="cell cell--ghost${flash}"></div>`;
            return `<div class="cell cell--${type}${flash}"></div>`;
          })
          .join('');
      })
      .join('');

    this.updateDangerState();
  }

  /**
   * Emits particles from the cells of cleared rows before the DOM is rebuilt.
   * Also shakes the screen (harder for a Tetris = 4 lines).
   */
  private emitLineClearParticles(): void {
    if (!this.fx || !this.boardElement) return;
    const cellEls = this.boardElement.querySelectorAll<HTMLElement>('.cell');
    const colors = ['#06b6d4', '#22d3ee', '#67e8f9', '#cffafe', '#ffffff'];

    this.pendingLineClears.forEach((row) => {
      for (let col = 0; col < this.cols; col++) {
        const cellEl = cellEls[row * this.cols + col];
        if (!cellEl) continue;
        const rect = cellEl.getBoundingClientRect();
        this.fx!.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
          count: 3,
          speed: 3.5,
          spread: Math.PI,
          angle: -Math.PI / 2,
          gravity: 0.14,
          duration: 600,
          size: rect.width * 0.38,
          colors,
        });
      }
    });

    screenShake(this.pendingLineClears.length >= 4 ? 10 : 5, 240);
  }

  /**
   * Adds `.is-danger` to the board when the stack reaches the top 35%,
   * giving the player a visual warning.
   */
  private updateDangerState(): void {
    if (!this.boardElement) return;
    const highestFilledRow = this.grid.findIndex((row) => row.some((cell) => cell !== null));
    const isDanger = highestFilledRow !== -1 && highestFilledRow <= Math.floor(this.rows * 0.35);
    this.boardElement.classList.toggle('is-danger', isDanger);
  }

  /**
   * Builds the grid to display: frozen cells, ghost piece, then current piece
   * (which overwrites ghost cells so the two never overlap visually).
   */
  private composeBoard(): CellValue[][] {
    const cells: CellValue[][] = this.grid.map((row) => [...row]);

    if (this.current) {
      const ghostY = this.getGhostY();
      if (ghostY !== this.current.y) {
        this.current.matrix.forEach((row, r) => {
          row.forEach((filled, c) => {
            if (!filled) return;
            const gy = ghostY + r;
            const gx = this.current!.x + c;
            if (gy >= 0 && gy < this.rows && gx >= 0 && gx < this.cols && !cells[gy][gx]) {
              cells[gy][gx] = 'ghost';
            }
          });
        });
      }

      const { matrix, x, y, type } = this.current;
      matrix.forEach((row, r) => {
        row.forEach((filled, c) => {
          if (!filled) return;
          const gx = x + c;
          const gy = y + r;
          if (gy >= 0 && gy < this.rows && gx >= 0 && gx < this.cols) {
            cells[gy][gx] = type;
          }
        });
      });
    }

    return cells;
  }

  /** Returns the y-row where the current piece would land if dropped straight down. */
  private getGhostY(): number {
    if (!this.current) return 0;
    let ghostY = this.current.y;
    while (this.canPlace(this.current.matrix, this.current.x, ghostY + 1)) {
      ghostY++;
    }
    return ghostY;
  }

  /**
   * Translates the key into an action: lateral move (left/right), soft drop
   * (down), rotation (up) or hard drop (space).
   */
  handleInput(event: KeyboardEvent): void {
    if (this.state.isGameOver || !this.current) return;

    const direction = keyboardDirection(event);

    if (direction === 'left') {
      event.preventDefault();
      this.moveHorizontal(-1);
    } else if (direction === 'right') {
      event.preventDefault();
      this.moveHorizontal(1);
    } else if (direction === 'down') {
      event.preventDefault();
      this.softDrop();
    } else if (direction === 'up') {
      event.preventDefault();
      this.rotate();
    } else if (event.key === ' ') {
      event.preventDefault();
      this.hardDrop();
    }
  }

  /**
   * Shifts the piece by one column if the target position is free.
   */
  private moveHorizontal(dx: number): void {
    if (!this.current) return;
    if (this.canPlace(this.current.matrix, this.current.x + dx, this.current.y)) {
      this.current.x += dx;
    }
  }

  /**
   * Soft drop: advances the piece by one cell, credits one point and rearms the
   * drop counter to avoid an immediate lock.
   */
  private softDrop(): void {
    if (!this.current) return;
    if (this.canPlace(this.current.matrix, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.dropAccumulator = 0;
      this.addScore(1);
    }
  }

  /**
   * Hard drop: drops the piece down to contact, credits the distance traveled,
   * then freezes it.
   */
  private hardDrop(): void {
    if (!this.current) return;

    let distance = 0;
    while (this.canPlace(this.current.matrix, this.current.x, this.current.y + 1)) {
      this.current.y++;
      distance++;
    }
    if (distance > 0) this.addScore(distance);

    this.dropAccumulator = 0;
    this.lockPiece();
  }

  /**
   * Rotates the piece clockwise, trying a few lateral offsets
   * ({@link ROTATION_KICKS}) if the target orientation hits a wall or a piece.
   */
  private rotate(): void {
    if (!this.current) return;

    const rotated = this.rotateMatrix(this.current.matrix);
    for (const offset of ROTATION_KICKS) {
      if (this.canPlace(rotated, this.current.x + offset, this.current.y)) {
        this.current.matrix = rotated;
        this.current.x += offset;
        return;
      }
    }
  }

  /**
   * Returns a copy of the matrix rotated 90° clockwise.
   */
  private rotateMatrix(matrix: number[][]): number[][] {
    const n = matrix.length;
    const rotated = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        rotated[j][n - 1 - i] = matrix[i][j];
      }
    }
    return rotated;
  }

  /**
   * Tells whether a matrix can occupy the given position: each filled cell must
   * stay within the columns/the bottom of the grid and not overlap a frozen
   * cell (overflow through the top is tolerated for spawning).
   */
  private canPlace(matrix: number[][], posX: number, posY: number): boolean {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const gx = posX + c;
        const gy = posY + r;
        if (gx < 0 || gx >= this.cols || gy >= this.rows) return false;
        if (gy >= 0 && this.grid[gy][gx]) return false;
      }
    }
    return true;
  }

  /**
   * Freezes the current piece into the grid, clears the complete lines then
   * spawns the next piece.
   */
  private lockPiece(): void {
    if (!this.current) return;

    const { matrix, x, y, type } = this.current;
    matrix.forEach((row, r) => {
      row.forEach((filled, c) => {
        if (!filled) return;
        const gy = y + r;
        const gx = x + c;
        if (gy >= 0 && gy < this.rows && gx >= 0 && gx < this.cols) {
          this.grid[gy][gx] = type;
        }
      });
    });

    const fullRows = this.getFullRows();
    if (fullRows.length > 0) {
      // Start the line-clear delay: keep the piece out, flash the full rows, and
      // let update() collapse them once the delay elapses (see finalizeClear).
      this.current = null;
      this.clearingRows = fullRows;
      this.clearingUntil = performance.now() + 160;
      playSound(fullRows.length >= 4 ? 'tetris' : 'clear');
    } else {
      playSound('drop');
      this.spawnPiece();
    }
  }

  /** Row indices that are completely filled (candidates for clearing). */
  private getFullRows(): number[] {
    const rows: number[] = [];
    for (let y = 0; y < this.rows; y++) {
      if (this.grid[y].every((cell) => cell !== null)) rows.push(y);
    }
    return rows;
  }

  /**
   * Ends the line-clear delay: drops the flashed rows, credits score/level, hands
   * the cleared indices to render() for particles, and spawns the next piece.
   */
  private finalizeClear(): void {
    const rows = this.clearingRows;
    this.clearingRows = [];

    this.grid = this.grid.filter((_, y) => !rows.includes(y));
    while (this.grid.length < this.rows) {
      this.grid.unshift(new Array<TetrominoType | null>(this.cols).fill(null));
    }

    const cleared = rows.length;
    this.lines += cleared;
    this.addScore(LINE_SCORES[cleared] * this.level);
    this.updateLevel();
    this.pendingLineClears = rows;
    this.spawnPiece();
  }

  /**
   * Recomputes the level (one tier every 10 lines) and speeds up the fall
   * accordingly, without going below `minDropInterval`.
   */
  private updateLevel(): void {
    this.level = Math.floor(this.lines / 10) + this.startLevel;
    this.dropInterval = Math.max(
      this.minDropInterval,
      this.baseDropInterval - (this.level - 1) * 65
    );
  }

  /**
   * Spawns a new random piece, centered at the top. If it cannot be placed, the
   * game is over.
   */
  private spawnPiece(): void {
    const template = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
    const matrix = template.matrix.map((row) => [...row]);
    const x = Math.floor((this.cols - matrix[0].length) / 2);
    const y = 0;

    this.current = { type: template.type, matrix, x, y };

    if (!this.canPlace(matrix, x, y)) {
      playSound('die');
      this.gameOver();
    }
  }

  /**
   * Creates an empty grid and spawns the first piece.
   */
  private resetBoard(): void {
    this.grid = Array.from({ length: this.rows }, () =>
      new Array<TetrominoType | null>(this.cols).fill(null)
    );
    this.spawnPiece();
  }

  /**
   * Resets grid, score, lines, level, rate and state, then performs the render.
   */
  /** The level a fresh game starts at, from the chosen difficulty. */
  private get startLevel(): number {
    return this.difficulty === 'hard' ? 10 : this.difficulty === 'medium' ? 5 : 1;
  }

  reset(): void {
    this.resetState();
    this.lines = 0;
    this.level = this.startLevel;
    this.dropInterval = Math.max(
      this.minDropInterval,
      this.baseDropInterval - (this.level - 1) * 65
    );
    this.dropAccumulator = 0;
    this.clearingRows = [];
    this.pendingLineClears = [];
    this.resetBoard();
    this.updateScoreDisplay();
    this.render();
  }

  /**
   * Details shown in the game-over modal: score and lines cleared.
   */
  protected getGameOverContent(): string {
    return `<div>Score: ${this.state.score}</div><div>Lines: ${this.lines}</div>`;
  }

  /**
   * Shows score, lines and high score in the game header.
   */
  protected updateScoreDisplay(): void {
    super.updateScoreDisplay();
    this.hud?.set('lines', this.lines);
  }
}
