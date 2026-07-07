import { BoardGame } from '../../shared/turn/BoardGame.js';
import { MatchMessage } from '../../shared/net/match.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import {
  setupSettingsPanel,
  SettingsPanelHandle,
  SettingsField,
} from '../../shared/ui/settingsPanel.js';
import { playSound } from '../../shared/fx/sound.js';
import { ParticleSystem, celebrate } from '../../shared/fx/particles.js';
import { dieFaceHtml } from '../../shared/ui/dicePips.js';
import {
  Die,
  ScoreKey,
  ALL_KEYS,
  LOWER_KEYS,
  CATEGORY_META,
  rollDie,
  scoreFor,
  upperTotal,
  upperBonus,
} from './yahtzee.js';
import {
  YState,
  YMove,
  YahtzeeRules,
  ROLLS_PER_TURN,
  applyRoll,
  totalFor,
} from './yahtzeeRules.js';
import { chooseHolds, decideCategory } from './yahtzeeBot.js';

const MAX_PLAYERS = 4;
const SEAT_LABELS = ['P1', 'P2', 'P3', 'P4'];
/** Guest → host: "roll my unheld dice" (held mask carried). Clear of BoardGame's 1–7. */
const OP_ROLL_REQ = 20;
const BOT_THINK = 600;
const BOT_ROLL_DELAY = 550;

/**
 * Yahtzee for 2–4 players on the shared {@link BoardGame} turn engine: play a
 * bot offline or up to four players online (host-authoritative relay). Rolling is
 * a phase (the host owns the randomness); the only relayed *move* is scoring a
 * category, which rides the standard move channel for free.
 */
export class YahtzeeGame extends BoardGame<YState, YMove> {
  protected turnSeconds = 45;
  protected endDelay = 700;

  private boardEl: HTMLElement | null = null;
  private diceEl: HTMLElement | null = null;
  private cardEl: HTMLElement | null = null;
  private settings: SettingsPanelHandle | null = null;
  private fx: ParticleSystem | null = null;

  /** Local UI: which dice the local player is keeping between rolls. */
  private held: boolean[] = [false, false, false, false, false];
  /** Dice currently mid-tumble (drives the roll animation). */
  private rolling: boolean[] = [false, false, false, false, false];
  private offlinePlayers = 2;
  private rulesCache: YahtzeeRules | null = null;

  constructor() {
    super({ storageKey: 'yahtzee' });
  }

  private effectivePlayers(): number {
    return this.mode === 'net' && this.net ? this.net.players : this.offlinePlayers;
  }

  protected get rules(): YahtzeeRules {
    const players = this.effectivePlayers();
    if (!this.rulesCache || this.rulesCache.seats !== players) {
      this.rulesCache = new YahtzeeRules(players);
    }
    return this.rulesCache;
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'turn', icon: 'circle-dot', label: t('hudTurn') },
      { key: 'rolls', icon: 'dice', label: t('yhRollsLeft') },
      { key: 'p1', icon: 'circle', label: 'P1' },
      { key: 'p2', icon: 'circle', label: 'P2' },
      { key: 'p3', icon: 'circle', label: 'P3' },
      { key: 'p4', icon: 'circle', label: 'P4' },
    ]);
    this.buildDOM();

    const playersField: SettingsField = {
      id: 'players',
      label: t('players'),
      value: String(this.offlinePlayers),
      choices: [
        { label: '2', value: '2' },
        { label: '3', value: '3' },
        { label: '4', value: '4' },
      ],
      onChange: (v) => {
        this.offlinePlayers = Number(v);
        this.reset();
      },
    };
    this.settings = setupSettingsPanel([playersField]);

    this.setupVersus(MAX_PLAYERS);
    this.game = this.freshGame();
    this.updateTurnDisplay();
    this.renderState();
  }

  protected onNetActiveChanged(active: boolean): void {
    this.settings?.setDisabled(active);
  }

  moveEquals(a: YMove, b: YMove): boolean {
    return a.category === b.category;
  }

  decideBotMove(legalMoves: YMove[]): YMove {
    return decideCategory(this.game, legalMoves);
  }

  protected isRoundOver(): boolean {
    return this.game.cards.every((c) => ALL_KEYS.every((k) => k in c));
  }

  protected onRoundReset(): void {
    this.held = [false, false, false, false, false];
  }

  // ---------------------------------------------------------------------------
  // Turn flow (host / solo authoritative; guests only render + relay input)
  // ---------------------------------------------------------------------------

  protected async runTurn(): Promise<void> {
    const gen = this.gen;
    if (!this.state.isRunning) return;
    this.awaitingHuman = false;
    this.pendingSeat = null;
    this.held = [false, false, false, false, false];
    this.updateTurnDisplay();
    this.renderState();

    const seat = this.game.seat;
    if (seat === this.mySeat) {
      // Local interactive turn: the roll button and category clicks drive it.
      this.awaitingHuman = true;
      this.renderState();
    } else if (this.isRemoteHuman(seat)) {
      // Host waits on a remote player (their rolls arrive as OP_ROLL_REQ, their
      // score as OP_MOVE). A countdown auto-scores if they go idle.
      this.pendingSeat = seat;
      this.startCountdown(() => this.autoResolve(seat));
    } else {
      await this.botTurn(gen, seat);
    }
  }

  private async botTurn(gen: number, seat: number): Promise<void> {
    await this.delay(BOT_THINK);
    if (gen !== this.gen || !this.state.isRunning) return;
    while (this.game.rollsLeft > 0) {
      const held = this.game.rolledThisTurn ? chooseHolds(this.game.dice) : [];
      this.applyRollLocal(held);
      await this.delay(BOT_ROLL_DELAY);
      if (gen !== this.gen || !this.state.isRunning) return;
    }
    const move = decideCategory(this.game, this.rules.legalMoves(this.game));
    void seat;
    this.commitMove(move);
  }

  /** Host auto-scores an idle remote seat with a bot pick using its current dice. */
  private autoResolve(seat: number): void {
    if (this.pendingSeat !== seat) return;
    // Ensure at least one roll happened so a category can be scored sensibly.
    if (!this.game.rolledThisTurn) this.applyRollLocal([]);
    this.resolvePending(decideCategory(this.game, this.rules.legalMoves(this.game)));
  }

  /** Rerolls the unheld dice on the authoritative state and broadcasts (host/solo). */
  private applyRollLocal(held: boolean[]): void {
    const dice = this.rollWithHolds(this.game.dice, held);
    this.rolling = this.game.dice.map((_, i) => !held[i]);
    this.game = applyRoll(this.game, dice);
    playSound('dice');
    this.broadcastState();
    this.renderState();
    window.setTimeout(() => {
      this.rolling = [false, false, false, false, false];
      this.renderDice();
    }, 600);
  }

  private rollWithHolds(dice: Die[], held: boolean[]): Die[] {
    return dice.map((d, i) => (held[i] ? d : rollDie())) as Die[];
  }

  // ---------------------------------------------------------------------------
  // Local input
  // ---------------------------------------------------------------------------

  private onRollClick(): void {
    if (this.game.seat !== this.mySeat || this.game.rollsLeft <= 0) return;
    if (!this.state.isRunning) return;
    if (this.isGuest()) {
      this.net?.send(OP_ROLL_REQ, { seat: this.mySeat, held: this.held });
      return;
    }
    this.applyRollLocal(this.held);
  }

  private onDiceAreaClick(target: EventTarget | null): void {
    const die = (target as HTMLElement | null)?.closest<HTMLElement>('.yh-die');
    if (!die || !this.game.rolledThisTurn) {
      this.onRollClick();
      return;
    }
    this.onDieClick(Number(die.dataset.idx));
  }

  private onDieClick(idx: number): void {
    if (this.game.seat !== this.mySeat || !this.game.rolledThisTurn) return;
    this.held[idx] = !this.held[idx];
    this.renderDice();
  }

  private onCategoryClick(category: ScoreKey): void {
    if (this.game.seat !== this.mySeat || !this.game.rolledThisTurn) return;
    if (category in this.game.cards[this.mySeat]) return;
    this.awaitingHuman = true;
    this.playLocalMove({ category });
  }

  /** Host: a guest asked to roll — validate, roll authoritatively, broadcast. */
  protected handleGameMessage(msg: MatchMessage): void {
    if (msg.opCode !== OP_ROLL_REQ) return;
    const d = msg.data as { seat?: number; held?: boolean[] } | null;
    if (!d || d.seat !== this.game.seat || this.game.rollsLeft <= 0) return;
    if (this.pendingSeat !== d.seat) return;
    this.applyRollLocal(Array.isArray(d.held) ? d.held : []);
    this.startCountdown(() => this.autoResolve(d.seat as number)); // give them more time
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private buildDOM(): void {
    if (!this.boardEl) return;
    this.boardEl.innerHTML = `
      <div class="yh-dice-area">
        <div class="yh-dice" id="yh-dice"></div>
      </div>
      <div class="yh-score-section">
        <table class="yh-table">
          <thead><tr><th data-i18n="yhCategory"></th><th data-i18n="yhScore"></th></tr></thead>
          <tbody id="yh-tbody"></tbody>
          <tfoot id="yh-tfoot"></tfoot>
        </table>
      </div>`;
    this.diceEl = document.getElementById('yh-dice');
    this.cardEl = document.getElementById('yh-tbody');

    this.diceEl?.parentElement?.addEventListener('click', (e) => this.onDiceAreaClick(e.target));
    this.buildScoreRows();
  }

  private buildScoreRows(): void {
    const tbody = this.cardEl;
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const key of ALL_KEYS) {
      if (key === LOWER_KEYS[0]) {
        const sep = document.createElement('tr');
        sep.innerHTML = '<td colspan="2" class="yh-sep"></td>';
        tbody.appendChild(sep);
      }
      const meta = CATEGORY_META[key];
      const tr = document.createElement('tr');
      tr.dataset.key = key;
      tr.className = 'yh-row';
      tr.innerHTML = `<td class="yh-cat" title="${meta.desc}">${meta.label}</td><td class="yh-score-cell" id="yh-score-${key}">—</td>`;
      tr.addEventListener('click', () => this.onCategoryClick(key));
      tbody.appendChild(tr);
    }
    const tfoot = document.getElementById('yh-tfoot');
    if (tfoot) {
      tfoot.innerHTML = `
        <tr><td data-i18n="yhUpperTotal"></td><td id="yh-upper-total">0</td></tr>
        <tr><td data-i18n="yhBonus"></td><td id="yh-upper-bonus">—</td></tr>
        <tr><td data-i18n="yhTotal"></td><td id="yh-grand-total">0</td></tr>`;
    }
  }

  protected renderState(): void {
    // A new turn (no roll yet) clears the local hold selection.
    if (this.game.rollsLeft === ROLLS_PER_TURN && !this.game.rolledThisTurn) {
      this.held = [false, false, false, false, false];
    }
    this.renderStandings();
    this.renderDice();
    this.renderCard();
  }

  private renderStandings(): void {
    const { cards, seat, players } = this.game;
    for (let s = 0; s < SEAT_LABELS.length; s++) {
      const key = `p${s + 1}`;
      this.hud?.set(key, s < players ? `${SEAT_LABELS[s]}: ${totalFor(cards[s])}` : null);
      this.hud?.toggle(key, 'is-active', s === seat && !this.state.isGameOver);
    }
  }

  private renderDice(): void {
    if (!this.diceEl) return;
    const { dice, rolledThisTurn, seat } = this.game;
    const mine = seat === this.mySeat;
    this.diceEl.innerHTML = dice
      .map((d, i) => {
        const held = mine && this.held[i];
        const cls = `yh-die${held ? ' is-held' : ''}${!rolledThisTurn ? ' is-fresh' : ''}${this.rolling[i] ? ' is-rolling' : ''}`;
        return `<button class="${cls}" data-idx="${i}" aria-label="Die ${i + 1}: ${d}">${dieFaceHtml(d)}</button>`;
      })
      .join('');
    const left = this.game.rollsLeft;
    this.hud?.set(
      'rolls',
      left > 0 ? `${left} ${t('yhRollsLeft')}` : rolledThisTurn ? t('yhMustScore') : null
    );
  }

  /** Renders the LOCAL player's scorecard (previews only on your turn). */
  private renderCard(): void {
    const card = this.game.cards[this.mySeat];
    const myTurn =
      this.game.seat === this.mySeat && this.game.rolledThisTurn && !this.state.isGameOver;
    for (const key of ALL_KEYS) {
      const el = document.getElementById(`yh-score-${key}`);
      const tr = el?.closest('tr');
      if (!el || !tr) continue;
      if (key in card) {
        el.textContent = String(card[key]);
        tr.classList.add('is-scored');
        tr.classList.remove('is-preview');
      } else if (myTurn) {
        const preview = scoreFor(key, this.game.dice);
        el.textContent = preview > 0 ? `+${preview}` : '0';
        tr.classList.add('is-preview');
        tr.classList.remove('is-scored');
      } else {
        el.textContent = '—';
        tr.classList.remove('is-preview', 'is-scored');
      }
    }
    const ut = upperTotal(card);
    const utEl = document.getElementById('yh-upper-total');
    const bonusEl = document.getElementById('yh-upper-bonus');
    const totalEl = document.getElementById('yh-grand-total');
    if (utEl) utEl.textContent = String(ut);
    if (bonusEl) bonusEl.textContent = upperBonus(card) ? '+35' : `${ut}/63`;
    if (totalEl) totalEl.textContent = String(totalFor(card));
  }

  protected updateTurnDisplay(): void {
    const seat = this.game.seat;
    let text: string;
    if (this.state.isGameOver) text = '';
    else if (seat === this.mySeat) text = `${SEAT_LABELS[seat]} (${t('you')})`;
    else if (this.humanSeats.has(seat)) text = SEAT_LABELS[seat];
    else text = `${SEAT_LABELS[seat]} (${t('bot')})`;
    this.hud?.set('turn', text);
  }

  protected onMoveCommitted(_move: YMove | null): void {
    if (this.isRoundOver()) {
      const w = this.rules.winner(this.game);
      if (w === this.mySeat) {
        playSound('win');
        celebrate(this.fx, this.boardEl);
      } else if (w !== null) {
        playSound('die');
      }
    } else {
      playSound('score');
    }
  }

  handleInput(_e: KeyboardEvent): void {}

  protected getGameOverTitle(): string {
    const w = this.rules.winner(this.game);
    if (w === null) return t('draw');
    return w === this.mySeat ? t('youWon') : t('youLose');
  }

  protected getGameOverContent(): string {
    const line = this.game.cards.map((c, i) => `${SEAT_LABELS[i]}: ${totalFor(c)}`).join(' — ');
    return `<p>${line}</p>`;
  }
}
