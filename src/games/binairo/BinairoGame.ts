import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { Stopwatch, formatClock } from '../../shared/ui/stopwatch.js';
import { playSound } from '../../shared/fx/sound.js';
import { Cell, BinairoState, generatePuzzle, isConflict, isSolved } from './binairo.js';

export class BinairoGame extends GameEngine {
  private puzzle: BinairoState = generatePuzzle(8);
  private boardEl: HTMLElement | null = null;
  private readonly clock = new Stopwatch((s) => this.hud?.set('time', formatClock(s)));

  constructor() {
    super({ storageKey: 'binairo', leaderboardId: 'binairo' });
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.hud = setupHud([
      { key: 'time', icon: 'clock', label: t('hudTime') },
      { key: 'errors', icon: 'triangle-exclamation', label: t('biErrors') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);
    this.hud.set('high', this.scoreManager.getHighScore());
    this.buildDOM();
    this.boardEl?.addEventListener('click', (e) => this.handleClick(e));
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.puzzle = generatePuzzle(8);
    this.clock.reset();
    this.clock.start();
    this.resetState();
    this.state.isRunning = true;
    this.state.isGameOver = false;
    this.hud?.set('errors', 0);
    this.hud?.set('high', this.scoreManager.getHighScore());
    this.buildDOM();
  }

  reset(): void {
    this.clock.reset();
    this.puzzle = generatePuzzle(8);
    this.resetState();
    this.buildDOM();
  }

  stop(): void {
    this.clock.stop();
    super.stop();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.start();
  }

  update(): void {}
  render(): void {}
  handleInput(_e: KeyboardEvent): void {}

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  private buildDOM(): void {
    if (!this.boardEl) return;
    const { size, puzzle, grid } = this.puzzle;
    this.boardEl.innerHTML = '';
    this.boardEl.style.setProperty('--bi-size', String(size));

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const el = document.createElement('div');
        const fixed = puzzle[r][c] !== null;
        el.className = 'bi-cell' + (fixed ? ' is-fixed' : '');
        el.dataset.r = String(r);
        el.dataset.c = String(c);
        const v = grid[r][c];
        el.textContent = v !== null ? String(v) : '';
        el.classList.toggle('is-zero', v === 0);
        el.classList.toggle('is-one', v === 1);
        this.boardEl.appendChild(el);
      }
    }
    this.updateConflicts();
  }

  private handleClick(e: MouseEvent): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('.bi-cell');
    if (!el) return;
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);
    if (this.puzzle.puzzle[r][c] !== null) return; // fixed cell
    const current = this.puzzle.grid[r][c];
    const next: Cell = current === null ? 0 : current === 0 ? 1 : null;
    this.puzzle.grid[r][c] = next;
    this.updateCell(r, c);
    this.updateConflicts();
    playSound('move');
    if (isSolved(this.puzzle.grid, this.puzzle.size)) {
      this.clock.stop();
      const bonus = Math.max(0, 1000 - this.clock.seconds * 2);
      this.addScore(500 + bonus);
      playSound('win');
      this.gameOver();
    }
  }

  private updateCell(r: number, c: number): void {
    const el = this.boardEl?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
    if (!el) return;
    const v = this.puzzle.grid[r][c];
    el.textContent = v !== null ? String(v) : '';
    el.classList.toggle('is-zero', v === 0);
    el.classList.toggle('is-one', v === 1);
  }

  private updateConflicts(): void {
    const { size, grid } = this.puzzle;
    let errCount = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const conflict = isConflict(grid, r, c, size);
        if (conflict) errCount++;
        const el = this.boardEl?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
        el?.classList.toggle('is-conflict', conflict);
      }
    }
    this.hud?.set('errors', errCount);
  }

  protected getGameOverTitle(): string {
    return t('solved');
  }

  protected getGameOverContent(): string {
    return `<p>${t('binairoRecap', { time: formatClock(this.clock.seconds), score: String(this.state.score) })}</p>`;
  }
}
