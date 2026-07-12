import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { setupSettingsPanel, difficultyField } from '../../shared/ui/settingsPanel.js';
import { playSound } from '../../shared/fx/sound.js';
import { Stopwatch, formatClock } from '../../shared/ui/stopwatch.js';
import { Difficulty } from '../../shared/quiz/quiz.js';
import { showToast } from '../../shared/ui/toast.js';
import { dailySeed, dayKey, mulberry32, type DailyProgress } from '../../shared/daily/daily.js';
import { loadDailyProgress, recordDailyWin, streakToday } from '../../shared/daily/dailyStore.js';
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

  private readonly clock = new Stopwatch((s) => this.hud?.set('time', formatClock(s)));

  /** Daily "puzzle of the day" mode (`?daily`): a date-seeded medium grid shared
   *  by everyone, whose solve feeds a consecutive-day streak. */
  private daily =
    typeof location !== 'undefined' && new URLSearchParams(location.search).has('daily');
  private dailyProgress: DailyProgress | null = null;

  constructor() {
    super({ storageKey: 'sudoku-scores', leaderboardId: 'sudoku' });
    if (this.daily) this.difficulty = 'medium';
  }

  initialize(): void {
    this.gridEl = document.getElementById('grid');
    this.padEl = document.getElementById('pad');
    this.hud = setupHud([
      { key: 'time', icon: 'clock', label: t('hudTime') },
      { key: 'score', icon: 'star', label: t('score') },
      this.daily
        ? { key: 'streak', icon: 'fire', label: t('hudStreak') }
        : { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);

    this.buildGrid();
    this.buildPad();
    this.setupEventListeners();

    setupSettingsPanel([
      difficultyField(this.difficulty, (v) => {
        this.difficulty = (v as Difficulty) ?? 'easy';
        this.setLeaderboardVariant(this.difficulty, t(this.difficulty));
        this.overlay.hide();
        this.stop();
        this.start();
      }),
    ]);
    this.setLeaderboardVariant(this.difficulty, t(this.difficulty));

    this.renderScoreTable();
    this.newGame();
    if (this.daily) void this.refreshDailyStreak();
  }

  /** Loads and shows the current daily streak on the HUD (best-effort). */
  private async refreshDailyStreak(): Promise<void> {
    this.dailyProgress = await loadDailyProgress('sudoku');
    this.hud?.set('streak', streakToday(this.dailyProgress));
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
    erase.setAttribute('aria-label', t('erase'));
    erase.addEventListener('click', () => this.enter(0));
    host.appendChild(erase);
  }

  private newGame(): void {
    this.clock.reset();
    // Daily mode seeds a date-derived PRNG so everyone gets the identical grid.
    const rng = this.daily ? mulberry32(dailySeed(dayKey())) : undefined;
    const { puzzle, solution } = generatePuzzle(this.difficulty, rng);
    this.grid = cloneGrid(puzzle);
    this.solution = solution;
    this.given = puzzle.map((row) => row.map((v) => v !== 0));
    this.selected = null;
    this.draw();
    this.hud?.set('time', formatClock(0));
    this.hud?.set('score', this.state.score);
    if (!this.daily) this.hud?.set('high', this.scoreManager.getHighScore());
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.newGame();
    this.resetState();
    this.state.isRunning = true;
    this.clock.start();
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
    this.clock.stop();
    const { base, par } = SCORING[this.difficulty];
    this.addScore(base + Math.max(0, par - this.clock.seconds));
    this.hud?.set('score', this.state.score);
    playSound('win');
    if (this.daily) void this.recordDaily();
    this.gameOver();
  }

  /** Solving today's puzzle extends the streak (idempotent per day); toast it. */
  private async recordDaily(): Promise<void> {
    this.dailyProgress = await recordDailyWin('sudoku');
    const streak = streakToday(this.dailyProgress);
    this.hud?.set('streak', streak);
    showToast(t('dailyStreak', { n: streak }), 'success', 4000);
  }

  stop(): void {
    super.stop();
    this.clock.stop();
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
    return t('solved');
  }

  protected getGameOverContent(): string {
    return t('sudokuRecap', { time: formatClock(this.clock.seconds), score: this.state.score });
  }
}
