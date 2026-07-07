import { BoardGame } from '../../shared/turn/BoardGame.js';
import { t } from '../../shared/i18n/i18n.js';
import { TurnRules } from '../../shared/turn/turnGame.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { playSound } from '../../shared/fx/sound.js';
import {
  setupSettingsPanel,
  SettingsPanelHandle,
  difficultyField,
} from '../../shared/ui/settingsPanel.js';
import { setupHud } from '../../shared/ui/hud.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import {
  MancalaState,
  MancalaMove,
  SEATS,
  rules as mancalaRules,
  eqMove,
  storeOf,
  pitsOf,
} from './mancala.js';
import { decideMove } from './mancalaBot.js';

const MAX_SEED_DOTS = 12;

/**
 * Mancala controller: a 2-player board game (human seat 0 vs bot, or 1-v-1
 * online). The board shows two rows of six pits and two stores. The human
 * clicks a pit to sow its seeds; the bot or remote player responds via the
 * shared BoardGame turn loop.
 */
export class MancalaGame extends BoardGame<MancalaState, MancalaMove> {
  protected botDelay = 700;
  protected nextTurnDelay = 350;
  protected endDelay = 600;
  protected turnSeconds = 30;

  private difficulty: Difficulty = 'medium';
  private settings: SettingsPanelHandle | null = null;

  private boardEl: HTMLElement | null = null;
  /** Map from absolute pit index (0-5, 7-12) to its DOM element. */
  private pitEls = new Map<number, HTMLElement>();
  /** Store elements, indexed by seat (0 = right, 1 = left). */
  private storeEls: (HTMLElement | null)[] = [null, null];
  private fx: ParticleSystem | null = null;
  /** Seed counts from the previous render, to animate only what changed. */
  private prevCounts = new Map<number, number>();

  constructor() {
    super({ storageKey: 'mancala' });
  }

  protected get rules(): TurnRules<MancalaState, MancalaMove> {
    return mancalaRules;
  }

  protected moveEquals(a: MancalaMove, b: MancalaMove): boolean {
    return eqMove(a, b);
  }

  protected decideBotMove(legalMoves: MancalaMove[]): MancalaMove {
    return decideMove(this.game, legalMoves, this.difficulty);
  }

  protected isRoundOver(): boolean {
    return this.game.gameOver;
  }

  protected onRoundReset(): void {
    // Forget last round's counts so the fresh board doesn't animate a huge diff.
    this.prevCounts.clear();
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'turn', icon: 'circle-dot', label: t('hudTurn') },
      { key: 'time', icon: 'clock', label: t('hudTime') },
    ]);

    this.buildBoard();
    this.boardEl?.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-pit]');
      if (el?.dataset.pit !== undefined) this.onPitClick(Number(el.dataset.pit));
    });

    this.settings = setupSettingsPanel([
      difficultyField(this.difficulty, (v) => {
        this.difficulty = v as Difficulty;
      }),
    ]);
    this.setupVersus(SEATS);

    this.game = this.freshGame();
    this.updateTurnDisplay();
    this.renderState();
  }

  protected onNetActiveChanged(active: boolean): void {
    this.settings?.setDisabled(active);
  }

  // ---------------------------------------------------------------------------
  // DOM construction (called once in initialize)
  // ---------------------------------------------------------------------------

  private buildBoard(): void {
    if (!this.boardEl) return;
    this.boardEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'mn-board';

    // Left store: seat 1
    const store1 = this.createStore(1);
    this.storeEls[1] = store1;
    wrap.appendChild(store1);

    // Central pit area: top row = P1 pits (12→7), bottom row = P0 pits (0→5)
    const pitsWrap = document.createElement('div');
    pitsWrap.className = 'mn-pits';

    const topRow = document.createElement('div');
    topRow.className = 'mn-row mn-row-top';
    for (const idx of [12, 11, 10, 9, 8, 7]) {
      topRow.appendChild(this.createPit(idx, 1));
    }
    pitsWrap.appendChild(topRow);

    const bottomRow = document.createElement('div');
    bottomRow.className = 'mn-row mn-row-bottom';
    for (const idx of [0, 1, 2, 3, 4, 5]) {
      bottomRow.appendChild(this.createPit(idx, 0));
    }
    pitsWrap.appendChild(bottomRow);

    wrap.appendChild(pitsWrap);

    // Right store: seat 0
    const store0 = this.createStore(0);
    this.storeEls[0] = store0;
    wrap.appendChild(store0);

    this.boardEl.appendChild(wrap);
  }

  private createPit(idx: number, seat: number): HTMLElement {
    const el = document.createElement('div');
    el.className = `mn-pit mn-pit-p${seat}`;
    el.dataset.pit = String(idx);
    el.setAttribute('role', 'button');
    const seeds = document.createElement('div');
    seeds.className = 'mn-seeds';
    const count = document.createElement('div');
    count.className = 'mn-count';
    el.appendChild(seeds);
    el.appendChild(count);
    this.pitEls.set(idx, el);
    return el;
  }

  private createStore(seat: number): HTMLElement {
    const el = document.createElement('div');
    el.className = `mn-store mn-store-p${seat}`;
    const label = document.createElement('div');
    label.className = 'mn-store-label';
    label.textContent = seat === 0 ? t('me') : t('you');
    const seeds = document.createElement('div');
    seeds.className = 'mn-seeds';
    const count = document.createElement('div');
    count.className = 'mn-count';
    el.appendChild(label);
    el.appendChild(seeds);
    el.appendChild(count);
    return el;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private refreshSeeds(el: HTMLElement, count: number, seat: number): void {
    const seedsEl = el.querySelector<HTMLElement>('.mn-seeds');
    if (!seedsEl) return;
    const shown = Math.min(count, MAX_SEED_DOTS);
    const prevShown = Number(seedsEl.dataset.shown ?? -1);
    if (prevShown === shown) return;
    seedsEl.dataset.shown = String(shown);
    seedsEl.innerHTML = '';
    const from = Math.max(0, prevShown);
    for (let i = 0; i < shown; i++) {
      const dot = document.createElement('span');
      dot.className = `mn-seed mn-seed-p${seat}`;
      // Seeds added since the last render drop in one after another.
      if (shown > prevShown && i >= from) {
        dot.classList.add('mn-seed-drop');
        dot.style.animationDelay = `${(i - from) * 55}ms`;
      }
      seedsEl.appendChild(dot);
    }
  }

  /** Restarts a one-shot animation class on an element. */
  private flash(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  protected renderState(): void {
    for (const [idx, el] of this.pitEls) {
      const count = this.game.pits[idx];
      const seat = idx < 7 ? 0 : 1;
      const prev = this.prevCounts.get(idx);
      el.querySelector('.mn-count')!.textContent = String(count);
      this.refreshSeeds(el, count, seat);

      if (prev !== undefined && count > prev) this.flash(el, 'mn-gain');
      else if (prev !== undefined && count === 0 && prev > 0) this.flash(el, 'mn-scoop');
      this.prevCounts.set(idx, count);

      const myPits = pitsOf(this.mySeat) as number[];
      const canPlay =
        this.awaitingHuman &&
        this.game.current === this.mySeat &&
        myPits.includes(idx) &&
        count > 0;
      el.classList.toggle('is-playable', canPlay);
      el.classList.toggle('is-empty', count === 0);
      el.classList.toggle('is-active-side', this.game.current === seat && !this.game.gameOver);
    }

    for (const s of [0, 1]) {
      const el = this.storeEls[s];
      if (!el) continue;
      const storeIdx = storeOf(s);
      const count = this.game.pits[storeIdx];
      const prev = this.prevCounts.get(storeIdx);
      el.querySelector('.mn-count')!.textContent = String(count);
      this.refreshSeeds(el, count, s);
      if (prev !== undefined && count > prev) this.flash(el, 'mn-gain');
      this.prevCounts.set(storeIdx, count);
      el.classList.toggle(
        'is-winning',
        this.game.gameOver && count > this.game.pits[storeOf(s === 0 ? 1 : 0)]
      );
    }
  }

  protected updateTurnDisplay(): void {
    const seat = this.game.current;
    let text: string;
    if (this.game.gameOver) text = '—';
    else if (seat === this.mySeat) text = 'My turn';
    else if (this.humanSeats.has(seat)) text = 'Your turn';
    else text = "Bot's turn";
    this.hud?.set('turn', text);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  handleInput(_event: KeyboardEvent): void {}

  private onPitClick(pit: number): void {
    if (!this.awaitingHuman || this.game.current !== this.mySeat) return;
    const myPits = pitsOf(this.mySeat) as number[];
    if (!myPits.includes(pit) || this.game.pits[pit] === 0) return;
    this.playLocalMove({ pit });
  }

  // ---------------------------------------------------------------------------
  // Post-move hooks
  // ---------------------------------------------------------------------------

  protected onMoveCommitted(move: MancalaMove | null): void {
    if (move) playSound('move');
    if (this.game.gameOver) {
      if (this.game.winner === this.mySeat) {
        playSound('win');
        this.spawnWinParticles();
      } else if (this.game.winner !== null) {
        playSound('die');
      }
    }
  }

  private spawnWinParticles(): void {
    const storeEl = this.storeEls[this.mySeat];
    if (!this.fx || !storeEl) return;
    const rect = storeEl.getBoundingClientRect();
    this.fx.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
      count: 28,
      speed: 6,
      spread: Math.PI * 2,
      gravity: 0.22,
      duration: 1000,
      size: 7,
      colors: ['#84cc16', '#a3e635', '#65a30d', '#bef264', '#ffffff'],
    });
  }

  // ---------------------------------------------------------------------------
  // Game-over text
  // ---------------------------------------------------------------------------

  protected getGameOverTitle(): string {
    if (!this.game.gameOver) return '';
    if (this.game.winner === null) return t('draw');
    return this.game.winner === this.mySeat ? t('youWin') : t('youLose');
  }

  protected getGameOverContent(): string {
    const mine = this.game.pits[storeOf(this.mySeat)];
    const theirs = this.game.pits[storeOf(this.mySeat === 0 ? 1 : 0)];
    if (this.game.winner === null) {
      return `<p>${t('mancalaDraw', { mine: String(mine), theirs: String(theirs) })}</p>`;
    }
    if (this.game.winner === this.mySeat) {
      return `<p>${t('mancalaWin', { mine: String(mine), theirs: String(theirs) })}</p>`;
    }
    return `<p>${t('mancalaLose', { mine: String(mine), theirs: String(theirs) })}</p>`;
  }
}
