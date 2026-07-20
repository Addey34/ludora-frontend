import { type Difficulty } from '../../shared/bot/difficulty.js';
import { playSound } from '../../shared/fx/sound.js';
import { t } from '../../shared/i18n/i18n.js';
import { BoardGame } from '../../shared/turn/BoardGame.js';
import type { TurnRules } from '../../shared/turn/turnGame.js';
import { setupHud } from '../../shared/ui/hud.js';
import {
  difficultyField,
  setupSettingsPanel,
  type SettingsPanelHandle,
} from '../../shared/ui/settingsPanel.js';
import {
  BOARD_SIZE,
  createQuoridorState,
  quoridorMoveEquals,
  quoridorRules,
  SEATS,
  type Position,
  type QuoridorMove,
  type QuoridorState,
  type QuoridorWall,
  type WallOrientation,
} from './quoridor.js';
import { decideMove } from './quoridorBot.js';

type Tool = 'pawn' | WallOrientation;

interface WallButton {
  element: HTMLButtonElement;
  wall: QuoridorWall;
}

export class QuoridorGame extends BoardGame<QuoridorState, QuoridorMove> {
  private board: HTMLElement | null = null;
  private grid: HTMLElement | null = null;
  private cells: HTMLButtonElement[][] = [];
  private horizontalWalls: WallButton[] = [];
  private verticalWalls: WallButton[] = [];
  private toolButtons = new Map<Tool, HTMLButtonElement>();
  private wallCounts: [HTMLElement | null, HTMLElement | null] = [null, null];
  private tool: Tool = 'pawn';
  private difficulty: Difficulty = 'medium';
  private settings: SettingsPanelHandle | null = null;
  private botStarts = false;

  constructor() {
    super({ storageKey: 'quoridor-scores' });
  }

  protected get rules(): TurnRules<QuoridorState, QuoridorMove> {
    return quoridorRules;
  }

  initialize(): void {
    this.board = document.getElementById('board');
    this.hud = setupHud([
      { key: 'turn', icon: 'circle-dot', label: t('hudTurn') },
      { key: 'time', icon: 'clock', label: t('hudTime') },
    ]);
    this.buildBoard();
    this.setupEventListeners();
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
            const wasRunning = this.state.isRunning;
            this.reset();
            if (wasRunning) this.start();
          }
        },
      },
    ]);
    this.setupVersus(SEATS);
    this.game = this.freshGame();
    this.updateTurnDisplay();
    this.renderState();
  }

  protected freshGame(): QuoridorState {
    const state = createQuoridorState();
    if (this.mode === 'solo' && this.botStarts) state.current = 1;
    return state;
  }

  protected onNetActiveChanged(active: boolean): void {
    this.settings?.setDisabled(active);
  }

  protected onRoundReset(): void {
    this.setTool('pawn');
  }

  handleInput(event: KeyboardEvent): void {
    const toolByKey: Partial<Record<string, Tool>> = {
      p: 'pawn',
      h: 'horizontal',
      v: 'vertical',
    };
    const tool = toolByKey[event.key.toLowerCase()];
    if (!tool) return;
    this.setTool(tool);
    event.preventDefault();
  }

  protected moveEquals(a: QuoridorMove, b: QuoridorMove): boolean {
    return quoridorMoveEquals(a, b);
  }

  protected decideBotMove(legalMoves: QuoridorMove[]): QuoridorMove {
    return decideMove(this.game, legalMoves, this.difficulty);
  }

  protected renderState(): void {
    const canPlay = this.awaitingHuman && this.game.current === this.mySeat && !this.isRoundOver();
    const legal = canPlay ? this.rules.legalMoves(this.game) : [];
    const legalPawns = new Set(
      legal
        .filter((move): move is Extract<QuoridorMove, { type: 'pawn' }> => move.type === 'pawn')
        .map((move) => positionKey(move.to))
    );
    const legalWalls = new Set(
      legal
        .filter((move): move is Extract<QuoridorMove, { type: 'wall' }> => move.type === 'wall')
        .map((move) => wallKey(move.wall))
    );
    const placedWalls = new Set(this.game.walls.map(wallKey));

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = this.cells[row]?.[col];
        if (!cell) continue;
        const seat = this.seatAt({ row, col });
        const isLegal = this.tool === 'pawn' && legalPawns.has(positionKey({ row, col }));
        cell.classList.toggle('is-seat-0', seat === 0);
        cell.classList.toggle('is-seat-1', seat === 1);
        cell.classList.toggle('is-legal', isLegal);
        cell.disabled = !isLegal;
      }
    }

    this.renderWallButtons(this.horizontalWalls, legalWalls, placedWalls, canPlay);
    this.renderWallButtons(this.verticalWalls, legalWalls, placedWalls, canPlay);
    this.wallCounts[0]?.replaceChildren(String(this.game.wallsRemaining[this.mySeat]));
    const opponent = this.mySeat === 0 ? 1 : 0;
    this.wallCounts[1]?.replaceChildren(String(this.game.wallsRemaining[opponent]));
  }

  protected onMoveCommitted(move: QuoridorMove | null): void {
    if (!move) return;
    playSound(this.game.winner === null ? (move.type === 'wall' ? 'drop' : 'move') : 'win');
  }

  protected getGameOverTitle(): string {
    if (this.game.winner === null) return t('draw');
    return this.game.winner === this.mySeat ? t('youWin') : t('youLose');
  }

  protected getGameOverContent(): string {
    const recap = this.game.winner === this.mySeat ? t('quoridorWinRecap') : t('quoridorLoseRecap');
    return `<p>${recap}</p>`;
  }

  private buildBoard(): void {
    if (!this.board) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'quoridor-toolbar';
    toolbar.setAttribute('aria-label', t('quoridorToolLabel'));
    for (const [tool, label] of [
      ['pawn', t('quoridorPawn')],
      ['horizontal', t('quoridorHorizontalWall')],
      ['vertical', t('quoridorVerticalWall')],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quoridor-tool';
      button.textContent = label;
      button.addEventListener('click', () => this.setTool(tool));
      toolbar.append(button);
      this.toolButtons.set(tool, button);
    }

    const counts = document.createElement('div');
    counts.className = 'quoridor-counts';
    this.wallCounts = [
      this.createWallCount(counts, 'quoridorWallsYou'),
      this.createWallCount(counts, 'quoridorWallsOpponent'),
    ];

    const grid = document.createElement('div');
    grid.className = 'quoridor-grid';
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', t('quoridorBoardLabel'));
    this.grid = grid;
    this.buildCells(grid);
    this.horizontalWalls = this.buildWallButtons(grid, 'horizontal');
    this.verticalWalls = this.buildWallButtons(grid, 'vertical');
    this.board.replaceChildren(toolbar, counts, grid);
    this.setTool(this.tool);
  }

  private buildCells(grid: HTMLElement): void {
    this.cells = Array.from({ length: BOARD_SIZE }, (_, row) =>
      Array.from({ length: BOARD_SIZE }, (_, col) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'quoridor-cell';
        cell.style.gridRow = String(row * 2 + 1);
        cell.style.gridColumn = String(col * 2 + 1);
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', t('quoridorSquare', { row: row + 1, column: col + 1 }));
        const pawn = document.createElement('span');
        pawn.className = 'quoridor-pawn';
        pawn.setAttribute('aria-hidden', 'true');
        cell.append(pawn);
        cell.addEventListener('click', () => this.tryMove({ type: 'pawn', to: { row, col } }));
        grid.append(cell);
        return cell;
      })
    );
  }

  private buildWallButtons(grid: HTMLElement, orientation: WallOrientation): WallButton[] {
    const buttons: WallButton[] = [];
    for (let row = 0; row < BOARD_SIZE - 1; row++) {
      for (let col = 0; col < BOARD_SIZE - 1; col++) {
        const wall = { row, col, orientation };
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `quoridor-wall is-${orientation}`;
        if (orientation === 'horizontal') {
          button.style.gridRow = String(row * 2 + 2);
          button.style.gridColumn = `${col * 2 + 1} / span 3`;
        } else {
          button.style.gridRow = `${row * 2 + 1} / span 3`;
          button.style.gridColumn = String(col * 2 + 2);
        }
        button.setAttribute(
          'aria-label',
          t('quoridorWallSlot', {
            orientation:
              orientation === 'horizontal'
                ? t('quoridorHorizontalWall')
                : t('quoridorVerticalWall'),
            row: row + 1,
            column: col + 1,
          })
        );
        button.addEventListener('click', () => this.tryMove({ type: 'wall', wall }));
        grid.append(button);
        buttons.push({ element: button, wall });
      }
    }
    return buttons;
  }

  private renderWallButtons(
    buttons: WallButton[],
    legalWalls: Set<string>,
    placedWalls: Set<string>,
    canPlay: boolean
  ): void {
    for (const { element, wall } of buttons) {
      const key = wallKey(wall);
      const placed = placedWalls.has(key);
      const activeTool = this.tool === wall.orientation;
      const legal = canPlay && activeTool && legalWalls.has(key);
      element.classList.toggle('is-placed', placed);
      element.classList.toggle('is-legal', legal);
      element.classList.toggle('is-active-tool', activeTool);
      element.disabled = placed || !legal;
    }
  }

  private createWallCount(host: HTMLElement, labelKey: string): HTMLElement {
    const item = document.createElement('span');
    item.className = 'quoridor-count';
    const label = document.createElement('span');
    label.textContent = t(labelKey);
    const value = document.createElement('strong');
    item.append(label, value);
    host.append(item);
    return value;
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    for (const [candidate, button] of this.toolButtons) {
      const active = candidate === tool;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    this.grid?.classList.toggle('is-wall-tool', tool !== 'pawn');
    this.renderState();
  }

  private tryMove(move: QuoridorMove): void {
    if (!this.awaitingHuman || this.game.current !== this.mySeat) return;
    if (!this.rules.legalMoves(this.game).some((candidate) => this.moveEquals(candidate, move))) {
      return;
    }
    this.playLocalMove(move);
  }

  private seatAt(position: Position): number | null {
    const seat = this.game.pawns.findIndex(
      (pawn) => pawn.row === position.row && pawn.col === position.col
    );
    return seat < 0 ? null : seat;
  }
}

function positionKey(position: Position): string {
  return `${position.row}:${position.col}`;
}

function wallKey(wall: QuoridorWall): string {
  return `${wall.orientation}:${wall.row}:${wall.col}`;
}
