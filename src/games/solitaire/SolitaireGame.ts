import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { setupSettingsPanel } from '../../shared/ui/settingsPanel.js';
import { Stopwatch, formatClock } from '../../shared/ui/stopwatch.js';
import { playSound } from '../../shared/fx/sound.js';
import { ParticleSystem, celebrate } from '../../shared/fx/particles.js';
import { isRed, RANK_LABEL, SUIT_SYMBOL, SUITS } from '../../shared/cards/cards.js';
import type { Suit } from '../../shared/cards/cards.js';
import {
  PlacedCard,
  SolitaireState,
  Source,
  Dest,
  SUIT_INDEX,
  deal,
  drawFromStock,
  canPlaceOnFoundation,
  canPlaceOnTableau,
  applyMove,
  isWon,
  scoreMove,
} from './solitaire.js';

type Selection = { zone: 'waste' } | { zone: 'tableau'; col: number; cardIdx: number };

const CARD_RATIO = 1.4; // height / width
const GAP = 6; // px between slots
const PADDING = 12; // px board padding
const FD_RATIO = 0.18; // face-down visible fraction
const FU_RATIO = 0.28; // face-up visible fraction

/**
 * Klondike Solitaire: move all 52 cards to the four foundations (A→K per suit).
 * Click a card to select it, click a destination to place it. Click the stock to
 * draw; click it again when empty to recycle the waste. Per-move scoring with a
 * time bonus on winning.
 */
export class SolitaireGame extends GameEngine {
  private game: SolitaireState = deal();
  private selected: Selection | null = null;
  private moveCount = 0;
  /** How many cards the stock deals per click (1 = easy, 3 = classic hard). */
  private drawCount = 1;
  private cardW = 80;
  private cardH = 112;

  private readonly clock = new Stopwatch((s) => this.hud?.set('time', formatClock(s)));

  private boardEl: HTMLElement | null = null;
  private stockEl: HTMLElement | null = null;
  private wasteEl: HTMLElement | null = null;
  private foundEls: HTMLElement[] = [];
  private colEls: HTMLElement[] = [];
  private fx: ParticleSystem | null = null;

  constructor() {
    super({ storageKey: 'solitaire', leaderboardId: 'solitaire' });
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'moves', icon: 'arrows-up-down-left-right', label: t('hudMoves') },
      { key: 'time', icon: 'clock', label: t('hudTime') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);
    setupSettingsPanel([
      {
        id: 'draw',
        label: t('solDrawLabel'),
        value: String(this.drawCount),
        choices: [
          { label: t('solDraw1'), value: '1' },
          { label: t('solDraw3'), value: '3' },
        ],
        onChange: (v) => {
          this.drawCount = Number(v);
          this.applyLeaderboardVariant();
          this.reset();
        },
      },
    ]);
    this.applyLeaderboardVariant();

    this.buildDOM();
    this.boardEl?.addEventListener('click', (e) => {
      if (!this.state.isRunning || this.state.isGameOver) return;
      this.handleClick(e.target as HTMLElement);
    });
  }

  private applyLeaderboardVariant(): void {
    const label = this.drawCount === 3 ? t('solDraw3') : t('solDraw1');
    this.setLeaderboardVariant(String(this.drawCount), label);
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.game = deal();
    this.selected = null;
    this.moveCount = 0;
    this.clock.reset();
    this.clock.start();
    this.resetState();
    this.state.isRunning = true;
    this.state.isGameOver = false;
    this.state.isPaused = false;
    this.updateCardSize();
    this.hud?.set('moves', 0);
    this.hud?.set('time', formatClock(0));
    this.hud?.set('high', this.scoreManager.getHighScore());
    this.renderState();
  }

  stop(): void {
    this.clock.stop();
    super.stop();
  }

  reset(): void {
    this.clock.reset();
    this.game = deal();
    this.selected = null;
    this.moveCount = 0;
    this.resetState();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.start();
  }

  update(): void {}
  render(): void {}
  handleInput(_e: KeyboardEvent): void {
    // Escape to deselect
    if (_e.key === 'Escape' && this.selected) {
      this.selected = null;
      this.renderState();
    }
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): void {
    if (!this.boardEl) return;
    this.boardEl.innerHTML = '';

    // Top row: stock | waste | spacer | F♠ | F♥ | F♦ | F♣
    const topRow = document.createElement('div');
    topRow.className = 'sol-top';

    this.stockEl = document.createElement('div');
    this.stockEl.className = 'sol-slot sol-stock';
    this.stockEl.id = 'sol-stock';
    topRow.appendChild(this.stockEl);

    this.wasteEl = document.createElement('div');
    this.wasteEl.className = 'sol-slot sol-waste';
    this.wasteEl.id = 'sol-waste';
    topRow.appendChild(this.wasteEl);

    const spacer = document.createElement('div');
    spacer.className = 'sol-slot sol-spacer';
    topRow.appendChild(spacer);

    this.foundEls = [];
    for (const suit of SUITS as readonly Suit[]) {
      const el = document.createElement('div');
      el.className = 'sol-slot sol-foundation';
      el.dataset.suit = suit;
      topRow.appendChild(el);
      this.foundEls.push(el);
    }

    this.boardEl.appendChild(topRow);

    // Tableau: 7 columns
    const tab = document.createElement('div');
    tab.className = 'sol-tableau';

    this.colEls = [];
    for (let i = 0; i < 7; i++) {
      const col = document.createElement('div');
      col.className = 'sol-col';
      col.dataset.col = String(i);
      tab.appendChild(col);
      this.colEls.push(col);
    }
    this.boardEl.appendChild(tab);
  }

  private updateCardSize(): void {
    const board = this.boardEl;
    if (!board) return;
    const w = board.clientWidth || 560;
    this.cardW = Math.max(44, Math.floor((w - 2 * PADDING - 6 * GAP) / 7));
    this.cardH = Math.floor(this.cardW * CARD_RATIO);
    board.style.setProperty('--sol-cw', `${this.cardW}px`);
    board.style.setProperty('--sol-ch', `${this.cardH}px`);
  }

  private get fdOff(): number {
    return Math.floor(this.cardH * FD_RATIO);
  }
  private get fuOff(): number {
    return Math.floor(this.cardH * FU_RATIO);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  protected renderState(): void {
    this.renderStock();
    this.renderWaste();
    this.renderFoundations();
    this.renderTableau();
  }

  private renderStock(): void {
    const el = this.stockEl;
    if (!el) return;
    el.innerHTML = '';
    if (this.game.stock.length > 0) {
      el.appendChild(this.makeBackCard());
      const cnt = document.createElement('span');
      cnt.className = 'sol-stock-count';
      cnt.textContent = String(this.game.stock.length);
      el.appendChild(cnt);
    } else {
      const lbl = document.createElement('div');
      lbl.className = 'sol-recycle';
      lbl.textContent = '↺';
      el.appendChild(lbl);
    }
  }

  private renderWaste(): void {
    const el = this.wasteEl;
    if (!el) return;
    el.innerHTML = '';
    const top = this.game.waste[this.game.waste.length - 1];
    if (top) {
      const cardEl = this.makeCardEl(top);
      if (this.selected?.zone === 'waste') cardEl.classList.add('is-selected');
      el.appendChild(cardEl);
    }
  }

  private renderFoundations(): void {
    for (let i = 0; i < 4; i++) {
      const el = this.foundEls[i];
      if (!el) continue;
      el.innerHTML = '';
      const pile = this.game.foundations[i];
      if (pile.length > 0) {
        el.appendChild(this.makeCardEl(pile[pile.length - 1]));
      } else {
        const lbl = document.createElement('div');
        lbl.className = 'sol-suit-label';
        lbl.textContent = SUIT_SYMBOL[SUITS[i] as Suit];
        el.appendChild(lbl);
      }
    }
  }

  private renderTableau(): void {
    for (let c = 0; c < 7; c++) {
      const colEl = this.colEls[c];
      if (!colEl) continue;
      colEl.innerHTML = '';
      const cards = this.game.tableau[c];

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const cardEl = card.faceUp ? this.makeCardEl(card) : this.makeBackCard();
        cardEl.dataset.col = String(c);
        cardEl.dataset.cardIdx = String(i);

        if (
          card.faceUp &&
          this.selected?.zone === 'tableau' &&
          this.selected.col === c &&
          i >= this.selected.cardIdx
        ) {
          cardEl.classList.add('is-selected');
        }

        if (i < cards.length - 1) {
          const off = card.faceUp ? this.fuOff : this.fdOff;
          cardEl.style.marginBottom = `${off - this.cardH}px`;
        }
        colEl.appendChild(cardEl);
      }
    }
  }

  private makeCardEl(card: PlacedCard): HTMLElement {
    const el = document.createElement('div');
    el.className = `sol-card pc-card is-face-up ${isRed(card.suit) ? 'is-red' : 'is-black'}`;
    el.dataset.suit = card.suit;
    el.dataset.rank = String(card.rank);
    el.style.width = `${this.cardW}px`;
    el.style.height = `${this.cardH}px`;

    const label = RANK_LABEL[card.rank] + SUIT_SYMBOL[card.suit];
    const tl = document.createElement('div');
    tl.className = 'sol-card-tl pc-corner';
    tl.textContent = label;

    const center = document.createElement('div');
    center.className = 'sol-card-center pc-pip';
    center.textContent = SUIT_SYMBOL[card.suit];

    const br = document.createElement('div');
    br.className = 'sol-card-br pc-corner pc-corner--br';
    br.textContent = label;

    el.appendChild(tl);
    el.appendChild(center);
    el.appendChild(br);
    return el;
  }

  private makeBackCard(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'sol-card pc-card pc-back is-face-down';
    el.style.width = `${this.cardW}px`;
    el.style.height = `${this.cardH}px`;
    return el;
  }

  // ---------------------------------------------------------------------------
  // Click handling
  // ---------------------------------------------------------------------------

  private handleClick(target: HTMLElement): void {
    if (target.closest('#sol-stock')) {
      this.onStockClick();
      return;
    }

    const cardEl = target.closest<HTMLElement>('.sol-card');
    const inWaste = !!target.closest('#sol-waste');
    const inFound = target.closest<HTMLElement>('.sol-foundation');
    const inCol = target.closest<HTMLElement>('.sol-col');

    if (inWaste) {
      if (cardEl && this.game.waste.length > 0) {
        this.selected = this.selected?.zone === 'waste' ? null : { zone: 'waste' };
        this.renderState();
      }
      return;
    }

    if (inFound) {
      if (this.selected) this.tryPlaceOnFoundation();
      return;
    }

    if (inCol) {
      const col = Number(inCol.dataset.col);
      if (!cardEl) {
        if (this.selected) this.tryPlaceOnTableau(col);
        return;
      }
      const cardIdx = Number(cardEl.dataset.cardIdx);
      this.onTableauCardClick(col, cardIdx);
      return;
    }

    if (this.selected) {
      this.selected = null;
      this.renderState();
    }
  }

  private onStockClick(): void {
    this.selected = null;
    this.game = drawFromStock(this.game, this.drawCount);
    playSound('move');
    this.renderState();
  }

  private onTableauCardClick(col: number, cardIdx: number): void {
    const card = this.game.tableau[col]?.[cardIdx];
    if (!card) return;

    if (!card.faceUp) {
      this.selected = null;
      this.renderState();
      return;
    }

    // Already selected this card → deselect
    if (
      this.selected?.zone === 'tableau' &&
      this.selected.col === col &&
      this.selected.cardIdx === cardIdx
    ) {
      this.selected = null;
      this.renderState();
      return;
    }

    // Something selected → try to move it here
    if (this.selected !== null) {
      const moved = this.tryPlaceOnTableau(col);
      if (!moved) {
        this.selected = { zone: 'tableau', col, cardIdx };
        this.renderState();
      }
      return;
    }

    this.selected = { zone: 'tableau', col, cardIdx };
    this.renderState();
  }

  // ---------------------------------------------------------------------------
  // Move execution
  // ---------------------------------------------------------------------------

  private tryPlaceOnFoundation(): boolean {
    if (!this.selected) return false;
    const cards = this.getSourceCards();
    if (cards.length !== 1) return false;
    const card = cards[0];
    const pile = this.game.foundations[SUIT_INDEX[card.suit]];
    if (!canPlaceOnFoundation(card, pile)) return false;
    const dest: Dest = { zone: 'foundation', suit: card.suit };
    this.executeMove(this.selected, dest);
    return true;
  }

  private tryPlaceOnTableau(col: number): boolean {
    if (!this.selected) return false;
    const cards = this.getSourceCards();
    if (!cards.length) return false;
    if (!canPlaceOnTableau(cards[0], this.game.tableau[col])) return false;
    const dest: Dest = { zone: 'tableau', col };
    this.executeMove(this.selected, dest);
    return true;
  }

  private getSourceCards(): PlacedCard[] {
    if (!this.selected) return [];
    if (this.selected.zone === 'waste') {
      const top = this.game.waste[this.game.waste.length - 1];
      return top ? [top] : [];
    }
    return this.game.tableau[this.selected.col].slice(this.selected.cardIdx);
  }

  private executeMove(source: Source, dest: Dest): void {
    // Bonus +5 when the move exposes a face-down tableau card
    let delta = scoreMove(source, dest);
    if (source.zone === 'tableau') {
      const { col, cardIdx } = source;
      if (cardIdx > 0 && !this.game.tableau[col][cardIdx - 1].faceUp) delta += 5;
    }

    this.game = applyMove(this.game, source, dest);
    this.selected = null;
    this.moveCount++;
    this.hud?.set('moves', this.moveCount);
    this.addScore(delta);
    playSound('move');

    if (isWon(this.game)) {
      this.clock.stop();
      const bonus = Math.max(0, Math.floor(10000 / (this.clock.seconds + 10)));
      this.addScore(bonus);
      playSound('win');
      this.spawnWinParticles();
      this.gameOver();
      return;
    }

    this.renderState();
  }

  // ---------------------------------------------------------------------------
  // Win effect & overlay
  // ---------------------------------------------------------------------------

  private spawnWinParticles(): void {
    // A burst from each foundation pile rather than one central pop.
    for (const el of this.foundEls) {
      celebrate(this.fx, el, { count: 18, gravity: 0.2, duration: 900, size: 7 });
    }
  }

  protected getGameOverTitle(): string {
    return t('cleared');
  }

  protected getGameOverContent(): string {
    const time = formatClock(this.clock.seconds);
    return `<p>${t('solitaireWin', { moves: String(this.moveCount), time, score: String(this.state.score) })}</p>`;
  }
}
