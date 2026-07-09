import { GameEngine, GameConfig } from '../../shared/engine/GameEngine.js';
import type { IRenderer } from '../../shared/engine/IRenderer.js';
import { setupHud } from '../../shared/ui/hud.js';
import { setupSettingsPanel, difficultyField } from '../../shared/ui/settingsPanel.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import { t } from '../../shared/i18n/i18n.js';
import { keyboardDirection, setupSwipe } from '../../shared/engine/input.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound } from '../../shared/fx/sound.js';
import {
  LINE_SCORES,
  applyLineClear,
  canPlace,
  createTetrisState,
  getFullRows,
  hardDrop,
  lockPiece,
  moveHorizontal,
  rotate,
  softDrop,
  spawnPiece,
  stepDown,
} from './tetrisLogic.js';
import type { TetrisGameState } from './tetrisState.js';
import { TetrisDOMRenderer } from './TetrisDOMRenderer.js';

interface TetrisConfig extends GameConfig {
  cols?: number;
  rows?: number;
  baseDropInterval?: number;
  minDropInterval?: number;
}

export class TetrisGame extends GameEngine {
  private readonly cols: number;
  private readonly rows: number;
  private readonly baseDropInterval: number;
  private readonly minDropInterval: number;

  private tetrisState: TetrisGameState;
  private difficulty: Difficulty = 'easy';

  private boardElement: HTMLElement | null = null;
  private fx: ParticleSystem | null = null;
  private renderer: IRenderer<TetrisGameState> | null = null;

  /** Accumulates time since the last drop step (ms). */
  private dropAccumulator: number = 0;
  /** Timestamp at which flashing rows collapse (ms). */
  private clearingUntil: number = 0;
  /** Rows cleared this frame — read by render() to emit particles before rebuild. */
  private pendingLineClears: number[] = [];

  constructor(config: TetrisConfig = {}) {
    super({ ...config, storageKey: 'tetris-high-scores', leaderboardId: 'tetris' });
    this.cols = config.cols ?? 10;
    this.rows = config.rows ?? 20;
    this.baseDropInterval = config.baseDropInterval ?? 800;
    this.minDropInterval = config.minDropInterval ?? 120;
    this.tetrisState = createTetrisState(
      this.cols,
      this.rows,
      this.baseDropInterval,
      this.minDropInterval,
      this.startLevel
    );
  }

  private get startLevel(): number {
    return this.difficulty === 'hard' ? 10 : this.difficulty === 'medium' ? 5 : 1;
  }

  initialize(): void {
    this.boardElement = document.getElementById('board');
    this.fx = new ParticleSystem();
    if (this.boardElement) this.renderer = new TetrisDOMRenderer(this.boardElement);

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
          if (this.state.isGameOver || !this.tetrisState.current) return;
          if (direction === 'left') this.applyMove(moveHorizontal(this.tetrisState, -1));
          else if (direction === 'right') this.applyMove(moveHorizontal(this.tetrisState, 1));
          else if (direction === 'down') this.applySoftDrop();
          else if (direction === 'up') this.applyMove(rotate(this.tetrisState));
        },
        onTap: () => {
          if (this.state.isGameOver || !this.tetrisState.current) return;
          this.applyMove(rotate(this.tetrisState));
        },
      });
    }

    this.renderScoreTable();
    this.updateScoreDisplay();
    this.render();
  }

  update(deltaTime: number): void {
    if (this.state.isPaused || this.state.isGameOver) return;

    if (this.tetrisState.clearingRows.length > 0) {
      if (performance.now() >= this.clearingUntil) this.executeClear();
      return;
    }

    this.dropAccumulator += deltaTime;
    if (this.dropAccumulator < this.tetrisState.dropInterval) return;
    this.dropAccumulator = 0;

    if (!this.tetrisState.current) return;
    if (
      canPlace(
        this.tetrisState,
        this.tetrisState.current.matrix,
        this.tetrisState.current.x,
        this.tetrisState.current.y + 1
      )
    ) {
      this.tetrisState = stepDown(this.tetrisState);
    } else {
      this.executeLock();
    }
  }

  render(): void {
    if (this.pendingLineClears.length > 0) {
      this.emitLineClearParticles(this.pendingLineClears);
      this.pendingLineClears = [];
    }
    this.renderer?.render(this.tetrisState);
  }

  handleInput(event: KeyboardEvent): void {
    if (this.state.isGameOver || !this.tetrisState.current) return;

    const direction = keyboardDirection(event);
    if (direction === 'left') {
      event.preventDefault();
      this.applyMove(moveHorizontal(this.tetrisState, -1));
    } else if (direction === 'right') {
      event.preventDefault();
      this.applyMove(moveHorizontal(this.tetrisState, 1));
    } else if (direction === 'down') {
      event.preventDefault();
      this.applySoftDrop();
    } else if (direction === 'up') {
      event.preventDefault();
      this.applyMove(rotate(this.tetrisState));
    } else if (event.key === ' ') {
      event.preventDefault();
      this.applyHardDrop();
    }
  }

  reset(): void {
    this.resetState();
    this.dropAccumulator = 0;
    this.clearingUntil = 0;
    this.pendingLineClears = [];
    if (this.boardElement) {
      this.renderer?.dispose?.();
      this.renderer = new TetrisDOMRenderer(this.boardElement);
    }
    this.tetrisState = createTetrisState(
      this.cols,
      this.rows,
      this.baseDropInterval,
      this.minDropInterval,
      this.startLevel
    );
    this.updateScoreDisplay();
    this.render();
  }

  protected getGameOverContent(): string {
    return `<div>Score: ${this.state.score}</div><div>Lines: ${this.tetrisState.lines}</div>`;
  }

  protected updateScoreDisplay(): void {
    super.updateScoreDisplay();
    this.hud?.set('lines', this.tetrisState.lines);
  }

  // --- private orchestration ---

  private applyMove(next: TetrisGameState | null): void {
    if (next) this.tetrisState = next;
  }

  private applySoftDrop(): void {
    const result = softDrop(this.tetrisState);
    if (result.moved) {
      this.tetrisState = result.state;
      this.dropAccumulator = 0;
      this.addScore(1);
    }
  }

  private applyHardDrop(): void {
    const result = hardDrop(this.tetrisState);
    this.tetrisState = result.state;
    if (result.distance > 0) this.addScore(result.distance);
    this.dropAccumulator = 0;
    this.executeLock();
  }

  private executeLock(): void {
    this.tetrisState = lockPiece(this.tetrisState);
    const fullRows = getFullRows(this.tetrisState);
    if (fullRows.length > 0) {
      this.tetrisState = { ...this.tetrisState, clearingRows: fullRows };
      this.clearingUntil = performance.now() + 160;
      playSound(fullRows.length >= 4 ? 'tetris' : 'clear');
    } else {
      playSound('drop');
      this.executeSpawn();
    }
  }

  private executeClear(): void {
    const rows = this.tetrisState.clearingRows;
    const scoreLevel = this.tetrisState.level;
    this.tetrisState = applyLineClear(
      this.tetrisState,
      rows,
      this.baseDropInterval,
      this.minDropInterval,
      this.startLevel
    );
    this.addScore(LINE_SCORES[rows.length] * scoreLevel);
    this.pendingLineClears = rows;
    this.updateScoreDisplay();
    this.executeSpawn();
  }

  private executeSpawn(): void {
    const result = spawnPiece(this.tetrisState);
    this.tetrisState = result.state;
    if (result.blocked) {
      playSound('die');
      this.gameOver();
    }
  }

  private emitLineClearParticles(clearedRows: number[]): void {
    if (!this.fx || !this.boardElement) return;
    const cellEls = this.boardElement.querySelectorAll<HTMLElement>('.cell');
    const colors = ['#06b6d4', '#22d3ee', '#67e8f9', '#cffafe', '#ffffff'];

    clearedRows.forEach((row) => {
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

    screenShake(clearedRows.length >= 4 ? 10 : 5, 240);
  }
}
