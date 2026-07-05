import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import {
  setupSettingsPanel,
  difficultyField,
  languageField,
} from '../../shared/ui/settingsPanel.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { playSound } from '../../shared/fx/sound.js';
import { Difficulty } from '../../shared/quiz/quiz.js';
import { Lang, WordEntry, keyboardForm } from '../../shared/words/words.js';
import { loadWords } from '../../shared/words/wordBank.js';
import {
  Cell,
  Puzzle,
  Placement,
  Direction,
  buildPuzzle,
  lineCells,
  findPlacement,
  DIRS_EASY,
  DIRS_MEDIUM,
  DIRS_HARD,
} from './wordsearch.js';

interface DiffDef {
  size: number;
  count: number;
  minLen: number;
  maxLen: number;
  dirs: Direction[];
  /** Base points for clearing the grid. */
  base: number;
  /** Par time (s): clearing under par adds the saved seconds to the score. */
  par: number;
}

const DIFFICULTIES: Record<Difficulty, DiffDef> = {
  easy: { size: 8, count: 6, minLen: 3, maxLen: 6, dirs: DIRS_EASY, base: 300, par: 90 },
  medium: { size: 11, count: 8, minLen: 4, maxLen: 8, dirs: DIRS_MEDIUM, base: 800, par: 180 },
  hard: { size: 13, count: 10, minLen: 4, maxLen: 11, dirs: DIRS_HARD, base: 1500, par: 300 },
};

/**
 * Word Search: find every hidden word by tracing a straight line of letters
 * (drag across the grid). A Language (FR/EN) and Difficulty setting swap the word
 * list and the grid/word count — both powered by the shared word service. Solving
 * scores points (base for the difficulty + the seconds saved under par), fed to
 * the per-variant leaderboard. Event-driven (pointer), so no rAF loop; a 1 s
 * interval drives the timer.
 */
export class WordSearchGame extends GameEngine {
  private boardEl: HTMLElement | null = null;
  private wordListEl: HTMLElement | null = null;
  private cells: HTMLElement[][] = [];
  private fx: ParticleSystem | null = null;

  private lang: Lang = 'en';
  private difficulty: Difficulty = 'easy';
  private bank: Record<Lang, WordEntry[]> = { fr: [], en: [] };

  private puzzle: Puzzle | null = null;
  private found = new Set<Placement>();

  /** Pointer drag state. */
  private selecting = false;
  private anchor: Cell | null = null;

  private elapsed = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super({ storageKey: 'wordsearch-scores' });
  }

  private get def(): DiffDef {
    return DIFFICULTIES[this.difficulty];
  }

  async initialize(): Promise<void> {
    this.boardEl = document.getElementById('board');
    this.wordListEl = document.getElementById('wordList');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'found', icon: 'check', label: t('hudFound') },
      { key: 'time', icon: 'clock', label: t('hudTime') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);

    this.setupPointer();
    setupSettingsPanel([
      languageField(this.lang, (v) => {
        this.lang = v === 'en' ? 'en' : 'fr';
        this.restart();
      }),
      difficultyField(this.difficulty, (v) => {
        this.difficulty = (v as Difficulty) ?? 'easy';
        this.restart();
      }),
    ]);

    this.applyLeaderboardVariant();
    const [fr, en] = await Promise.all([loadWords('fr'), loadWords('en')]);
    this.bank = { fr, en };
  }

  /** Points the leaderboard at the current language + difficulty board (local). */
  private applyLeaderboardVariant(): void {
    const cap = (s: string): string => s[0].toUpperCase() + s.slice(1);
    this.setLeaderboardVariant(
      `${this.lang}-${this.difficulty}`,
      `${this.lang.toUpperCase()} · ${cap(this.difficulty)}`
    );
  }

  private restart(): void {
    this.overlay.hide();
    this.stop();
    this.start();
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.resetState();
    this.applyLeaderboardVariant();
    this.newPuzzle();
    this.state.isRunning = true;
    this.startTimer();
  }

  reset(): void {
    this.resetState();
    this.newPuzzle();
  }

  stop(): void {
    super.stop();
    this.clearTimer();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.start();
  }

  /** Chooses words for the current settings and lays out a fresh grid. */
  private newPuzzle(): void {
    this.clearTimer();
    this.elapsed = 0;
    this.found = new Set();
    const words = this.pickWords();
    this.puzzle = buildPuzzle(this.def.size, words, this.def.dirs);
    this.buildGrid();
    this.renderWordList();
    this.updateFoundHud();
    this.hud?.set('time', this.formatTime(0));
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  /** Unique uppercase A–Z words of the right length for the current difficulty. */
  private pickWords(): string[] {
    const { size, count, minLen, maxLen } = this.def;
    const cap = Math.min(maxLen, size);
    const seen = new Set<string>();
    const pool: string[] = [];
    for (const entry of this.bank[this.lang]) {
      const w = keyboardForm(entry.w);
      if (w.length < minLen || w.length > cap || seen.has(w) || !/^[A-Z]+$/.test(w)) continue;
      seen.add(w);
      pool.push(w);
    }
    // Shuffle and take `count` (fewer if the pool is small).
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  private buildGrid(): void {
    const board = this.boardEl;
    const puzzle = this.puzzle;
    if (!board || !puzzle) return;
    board.style.setProperty('--size', String(puzzle.size));
    board.innerHTML = '';
    this.cells = [];
    for (let r = 0; r < puzzle.size; r++) {
      const row: HTMLElement[] = [];
      for (let c = 0; c < puzzle.size; c++) {
        const cell = document.createElement('div');
        cell.className = 'ws-cell';
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.textContent = puzzle.grid[r][c];
        board.appendChild(cell);
        row.push(cell);
      }
      this.cells.push(row);
    }
  }

  private renderWordList(): void {
    const host = this.wordListEl;
    if (!host || !this.puzzle) return;
    host.replaceChildren(
      ...this.puzzle.placements.map((p) => {
        const chip = document.createElement('span');
        chip.className = 'ws-word';
        chip.dataset.word = p.word;
        chip.textContent = p.word;
        return chip;
      })
    );
  }

  private setupPointer(): void {
    const board = this.boardEl;
    if (!board) return;
    board.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    board.addEventListener('pointermove', (e) => this.onPointerMove(e));
    board.addEventListener('pointerup', () => this.onPointerUp());
    board.addEventListener('pointerleave', () => this.cancelSelection());
    board.addEventListener('pointercancel', () => this.cancelSelection());
  }

  private cellAt(x: number, y: number): Cell | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.ws-cell');
    if (!el || el.dataset.r === undefined) return null;
    return { r: Number(el.dataset.r), c: Number(el.dataset.c) };
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    const cell = this.cellAt(e.clientX, e.clientY);
    if (!cell) return;
    e.preventDefault();
    this.selecting = true;
    this.anchor = cell;
    this.highlight([cell]);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.selecting || !this.anchor) return;
    const cell = this.cellAt(e.clientX, e.clientY);
    if (!cell) return;
    const line = lineCells(this.anchor, cell);
    if (line) this.highlight(line);
  }

  private onPointerUp(): void {
    if (!this.selecting || !this.anchor) return;
    const active = this.selectedCells();
    this.selecting = false;
    this.anchor = null;
    this.clearSelectionClass();
    if (active.length >= 2) this.tryFind(active);
  }

  private cancelSelection(): void {
    this.selecting = false;
    this.anchor = null;
    this.clearSelectionClass();
  }

  /** The cells currently flagged as the tentative selection. */
  private selectedCells(): Cell[] {
    const cells: Cell[] = [];
    for (let r = 0; r < this.cells.length; r++) {
      for (let c = 0; c < this.cells[r].length; c++) {
        if (this.cells[r][c].classList.contains('is-sel')) cells.push({ r, c });
      }
    }
    // Order them along the anchor→end line so readback is stable.
    return cells;
  }

  private highlight(line: Cell[]): void {
    this.clearSelectionClass();
    for (const { r, c } of line) this.cells[r]?.[c]?.classList.add('is-sel');
  }

  private clearSelectionClass(): void {
    for (const row of this.cells) for (const cell of row) cell.classList.remove('is-sel');
  }

  /** Checks a completed trace against the unfound placements. */
  private tryFind(trace: Cell[]): void {
    if (!this.puzzle) return;
    const remaining = this.puzzle.placements.filter((p) => !this.found.has(p));
    const hit = findPlacement(remaining, this.orderTrace(trace));
    if (!hit) {
      playSound('mismatch');
      return;
    }
    this.found.add(hit);
    for (const { r, c } of hit.cells) this.cells[r]?.[c]?.classList.add('is-found');
    this.markWordFound(hit.word);
    playSound('match');
    this.updateFoundHud();
    if (this.found.size === this.puzzle.placements.length) this.win();
  }

  /** Re-orders the flagged cells into a proper line (anchor stored the start). */
  private orderTrace(cells: Cell[]): Cell[] {
    if (cells.length < 2) return cells;
    const first = cells[0];
    const last = cells[cells.length - 1];
    return lineCells(first, last) ?? cells;
  }

  private markWordFound(word: string): void {
    const chip = this.wordListEl?.querySelector<HTMLElement>(`.ws-word[data-word="${word}"]`);
    chip?.classList.add('is-found');
  }

  private updateFoundHud(): void {
    const total = this.puzzle?.placements.length ?? 0;
    this.hud?.set('found', `${this.found.size} / ${total}`);
  }

  private win(): void {
    this.clearTimer();
    const { base, par } = this.def;
    this.addScore(base + Math.max(0, par - this.elapsed));
    playSound('win');
    this.emitBurst();
    this.gameOver();
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

  update(): void {}
  render(): void {}
  handleInput(): void {}

  protected getGameOverTitle(): string {
    return t('cleared');
  }

  protected getGameOverContent(): string {
    return t('wordsearchRecap', {
      count: this.puzzle?.placements.length ?? 0,
      time: this.formatTime(this.elapsed),
      score: this.state.score,
    });
  }
}
