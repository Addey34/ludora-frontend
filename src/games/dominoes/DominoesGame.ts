import { playSound } from '../../shared/fx/sound.js';
import { t } from '../../shared/i18n/i18n.js';
import { BoardGame } from '../../shared/turn/BoardGame.js';
import type { TurnRules } from '../../shared/turn/turnGame.js';
import { dieFaceHtml } from '../../shared/ui/dicePips.js';
import { setupHud } from '../../shared/ui/hud.js';
import { showToast } from '../../shared/ui/toast.js';
import { dominoesRules, type DominoesMove, type DominoesState, type Tile } from './dominoes.js';

export class DominoesGame extends BoardGame<DominoesState, DominoesMove> {
  private chainEl: HTMLElement | null = null;
  private handEl: HTMLElement | null = null;
  private opponentEl: HTMLElement | null = null;
  private actionBtn: HTMLButtonElement | null = null;
  /** Hand tile awaiting an end choice (it fits both chain ends). */
  private pendingTile: Tile | null = null;

  constructor() {
    super({ storageKey: 'dominoes-scores' });
  }

  protected get rules(): TurnRules<DominoesState, DominoesMove> {
    return dominoesRules;
  }

  initialize(): void {
    this.chainEl = document.getElementById('chain');
    this.handEl = document.getElementById('hand');
    this.opponentEl = document.getElementById('opponentHand');
    this.actionBtn = document.getElementById('drawBtn') as HTMLButtonElement | null;
    this.actionBtn?.addEventListener('click', () => this.playAction());
    this.hud = setupHud([
      { key: 'turn', icon: 'circle-dot', label: t('hudTurn') },
      { key: 'mine', icon: 'user', label: t('hudMyTiles') },
      { key: 'bot', icon: 'users', label: t('hudBotTiles') },
      { key: 'pile', icon: 'layer-group', label: t('hudBoneyard') },
    ]);
    this.updateTurnDisplay();
    this.renderState();
  }

  handleInput(_event: KeyboardEvent): void {}

  protected moveEquals(a: DominoesMove, b: DominoesMove): boolean {
    if (a.type !== b.type) return false;
    if (a.type !== 'place' || b.type !== 'place') return true;
    return a.tile[0] === b.tile[0] && a.tile[1] === b.tile[1] && a.end === b.end;
  }

  protected decideBotMove(legalMoves: DominoesMove[]): DominoesMove {
    // Dump the heaviest playable tile to keep the blocked-game pip count low.
    let best: DominoesMove | null = null;
    let bestPips = -1;
    for (const move of legalMoves) {
      if (move.type !== 'place') continue;
      const pips = move.tile[0] + move.tile[1];
      if (pips > bestPips) {
        best = move;
        bestPips = pips;
      }
    }
    return best ?? legalMoves[0];
  }

  protected isRoundOver(): boolean {
    return this.game.finished;
  }

  protected onMoveCommitted(move: DominoesMove | null): void {
    if (move?.type === 'place') playSound('move');
    if (this.game.blocked) showToast(t('dominoBlocked'), 'info');
  }

  protected onRoundReset(): void {
    this.pendingTile = null;
  }

  protected getGameOverTitle(): string {
    if (this.game.winner === null) return t('draw');
    return this.game.winner === this.mySeat ? t('youWin') : t('youLose');
  }

  protected renderState(): void {
    const myTurn = this.awaitingHuman && this.game.current === this.mySeat;
    if (!myTurn) this.pendingTile = null;
    const legal = this.rules.legalMoves(this.game);
    this.renderChain(myTurn);
    this.renderHand(myTurn, legal);
    this.renderOpponent();
    this.renderAction(myTurn, legal);
    this.hud?.set('mine', String(this.game.hands[this.mySeat]?.length ?? 0));
    this.hud?.set('bot', String(this.game.hands[this.mySeat === 0 ? 1 : 0]?.length ?? 0));
    this.hud?.set('pile', String(this.game.boneyard.length));
  }

  private tileHtml(tile: Tile): string {
    return (
      `<span class="dominoes-half">${dieFaceHtml(tile[0])}</span>` +
      `<span class="dominoes-half">${dieFaceHtml(tile[1])}</span>`
    );
  }

  private renderChain(myTurn: boolean): void {
    if (!this.chainEl) return;
    this.chainEl.replaceChildren();
    if (myTurn && this.pendingTile) this.chainEl.append(this.endButton('left'));
    for (const tile of this.game.chain) {
      const el = document.createElement('div');
      el.className = 'dominoes-tile';
      el.classList.toggle('is-double', tile[0] === tile[1]);
      el.innerHTML = this.tileHtml(tile);
      this.chainEl.append(el);
    }
    if (myTurn && this.pendingTile) this.chainEl.append(this.endButton('right'));
  }

  private endButton(end: 'left' | 'right'): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dominoes-end';
    btn.textContent = end === 'left' ? '◀' : '▶';
    btn.setAttribute('aria-label', t(end === 'left' ? 'dominoPlaceLeft' : 'dominoPlaceRight'));
    btn.addEventListener('click', () => {
      const tile = this.pendingTile;
      if (!tile) return;
      this.pendingTile = null;
      this.playLocalMove({ type: 'place', tile, end });
    });
    return btn;
  }

  private renderHand(myTurn: boolean, legal: DominoesMove[]): void {
    if (!this.handEl) return;
    this.handEl.replaceChildren();
    for (const tile of this.game.hands[this.mySeat] ?? []) {
      const placements = legal.filter(
        (move): move is DominoesMove & { type: 'place' } =>
          move.type === 'place' && move.tile[0] === tile[0] && move.tile[1] === tile[1]
      );
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dominoes-tile is-hand';
      btn.classList.toggle('is-double', tile[0] === tile[1]);
      btn.classList.toggle('is-selected', this.pendingTile === tile);
      btn.innerHTML = this.tileHtml(tile);
      btn.disabled = !myTurn || placements.length === 0;
      btn.addEventListener('click', () => {
        if (placements.length === 1) {
          this.pendingTile = null;
          this.playLocalMove(placements[0]);
        } else {
          this.pendingTile = this.pendingTile === tile ? null : tile;
          this.renderState();
        }
      });
      this.handEl.append(btn);
    }
  }

  private renderOpponent(): void {
    if (!this.opponentEl) return;
    this.opponentEl.replaceChildren();
    const count = this.game.hands[this.mySeat === 0 ? 1 : 0]?.length ?? 0;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'dominoes-tile is-back';
      this.opponentEl.append(el);
    }
  }

  private renderAction(myTurn: boolean, legal: DominoesMove[]): void {
    if (!this.actionBtn) return;
    const action = legal.find((move) => move.type !== 'place');
    const show = myTurn && action !== undefined && legal.every((move) => move.type !== 'place');
    this.actionBtn.hidden = !show;
    if (show && action) {
      this.actionBtn.textContent = t(action.type === 'draw' ? 'dominoDrawTile' : 'dominoPass');
    }
  }

  private playAction(): void {
    if (!this.awaitingHuman || this.game.current !== this.mySeat) return;
    const legal = this.rules.legalMoves(this.game);
    const action = legal.find((move) => move.type !== 'place');
    if (action && legal.every((move) => move.type !== 'place')) this.playLocalMove(action);
  }
}
