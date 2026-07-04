import { GameEngine } from '../../shared/engine/GameEngine.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { setupSettingsPanel } from '../../shared/ui/settingsPanel.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound } from '../../shared/fx/sound.js';
import { Board, createBoard, floodReveal, isWin } from './minesweeper.js';

type Difficulty = 'easy' | 'medium' | 'hard';

interface DiffDef {
  rows: number;
  cols: number;
  mines: number;
  /** Base points for clearing this difficulty. */
  base: number;
  /** Par time (s): clearing under par adds the remaining seconds to the score. */
  par: number;
}

const DIFFICULTIES: Record<Difficulty, DiffDef> = {
  easy: { rows: 9, cols: 9, mines: 10, base: 500, par: 120 },
  medium: { rows: 13, cols: 13, mines: 28, base: 1500, par: 300 },
  hard: { rows: 16, cols: 16, mines: 45, base: 3000, par: 600 },
};

/**
 * Minesweeper: clear every safe cell without detonating a mine. The first click
 * is always safe (the board is generated around it). Difficulty is chosen in the
 * Settings popover; each level has its own grid/mine count. Winning scores
 * points (base for the difficulty + the seconds saved under par), fed to the
 * shared leaderboard; losing just shows the mines and a "Play again".
 *
 * Event-driven (clicks + right-click/flag mode), so it doesn't use the engine's
 * `requestAnimationFrame` loop; a 1 s interval drives the elapsed timer.
 */
export class MinesweeperGame extends GameEngine {
  private boardEl: HTMLElement | null = null;
  private cells: HTMLButtonElement[][] = [];
  private fx: ParticleSystem | null = null;
  private flagToggle: HTMLButtonElement | null = null;

  private difficulty: Difficulty = 'easy';
  private board: Board | null = null;
  private revealed: boolean[][] = [];
  private flagged: boolean[][] = [];
  /** Touch-friendly: when on, a tap flags instead of revealing. */
  private flagMode = false;

  private elapsed = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super({ storageKey: 'minesweeper-scores', leaderboardId: 'minesweeper' });
  }

  private get def(): DiffDef {
    return DIFFICULTIES[this.difficulty];
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.flagToggle = document.getElementById('flagToggle') as HTMLButtonElement | null;
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'mines', icon: 'bomb', label: 'Mines left' },
      { key: 'time', icon: 'clock', label: 'Time' },
      { key: 'high', icon: 'trophy', label: 'Best' },
    ]);

    // Reveal on left click, flag on right click — both via delegation.
    this.boardEl?.addEventListener('click', (e) => this.onBoardClick(e));
    this.boardEl?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.onBoardFlag(e);
    });
    this.flagToggle?.addEventListener('click', () => this.toggleFlagMode());

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
        onChange: (v) => this.changeDifficulty(v as Difficulty),
      },
    ]);

    this.renderScoreTable();
    this.prepare();
  }

  /** Builds a fresh, ready-to-play board for the current difficulty (not running). */
  private prepare(): void {
    this.clearTimer();
    this.board = null;
    this.elapsed = 0;
    const { rows, cols } = this.def;
    this.revealed = this.grid(rows, cols);
    this.flagged = this.grid(rows, cols);
    this.buildGrid();
    this.renderCells();
    this.updateMinesLeft();
    this.hud?.set('time', this.formatTime(0));
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  private grid(rows: number, cols: number): boolean[][] {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
  }

  private buildGrid(): void {
    const board = this.boardEl;
    if (!board) return;
    const { rows, cols } = this.def;
    board.style.setProperty('--rows', String(rows));
    board.style.setProperty('--cols', String(cols));
    board.innerHTML = '';
    this.cells = [];
    for (let r = 0; r < rows; r++) {
      const row: HTMLButtonElement[] = [];
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'mine-cell';
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        board.appendChild(cell);
        row.push(cell);
      }
      this.cells.push(row);
    }
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.prepare();
    this.resetState();
    this.state.isRunning = true;
  }

  reset(): void {
    this.prepare();
    this.resetState();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.start();
  }

  private changeDifficulty(d: Difficulty): void {
    this.difficulty = d;
    this.overlay.hide();
    this.stop();
    this.start();
  }

  private toggleFlagMode(): void {
    this.flagMode = !this.flagMode;
    this.flagToggle?.classList.toggle('is-active', this.flagMode);
    this.flagToggle?.setAttribute('aria-pressed', String(this.flagMode));
  }

  private cellFromEvent(e: Event): { r: number; c: number } | null {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.mine-cell');
    if (!el) return null;
    return { r: Number(el.dataset.r), c: Number(el.dataset.c) };
  }

  private onBoardClick(e: Event): void {
    const pos = this.cellFromEvent(e);
    if (!pos) return;
    if (this.flagMode) this.flag(pos.r, pos.c);
    else this.reveal(pos.r, pos.c);
  }

  private onBoardFlag(e: Event): void {
    const pos = this.cellFromEvent(e);
    if (pos) this.flag(pos.r, pos.c);
  }

  private reveal(r: number, c: number): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    if (this.flagged[r][c] || this.revealed[r][c]) return;

    // First reveal: generate the board around it (guaranteed safe) and start the clock.
    if (!this.board) {
      const { rows, cols, mines } = this.def;
      this.board = createBoard(rows, cols, mines, r, c);
      this.startTimer();
    }

    if (this.board.mine[r][c]) {
      this.lose(r, c);
      return;
    }

    floodReveal(this.board, this.revealed, r, c);
    playSound('move');
    this.renderCells();

    if (isWin(this.board, this.revealed)) this.win();
  }

  private flag(r: number, c: number): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    if (this.revealed[r][c]) return;
    this.flagged[r][c] = !this.flagged[r][c];
    playSound('bounce');
    this.renderCell(r, c);
    this.updateMinesLeft();
  }

  private win(): void {
    this.stopClock();
    const { base, par } = this.def;
    const points = base + Math.max(0, par - this.elapsed);
    this.addScore(points);
    playSound('win');
    this.emitBurst();
    // Route through the engine's game-over flow (save prompt when it's a top score).
    this.gameOver();
  }

  private lose(r: number, c: number): void {
    this.stopClock();
    this.state.isGameOver = true;
    this.state.isRunning = false;
    this.revealAllMines(r, c);
    playSound('die');
    screenShake(8, 350);
    this.overlay.show({
      title: 'Boom! 💥',
      bodyHtml: '<p>You hit a mine. Better luck next time!</p>',
      buttons: [
        {
          text: 'Play again',
          primary: true,
          onClick: () => {
            this.overlay.hide();
            this.start();
          },
        },
      ],
    });
  }

  private revealAllMines(hitR: number, hitC: number): void {
    if (!this.board) return;
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        if (!this.board.mine[r][c]) continue;
        const cell = this.cells[r]?.[c];
        if (!cell) continue;
        cell.classList.add('is-mine');
        if (r === hitR && c === hitC) cell.classList.add('is-exploded');
      }
    }
  }

  private renderCells(): void {
    if (!this.board) {
      for (let r = 0; r < this.cells.length; r++) {
        for (let c = 0; c < this.cells[r].length; c++) this.renderCell(r, c);
      }
      return;
    }
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) this.renderCell(r, c);
    }
  }

  private renderCell(r: number, c: number): void {
    const cell = this.cells[r]?.[c];
    if (!cell) return;
    const revealed = this.revealed[r][c];
    const flagged = this.flagged[r][c];
    cell.classList.toggle('is-revealed', revealed);
    cell.classList.toggle('is-flag', flagged && !revealed);

    for (let n = 1; n <= 8; n++) cell.classList.remove(`n${n}`);
    if (revealed && this.board && !this.board.mine[r][c]) {
      const count = this.board.count[r][c];
      cell.textContent = count > 0 ? String(count) : '';
      if (count > 0) cell.classList.add(`n${count}`);
    } else if (flagged && !revealed) {
      cell.textContent = '🚩';
    } else {
      cell.textContent = '';
    }
  }

  private updateMinesLeft(): void {
    const total = this.board?.mines ?? this.def.mines;
    const flags = this.flagged.reduce((s, row) => s + row.filter(Boolean).length, 0);
    this.hud?.set('mines', total - flags);
  }

  private emitBurst(): void {
    if (!this.fx || !this.boardEl) return;
    const rect = this.boardEl.getBoundingClientRect();
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

  private startTimer(): void {
    this.clearTimer();
    this.timerId = setInterval(() => {
      this.elapsed++;
      this.hud?.set('time', this.formatTime(this.elapsed));
    }, 1000);
  }

  private stopClock(): void {
    this.clearTimer();
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

  update(): void {}
  render(): void {}

  handleInput(): void {}

  protected getGameOverTitle(): string {
    return 'Cleared! 🎉';
  }

  protected getGameOverContent(): string {
    return `<p>Swept in <strong>${this.formatTime(this.elapsed)}</strong> — ${this.state.score} points.</p>`;
  }
}
