import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { setupSettingsPanel, difficultyField } from '../../shared/ui/settingsPanel.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound } from '../../shared/fx/sound.js';
import { Difficulty } from '../../shared/quiz/quiz.js';
import { Feedback, generateCode, scoreGuess, isWin } from './mastermind.js';

interface DiffDef {
  length: number;
  colors: number;
  duplicates: boolean;
  guesses: number;
  /** Base points for cracking the code (a bonus per unused guess is added). */
  base: number;
}

const DIFFICULTIES: Record<Difficulty, DiffDef> = {
  easy: { length: 4, colors: 6, duplicates: false, guesses: 10, base: 400 },
  medium: { length: 4, colors: 6, duplicates: true, guesses: 10, base: 700 },
  hard: { length: 5, colors: 8, duplicates: true, guesses: 12, base: 1200 },
};

/**
 * Mastermind: crack the hidden colour code within a limited number of guesses.
 * The Difficulty setting scales the code length, the palette size and whether
 * colours may repeat — so it never becomes trivial. Cracking the code scores
 * points (base for the difficulty + a bonus for every guess saved), fed to the
 * per-variant leaderboard. Event-driven (palette clicks + number keys), no rAF.
 */
export class MastermindGame extends GameEngine {
  private boardEl: HTMLElement | null = null;
  private paletteEl: HTMLElement | null = null;
  private secretEl: HTMLElement | null = null;
  private fx: ParticleSystem | null = null;

  private difficulty: Difficulty = 'medium';

  private secret: number[] = [];
  private currentGuess: number[] = [];
  private activeRow = 0;
  private usedGuesses = 0;
  private won = false;

  private rowEls: HTMLElement[] = [];
  private slotEls: HTMLElement[][] = [];
  private pegEls: HTMLElement[][] = [];
  private feedbackEls: HTMLElement[] = [];

  constructor() {
    super({ storageKey: 'mastermind-scores', leaderboardId: 'mastermind' });
  }

  private get def(): DiffDef {
    return DIFFICULTIES[this.difficulty];
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.paletteEl = document.getElementById('palette');
    this.secretEl = document.getElementById('secret');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'guesses', icon: 'list-ol', label: t('hudGuessesLeft') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);

    this.setupEventListeners(); // keydown → handleInput
    setupSettingsPanel([
      difficultyField(this.difficulty, (v) => {
        this.difficulty = (v as Difficulty) ?? 'medium';
        this.restart();
      }),
    ]);

    this.applyLeaderboardVariant();
    this.newRound();
  }

  /** Points the leaderboard at the current difficulty board (local). */
  private applyLeaderboardVariant(): void {
    const cap = (s: string): string => s[0].toUpperCase() + s.slice(1);
    this.setLeaderboardVariant(this.difficulty, cap(this.difficulty));
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
    this.newRound();
    this.state.isRunning = true;
  }

  reset(): void {
    this.resetState();
    this.newRound();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.start();
  }

  /** Fresh secret, empty board and palette for the current difficulty. */
  private newRound(): void {
    const { length, colors, duplicates, guesses } = this.def;
    this.secret = generateCode(length, colors, duplicates);
    this.currentGuess = [];
    this.activeRow = 0;
    this.usedGuesses = 0;
    this.won = false;
    this.buildBoard();
    this.buildPalette();
    this.hideSecret();
    this.hud?.set('guesses', guesses);
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  private buildBoard(): void {
    const board = this.boardEl;
    if (!board) return;
    const { length, guesses } = this.def;
    board.style.setProperty('--len', String(length));
    board.innerHTML = '';
    this.rowEls = [];
    this.slotEls = [];
    this.pegEls = [];
    this.feedbackEls = [];
    for (let r = 0; r < guesses; r++) {
      const row = document.createElement('div');
      row.className = 'mm-row';

      const slots = document.createElement('div');
      slots.className = 'mm-slots';
      const rowSlots: HTMLElement[] = [];
      for (let c = 0; c < length; c++) {
        const slot = document.createElement('div');
        slot.className = 'mm-slot';
        slots.appendChild(slot);
        rowSlots.push(slot);
      }

      const feedback = document.createElement('div');
      feedback.className = 'mm-feedback';
      const rowPegs: HTMLElement[] = [];
      for (let c = 0; c < length; c++) {
        const peg = document.createElement('span');
        peg.className = 'mm-peg';
        feedback.appendChild(peg);
        rowPegs.push(peg);
      }

      row.append(slots, feedback);
      board.appendChild(row);
      this.rowEls.push(row);
      this.slotEls.push(rowSlots);
      this.pegEls.push(rowPegs);
      this.feedbackEls.push(feedback);
    }
    this.markActiveRow();
  }

  private buildPalette(): void {
    const palette = this.paletteEl;
    if (!palette) return;
    palette.innerHTML = '';
    for (let color = 0; color < this.def.colors; color++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mm-color mm-c${color}`;
      btn.setAttribute('aria-label', `Color ${color + 1}`);
      btn.addEventListener('click', () => this.pushColor(color));
      palette.appendChild(btn);
    }
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'mm-action';
    del.textContent = '⌫';
    del.setAttribute('aria-label', 'Delete');
    del.addEventListener('click', () => this.popColor());

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'mm-action mm-submit';
    ok.textContent = '✓';
    ok.setAttribute('aria-label', 'Submit guess');
    ok.addEventListener('click', () => this.submitGuess());

    palette.append(del, ok);
  }

  handleInput(event: KeyboardEvent): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    if (event.key === 'Backspace') {
      event.preventDefault();
      this.popColor();
      return;
    }
    if (event.key === 'Enter') {
      this.submitGuess();
      return;
    }
    const n = Number(event.key);
    if (Number.isInteger(n) && n >= 1 && n <= this.def.colors) this.pushColor(n - 1);
  }

  private pushColor(color: number): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    if (this.currentGuess.length >= this.def.length) return;
    this.currentGuess.push(color);
    playSound('move');
    this.renderActiveRow();
  }

  private popColor(): void {
    if (this.currentGuess.length === 0) return;
    this.currentGuess.pop();
    this.renderActiveRow();
  }

  private renderActiveRow(): void {
    const slots = this.slotEls[this.activeRow];
    if (!slots) return;
    for (let c = 0; c < slots.length; c++) {
      const color = this.currentGuess[c];
      slots[c].className = 'mm-slot' + (color === undefined ? '' : ` is-filled mm-c${color}`);
    }
  }

  private submitGuess(): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    if (this.currentGuess.length !== this.def.length) {
      screenShake(4, 200);
      return;
    }
    const feedback = scoreGuess(this.secret, this.currentGuess);
    this.renderFeedback(this.activeRow, feedback);
    this.usedGuesses++;
    this.hud?.set('guesses', this.def.guesses - this.usedGuesses);

    if (isWin(feedback, this.def.length)) {
      this.win();
      return;
    }
    playSound('mismatch');
    this.activeRow++;
    this.currentGuess = [];
    if (this.activeRow >= this.def.guesses) this.lose();
    else this.markActiveRow();
  }

  /** Paints the black pegs (exact) then the white pegs (colour-only). */
  private renderFeedback(row: number, feedback: Feedback): void {
    const pegs = this.pegEls[row];
    if (!pegs) return;
    let i = 0;
    for (let b = 0; b < feedback.black; b++) pegs[i++].classList.add('is-black');
    for (let w = 0; w < feedback.white; w++) pegs[i++].classList.add('is-white');
    // Hover tooltip that spells out what the black / white pegs mean.
    const hint = t('mastermindPegs', { black: feedback.black, white: feedback.white });
    const el = this.feedbackEls[row];
    if (el) {
      el.title = hint;
      el.setAttribute('aria-label', hint);
    }
  }

  private markActiveRow(): void {
    this.rowEls.forEach((row, r) => row.classList.toggle('is-active', r === this.activeRow));
  }

  private win(): void {
    this.won = true;
    const remaining = this.def.guesses - this.usedGuesses;
    this.addScore(this.def.base + remaining * 80);
    this.revealSecret();
    playSound('win');
    this.emitBurst();
    this.gameOver();
  }

  private lose(): void {
    this.won = false;
    this.revealSecret();
    playSound('die');
    screenShake(7, 320);
    this.gameOver();
  }

  private hideSecret(): void {
    const host = this.secretEl;
    if (!host) return;
    // Left empty (not filled with placeholder slots) so it collapses to no
    // height while hidden — otherwise it reserves a gap at the top of the board.
    host.classList.remove('is-revealed');
    host.innerHTML = '';
  }

  private revealSecret(): void {
    const host = this.secretEl;
    if (!host) return;
    host.classList.add('is-revealed');
    host.replaceChildren(
      ...this.secret.map((color) => {
        const slot = document.createElement('div');
        slot.className = `mm-slot is-filled mm-c${color}`;
        return slot;
      })
    );
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
    return this.won ? t('youWin') : t('youLose');
  }

  protected getGameOverContent(): string {
    return this.won
      ? t('mastermindWin', { guesses: this.usedGuesses, score: this.state.score })
      : t('mastermindLose');
  }
}
