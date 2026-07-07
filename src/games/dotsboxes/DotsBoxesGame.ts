import { BoardGame } from '../../shared/turn/BoardGame.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import {
  setupSettingsPanel,
  SettingsPanelHandle,
  SettingsField,
} from '../../shared/ui/settingsPanel.js';
import { playSound } from '../../shared/fx/sound.js';
import { ParticleSystem, celebrate } from '../../shared/fx/particles.js';
import { DBState, DBMove, DotsBoxesRules } from './dotsboxes.js';
import { decideBotMove } from './dotsboxesBot.js';

const GRID_N = 4;
const MAX_PLAYERS = 4;
/** Distinct colour + label per seat, indexed 0..3. */
const SEAT_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b'];
const SEAT_LABELS = ['P1', 'P2', 'P3', 'P4'];

export class DotsBoxesGame extends BoardGame<DBState, DBMove> {
  private boardEl: HTMLElement | null = null;
  private fx: ParticleSystem | null = null;
  private settings: SettingsPanelHandle | null = null;

  /** Player count for offline play (online uses the number who join). */
  private offlinePlayers = 2;
  private rulesCache: DotsBoxesRules | null = null;

  /** Seats in play: the lobby size online, else the offline setting. */
  private effectivePlayers(): number {
    return this.mode === 'net' && this.net ? this.net.players : this.offlinePlayers;
  }

  protected get rules(): DotsBoxesRules {
    const players = this.effectivePlayers();
    if (!this.rulesCache || this.rulesCache.seats !== players) {
      this.rulesCache = new DotsBoxesRules(GRID_N, players);
    }
    return this.rulesCache;
  }

  constructor() {
    super({ storageKey: 'dotsboxes' });
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'turn', icon: 'circle-dot', label: t('hudTurn') },
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
        this.reset(); // rebuild the board for the new player count
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

  protected onGameOver(): void {
    const winner = this.rules.winner(this.game);
    if (winner !== null && this.humanSeats.has(winner)) {
      playSound('win');
      celebrate(this.fx, this.boardEl);
    }
    super.onGameOver();
  }

  moveEquals(a: DBMove, b: DBMove): boolean {
    return a.dir === b.dir && a.row === b.row && a.col === b.col;
  }

  decideBotMove(legalMoves: DBMove[]): DBMove {
    return decideBotMove(this.game, legalMoves, this.rules.currentSeat(this.game));
  }

  protected renderState(): void {
    this.renderBoard();
    this.renderScores();
  }

  protected updateTurnDisplay(): void {
    const seat = this.rules.currentSeat(this.game);
    const label = this.humanSeats.has(seat) ? t('you') : t('bot');
    this.hud?.set('turn', `${SEAT_LABELS[seat]} (${label})`);
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
    const line = s.map((score, i) => `${SEAT_LABELS[i]}: ${score}`).join(' — ');
    return `<p>${line}</p>`;
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  private buildDOM(): void {
    if (!this.boardEl) return;
    this.boardEl.innerHTML = `
      <div class="db-grid" id="db-grid"></div>`;
    this.buildGrid();
  }

  private buildGrid(): void {
    const grid = document.getElementById('db-grid');
    if (!grid) return;
    const n = GRID_N;
    const size = 2 * n + 1;
    grid.innerHTML = '';
    // Alternating tracks: dots sit on small fixed tracks, edges/boxes stretch to
    // fill the 1fr tracks between them. Both axes need this — without explicit
    // rows the edge/box rows collapse to zero height and nothing shows.
    const template = Array.from({ length: size }, (_, i) =>
      i % 2 === 0 ? 'var(--db-dot)' : '1fr'
    ).join(' ');
    grid.style.gridTemplateColumns = template;
    grid.style.gridTemplateRows = template;

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
    const { hEdges, vEdges, boxes } = this.game;
    const grid = document.getElementById('db-grid');
    if (!grid) return;

    grid.querySelectorAll<HTMLElement>('.db-h-edge').forEach((el) => {
      const drawn = hEdges[Number(el.dataset.row)][Number(el.dataset.col)];
      this.paintEdge(el, drawn);
    });
    grid.querySelectorAll<HTMLElement>('.db-v-edge').forEach((el) => {
      const drawn = vEdges[Number(el.dataset.row)][Number(el.dataset.col)];
      this.paintEdge(el, drawn);
    });
    grid.querySelectorAll<HTMLElement>('.db-box').forEach((el) => {
      const owner = boxes[Number(el.dataset.br)][Number(el.dataset.bc)];
      const wasOwned = el.classList.contains('is-owned');
      if (owner !== null) {
        el.style.setProperty('--db-owner', SEAT_COLORS[owner]);
        el.textContent = SEAT_LABELS[owner];
        el.classList.add('is-owned');
        if (!wasOwned) {
          el.classList.remove('db-capture');
          void el.offsetWidth; // restart the capture flash
          el.classList.add('db-capture');
        }
      } else {
        el.style.removeProperty('--db-owner');
        el.textContent = '';
        el.classList.remove('is-owned', 'db-capture');
      }
    });
  }

  /** Marks an edge drawn/available and animates the stroke as it appears. */
  private paintEdge(el: HTMLElement, drawn: boolean): void {
    const wasDrawn = el.classList.contains('is-drawn');
    el.classList.toggle('is-drawn', drawn);
    el.classList.toggle('is-available', this.awaitingHuman && !drawn);
    if (drawn && !wasDrawn) {
      el.classList.remove('db-stroke');
      void el.offsetWidth; // restart the draw animation
      el.classList.add('db-stroke');
    }
  }

  private renderScores(): void {
    const { scores, players } = this.game;
    for (let s = 0; s < SEAT_LABELS.length; s++) {
      const key = `p${s + 1}`;
      this.hud?.set(key, s < players ? `${SEAT_LABELS[s]}: ${scores[s]}` : null);
      this.hud?.toggle(key, 'is-active', s === this.game.seat && !this.state.isGameOver);
    }
  }
}
