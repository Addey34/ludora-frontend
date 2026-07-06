import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { Stopwatch, formatClock } from '../../shared/ui/stopwatch.js';
import { playSound } from '../../shared/fx/sound.js';
import { PUZZLES, KakuroPuzzle, checkSolution } from './kakuro.js';

export class KakuroGame extends GameEngine {
  private puzzle: KakuroPuzzle = PUZZLES[0];
  private puzzleIdx = 0;
  private values: (number | null)[][] = [];
  private selected: [number, number] | null = null;
  private boardEl: HTMLElement | null = null;
  private readonly clock = new Stopwatch((s) => this.hud?.set('time', formatClock(s)));

  constructor() {
    super({ storageKey: 'kakuro', leaderboardId: 'kakuro' });
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.hud = setupHud([
      { key: 'puzzle', icon: 'grid', label: t('kakPuzzle') },
      { key: 'time', icon: 'clock', label: t('hudTime') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);
    this.hud.set('high', this.scoreManager.getHighScore());
    this.loadPuzzle(0);
    this.setupEventListeners();
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.loadPuzzle(this.puzzleIdx);
    this.resetState();
    this.state.isRunning = true;
    this.state.isGameOver = false;
    this.clock.start();
  }

  reset(): void {
    this.clock.reset();
    this.loadPuzzle(this.puzzleIdx);
    this.resetState();
  }

  stop(): void {
    this.clock.stop();
    super.stop();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.puzzleIdx = (this.puzzleIdx + 1) % PUZZLES.length;
    this.loadPuzzle(this.puzzleIdx);
    this.resetState();
    this.state.isRunning = true;
    this.state.isGameOver = false;
    this.clock.reset();
    this.clock.start();
  }

  update(): void {}
  render(): void {}
  handleInput(e: KeyboardEvent): void {
    if (!this.selected) return;
    const [r, c] = this.selected;
    if (e.key >= '1' && e.key <= '9') {
      this.setValue(r, c, Number(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      this.setValue(r, c, null);
    } else if (e.key === 'Escape') {
      this.clearSelection();
    } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
      e.preventDefault();
      this.moveSelection(0, 1);
    } else if (e.key === 'ArrowLeft') {
      this.moveSelection(0, -1);
    } else if (e.key === 'ArrowDown') {
      this.moveSelection(1, 0);
    } else if (e.key === 'ArrowUp') {
      this.moveSelection(-1, 0);
    }
  }

  private loadPuzzle(idx: number): void {
    this.puzzle = PUZZLES[idx];
    this.values = this.puzzle.grid.map((row) =>
      row.map((cell) => (cell.kind === 'fill' ? null : null))
    );
    this.selected = null;
    this.clock.reset();
    this.hud?.set('puzzle', `${idx + 1}/${PUZZLES.length}`);
    this.buildDOM();
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  private buildDOM(): void {
    if (!this.boardEl) return;
    const { puzzle } = this;
    this.boardEl.innerHTML = '';
    this.boardEl.style.setProperty('--kak-cols', String(puzzle.cols));
    this.boardEl.style.setProperty('--kak-rows', String(puzzle.rows));

    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const cell = puzzle.grid[r][c];
        const el = document.createElement('div');
        el.dataset.r = String(r);
        el.dataset.c = String(c);

        if (cell.kind === 'black') {
          el.className = 'kak-black';
        } else if (cell.kind === 'clue') {
          el.className = 'kak-clue';
          const downText = cell.down !== undefined ? String(cell.down) : '';
          const acrossText = cell.across !== undefined ? String(cell.across) : '';
          el.innerHTML = `
            <div class="kak-clue-inner">
              <span class="kak-down">${downText}</span>
              <div class="kak-diagonal"></div>
              <span class="kak-across">${acrossText}</span>
            </div>`;
        } else {
          el.className = 'kak-fill';
          el.tabIndex = 0;
          el.addEventListener('click', () => this.onCellClick(r, c, el));
        }
        this.boardEl.appendChild(el);
      }
    }
  }

  private onCellClick(r: number, c: number, el: HTMLElement): void {
    if (!this.state.isRunning) return;
    this.clearSelection();
    this.selected = [r, c];
    el.classList.add('is-selected');
    el.focus();
  }

  private clearSelection(): void {
    this.selected = null;
    this.boardEl?.querySelectorAll('.kak-fill.is-selected').forEach((el) => {
      el.classList.remove('is-selected');
    });
  }

  private setValue(r: number, c: number, val: number | null): void {
    this.values[r][c] = val;
    const el = this.boardEl?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
    if (el) el.textContent = val !== null ? String(val) : '';
    playSound('move');
    this.checkErrors();
    this.checkWin();
  }

  private moveSelection(dr: number, dc: number): void {
    if (!this.selected) return;
    let [r, c] = this.selected;
    const { rows, cols, grid } = this.puzzle;
    for (let step = 0; step < Math.max(rows, cols); step++) {
      r = (r + dr + rows) % rows;
      c = (c + dc + cols) % cols;
      if (grid[r][c].kind === 'fill') {
        this.clearSelection();
        const el = this.boardEl?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
        if (el) this.onCellClick(r, c, el);
        return;
      }
    }
  }

  private checkErrors(): void {
    const { correct, errors } = checkSolution(this.puzzle, this.values);
    for (let r = 0; r < this.puzzle.rows; r++) {
      for (let c = 0; c < this.puzzle.cols; c++) {
        if (this.puzzle.grid[r][c].kind !== 'fill') continue;
        const el = this.boardEl?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
        if (el) el.classList.toggle('is-error', errors.has(`${r},${c}`));
      }
    }
    void correct;
  }

  private checkWin(): void {
    const { correct } = checkSolution(this.puzzle, this.values);
    if (!correct) return;
    this.clock.stop();
    const bonus = Math.max(0, 2000 - this.clock.seconds * 3);
    this.addScore(1000 + bonus + this.puzzleIdx * 200);
    playSound('win');
    this.gameOver();
  }

  protected getGameOverTitle(): string {
    return t('solved');
  }

  protected getGameOverContent(): string {
    const next = this.puzzleIdx + 1 < PUZZLES.length ? t('kakNextPuzzle') : t('kakAllDone');
    return `<p>${t('kakRecap', { time: formatClock(this.clock.seconds), score: String(this.state.score) })}</p><p>${next}</p>`;
  }
}
