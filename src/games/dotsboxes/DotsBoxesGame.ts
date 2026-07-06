import { BoardGame } from '../../shared/turn/BoardGame.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { playSound } from '../../shared/fx/sound.js';
import { DBState, DBMove, DotsBoxesRules } from './dotsboxes.js';
import { decideBotMove } from './dotsboxesBot.js';

const GRID_N = 4;
const SEAT_COLORS = ['#3b82f6', '#ef4444'];
const SEAT_LABELS = ['P1', 'P2'];
const DB_RULES = new DotsBoxesRules(GRID_N);

export class DotsBoxesGame extends BoardGame<DBState, DBMove> {
  private boardEl: HTMLElement | null = null;
  private scoreEls: [HTMLElement | null, HTMLElement | null] = [null, null];
  private turnEl: HTMLElement | null = null;

  protected get rules() {
    return DB_RULES;
  }

  constructor() {
    super({ storageKey: 'dotsboxes' });
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.hud = setupHud([
      { key: 'p1', icon: 'circle', label: 'P1' },
      { key: 'p2', icon: 'circle', label: 'P2' },
    ]);
    this.buildDOM();
    this.setupVersus(2);
  }

  moveEquals(a: DBMove, b: DBMove): boolean {
    return a.dir === b.dir && a.row === b.row && a.col === b.col;
  }

  decideBotMove(legalMoves: DBMove[]): DBMove {
    return decideBotMove(this.game, legalMoves, this.rules.currentSeat(this.game) as 0 | 1);
  }

  protected renderState(): void {
    this.renderBoard();
    this.renderScores();
  }

  protected updateTurnDisplay(): void {
    if (!this.turnEl) return;
    const seat = this.rules.currentSeat(this.game);
    const label = this.humanSeats.has(seat) ? t('you') : t('bot');
    this.turnEl.textContent = `${SEAT_LABELS[seat]} (${label})`;
    this.turnEl.style.color = SEAT_COLORS[seat];
  }

  protected onMoveCommitted(_move: DBMove | null): void {
    playSound('move');
  }

  protected isRoundOver(): boolean {
    return this.game.filledEdges >= this.game.totalEdges;
  }

  handleInput(_e: KeyboardEvent): void {}

  protected getGameOverTitle(): string {
    const w = this.rules.winner(this.game);
    if (w === null) return t('draw');
    return w === this.mySeat ? t('youWon') : t('youLose');
  }

  protected getGameOverContent(): string {
    const s = this.game.scores;
    return `<p>${SEAT_LABELS[0]}: ${s[0]} — ${SEAT_LABELS[1]}: ${s[1]}</p>`;
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  private buildDOM(): void {
    if (!this.boardEl) return;
    this.boardEl.innerHTML = `
      <div class="db-header">
        <div class="db-score" id="db-score-0" style="color:${SEAT_COLORS[0]}">P1: 0</div>
        <div class="db-turn" id="db-turn"></div>
        <div class="db-score" id="db-score-1" style="color:${SEAT_COLORS[1]}">P2: 0</div>
      </div>
      <div class="db-grid" id="db-grid"></div>`;
    this.scoreEls[0] = document.getElementById('db-score-0');
    this.scoreEls[1] = document.getElementById('db-score-1');
    this.turnEl = document.getElementById('db-turn');
    this.buildGrid();
  }

  private buildGrid(): void {
    const grid = document.getElementById('db-grid');
    if (!grid) return;
    const n = GRID_N;
    const size = 2 * n + 1;
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const el = document.createElement('div');
        const isDotRow = r % 2 === 0;
        const isDotCol = c % 2 === 0;
        if (isDotRow && isDotCol) {
          el.className = 'db-dot';
        } else if (isDotRow && !isDotCol) {
          el.className = 'db-h-edge';
          const er = r / 2;
          const ec = (c - 1) / 2;
          el.dataset.dir = 'h';
          el.dataset.row = String(er);
          el.dataset.col = String(ec);
          el.addEventListener('click', () => this.onEdgeClick('h', er, ec));
        } else if (!isDotRow && isDotCol) {
          el.className = 'db-v-edge';
          const er = (r - 1) / 2;
          const ec = c / 2;
          el.dataset.dir = 'v';
          el.dataset.row = String(er);
          el.dataset.col = String(ec);
          el.addEventListener('click', () => this.onEdgeClick('v', er, ec));
        } else {
          el.className = 'db-box';
          el.dataset.br = String((r - 1) / 2);
          el.dataset.bc = String((c - 1) / 2);
        }
        grid.appendChild(el);
      }
    }
  }

  private onEdgeClick(dir: 'h' | 'v', row: number, col: number): void {
    if (!this.awaitingHuman || this.state.isGameOver) return;
    const move: DBMove = { dir, row, col };
    const legal = this.rules.legalMoves(this.game);
    if (!legal.some((m) => this.moveEquals(m, move))) return;
    this.commitMove(move);
  }

  private renderBoard(): void {
    const { hEdges, vEdges, boxes, n } = this.game;
    const grid = document.getElementById('db-grid');
    if (!grid) return;
    const cells = grid.querySelectorAll<HTMLElement>('.db-h-edge, .db-v-edge, .db-box');
    for (const el of cells) {
      const dir = el.dataset.dir;
      if (dir === 'h') {
        const r = Number(el.dataset.row);
        const c = Number(el.dataset.col);
        el.classList.toggle('is-drawn', hEdges[r][c]);
        el.classList.toggle('is-available', this.awaitingHuman && !hEdges[r][c]);
      } else if (dir === 'v') {
        const r = Number(el.dataset.row);
        const c = Number(el.dataset.col);
        el.classList.toggle('is-drawn', vEdges[r][c]);
        el.classList.toggle('is-available', this.awaitingHuman && !vEdges[r][c]);
      } else if (el.classList.contains('db-box')) {
        const br = Number(el.dataset.br);
        const bc = Number(el.dataset.bc);
        const owner = boxes[br][bc];
        el.style.background = owner !== null ? SEAT_COLORS[owner] : '';
        el.classList.toggle('is-owned', owner !== null);
      }
    }
    // Re-render grid structure if first time
    for (let r = 0; r <= n; r++) {
      for (let c = 0; c < n; c++) {
        const el = grid.querySelector<HTMLElement>(
          `[data-dir="h"][data-row="${r}"][data-col="${c}"]`
        );
        if (el) el.classList.toggle('is-drawn', hEdges[r][c]);
      }
    }
    for (let r = 0; r < n; r++) {
      for (let c = 0; c <= n; c++) {
        const el = grid.querySelector<HTMLElement>(
          `[data-dir="v"][data-row="${r}"][data-col="${c}"]`
        );
        if (el) el.classList.toggle('is-drawn', vEdges[r][c]);
      }
    }
    for (let br = 0; br < n; br++) {
      for (let bc = 0; bc < n; bc++) {
        const el = grid.querySelector<HTMLElement>(`[data-br="${br}"][data-bc="${bc}"]`);
        if (el) {
          const owner = boxes[br][bc];
          el.style.background = owner !== null ? `${SEAT_COLORS[owner]}66` : '';
          el.textContent = owner !== null ? SEAT_LABELS[owner] : '';
        }
      }
    }
  }

  private renderScores(): void {
    const { scores } = this.game;
    if (this.scoreEls[0]) this.scoreEls[0].textContent = `P1: ${scores[0]}`;
    if (this.scoreEls[1]) this.scoreEls[1].textContent = `P2: ${scores[1]}`;
    this.hud?.set('p1', scores[0]);
    this.hud?.set('p2', scores[1]);
  }
}
