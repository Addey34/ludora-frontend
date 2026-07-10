import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { playSound } from '../../shared/fx/sound.js';
import { Stopwatch, formatClock } from '../../shared/ui/stopwatch.js';
import { LevelsConfig } from '../../shared/levels/levels.js';
import {
  Puzzle,
  Mark,
  EMPTY,
  FILLED,
  CROSS,
  parsePuzzle,
  emptyMarks,
  isSolved,
  filledCount,
} from './nonogram.js';
import { LEVELS } from './nonogramLevels.js';

/** Builds the level set: level 1 open, the rest unlock sequentially. */
function nonogramLevels(): LevelsConfig {
  return {
    gameKey: 'nonogram',
    levels: LEVELS.map((_, i) => ({
      id: i + 1,
      unlock: i === 0 ? { type: 'open' } : { type: 'sequential' },
    })),
  };
}

/** The two painting tools: fill a cell, or cross it out (a known-empty note). */
type Tool = 'fill' | 'cross';

/**
 * Nonogram (Picross): reveal the hidden picture by filling the cells the row and
 * column clues describe. A level-based puzzle (like Sokoban / Pac-Man): clearing a
 * picture unlocks the next in the "Levels" panel; there is no lose state — crosses
 * are just a pencil aid and Restart is always available. Paint by dragging (the
 * first cell sets the stroke), toggle the Fill / Cross tool (or right-click to
 * cross); the pure rules + the unique-solution guarantee live in `nonogram.ts`.
 * No leaderboard (it's about clearing pictures), so no server change is needed.
 */
export class NonogramGame extends GameEngine {
  private boardEl: HTMLElement | null = null;
  private colCluesEl: HTMLElement | null = null;
  private rowCluesEl: HTMLElement | null = null;
  private cellsEl: HTMLElement | null = null;
  private modeBtn: HTMLButtonElement | null = null;
  private fx: ParticleSystem | null = null;

  private puzzle: Puzzle = parsePuzzle(LEVELS[0]);
  private marks: Mark[][] = emptyMarks(this.puzzle);
  private cells: HTMLElement[][] = [];
  private tool: Tool = 'fill';

  /** Pointer drag state: the value being painted and the value it replaces. */
  private painting = false;
  private paintValue: Mark = EMPTY;
  private paintFrom: Mark = EMPTY;

  private readonly clock = new Stopwatch((s) => this.hud?.set('time', formatClock(s)));

  constructor() {
    super({ storageKey: 'nonogram', leaderboardId: 'nonogram', levels: nonogramLevels() });
  }

  async initialize(): Promise<void> {
    this.boardEl = document.getElementById('board');
    this.colCluesEl = document.getElementById('colClues');
    this.rowCluesEl = document.getElementById('rowClues');
    this.cellsEl = document.getElementById('cells');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'filled', icon: 'fill-drip', label: t('hudFilled') },
      { key: 'time', icon: 'clock', label: t('hudTime') },
    ]);

    this.setupEventListeners(); // keydown → handleInput
    this.setupPointer();
    this.setupTools();
    await this.setupLevels(); // loads progress + selects a level → onLevelSelected
  }

  /** Wires the Fill/Cross tool toggle and the Restart button. */
  private setupTools(): void {
    this.modeBtn = document.getElementById('modeBtn') as HTMLButtonElement | null;
    this.modeBtn?.addEventListener('click', () => this.toggleTool());
    document.getElementById('restartBtn')?.addEventListener('click', () => this.restartLevel());
    this.updateToolButton();
  }

  /** Loads the picked level's picture and renders it (the engine calls this). */
  protected onLevelSelected(levelId: number): void {
    this.loadLevel(levelId);
  }

  /** A level is cleared once the filled cells match the picture exactly. */
  protected didWinLevel(): boolean {
    return isSolved(this.puzzle, this.marks);
  }

  private loadLevel(levelId: number): void {
    const rows = LEVELS[levelId - 1] ?? LEVELS[0];
    this.puzzle = parsePuzzle(rows);
    this.marks = emptyMarks(this.puzzle);
    this.clock.reset();
    this.buildBoard();
    this.renderState();
    this.updateHud();
    if (this.state.isRunning) this.clock.start();
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.resetState();
    this.state.isRunning = true;
    this.clock.start();
  }

  reset(): void {
    this.resetState();
    this.loadLevel(this.currentLevel);
  }

  stop(): void {
    super.stop();
    this.clock.stop();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.reset();
    this.start();
  }

  /** Clears the grid and reloads the current picture (button / R key). */
  private restartLevel(): void {
    this.overlay.hide();
    this.loadLevel(this.currentLevel);
  }

  private toggleTool(): void {
    this.tool = this.tool === 'fill' ? 'cross' : 'fill';
    this.updateToolButton();
  }

  private updateToolButton(): void {
    const btn = this.modeBtn;
    if (!btn) return;
    const fill = this.tool === 'fill';
    btn.classList.toggle('is-cross', !fill);
    btn.textContent = fill ? '■' : '✗';
    const label = fill ? t('nonoToolFill') : t('nonoToolCross');
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }

  handleInput(event: KeyboardEvent): void {
    const k = event.key.toLowerCase();
    if (k === 'r') {
      this.restartLevel();
    } else if (k === 'x' || k === ' ') {
      event.preventDefault();
      this.toggleTool();
    }
  }

  private buildBoard(): void {
    const { rows, cols, rowClues, colClues } = this.puzzle;
    this.boardEl?.style.setProperty('--rows', String(rows));
    this.boardEl?.style.setProperty('--cols', String(cols));

    // Column clues: one bottom-aligned stack of numbers per column.
    if (this.colCluesEl) {
      this.colCluesEl.replaceChildren(...colClues.map((clue) => this.clueGroup(clue, 'col')));
    }
    // Row clues: one right-aligned row of numbers per row.
    if (this.rowCluesEl) {
      this.rowCluesEl.replaceChildren(...rowClues.map((clue) => this.clueGroup(clue, 'row')));
    }
    // The cell grid.
    const host = this.cellsEl;
    if (!host) return;
    host.innerHTML = '';
    this.cells = [];
    for (let r = 0; r < rows; r++) {
      const row: HTMLElement[] = [];
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'nono-cell';
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        // Thicker separators every 5 cells (standard nonogram reading aid).
        if (c % 5 === 0 && c > 0) cell.classList.add('block-left');
        if (r % 5 === 0 && r > 0) cell.classList.add('block-top');
        host.appendChild(cell);
        row.push(cell);
      }
      this.cells.push(row);
    }
  }

  private clueGroup(clue: number[], axis: 'row' | 'col'): HTMLElement {
    const group = document.createElement('div');
    group.className = `nono-clue nono-clue-${axis}`;
    const numbers = clue.length ? clue : [0];
    for (const n of numbers) {
      const span = document.createElement('span');
      span.textContent = String(n);
      if (n === 0) span.classList.add('is-zero');
      group.appendChild(span);
    }
    return group;
  }

  private setupPointer(): void {
    const host = this.cellsEl;
    if (!host) return;
    host.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    host.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', () => this.onPointerUp());
    host.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private cellAt(x: number, y: number): { r: number; c: number } | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.nono-cell');
    if (!el || el.dataset.r === undefined) return null;
    return { r: Number(el.dataset.r), c: Number(el.dataset.c) };
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    const at = this.cellAt(e.clientX, e.clientY);
    if (!at) return;
    e.preventDefault();
    // Right-click always crosses; otherwise use the selected tool.
    const target: Mark = e.button === 2 ? CROSS : this.tool === 'fill' ? FILLED : CROSS;
    const current = this.marks[at.r][at.c];
    this.painting = true;
    this.paintFrom = current;
    // Clicking a cell already in the target state erases it (toggle); dragging
    // then repeats that same stroke across the cells the pointer passes over.
    this.paintValue = current === target ? EMPTY : target;
    this.applyPaint(at.r, at.c);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.painting) return;
    const at = this.cellAt(e.clientX, e.clientY);
    if (at) this.applyPaint(at.r, at.c);
  }

  private onPointerUp(): void {
    this.painting = false;
  }

  /** Applies the current stroke to one cell, keeping drags predictable. */
  private applyPaint(r: number, c: number): void {
    if (this.state.isGameOver) return;
    const current = this.marks[r][c];
    if (this.paintValue === EMPTY) {
      // Erasing: only clear cells of the same kind we started erasing.
      if (current !== this.paintFrom) return;
    } else {
      // Painting: only fill blank cells (don't clobber the other kind).
      if (current !== EMPTY) return;
    }
    if (current === this.paintValue) return;
    this.marks[r][c] = this.paintValue;
    this.renderCell(r, c);
    playSound(this.paintValue === FILLED ? 'move' : 'match');
    this.updateHud();
    if (isSolved(this.puzzle, this.marks)) this.win();
  }

  private renderCell(r: number, c: number): void {
    const cell = this.cells[r]?.[c];
    if (!cell) return;
    const v = this.marks[r][c];
    cell.classList.toggle('is-filled', v === FILLED);
    cell.classList.toggle('is-cross', v === CROSS);
  }

  private renderState(): void {
    for (let r = 0; r < this.puzzle.rows; r++) {
      for (let c = 0; c < this.puzzle.cols; c++) this.renderCell(r, c);
    }
  }

  private updateHud(): void {
    let filled = 0;
    for (const row of this.marks) for (const v of row) if (v === FILLED) filled++;
    this.hud?.set('filled', `${filled} / ${filledCount(this.puzzle)}`);
    this.hud?.set('time', formatClock(this.clock.seconds));
  }

  private win(): void {
    this.clock.stop();
    playSound('win');
    this.emitBurst();
    this.gameOver(); // updates level progress (unlocks the next) + shows the overlay
  }

  private emitBurst(): void {
    if (!this.fx || !this.cellsEl) return;
    const rect = this.cellsEl.getBoundingClientRect();
    if (rect.width === 0) return;
    this.fx.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
      count: 30,
      speed: 4,
      spread: Math.PI * 2,
      colors: ['#22c55e', '#ffd700', '#ffffff'],
      size: 5,
      duration: 1100,
      gravity: 0.05,
    });
  }

  update(): void {}
  render(): void {}

  protected getGameOverTitle(): string {
    return t('levelCleared');
  }

  protected getGameOverContent(): string {
    return t('nonogramRecap', { time: formatClock(this.clock.seconds) });
  }
}
