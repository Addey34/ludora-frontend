import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import {
  setupSettingsPanel,
  difficultyField,
  languageField,
} from '../../shared/ui/settingsPanel.js';
import { playSound } from '../../shared/fx/sound.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { Difficulty, difficultyMultiplier } from '../../shared/quiz/quiz.js';
import {
  Lang,
  WordEntry,
  isWordGuessed,
  keyboardForm,
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
<svg viewBox="0 0 120 140" class="hangman-svg" aria-hidden="true">
  <g class="hangman-gallows">
    <line x1="10" y1="135" x2="80" y2="135" />
    <line x1="30" y1="135" x2="30" y2="10" />
    <line x1="30" y1="10" x2="80" y2="10" />
    <line x1="80" y1="10" x2="80" y2="28" />
  </g>
  <circle class="hangman-part" cx="80" cy="40" r="12" fill="none" />
  <line class="hangman-part" x1="80" y1="52" x2="80" y2="92" />
  <line class="hangman-part" x1="80" y1="62" x2="62" y2="78" />
  <line class="hangman-part" x1="80" y1="62" x2="98" y2="78" />
  <line class="hangman-part" x1="80" y1="92" x2="64" y2="112" />
  <line class="hangman-part" x1="80" y1="92" x2="96" y2="112" />
</svg>`;

/**
 * Hangman: guess the hidden word letter by letter before the figure
 * is complete (six misses). Word length grows with difficulty and a Language
 * setting (FR/EN) swaps the list — both powered by the shared word service. A
 * win scores more the fewer misses and the longer the word. Event-driven (an
 * on-screen A–Z keyboard + physical keys), no rAF loop.
 */
export class HangmanGame extends GameEngine {
  private wordEl: HTMLElement | null = null;
  private figureEl: HTMLElement | null = null;
  private keyboardEl: HTMLElement | null = null;
  private parts: HTMLElement[] = [];
  private keyEls = new Map<string, HTMLButtonElement>();

  private lang: Lang = 'en';
  private difficulty: Difficulty = 'easy';
  private words: Record<Lang, WordEntry[]> = { fr: [], en: [] };

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
    super({ storageKey: 'hangman-scores', leaderboardId: 'hangman' });
  }

  async initialize(): Promise<void> {
    this.wordEl = document.getElementById('word');
    this.figureEl = document.getElementById('figure');
    this.keyboardEl = document.getElementById('keyboard');
    this.hud = setupHud([
      { key: 'solved', icon: 'check', label: t('hudWordsSolved') },
      { key: 'lives', icon: 'heart', label: t('hudGuessesLeft') },
      { key: 'score', icon: 'star', label: t('score') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);

    if (this.figureEl) this.figureEl.innerHTML = FIGURE_SVG;
    this.parts = this.figureEl
      ? [...this.figureEl.querySelectorAll<HTMLElement>('.hangman-part')]
      : [];
    this.buildKeyboard();
    this.setupEventListeners();

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
    this.words = { fr, en };
  }

  /** Points the leaderboard at the current language + difficulty board. */
  private applyLeaderboardVariant(): void {
    const cap = (s: string): string => s[0].toUpperCase() + s.slice(1);
    this.setLeaderboardVariant(
      `${this.lang}-${this.difficulty}`,
      `${this.lang.toUpperCase()} · ${cap(this.difficulty)}`
    );
  }

  private buildKeyboard(): void {
    const kb = this.keyboardEl;
    if (!kb) return;
    kb.innerHTML = '';
    this.keyEls.clear();
    for (const row of KEY_ROWS) {
      const rowEl = document.createElement('div');
      rowEl.className = 'hangman-krow';
      for (const letter of row) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hangman-key';
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
    this.applyLeaderboardVariant();
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

  /** Serves the next word of the run (fresh figure, letters and keyboard). */
  private newWord(): void {
    const list = this.words[this.lang];
    this.target = list.length > 0 ? keyboardForm(pickWord(list, this.difficulty)) : 'HOUSE';
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
        slot.className = 'hangman-slot';
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
    return t('hanged');
  }

  protected getGameOverContent(): string {
    const w = this.solved;
    return (
      t(w === 1 ? 'hangmanStreakOne' : 'hangmanStreakMany', { n: w }) +
      t('hangmanWord', { target: this.target, score: this.state.score })
    );
  }
}
