import { GameEngine } from '../../shared/engine/GameEngine.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { setupSettingsPanel } from '../../shared/ui/settingsPanel.js';
import { playSound } from '../../shared/fx/sound.js';
import { Difficulty } from '../../shared/quiz/quiz.js';
import { Grid, SIZE, cloneGrid, conflicts, generatePuzzle, isSolved } from './sudoku.js';

/** Base points + par time (s) for the score bonus, per difficulty. */
const SCORING: Record<Difficulty, { base: number; par: number }> = {
  easy: { base: 600, par: 480 },
  medium: { base: 1400, par: 720 },
  hard: { base: 2800, par: 1080 },
};

/**
 * Sudoku: fill the 9×9 grid so every row, column and 3×3 box holds 1–9. Puzzles
 * are generated with a guaranteed unique solution (see sudoku.ts); difficulty
 * sets how many cells are dug out. Pick a cell then type 1–9 (keyboard or the
 * on-screen pad); clashes highlight live. Solving scores the difficulty base plus
 * the time saved under par. Event-driven; a 1 s interval drives the clock.
 */
export class SudokuGame extends GameEngine {
  private gridEl: HTMLElement | null = null;
  private padEl: HTMLElement | null = null;
  private cells: HTMLButtonElement[][] = [];

  private difficulty: Difficulty = 'easy';
  private grid: Grid = [];
  private solution: Grid = [];
  private given: boolean[][] = [];
  private selected: { r: number; c: number } | null = null;

  private elapsed = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super({ storageKey: 'sudoku-scores', leaderboardId: 'sudoku' });
  }

  initialize(): void {
    this.gridEl = document.getElementById('grid');
    this.padEl = document.getElementById('pad');
    this.hud = setupHud([
      { key: 'time', icon: 'clock', label: 'Time' },
      { key: 'score', icon: 'star', label: 'Score' },
      { key: 'high', icon: 'trophy', label: 'Best' },
    ]);

    this.buildGrid();
    this.buildPad();
    this.setupEventListeners();

    setupSettingsPanel([
      {
        id: 'difficulty',
        label: 'Difficulty',
        choices: [
          { label: 'Easy', value: 'easy' },
          { label: 'Medium', value: 'medium' },
          { label: 'Hard', value: 'hard' },
        ],
        value: this.difficulty,
        onChange: (v) => {
          this.difficulty = (v as Difficulty) ?? 'easy';
          this.overlay.hide();
          this.stop();
          this.start();
        },
      },
    ]);

    this.renderScoreTable();
    this.newGame();
  }

  private buildGrid(): void {
    const host = this.gridEl;
    if (!host) return;
    host.innerHTML = '';
    this.cells = [];
    for (let r = 0; r < SIZE; r++) {
      const row: HTMLButtonElement[] = [];
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'sudoku-cell';
        cell.addEventListener('click', () => this.select(r, c));
        host.appendChild(cell);
        row.push(cell);
      }
      this.cells.push(row);
    }
  }

  private buildPad(): void {
    const host = this.padEl;
    if (!host) return;
    host.innerHTML = '';
    for (let n = 1; n <= SIZE; n++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sudoku-pad-key';
      btn.textContent = String(n);
      btn.addEventListener('click', () => this.enter(n));
      host.appendChild(btn);
    }
    const erase = document.createElement('button');
    erase.type = 'button';
    erase.className = 'sudoku-pad-key sudoku-pad-erase';
    erase.innerHTML = '<i class="fas fa-eraser" aria-hidden="true"></i>';
    erase.setAttribute('aria-label', 'Erase');
    erase.addEventListener('click', () => this.enter(0));
    host.appendChild(erase);
  }

  private newGame(): void {
    this.clearTimer();
    this.elapsed = 0;
    const { puzzle, solution } = generatePuzzle(this.difficulty);
    this.grid = cloneGrid(puzzle);
    this.solution = solution;
    this.given = puzzle.map((row) => row.map((v) => v !== 0));
    this.selected = null;
    this.draw();
    this.hud?.set('time', this.formatTime(0));
    this.hud?.set('score', this.state.score);
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.newGame();
    this.resetState();
    this.state.isRunning = true;
    this.startTimer();
  }

  reset(): void {
    this.newGame();
    this.resetState();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.start();
  }

  private select(r: number, c: number): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    this.selected = { r, c };
    this.draw();
  }

  private enter(value: number): void {
    const sel = this.selected;
    if (!sel || !this.state.isRunning || this.state.isGameOver) return;
    if (this.given[sel.r][sel.c]) return;
    this.grid[sel.r][sel.c] = value;
    playSound(value === 0 ? 'move' : 'drop');
    this.draw();
    if (isSolved(this.grid, this.solution)) this.win();
  }

  private moveSelection(dr: number, dc: number): void {
    const sel = this.selected ?? { r: 0, c: 0 };
    this.select((sel.r + dr + SIZE) % SIZE, (sel.c + dc + SIZE) % SIZE);
  }

  private draw(): void {
    const bad = conflicts(this.grid);
    const sel = this.selected;
    const selValue = sel ? this.grid[sel.r][sel.c] : 0;

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = this.cells[r][c];
        const value = this.grid[r][c];
        cell.textContent = value === 0 ? '' : String(value);
        cell.classList.toggle('is-given', this.given[r][c]);
        cell.classList.toggle('is-selected', !!sel && sel.r === r && sel.c === c);
        cell.classList.toggle('is-conflict', bad.has(`${r},${c}`));
        cell.classList.toggle('is-peer', !!sel && (sel.r === r || sel.c === c));
        cell.classList.toggle('is-same', value !== 0 && value === selValue);
      }
    }
  }

  private win(): void {
    this.clearTimer();
    const { base, par } = SCORING[this.difficulty];
    this.addScore(base + Math.max(0, par - this.elapsed));
    this.hud?.set('score', this.state.score);
    playSound('win');
    this.gameOver();
  }

  private startTimer(): void {
    this.clearTimer();
    this.timerId = setInterval(() => {
      this.elapsed += 1;
      this.hud?.set('time', this.formatTime(this.elapsed));
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  stop(): void {
    super.stop();
    this.clearTimer();
  }

  handleInput(event: KeyboardEvent): void {
    if (event.key >= '1' && event.key <= '9') {
      this.enter(Number(event.key));
    } else if (event.key === '0' || event.key === 'Backspace' || event.key === 'Delete') {
      this.enter(0);
    } else if (event.key === 'ArrowUp') this.moveSelection(-1, 0);
    else if (event.key === 'ArrowDown') this.moveSelection(1, 0);
    else if (event.key === 'ArrowLeft') this.moveSelection(0, -1);
    else if (event.key === 'ArrowRight') this.moveSelection(0, 1);
  }

  update(): void {}
  render(): void {} // engine loop unused; the DOM is drawn by draw() on each change

  protected getGameOverTitle(): string {
    return 'Solved! 🎉';
  }

  protected getGameOverContent(): string {
    return `<p>Grid solved in <strong>${this.formatTime(this.elapsed)}</strong> — ${this.state.score} points.</p>`;
  }
}
