import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { playSound } from '../../shared/fx/sound.js';
import { ParticleSystem, celebrate } from '../../shared/fx/particles.js';
import { setupSettingsPanel } from '../../shared/ui/settingsPanel.js';
import { isRed, RANK_LABEL, SUIT_SYMBOL } from '../../shared/cards/cards.js';
import type { Card } from '../../shared/cards/cards.js';
import {
  BJState,
  BJResult,
  initialState,
  startDeal,
  hit,
  stand,
  doubleDown,
  resolveDealer,
  handValue,
  isBust,
  MIN_BET,
  MAX_BET,
  BET_STEP,
  STARTING_CHIPS,
} from './blackjack.js';

export class BlackjackGame extends GameEngine {
  private startChips = STARTING_CHIPS;
  private bj: BJState = initialState();
  private boardEl: HTMLElement | null = null;
  private dealerEl: HTMLElement | null = null;
  private playerEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private actionsEl: HTMLElement | null = null;
  private betRowEl: HTMLElement | null = null;
  private betValEl: HTMLElement | null = null;
  private fx: ParticleSystem | null = null;

  constructor() {
    super({ storageKey: 'blackjack', leaderboardId: 'blackjack' });
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.buildDOM();
    this.hud = setupHud([
      { key: 'chips', icon: 'coins', label: t('bjChips') },
      { key: 'bet', icon: 'dollar-sign', label: t('bjBet') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);
    this.hud.set('high', this.scoreManager.getHighScore());
    setupSettingsPanel([
      {
        id: 'chips',
        label: t('bjStartChips'),
        value: String(this.startChips),
        choices: [
          { label: '100', value: '100' },
          { label: '200', value: '200' },
          { label: '500', value: '500' },
        ],
        onChange: (v) => {
          this.startChips = Number(v);
          this.setLeaderboardVariant(String(this.startChips), String(this.startChips));
          this.reset();
        },
      },
    ]);
    this.setLeaderboardVariant(String(this.startChips), String(this.startChips));
    this.renderState();
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.bj = initialState(this.startChips);
    this.resetState();
    this.state.isRunning = true;
    this.state.isGameOver = false;
    this.hud?.set('chips', this.bj.chips);
    this.hud?.set('bet', this.bj.bet);
    this.hud?.set('high', this.scoreManager.getHighScore());
    this.renderState();
  }

  reset(): void {
    this.bj = initialState(this.startChips);
    this.resetState();
    this.renderState();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.start();
  }

  update(): void {}
  render(): void {}
  handleInput(_e: KeyboardEvent): void {}

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): void {
    if (!this.boardEl) return;
    this.boardEl.innerHTML = `
      <div class="bj-area bj-dealer-area">
        <div class="bj-area-label" id="bj-dealer-label"></div>
        <div class="bj-hand" id="bj-dealer-hand"></div>
      </div>
      <div class="bj-status" id="bj-status"></div>
      <div class="bj-area bj-player-area">
        <div class="bj-area-label" id="bj-player-label"></div>
        <div class="bj-hand" id="bj-player-hand"></div>
      </div>
      <div class="bj-actions" id="bj-actions">
        <button class="bj-btn" id="bj-hit" data-i18n="bjHit"></button>
        <button class="bj-btn" id="bj-stand" data-i18n="bjStand"></button>
        <button class="bj-btn" id="bj-double" data-i18n="bjDouble"></button>
      </div>
      <div class="bj-bet-row" id="bj-bet-row">
        <button class="bj-btn bj-btn-sm" id="bj-bet-down">−</button>
        <span class="bj-bet-label"><span id="bj-bet-val">10</span></span>
        <button class="bj-btn bj-btn-sm" id="bj-bet-up">+</button>
        <button class="bj-btn bj-btn-deal" id="bj-deal" data-i18n="bjDeal"></button>
      </div>`;

    this.dealerEl = document.getElementById('bj-dealer-hand');
    this.playerEl = document.getElementById('bj-player-hand');
    this.statusEl = document.getElementById('bj-status');
    this.actionsEl = document.getElementById('bj-actions');
    this.betRowEl = document.getElementById('bj-bet-row');
    this.betValEl = document.getElementById('bj-bet-val');

    document.getElementById('bj-hit')?.addEventListener('click', () => this.onHit());
    document.getElementById('bj-stand')?.addEventListener('click', () => this.onStand());
    document.getElementById('bj-double')?.addEventListener('click', () => this.onDouble());
    document.getElementById('bj-deal')?.addEventListener('click', () => this.onDeal());
    document
      .getElementById('bj-bet-down')
      ?.addEventListener('click', () => this.adjustBet(-BET_STEP));
    document.getElementById('bj-bet-up')?.addEventListener('click', () => this.adjustBet(BET_STEP));
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  protected renderState(): void {
    this.renderDealer();
    this.renderPlayer();
    this.renderStatus();
    this.renderControls();
  }

  private renderDealer(): void {
    if (!this.dealerEl) return;
    const { dealerHand, phase } = this.bj;
    const showHidden = phase === 'play';
    const label = document.getElementById('bj-dealer-label');
    if (label) {
      const val = showHidden ? '?' : dealerHand.length > 0 ? String(handValue(dealerHand)) : '';
      label.textContent = dealerHand.length > 0 ? `${t('bjDealer')} ${val}` : t('bjDealer');
    }
    this.dealerEl.innerHTML = dealerHand
      .map((c, i) =>
        i === 1 && showHidden
          ? this.makeBackCardHTML()
          : this.makeCardHTML(c, i === dealerHand.length - 1)
      )
      .join('');
  }

  private renderPlayer(): void {
    if (!this.playerEl) return;
    const { playerHand } = this.bj;
    const label = document.getElementById('bj-player-label');
    if (label) {
      const val = playerHand.length > 0 ? String(handValue(playerHand)) : '';
      label.textContent = playerHand.length > 0 ? `${t('bjYou')} ${val}` : t('bjYou');
    }
    this.playerEl.innerHTML = playerHand
      .map((c, i) => this.makeCardHTML(c, i === playerHand.length - 1))
      .join('');
  }

  private renderStatus(): void {
    if (!this.statusEl) return;
    const { phase, result } = this.bj;
    if (phase === 'bet') {
      this.statusEl.textContent = t('bjPlaceBet');
      this.statusEl.className = 'bj-status';
    } else if (phase === 'play') {
      this.statusEl.textContent = t('bjYourTurn');
      this.statusEl.className = 'bj-status';
    } else if (phase === 'dealer') {
      this.statusEl.textContent = t('bjDealerTurn');
      this.statusEl.className = 'bj-status';
    } else if (phase === 'result' && result) {
      const [text, cls] = this.resultDisplay(result);
      this.statusEl.textContent = text;
      this.statusEl.className = `bj-status bj-status--${cls}`;
    }
  }

  private resultDisplay(result: BJResult): [string, string] {
    switch (result) {
      case 'blackjack':
        return [t('bjBlackjack'), 'win'];
      case 'win':
        return [t('bjWin'), 'win'];
      case 'push':
        return [t('bjPush'), 'push'];
      case 'lose':
        return [t('bjLose'), 'lose'];
      case 'bust':
        return [t('bjBust'), 'lose'];
    }
  }

  private renderControls(): void {
    const { phase, bet, chips } = this.bj;
    const inPlay = phase === 'play';
    const inBet = phase === 'bet' || phase === 'result';
    const inDealer = phase === 'dealer';

    if (this.actionsEl) this.actionsEl.style.display = inPlay ? 'flex' : 'none';
    if (this.betRowEl) this.betRowEl.style.display = inBet ? 'flex' : 'none';
    if (inDealer && this.actionsEl) this.actionsEl.style.display = 'none';

    const doubleBtn = document.getElementById('bj-double') as HTMLButtonElement | null;
    if (doubleBtn) doubleBtn.disabled = inPlay && (this.bj.playerHand.length !== 2 || chips < bet);

    if (this.betValEl) this.betValEl.textContent = String(bet);
    this.hud?.set('chips', chips);
    this.hud?.set('bet', bet);
  }

  private makeCardHTML(card: Card, isNew = false): string {
    const red = isRed(card.suit);
    const label = RANK_LABEL[card.rank] + SUIT_SYMBOL[card.suit];
    return `<div class="bj-card pc-card ${red ? 'is-red' : 'is-black'}${isNew ? ' is-dealt' : ''}">
      <div class="bj-card-tl pc-corner">${label}</div>
      <div class="bj-card-center pc-pip">${SUIT_SYMBOL[card.suit]}</div>
      <div class="bj-card-br pc-corner pc-corner--br">${label}</div>
    </div>`;
  }

  private makeBackCardHTML(): string {
    return `<div class="bj-card pc-card pc-back"></div>`;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  private adjustBet(delta: number): void {
    const newBet = Math.max(
      MIN_BET,
      Math.min(MAX_BET, Math.min(this.bj.chips, this.bj.bet + delta))
    );
    this.bj = { ...this.bj, bet: newBet };
    if (this.betValEl) this.betValEl.textContent = String(newBet);
    this.hud?.set('bet', newBet);
  }

  private onDeal(): void {
    if (this.bj.chips < this.bj.bet) return;
    this.bj = startDeal(this.bj);
    playSound('move');
    this.renderState();
    if (this.bj.phase === 'dealer') {
      setTimeout(() => this.runDealer(), 600);
    }
  }

  private onHit(): void {
    if (this.bj.phase !== 'play') return;
    this.bj = hit(this.bj);
    playSound('move');
    this.renderState();
    if (isBust(this.bj.playerHand)) {
      setTimeout(() => this.runDealer(), 400);
    }
  }

  private onStand(): void {
    if (this.bj.phase !== 'play') return;
    this.bj = stand(this.bj);
    this.renderState();
    setTimeout(() => this.runDealer(), 400);
  }

  private onDouble(): void {
    if (this.bj.phase !== 'play') return;
    if (this.bj.playerHand.length !== 2) return;
    this.bj = doubleDown(this.bj);
    playSound('move');
    this.renderState();
    setTimeout(() => this.runDealer(), 400);
  }

  private runDealer(): void {
    this.bj = resolveDealer(this.bj);
    this.renderState();
    const result = this.bj.result;
    if (!result) return;

    if (result === 'blackjack' || result === 'win') {
      playSound('win');
      celebrate(this.fx, this.playerEl ?? this.boardEl, { count: 20 });
    } else if (result === 'bust' || result === 'lose') playSound('die');
    else playSound('bounce');

    if (this.bj.chips > this.state.score) {
      this.state.score = this.bj.chips;
    }

    if (this.bj.chips === 0) {
      setTimeout(() => {
        this.state.score = 0;
        this.gameOver();
      }, 1200);
    }
  }

  protected getGameOverTitle(): string {
    return t('bjBankrupt');
  }

  protected getGameOverContent(): string {
    return `<p>${t('bjBankruptMsg')}</p>`;
  }

  protected updateScoreDisplay(): void {
    this.hud?.set('chips', this.bj.chips);
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  protected buildScoreEntry(username: string) {
    return { username, score: this.bj.chips };
  }
}
