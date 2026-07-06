import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { playSound } from '../../shared/fx/sound.js';
import {
  Die,
  ScoreKey,
  ALL_KEYS,
  UPPER_KEYS,
  LOWER_KEYS,
  CATEGORY_META,
  rollDice,
  rollDie,
  scoreFor,
  upperTotal,
  upperBonus,
  grandTotal,
} from './yahtzee.js';

const TOTAL_TURNS = 13;
const ROLLS_PER_TURN = 3;

interface YState {
  dice: Die[];
  held: boolean[];
  rollsLeft: number;
  scores: Partial<Record<ScoreKey, number>>;
  yahtzeeBonus: number;
  turn: number;
}

export class YahtzeeGame extends GameEngine {
  private st: YState = this.freshState();
  private boardEl: HTMLElement | null = null;
  private diceEl: HTMLElement | null = null;
  private rollBtn: HTMLButtonElement | null = null;
  private scoreTable: HTMLElement | null = null;

  constructor() {
    super({ storageKey: 'yahtzee', leaderboardId: 'yahtzee' });
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.buildDOM();
    this.hud = setupHud([
      { key: 'turn', icon: 'hashtag', label: t('hudTurn') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);
    this.hud.set('high', this.scoreManager.getHighScore());
    this.renderState();
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.st = this.freshState();
    this.resetState();
    this.state.isRunning = true;
    this.state.isGameOver = false;
    this.hud?.set('turn', `1/${TOTAL_TURNS}`);
    this.hud?.set('high', this.scoreManager.getHighScore());
    this.renderState();
  }

  reset(): void {
    this.st = this.freshState();
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

  private freshState(): YState {
    return {
      dice: [1, 1, 1, 1, 1] as Die[],
      held: [false, false, false, false, false],
      rollsLeft: ROLLS_PER_TURN,
      scores: {},
      yahtzeeBonus: 0,
      turn: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  private buildDOM(): void {
    if (!this.boardEl) return;
    this.boardEl.innerHTML = `
      <div class="yh-dice-area">
        <div class="yh-dice" id="yh-dice"></div>
        <button class="yh-roll-btn" id="yh-roll" data-i18n="yhRoll"></button>
        <div class="yh-rolls-left" id="yh-rolls-left"></div>
      </div>
      <div class="yh-score-section">
        <table class="yh-table" id="yh-table">
          <thead><tr><th data-i18n="yhCategory"></th><th data-i18n="yhScore"></th></tr></thead>
          <tbody id="yh-tbody"></tbody>
          <tfoot id="yh-tfoot"></tfoot>
        </table>
      </div>`;
    this.diceEl = document.getElementById('yh-dice');
    this.rollBtn = document.getElementById('yh-roll') as HTMLButtonElement | null;
    this.scoreTable = document.getElementById('yh-tbody');
    this.rollBtn?.addEventListener('click', () => this.onRoll());
    this.buildScoreRows();
  }

  private buildScoreRows(): void {
    const tbody = this.scoreTable;
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const key of ALL_KEYS) {
      const meta = CATEGORY_META[key];
      const tr = document.createElement('tr');
      tr.dataset.key = key;
      tr.className = 'yh-row';
      const isUpper = UPPER_KEYS.includes(key);
      if (!isUpper && key === LOWER_KEYS[0]) {
        tbody.appendChild(this.makeSeparatorRow());
      }
      tr.innerHTML = `<td class="yh-cat" title="${meta.desc}">${meta.label}</td><td class="yh-score-cell" id="yh-score-${key}">—</td>`;
      tr.addEventListener('click', () => this.onScoreClick(key));
      tbody.appendChild(tr);
    }
    const tfoot = document.getElementById('yh-tfoot');
    if (tfoot) {
      tfoot.innerHTML = `
        <tr><td colspan="2" class="yh-sep"></td></tr>
        <tr><td data-i18n="yhUpperTotal"></td><td id="yh-upper-total">0</td></tr>
        <tr><td data-i18n="yhBonus"></td><td id="yh-upper-bonus">—</td></tr>
        <tr><td data-i18n="yhTotal"></td><td id="yh-grand-total">0</td></tr>`;
    }
  }

  private makeSeparatorRow(): HTMLTableRowElement {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="2" class="yh-sep"></td>';
    return tr;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  protected renderState(): void {
    this.renderDice();
    this.renderScoreTable();
    this.renderTotals();
    this.renderRollBtn();
  }

  private renderDice(): void {
    if (!this.diceEl) return;
    const { dice, held, rollsLeft } = this.st;
    this.diceEl.innerHTML = dice
      .map((d, i) => {
        const cls = `yh-die${held[i] ? ' is-held' : ''}${rollsLeft === ROLLS_PER_TURN ? ' is-fresh' : ''}`;
        return `<button class="${cls}" data-idx="${i}" aria-label="Die ${i + 1}: ${d}${held[i] ? ' (held)' : ''}">${this.diePips(d)}</button>`;
      })
      .join('');
    this.diceEl.querySelectorAll<HTMLElement>('.yh-die').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        if (this.st.rollsLeft === ROLLS_PER_TURN) return;
        this.st.held[idx] = !this.st.held[idx];
        this.renderDice();
      });
    });

    const rollsEl = document.getElementById('yh-rolls-left');
    if (rollsEl) {
      rollsEl.textContent = rollsLeft > 0 ? `${rollsLeft} ${t('yhRollsLeft')}` : t('yhMustScore');
    }
  }

  private diePips(v: Die): string {
    const dots = [
      '',
      '<span class="pip c"></span>',
      '<span class="pip tl"></span><span class="pip br"></span>',
      '<span class="pip tl"></span><span class="pip c"></span><span class="pip br"></span>',
      '<span class="pip tl"></span><span class="pip tr"></span><span class="pip bl"></span><span class="pip br"></span>',
      '<span class="pip tl"></span><span class="pip tr"></span><span class="pip c"></span><span class="pip bl"></span><span class="pip br"></span>',
      '<span class="pip tl"></span><span class="pip tr"></span><span class="pip ml"></span><span class="pip mr"></span><span class="pip bl"></span><span class="pip br"></span>',
    ];
    return dots[v] ?? '';
  }

  protected renderScoreTable(): void {
    const { dice, rollsLeft, scores } = this.st;
    const canScore = rollsLeft < ROLLS_PER_TURN;
    for (const key of ALL_KEYS) {
      const el = document.getElementById(`yh-score-${key}`);
      const tr = el?.closest('tr');
      if (!el || !tr) continue;
      if (key in scores) {
        el.textContent = String(scores[key]);
        tr.classList.add('is-scored');
        tr.classList.remove('is-preview');
      } else if (canScore) {
        const preview = scoreFor(key, dice);
        el.textContent = preview > 0 ? `+${preview}` : '0';
        tr.classList.add('is-preview');
        tr.classList.remove('is-scored');
      } else {
        el.textContent = '—';
        tr.classList.remove('is-preview', 'is-scored');
      }
    }
  }

  private renderTotals(): void {
    const { scores, yahtzeeBonus } = this.st;
    const ut = upperTotal(scores);
    const bonus = upperBonus(scores);
    const grand = grandTotal(scores, yahtzeeBonus);
    const utEl = document.getElementById('yh-upper-total');
    const bonusEl = document.getElementById('yh-upper-bonus');
    const totalEl = document.getElementById('yh-grand-total');
    if (utEl) utEl.textContent = String(ut);
    if (bonusEl) bonusEl.textContent = bonus ? '+35' : ut >= 63 ? '+35' : `${ut}/63`;
    if (totalEl) totalEl.textContent = String(grand);
  }

  private renderRollBtn(): void {
    if (!this.rollBtn) return;
    const canRoll = this.st.rollsLeft > 0;
    this.rollBtn.disabled = !canRoll || !this.state.isRunning;
    this.rollBtn.classList.toggle('is-disabled', !canRoll);
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  private onRoll(): void {
    if (!this.state.isRunning || this.st.rollsLeft <= 0) return;
    const { held } = this.st;
    this.st.dice = this.st.dice.map((d, i) => (held[i] ? d : rollDie())) as Die[];
    this.st.rollsLeft--;
    playSound('dice');
    this.renderState();
    this.hud?.set('turn', `${this.st.turn + 1}/${TOTAL_TURNS}`);
  }

  private onScoreClick(key: ScoreKey): void {
    if (!this.state.isRunning || this.st.rollsLeft === ROLLS_PER_TURN) return;
    if (key in this.st.scores) return;

    let pts = scoreFor(key, this.st.dice);
    if (key === 'yahtzee' && pts === 50 && this.st.scores.yahtzee === 50) {
      this.st.yahtzeeBonus++;
      pts = 100;
    }
    this.st.scores[key] = pts;
    this.addScore(pts);
    playSound(pts > 0 ? 'score' : 'miss');

    this.st.turn++;
    if (this.st.turn >= TOTAL_TURNS) {
      this.finishGame();
      return;
    }

    this.st.dice = rollDice();
    this.st.held = [false, false, false, false, false];
    this.st.rollsLeft = ROLLS_PER_TURN;
    this.hud?.set('turn', `${this.st.turn + 1}/${TOTAL_TURNS}`);
    this.renderState();
  }

  private finishGame(): void {
    const total = grandTotal(this.st.scores, this.st.yahtzeeBonus);
    this.state.score = total;
    this.renderState();
    playSound('win');
    this.gameOver();
  }

  protected getGameOverTitle(): string {
    return t('yhGameOver');
  }

  protected getGameOverContent(): string {
    return `<p>${t('yhFinalScore', { score: String(grandTotal(this.st.scores, this.st.yahtzeeBonus)) })}</p>`;
  }
}
