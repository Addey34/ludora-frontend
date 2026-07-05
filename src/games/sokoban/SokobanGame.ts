import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { keyboardDirection, setupSwipe, Direction } from '../../shared/engine/input.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { playSound } from '../../shared/fx/sound.js';
import { LevelsConfig } from '../../shared/levels/levels.js';
import { SokobanState, Dir, parseLevel, move, isSolved } from './sokoban.js';
import { LEVELS } from './sokobanLevels.js';

/** Builds the level set: level 1 open, the rest unlock sequentially. */
function sokobanLevels(): LevelsConfig {
  return {
    gameKey: 'sokoban',
    levels: LEVELS.map((_, i) => ({
      id: i + 1,
      unlock: i === 0 ? { type: 'open' } : { type: 'sequential' },
    })),
  };
}

/**
 * Sokoban: push every box onto a target. A level-based puzzle (like Pac-Man):
 * clearing a level unlocks the next in the "Levels" panel; there is no lose state
 * — Undo and Restart are always available. Move with the arrow keys / WASD or by
 * swiping; the pure rules live in `sokoban.ts`. No leaderboard (it's about
 * clearing levels, not scoring), so no server change is needed.
 */
export class SokobanGame extends GameEngine {
  private boardEl: HTMLElement | null = null;
  private cells: HTMLElement[][] = [];
  private fx: ParticleSystem | null = null;

  private game: SokobanState = parseLevel(LEVELS[0]);
  /** Past states for Undo (this level only). */
  private history: SokobanState[] = [];

  constructor() {
    super({ storageKey: 'sokoban', levels: sokobanLevels() });
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'moves', icon: 'shoe-prints', label: t('hudMoves') },
      { key: 'pushes', icon: 'box', label: t('hudPushes') },
    ]);

    this.setupEventListeners(); // keydown → handleInput
    if (this.boardEl) {
      setupSwipe(this.boardEl, { onSwipe: (dir) => this.tryMove(dir) });
    }
    this.setupTools();
    this.setupLevels(); // loads progress + selects a level → onLevelSelected
  }

  /** Wires the on-screen Undo / Restart buttons (for touch, no keyboard). */
  private setupTools(): void {
    document.getElementById('undoBtn')?.addEventListener('click', () => this.undo());
    document.getElementById('restartBtn')?.addEventListener('click', () => this.restartLevel());
  }

  /** Loads the picked level's layout and renders it (the engine calls this). */
  protected onLevelSelected(levelId: number): void {
    this.loadLevel(levelId);
  }

  /** A level is cleared once every box sits on a target. */
  protected didWinLevel(): boolean {
    return isSolved(this.game);
  }

  private loadLevel(levelId: number): void {
    const rows = LEVELS[levelId - 1] ?? LEVELS[0];
    this.game = parseLevel(rows);
    this.history = [];
    this.buildGrid();
    this.renderState();
    this.updateHud();
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.resetState();
    this.state.isRunning = true;
  }

  reset(): void {
    this.resetState();
    this.loadLevel(this.currentLevel);
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.reset();
    this.start();
  }

  /** Reloads the current level from scratch (button / R key). */
  private restartLevel(): void {
    this.overlay.hide();
    this.loadLevel(this.currentLevel);
  }

  private undo(): void {
    const prev = this.history.pop();
    if (!prev) return;
    this.game = prev;
    this.renderState();
    this.updateHud();
    playSound('move');
  }

  handleInput(event: KeyboardEvent): void {
    const k = event.key.toLowerCase();
    if (k === 'u') {
      this.undo();
      return;
    }
    if (k === 'r') {
      this.restartLevel();
      return;
    }
    const dir = keyboardDirection(event);
    if (dir) {
      event.preventDefault();
      this.tryMove(dir);
    }
  }

  /** Attempts one step; records history and plays feedback only on a real move. */
  private tryMove(dir: Direction): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    const next = move(this.game, dir as Dir);
    if (next === this.game) return; // blocked, nothing changed
    const pushed = next.pushes > this.game.pushes;
    this.history.push(this.game);
    this.game = next;
    this.renderState();
    this.updateHud();
    playSound(pushed ? 'drop' : 'move');
    if (isSolved(next)) this.win();
  }

  private win(): void {
    playSound('win');
    this.emitBurst();
    this.gameOver(); // updates level progress (unlocks the next) + shows the overlay
  }

  private buildGrid(): void {
    const board = this.boardEl;
    if (!board) return;
    const { rows, cols } = this.game;
    board.style.setProperty('--rows', String(rows));
    board.style.setProperty('--cols', String(cols));
    board.innerHTML = '';
    this.cells = [];
    for (let r = 0; r < rows; r++) {
      const row: HTMLElement[] = [];
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'sok-cell';
        board.appendChild(cell);
        row.push(cell);
      }
      this.cells.push(row);
    }
  }

  private renderState(): void {
    const s = this.game;
    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) {
        const cell = this.cells[r]?.[c];
        if (!cell) continue;
        const isPlayer = s.player.r === r && s.player.c === c;
        const box = s.boxes[r][c];
        const target = s.targets[r][c];
        cell.classList.toggle('is-wall', s.walls[r][c]);
        cell.classList.toggle('is-target', target && !box);
        cell.classList.toggle('is-box', box && !target);
        cell.classList.toggle('is-box-on', box && target);
        cell.classList.toggle('is-player', isPlayer);
      }
    }
  }

  private updateHud(): void {
    this.hud?.set('moves', this.game.moves);
    this.hud?.set('pushes', this.game.pushes);
  }

  private emitBurst(): void {
    if (!this.fx || !this.boardEl) return;
    const rect = this.boardEl.getBoundingClientRect();
    if (rect.width === 0) return;
    this.fx.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
      count: 28,
      speed: 4,
      spread: Math.PI * 2,
      colors: ['#22c55e', '#ffd700', '#ffffff'],
      size: 5,
      duration: 1000,
      gravity: 0.05,
    });
  }

  update(): void {}
  render(): void {}

  protected getGameOverTitle(): string {
    return t('levelCleared');
  }

  protected getGameOverContent(): string {
    return t('sokobanRecap', { moves: this.game.moves, pushes: this.game.pushes });
  }
}
