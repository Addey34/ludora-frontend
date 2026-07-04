import { GameEngine } from '../../shared/engine/GameEngine.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { setupSettingsPanel } from '../../shared/ui/settingsPanel.js';
import { playSound } from '../../shared/fx/sound.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { Difficulty, difficultyMultiplier } from '../../shared/quiz/quiz.js';
import {
  Lang,
  LENGTH_BY_DIFFICULTY,
  isWordGuessed,
  maskWord,
  pickWord,
} from '../../shared/words/words.js';
import { loadWords } from '../../shared/words/wordBank.js';

/** Letters that complete the hanging figure — the number of allowed wrong guesses. */
const MAX_WRONG = 6;

/** Alphabetical keyboard rows (FR/EN words are stored accent-free A–Z). */
const KEY_ROWS = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ'].map((row) => [...row]);

/** SVG of the gallows (always drawn) + the six body parts, revealed one per miss. */
const FIGURE_SVG = `
<svg viewBox="0 0 120 140" class="pendu-svg" aria-hidden="true">
  <g class="pendu-gallows">
    <line x1="10" y1="135" x2="80" y2="135" />
    <line x1="30" y1="135" x2="30" y2="10" />
    <line x1="30" y1="10" x2="80" y2="10" />
    <line x1="80" y1="10" x2="80" y2="28" />
  </g>
  <circle class="pendu-part" cx="80" cy="40" r="12" fill="none" />
  <line class="pendu-part" x1="80" y1="52" x2="80" y2="92" />
  <line class="pendu-part" x1="80" y1="62" x2="62" y2="78" />
  <line class="pendu-part" x1="80" y1="62" x2="98" y2="78" />
  <line class="pendu-part" x1="80" y1="92" x2="64" y2="112" />
  <line class="pendu-part" x1="80" y1="92" x2="96" y2="112" />
</svg>`;

/**
 * Hangman (Le Pendu): guess the hidden word letter by letter before the figure
 * is complete (six misses). Word length grows with difficulty and a Language
 * setting (FR/EN) swaps the list — both powered by the shared word service. A
 * win scores more the fewer misses and the longer the word. Event-driven (an
 * on-screen A–Z keyboard + physical keys), no rAF loop.
 */
export class PenduGame extends GameEngine {
  private wordEl: HTMLElement | null = null;
  private figureEl: HTMLElement | null = null;
  private keyboardEl: HTMLElement | null = null;
  private parts: HTMLElement[] = [];
  private keyEls = new Map<string, HTMLButtonElement>();

  private lang: Lang = 'en';
  private difficulty: Difficulty = 'easy';
  private words: Record<Lang, string[]> = { fr: [], en: [] };

  private target = '';
  private guessed = new Set<string>();
  private wrong = 0;
  private finished = true;
  /** Words solved in the current endless run (also the challenge metric). */
  private solved = 0;
  /** Bumped on start/reset/stop so a pending between-words timeout bails. */
  private gen = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super({ storageKey: 'pendu-scores', leaderboardId: 'pendu' });
  }

  async initialize(): Promise<void> {
    this.wordEl = document.getElementById('word');
    this.figureEl = document.getElementById('figure');
    this.keyboardEl = document.getElementById('keyboard');
    this.hud = setupHud([
      { key: 'solved', icon: 'check', label: 'Words solved' },
      { key: 'lives', icon: 'heart', label: 'Guesses left' },
      { key: 'score', icon: 'star', label: 'Score' },
      { key: 'high', icon: 'trophy', label: 'Best' },
    ]);

    if (this.figureEl) this.figureEl.innerHTML = FIGURE_SVG;
    this.parts = this.figureEl
      ? [...this.figureEl.querySelectorAll<HTMLElement>('.pendu-part')]
      : [];
    this.buildKeyboard();
    this.setupEventListeners();

    setupSettingsPanel([
      {
        id: 'lang',
        label: 'Language',
        choices: [
          { label: 'FR', value: 'fr' },
          { label: 'EN', value: 'en' },
        ],
        value: this.lang,
        onChange: (v) => {
          this.lang = v === 'en' ? 'en' : 'fr';
          this.restart();
        },
      },
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
          this.restart();
        },
      },
    ]);

    this.renderScoreTable();
    const [fr, en] = await Promise.all([loadWords('fr'), loadWords('en')]);
    this.words = { fr, en };
  }

  private buildKeyboard(): void {
    const kb = this.keyboardEl;
    if (!kb) return;
    kb.innerHTML = '';
    this.keyEls.clear();
    for (const row of KEY_ROWS) {
      const rowEl = document.createElement('div');
      rowEl.className = 'pendu-krow';
      for (const letter of row) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pendu-key';
        btn.textContent = letter;
        btn.addEventListener('click', () => {
          this.guess(letter);
          btn.blur();
        });
        rowEl.appendChild(btn);
        this.keyEls.set(letter, btn);
      }
      kb.appendChild(rowEl);
    }
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
    this.solved = 0;
    this.gen += 1;
    this.state.isRunning = true;
    this.newWord();
  }

  reset(): void {
    this.gen += 1;
    this.clearTimer();
    this.resetState();
    this.solved = 0;
    this.newWord();
  }

  stop(): void {
    super.stop();
    this.gen += 1;
    this.clearTimer();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.start();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Word-length window for the current run: widens as the streak grows. */
  private wordRange(): [number, number] {
    const [min, max] = LENGTH_BY_DIFFICULTY[this.difficulty];
    const ramp = Math.min(Math.floor(this.solved / 4), 4);
    return [min + ramp, max + ramp];
  }

  /** Serves the next word of the run (fresh figure, letters and keyboard). */
  private newWord(): void {
    const [min, max] = this.wordRange();
    const list = this.words[this.lang];
    this.target = list.length > 0 ? pickWord(list, min, max) : 'HOUSE';
    this.guessed = new Set();
    this.wrong = 0;
    this.finished = false;
    for (const btn of this.keyEls.values()) {
      btn.disabled = false;
      btn.classList.remove('is-hit', 'is-miss');
    }
    this.renderWord();
    this.renderFigure();
    this.hud?.set('solved', this.solved);
    this.hud?.set('lives', MAX_WRONG);
    this.hud?.set('score', this.state.score);
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  private guess(letter: string): void {
    if (this.finished || !this.state.isRunning || this.guessed.has(letter)) return;
    this.guessed.add(letter);
    const btn = this.keyEls.get(letter);
    if (btn) btn.disabled = true;

    if (this.target.includes(letter)) {
      btn?.classList.add('is-hit');
      playSound('move');
      this.renderWord();
      if (isWordGuessed(this.target, this.guessed)) this.onWordSolved();
    } else {
      btn?.classList.add('is-miss');
      this.wrong += 1;
      playSound('mismatch');
      this.renderFigure();
      this.hud?.set('lives', MAX_WRONG - this.wrong);
      if (this.wrong >= MAX_WRONG) this.endRun();
    }
  }

  private renderWord(): void {
    const host = this.wordEl;
    if (!host) return;
    const masked = maskWord(this.target, this.guessed);
    host.replaceChildren(
      ...[...masked].map((ch, i) => {
        const slot = document.createElement('span');
        slot.className = 'pendu-slot';
        if (ch !== '_') {
          slot.textContent = this.target[i];
          slot.classList.add('is-filled');
        }
        return slot;
      })
    );
  }

  private renderFigure(): void {
    this.parts.forEach((part, i) => part.classList.toggle('is-shown', i < this.wrong));
  }

  /** A word is fully guessed: score it, then move on to the next word (endless). */
  private onWordSolved(): void {
    this.finished = true; // block input during the brief transition
    this.solved += 1;
    const points = Math.round(
      (50 + (MAX_WRONG - this.wrong) * 20 + this.target.length * 10) *
        difficultyMultiplier(this.difficulty)
    );
    this.addScore(points);
    playSound('win');
    this.hud?.set('solved', this.solved);
    this.hud?.set('score', this.state.score);
    this.hud?.set('high', this.scoreManager.getHighScore());

    const gen = this.gen;
    this.clearTimer();
    this.timer = setTimeout(() => {
      if (gen === this.gen) this.newWord();
    }, 850);
  }

  /** Out of guesses on a word: the run ends. Score + streak go to the leaderboard. */
  private endRun(): void {
    this.finished = true;
    this.clearTimer();
    for (const btn of this.keyEls.values()) btn.disabled = true;
    // Reveal the word that ended the run.
    this.guessed = new Set(this.target);
    this.renderWord();
    playSound('die');
    screenShake(7, 320);
    this.gameOver();
  }

  handleInput(event: KeyboardEvent): void {
    const key = event.key.toUpperCase();
    if (/^[A-Z]$/.test(key)) this.guess(key);
  }

  update(): void {}
  render(): void {}

  protected getGameOverTitle(): string {
    return 'Hanged! 💀';
  }

  protected getGameOverContent(): string {
    const w = this.solved;
    return (
      `<p>You solved <strong>${w}</strong> word${w === 1 ? '' : 's'} in a row.</p>` +
      `<p>The word was <strong>${this.target}</strong> — ${this.state.score} points.</p>`
    );
  }
}
