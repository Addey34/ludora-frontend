import { GameEngine } from '../../shared/engine/GameEngine.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { setupSettingsPanel } from '../../shared/ui/settingsPanel.js';
import { showToast } from '../../shared/ui/toast.js';
import { playSound } from '../../shared/fx/sound.js';
import { MAX_TRIES, WORD_LEN, Verdict, normalizeWord, scoreGuess } from './motus.js';

type Lang = 'fr' | 'en';

const KEY_ENTER = 'ENTER';
const KEY_DEL = 'DEL';

/** On-screen key rows per language (AZERTY for FR, QWERTY for EN). */
const LAYOUTS: Record<Lang, string[][]> = {
  fr: [[...'AZERTYUIOP'], [...'QSDFGHJKLM'], [KEY_ENTER, ...'WXCVBN', KEY_DEL]],
  en: [[...'QWERTYUIOP'], [...'ASDFGHJKL'], [KEY_ENTER, ...'ZXCVBNM', KEY_DEL]],
};

/** Fallback words if the dictionary file can't be fetched (offline dev). */
const FALLBACK: Record<Lang, string[]> = {
  fr: ['ARBRE', 'CHIEN', 'FLEUR', 'ROUTE', 'PIANO', 'MONDE', 'TABLE', 'PORTE'],
  en: ['APPLE', 'HOUSE', 'PLANT', 'BREAD', 'RIVER', 'STONE', 'MUSIC', 'TIGER'],
};

/** Priority so a letter's key colour only ever upgrades (absent→present→correct). */
const RANK: Record<Verdict, number> = { absent: 0, present: 1, correct: 2 };

/**
 * Motus / Wordle: guess the hidden 5-letter word in 6 tries. Each guess colours
 * its tiles green (right spot), yellow (wrong spot) or grey (absent), and the
 * on-screen keyboard mirrors what's known. The dictionary language (FR/EN) is
 * picked in Settings; each language ships its own word list + keyboard layout.
 *
 * Event-driven (physical + on-screen keyboard), so no `requestAnimationFrame`
 * loop. Winning scores more the fewer tries were used; losing reveals the word.
 */
export class MotusGame extends GameEngine {
  private gridEl: HTMLElement | null = null;
  private keyboardEl: HTMLElement | null = null;
  private tiles: HTMLElement[][] = [];
  private keyEls = new Map<string, HTMLButtonElement>();

  private lang: Lang = 'fr';
  private words: string[] = [];

  private target = '';
  private row = 0;
  private guess = '';
  private finished = true;

  constructor() {
    super({ storageKey: 'motus-scores' });
  }

  async initialize(): Promise<void> {
    this.gridEl = document.getElementById('grid');
    this.keyboardEl = document.getElementById('keyboard');
    this.hud = setupHud([
      { key: 'tries', icon: 'list-ol', label: 'Tries' },
      { key: 'high', icon: 'trophy', label: 'Best' },
    ]);

    this.buildGrid();
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
        onChange: (v) => void this.changeLang(v as Lang),
      },
    ]);

    this.renderScoreTable();
    await this.loadWords();
  }

  private async loadWords(): Promise<void> {
    try {
      const res = await fetch(`/motus-${this.lang}.txt`);
      const text = await res.text();
      const words = text
        .split(/\r?\n/)
        .map((w) => normalizeWord(w))
        .filter((w): w is string => w !== null);
      this.words = words.length > 0 ? words : FALLBACK[this.lang];
    } catch {
      this.words = FALLBACK[this.lang];
    }
  }

  private buildGrid(): void {
    const grid = this.gridEl;
    if (!grid) return;
    grid.innerHTML = '';
    this.tiles = [];
    for (let r = 0; r < MAX_TRIES; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'motus-row';
      const rowTiles: HTMLElement[] = [];
      for (let c = 0; c < WORD_LEN; c++) {
        const tile = document.createElement('div');
        tile.className = 'motus-tile';
        rowEl.appendChild(tile);
        rowTiles.push(tile);
      }
      grid.appendChild(rowEl);
      this.tiles.push(rowTiles);
    }
  }

  private buildKeyboard(): void {
    const kb = this.keyboardEl;
    if (!kb) return;
    kb.innerHTML = '';
    this.keyEls.clear();
    for (const rowKeys of LAYOUTS[this.lang]) {
      const rowEl = document.createElement('div');
      rowEl.className = 'motus-krow';
      for (const key of rowKeys) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'motus-key';
        if (key === KEY_ENTER || key === KEY_DEL) btn.classList.add('motus-key--wide');
        btn.textContent = key === KEY_ENTER ? 'Enter' : key === KEY_DEL ? '⌫' : key;
        btn.dataset.key = key;
        btn.addEventListener('click', () => this.press(key));
        rowEl.appendChild(btn);
        this.keyEls.set(key, btn);
      }
      kb.appendChild(rowEl);
    }
  }

  private async changeLang(lang: Lang): Promise<void> {
    this.lang = lang;
    this.buildKeyboard();
    await this.loadWords();
    this.stop();
    this.start();
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.newRound();
    this.resetState();
    this.state.isRunning = true;
  }

  reset(): void {
    this.newRound();
    this.resetState();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.start();
  }

  private newRound(): void {
    this.target =
      this.words[Math.floor(Math.random() * this.words.length)] ?? FALLBACK[this.lang][0];
    this.row = 0;
    this.guess = '';
    this.finished = false;
    this.buildGrid();
    for (const btn of this.keyEls.values()) {
      btn.classList.remove('is-correct', 'is-present', 'is-absent');
    }
    this.hud?.set('tries', `0/${MAX_TRIES}`);
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  /** Central input entry point (both the physical and on-screen keyboards). */
  private press(key: string): void {
    if (this.finished || !this.state.isRunning) return;
    if (key === KEY_ENTER) this.submit();
    else if (key === KEY_DEL) this.backspace();
    else if (/^[A-Z]$/.test(key)) this.type(key);
  }

  private type(letter: string): void {
    if (this.guess.length >= WORD_LEN) return;
    this.guess += letter;
    this.renderCurrentRow();
  }

  private backspace(): void {
    if (this.guess.length === 0) return;
    this.guess = this.guess.slice(0, -1);
    this.renderCurrentRow();
  }

  private renderCurrentRow(): void {
    const rowTiles = this.tiles[this.row];
    if (!rowTiles) return;
    for (let c = 0; c < WORD_LEN; c++) {
      const ch = this.guess[c] ?? '';
      rowTiles[c].textContent = ch;
      rowTiles[c].classList.toggle('is-filled', ch !== '');
    }
  }

  private submit(): void {
    if (this.guess.length < WORD_LEN) {
      showToast('Not enough letters', 'warning');
      return;
    }

    const verdicts = scoreGuess(this.guess, this.target);
    const rowTiles = this.tiles[this.row];
    verdicts.forEach((v, c) => {
      rowTiles[c].classList.add(`is-${v}`);
      this.upgradeKey(this.guess[c], v);
    });
    playSound('move');

    const won = verdicts.every((v) => v === 'correct');
    this.row++;
    this.hud?.set('tries', `${this.row}/${MAX_TRIES}`);
    this.guess = '';

    if (won) {
      this.win();
    } else if (this.row >= MAX_TRIES) {
      this.lose();
    }
  }

  private upgradeKey(letter: string, verdict: Verdict): void {
    const btn = this.keyEls.get(letter);
    if (!btn) return;
    const rank = btn.classList.contains('is-correct')
      ? RANK.correct
      : btn.classList.contains('is-present')
        ? RANK.present
        : btn.classList.contains('is-absent')
          ? RANK.absent
          : -1;
    if (rank >= RANK[verdict]) return;
    btn.classList.remove('is-correct', 'is-present', 'is-absent');
    btn.classList.add(`is-${verdict}`);
  }

  private win(): void {
    this.finished = true;
    const points = (MAX_TRIES - this.row + 1) * 200;
    this.addScore(points);
    playSound('win');
    this.gameOver();
  }

  private lose(): void {
    this.finished = true;
    this.state.isGameOver = true;
    this.state.isRunning = false;
    playSound('die');
    this.overlay.show({
      title: 'Out of tries',
      bodyHtml: `<p>The word was <strong>${this.target}</strong>.</p>`,
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

  handleInput(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.press(KEY_ENTER);
    else if (event.key === 'Backspace') this.press(KEY_DEL);
    else {
      const k = event.key.toUpperCase();
      if (/^[A-Z]$/.test(k)) this.press(k);
    }
  }

  update(): void {}
  render(): void {}

  protected getGameOverTitle(): string {
    return 'Solved! 🎉';
  }

  protected getGameOverContent(): string {
    const tries = this.row;
    return `<p>Found <strong>${this.target}</strong> in ${tries} ${tries === 1 ? 'try' : 'tries'} — ${this.state.score} points.</p>`;
  }
}
