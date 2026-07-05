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
  Connect4State,
  Connect4Move,
  COLS,
  ROWS,
  SEATS,
  rules as connect4Rules,
  eqMove,
  initialState,
  isFull,
  discAt,
  findWinningLine,
} from './connect4.js';
import { decideMove } from './connect4Bot.js';

/**
 * Connect 4 controller: a deterministic turn-based game playable **solo** (human
 * = seat 0 red, bot = seat 1 yellow) or **1-v-1 online** over the relay. It only
 * owns the 7×6 board rendering and input; the whole turn/host-authoritative
 * networking lives in {@link BoardGame}. This is the simplest reference for a new
 * board game: supply the rules, the rendering and a bot, nothing else.
 */
export class Connect4Game extends BoardGame<Connect4State, Connect4Move> {
  protected botDelay = 550;
  protected nextTurnDelay = 250;
  protected endDelay = 550;
  protected turnSeconds = 20;

  private difficulty: Difficulty = 'medium';
  private settings: SettingsPanelHandle | null = null;
  /** Solo only: whether the bot takes the first move (Settings). */
  private botStarts = false;

  private boardEl: HTMLElement | null = null;
  /** Column elements and their cells (`cellEls[col][rowFromTop]`). */
  private colEls: HTMLElement[] = [];
  private cellEls: HTMLElement[][] = [];
  /** The column the human is currently aiming at (mouse hover / keyboard). */
  private cursorCol = Math.floor(COLS / 2);
  private fx: ParticleSystem | null = null;

  constructor() {
    super({ storageKey: 'connect4' });
  }

  protected get rules(): TurnRules<Connect4State, Connect4Move> {
    return connect4Rules;
  }
  protected moveEquals(a: Connect4Move, b: Connect4Move): boolean {
    return eqMove(a, b);
  }
  protected decideBotMove(legalMoves: Connect4Move[]): Connect4Move {
    return decideMove(this.game, legalMoves, this.difficulty);
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'turn', icon: 'circle-dot', label: t('hudTurn') },
      { key: 'time', icon: 'clock', label: t('hudTime') },
    ]);

    this.buildBoard();
    this.setupEventListeners();
    this.setupBoardPointer();

    this.settings = setupSettingsPanel([
      difficultyField(this.difficulty, (value) => {
        this.difficulty = value as Difficulty;
      }),
      {
        id: 'first',
        label: t('firstMove'),
        choices: [
          { label: t('me'), value: 'me' },
          { label: t('you'), value: 'you' },
        ],
        value: this.botStarts ? 'you' : 'me',
        onChange: (value) => {
          this.botStarts = value === 'you';
          if (this.mode === 'solo') {
            this.reset();
            if (this.state.isRunning) this.start();
          }
        },
      },
    ]);
    this.setupVersus(SEATS);

    this.game = this.freshGame();
    this.updateTurnDisplay();
    this.renderState();
  }

  /** A fresh board; in solo the bot takes seat 0's turn first when configured. */
  protected freshGame(): Connect4State {
    const state = initialState();
    if (this.mode === 'solo' && this.botStarts) state.current = 1;
    return state;
  }

  /** Connect 4 has a draw (full board with no line), on top of a win. */
  protected isRoundOver(): boolean {
    return this.game.winner !== null || isFull(this.game);
  }

  /** Multiplayer freezes the solo-only settings (difficulty / first move). */
  protected onNetActiveChanged(active: boolean): void {
    this.settings?.setDisabled(active);
  }

  /** Builds the 7×6 grid of columns and cells once (state is applied in render). */
  private buildBoard(): void {
    const board = this.boardEl;
    if (!board) return;
    board.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'connect4-grid';

    this.colEls = [];
    this.cellEls = [];
    for (let col = 0; col < COLS; col++) {
      const colEl = document.createElement('div');
      colEl.className = 'connect4-col';
      colEl.dataset.col = String(col);
      const cells: HTMLElement[] = [];
      for (let rowTop = 0; rowTop < ROWS; rowTop++) {
        const cell = document.createElement('div');
        cell.className = 'connect4-cell';
        const disc = document.createElement('span');
        disc.className = 'connect4-disc';
        cell.appendChild(disc);
        colEl.appendChild(cell);
        cells.push(cell);
      }
      grid.appendChild(colEl);
      this.colEls.push(colEl);
      this.cellEls.push(cells);
    }
    board.appendChild(grid);
  }

  /** Click to drop, hover to aim (pointer complement to the keyboard input). */
  private setupBoardPointer(): void {
    this.boardEl?.addEventListener('click', (event) => {
      const col = this.columnOf(event.target);
      if (col !== null) this.playColumn(col);
    });
    this.boardEl?.addEventListener('mousemove', (event) => {
      if (!this.awaitingHuman) return;
      const col = this.columnOf(event.target);
      if (col !== null && col !== this.cursorCol) {
        this.cursorCol = col;
        this.renderState();
      }
    });
  }

  /** The column index under an event target, or null. */
  private columnOf(target: EventTarget | null): number | null {
    const colEl = (target as HTMLElement | null)?.closest<HTMLElement>('.connect4-col');
    return colEl?.dataset.col !== undefined ? Number(colEl.dataset.col) : null;
  }

  /** Keyboard: ← → to aim a column, ↓ / Enter / Space to drop. */
  handleInput(event: KeyboardEvent): void {
    if (!this.awaitingHuman || this.game.current !== this.mySeat) return;
    switch (event.key) {
      case 'ArrowLeft':
        this.moveCursor(-1);
        event.preventDefault();
        break;
      case 'ArrowRight':
        this.moveCursor(1);
        event.preventDefault();
        break;
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        this.playColumn(this.cursorCol);
        event.preventDefault();
        break;
    }
  }

  private moveCursor(delta: number): void {
    this.cursorCol = Math.max(0, Math.min(COLS - 1, this.cursorCol + delta));
    this.renderState();
  }

  /** Human dropped in `col`: hand it to the coordinator (plays it or relays it). */
  private playColumn(col: number): void {
    if (!this.awaitingHuman || this.game.current !== this.mySeat) return;
    if (this.game.columns[col].length >= ROWS) return;
    this.playLocalMove({ col });
  }

  /** Reflects the state on the board, plus the aiming ghost on the human's turn. */
  protected renderState(): void {
    const columns = this.game.columns;
    const aiming =
      this.awaitingHuman && this.game.current === this.mySeat && this.game.winner === null;
    const ghostCol = aiming ? this.cursorCol : -1;
    const ghostRowTop =
      ghostCol >= 0 && columns[ghostCol].length < ROWS ? ROWS - 1 - columns[ghostCol].length : -1;
    const winLine = this.game.winner !== null ? findWinningLine(this.game) : null;
    const winSet = winLine ? new Set(winLine.map((c) => `${c.col},${c.row}`)) : null;

    for (let col = 0; col < COLS; col++) {
      this.colEls[col]?.classList.toggle('is-aim', aiming && col === ghostCol);
      for (let rowTop = 0; rowTop < ROWS; rowTop++) {
        const cell = this.cellEls[col]?.[rowTop];
        if (!cell) continue;
        const disc = discAt(columns, col, ROWS - 1 - rowTop);
        cell.classList.toggle('is-p0', disc === 0);
        cell.classList.toggle('is-p1', disc === 1);
        cell.classList.toggle('is-win', winSet?.has(`${col},${ROWS - 1 - rowTop}`) ?? false);
        const ghost = col === ghostCol && rowTop === ghostRowTop;
        cell.classList.toggle('is-ghost', ghost);
        cell.classList.toggle('is-ghost-p0', ghost && this.mySeat === 0);
        cell.classList.toggle('is-ghost-p1', ghost && this.mySeat === 1);
      }
    }
  }

  /** Writes whose turn it is into the HUD. */
  protected updateTurnDisplay(): void {
    const seat = this.game.current;
    let text: string;
    if (this.game.winner !== null || isFull(this.game)) text = '—';
    else if (seat === this.mySeat) text = 'My turn';
    else if (this.humanSeats.has(seat)) text = 'Your turn';
    else text = "Bot's turn";
    this.hud?.set('turn', text);
  }

  /** Post-move visuals (host and guest): drop animation, sound, win confetti. */
  protected onMoveCommitted(move: Connect4Move | null): void {
    if (move) this.animateDrop(move.col);
    if (this.game.winner !== null) {
      playSound('win');
      this.spawnWinParticles();
    } else if (!isFull(this.game)) {
      playSound('connect');
    }
  }

  /**
   * Emits a confetti burst from each disc in the winning line.
   * Uses the winner's disc color (seat 0 = red, seat 1 = yellow).
   */
  private spawnWinParticles(): void {
    const winLine = findWinningLine(this.game);
    if (!this.fx || !winLine) return;
    const winner = this.game.winner!;
    const colors =
      winner === 0
        ? ['#ef4444', '#f87171', '#fca5a5', '#ffffff']
        : ['#facc15', '#fde047', '#fef08a', '#ffffff'];

    winLine.forEach(({ col, row }) => {
      const rowTop = ROWS - 1 - row;
      const cell = this.cellEls[col]?.[rowTop];
      if (!cell) return;
      const rect = cell.getBoundingClientRect();
      this.fx!.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
        count: 10,
        speed: 5,
        spread: Math.PI * 2,
        gravity: 0.2,
        duration: 900,
        size: rect.width * 0.22,
        colors,
      });
    });
  }

  /** Plays the falling-disc animation on the disc that just landed on top of `col`. */
  private animateDrop(col: number): void {
    const height = this.game.columns[col]?.length ?? 0;
    if (height === 0) return;
    const rowTop = ROWS - height;
    const disc = this.cellEls[col]?.[rowTop]?.querySelector<HTMLElement>('.connect4-disc');
    if (!disc) return;
    disc.style.setProperty('--drop-from', `${(-((rowTop + 1) / 0.88) * 100).toFixed(0)}%`);
    disc.classList.remove('is-drop');
    disc.getBoundingClientRect();
    disc.classList.add('is-drop');
  }

  protected getGameOverTitle(): string {
    if (this.game.winner === null) return t('draw');
    return this.game.winner === this.mySeat ? t('youWin') : t('youLose');
  }

  protected getGameOverContent(): string {
    if (this.game.winner === null) return '<p>The board is full — nobody lined up four.</p>';
    return this.game.winner === this.mySeat
      ? '<p>Four in a row — well played!</p>'
      : '<p>The opponent lined up four.</p>';
  }
}
