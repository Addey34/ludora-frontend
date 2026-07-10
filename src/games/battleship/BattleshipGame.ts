/**
 * Battleship controller: a two-phase game (placement → combat), playable solo
 * against a bot or 1-v-1 online through the Nakama relay.
 *
 * Extends {@link BoardGame}: the **combat** phase reuses the whole shared
 * host-authoritative turn loop (countdown, shot relaying, rematch, result
 * overlay). Only the **placement** phase is bespoke — it is handled here and
 * then enters the base loop via {@link startCombat}. A guest's shot travels as
 * a standard `OP_MOVE` (validated by the rules), the fleet as an `OP_READY`.
 *
 * Host-authoritative networking: the host owns the full state and broadcasts a
 * **sanitized** snapshot (unsunk enemy ships hidden, cf. {@link broadcastState}).
 */

import { BoardGame } from '../../shared/turn/BoardGame.js';
import { t } from '../../shared/i18n/i18n.js';
import { TurnRules } from '../../shared/turn/turnGame.js';
import { MatchMessage, NetMatch } from '../../shared/net/match.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound } from '../../shared/fx/sound.js';
import {
  setupSettingsPanel,
  SettingsPanelHandle,
  difficultyField,
} from '../../shared/ui/settingsPanel.js';
import { setupHud } from '../../shared/ui/hud.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import {
  SHIP_DEFS,
  GRID_SIZE,
  BattleshipState,
  BattleshipMove,
  ShipPlacement,
  Fleet,
  Orientation,
  SEATS,
  rules as bsRules,
  eqMove,
  cellKey,
  shipCells,
  isValidPlacement,
  randomFleet,
  initialState,
  applyMove,
  sanitizeFleet,
} from './battleship.js';
import { decideShot } from './battleshipBot.js';

const BOT_DELAY = 700;
const NEXT_TURN_DELAY = 350;
const END_DELAY = 600;
const TURN_SECONDS = 25;

type Phase = 'placement' | 'combat';

export class BattleshipGame extends BoardGame<BattleshipState, BattleshipMove> {
  protected botDelay = BOT_DELAY;
  protected nextTurnDelay = NEXT_TURN_DELAY;
  protected endDelay = END_DELAY;
  protected turnSeconds = TURN_SECONDS;

  private phase: Phase = 'placement';

  private myFleet: ShipPlacement[] = [];
  private pendingShipIdx = 0;
  private orientation: Orientation = 'h';
  private hoverCell: { row: number; col: number } | null = null;
  private localReady = false;
  private guestFleet: ShipPlacement[] | null = null;

  private settings: SettingsPanelHandle | null = null;
  private difficulty: Difficulty = 'medium';
  private fx: ParticleSystem | null = null;

  private boardEl: HTMLElement | null = null;
  private placementView: HTMLElement | null = null;
  private combatView: HTMLElement | null = null;
  private shipListEl: HTMLElement | null = null;
  private readyBtnEl: HTMLButtonElement | null = null;
  private waitingMsgEl: HTMLElement | null = null;
  private placementCells: HTMLElement[][] = [];
  private myCells: HTMLElement[][] = [];
  private enemyCells: HTMLElement[][] = [];
  private enemySideEl: HTMLElement | null = null;

  constructor() {
    super({});
  }

  protected get rules(): TurnRules<BattleshipState, BattleshipMove> {
    return bsRules;
  }
  protected moveEquals(a: BattleshipMove, b: BattleshipMove): boolean {
    return eqMove(a, b);
  }
  /** Bot shot: the smart targeting bot, from the opponent's fleet (ignores `legal`). */
  protected decideBotMove(_legalMoves: BattleshipMove[]): BattleshipMove {
    const oppFleet = this.game.fleets[1 - this.game.current];
    return decideShot(oppFleet, this.difficulty);
  }

  initialize(): void {
    this.fx = new ParticleSystem();
    this.boardEl = document.getElementById('board');

    this.hud = setupHud([
      { key: 'mine', icon: 'shield-halved', label: t('bsMyShips') },
      { key: 'enemy', icon: 'crosshairs', label: t('bsEnemyShips') },
      { key: 'turn', icon: 'circle-dot', label: t('hudTurn') },
      { key: 'time', icon: 'clock', label: t('hudTime') },
    ]);

    this.buildViews();
    this.setupEventListeners();

    this.settings = setupSettingsPanel([
      difficultyField(this.difficulty, (v) => {
        this.difficulty = v as Difficulty;
      }),
    ]);

    this.setupVersus(SEATS);
  }

  private buildViews(): void {
    const board = this.boardEl;
    if (!board) return;
    board.innerHTML = '';

    const placement = document.createElement('div');
    placement.className = 'bs-placement';

    const gridArea = document.createElement('div');
    gridArea.className = 'bs-grid-area';
    const placementGrid = document.createElement('div');
    placementGrid.className = 'bs-grid';
    this.placementCells = this.buildGrid(placementGrid);
    placementGrid.addEventListener('mousemove', (e) => this.onPlacementMove(e));
    placementGrid.addEventListener('mouseleave', () => {
      this.hoverCell = null;
      this.renderPlacement();
    });
    placementGrid.addEventListener('click', (e) => this.onPlacementClick(e));
    gridArea.appendChild(placementGrid);

    const shipList = document.createElement('div');
    shipList.className = 'bs-ship-list';
    this.shipListEl = shipList;

    const actions = document.createElement('div');
    actions.className = 'bs-placement-actions';

    const rotateBtn = document.createElement('button');
    rotateBtn.type = 'button';
    rotateBtn.className = 'btn btn--secondary';
    rotateBtn.textContent = t('bsRotate');
    rotateBtn.addEventListener('click', () => this.toggleOrientation());

    const autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.className = 'btn btn--secondary';
    autoBtn.textContent = t('bsAutoPlace');
    autoBtn.addEventListener('click', () => this.autoPlace());

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn btn--secondary';
    resetBtn.textContent = t('reset');
    resetBtn.addEventListener('click', () => this.resetPlacement());

    const readyBtn = document.createElement('button');
    readyBtn.type = 'button';
    readyBtn.className = 'btn btn--primary';
    readyBtn.textContent = t('ready');
    readyBtn.disabled = true;
    readyBtn.addEventListener('click', () => this.onLocalReady());
    this.readyBtnEl = readyBtn;

    const waiting = document.createElement('p');
    waiting.className = 'bs-waiting';
    waiting.textContent = t('bsWaitingPlace');
    waiting.hidden = true;
    this.waitingMsgEl = waiting;

    actions.append(rotateBtn, autoBtn, resetBtn, readyBtn, waiting);
    placement.append(gridArea, shipList, actions);

    const combat = document.createElement('div');
    combat.className = 'bs-combat dual-board';
    combat.hidden = true;

    const makeSide = (label: string, cells: HTMLElement[][], clickable: boolean): HTMLElement => {
      const side = document.createElement('div');
      side.className = 'bs-side dual-board__side';
      const lbl = document.createElement('div');
      lbl.className = 'bs-label';
      lbl.textContent = label;
      const grid = document.createElement('div');
      grid.className = 'bs-grid';
      const built = this.buildGrid(grid);
      built.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (clickable) cell.addEventListener('click', () => this.shoot(r, c));
          cells.push(built[r]);
        })
      );
      cells.length = 0;
      built.forEach((row) => cells.push(row));
      side.append(lbl, grid);
      return side;
    };

    const mySide = makeSide('My waters', this.myCells, false);
    const enemySide = makeSide('Enemy waters', this.enemyCells, true);
    this.enemySideEl = enemySide;

    const fireHint = document.createElement('p');
    fireHint.className = 'bs-fire-hint';
    fireHint.setAttribute('aria-hidden', 'true');
    fireHint.textContent = t('bsFireHint');
    enemySide.appendChild(fireHint);

    combat.append(mySide, enemySide);

    board.append(placement, combat);
    this.placementView = placement;
    this.combatView = combat;
  }

  /** Builds a 10×10 grid and returns the cell[row][col] elements. */
  private buildGrid(container: HTMLElement): HTMLElement[][] {
    container.innerHTML = '';
    const cells: HTMLElement[][] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      const rowCells: HTMLElement[] = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        const cell = document.createElement('div');
        cell.className = 'bs-cell';
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        container.appendChild(cell);
        rowCells.push(cell);
      }
      cells.push(rowCells);
    }
    return cells;
  }

  private enterPlacement(): void {
    this.phase = 'placement';
    this.myFleet = [];
    this.pendingShipIdx = 0;
    this.orientation = 'h';
    this.hoverCell = null;
    this.localReady = false;
    this.guestFleet = null;
    this.boardEl?.classList.remove('is-combat');
    document.body.classList.remove('bs-combat-active');
    if (this.placementView) this.placementView.hidden = false;
    if (this.combatView) this.combatView.hidden = true;
    if (this.waitingMsgEl) this.waitingMsgEl.hidden = true;
    this.clearHud();
    this.renderShipList();
    this.renderPlacement();
    this.updateReadyBtn();
  }

  private onPlacementMove(e: MouseEvent): void {
    if (this.pendingShipIdx >= SHIP_DEFS.length) return;
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.bs-cell');
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (this.hoverCell?.row === row && this.hoverCell?.col === col) return;
    this.hoverCell = { row, col };
    this.renderPlacement();
  }

  private onPlacementClick(e: MouseEvent): void {
    if (this.pendingShipIdx >= SHIP_DEFS.length) return;
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.bs-cell');
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    this.placeShip(row, col);
  }

  private placeShip(row: number, col: number): void {
    if (this.pendingShipIdx >= SHIP_DEFS.length) return;
    const def = SHIP_DEFS[this.pendingShipIdx];
    const candidate: ShipPlacement = {
      id: def.id,
      size: def.size,
      row,
      col,
      orientation: this.orientation,
    };
    if (!isValidPlacement(this.myFleet, candidate)) return;
    this.myFleet.push(candidate);
    this.pendingShipIdx++;
    this.hoverCell = null;
    this.renderShipList();
    this.renderPlacement();
    this.updateReadyBtn();
  }

  private toggleOrientation(): void {
    this.orientation = this.orientation === 'h' ? 'v' : 'h';
    this.renderPlacement();
  }

  private autoPlace(): void {
    const remaining = SHIP_DEFS.slice(this.pendingShipIdx);
    const extra = randomFleet().filter((s) => remaining.some((d) => d.id === s.id));
    for (const ship of extra) {
      if (isValidPlacement(this.myFleet, ship)) {
        this.myFleet.push(ship);
        this.pendingShipIdx++;
      }
    }
    if (this.pendingShipIdx < SHIP_DEFS.length) {
      this.myFleet = randomFleet();
      this.pendingShipIdx = SHIP_DEFS.length;
    }
    this.hoverCell = null;
    this.renderShipList();
    this.renderPlacement();
    this.updateReadyBtn();
  }

  /** Clears every placed ship to start the placement over (disabled once ready). */
  private resetPlacement(): void {
    if (this.localReady) return;
    this.myFleet = [];
    this.pendingShipIdx = 0;
    this.hoverCell = null;
    this.renderShipList();
    this.renderPlacement();
    this.updateReadyBtn();
  }

  private updateReadyBtn(): void {
    if (this.readyBtnEl) this.readyBtnEl.disabled = this.pendingShipIdx < SHIP_DEFS.length;
  }

  private onLocalReady(): void {
    if (this.pendingShipIdx < SHIP_DEFS.length) return;
    if (this.mode === 'solo') {
      this.startCombat(this.myFleet, randomFleet());
      return;
    }
    this.localReady = true;
    if (this.net?.role === 'guest') {
      this.net.send(BoardGame.OP_READY, { ships: this.myFleet });
      if (this.readyBtnEl) this.readyBtnEl.disabled = true;
      if (this.waitingMsgEl) this.waitingMsgEl.hidden = false;
    } else if (this.net?.role === 'host') {
      if (this.guestFleet !== null) this.startCombat(this.myFleet, this.guestFleet);
    }
  }

  private startCombat(fleet0: ShipPlacement[], fleet1: ShipPlacement[]): void {
    this.game = initialState(fleet0, fleet1);
    this.phase = 'combat';
    this.boardEl?.classList.add('is-combat');
    document.body.classList.add('bs-combat-active');
    if (this.placementView) this.placementView.hidden = true;
    if (this.combatView) this.combatView.hidden = false;
    this.updateHud();
    this.renderMyGrid();
    this.renderEnemyGrid();

    if (this.mode === 'net' && this.net?.role === 'host') this.broadcastState(null);
    this.gen++;
    void this.runTurn();
  }

  /** Human fired at (row, col): hand it to the coordinator (plays it or relays it). */
  private shoot(row: number, col: number): void {
    if (!this.awaitingHuman || this.phase !== 'combat' || this.game.current !== this.mySeat) return;
    if (this.game.fleets[1 - this.mySeat].shots[cellKey(row, col)]) return;
    this.playLocalMove({ row, col });
  }

  /** Applies a shot to the authoritative state, then broadcasts + schedules. */
  protected commitMove(move: BattleshipMove): void {
    this.stopCountdown();
    const shooter = this.game.current;
    this.game = applyMove(this.game, move);
    this.awaitingHuman = false;
    this.pendingSeat = null;
    this.updateHud();
    this.renderMyGrid();
    this.renderEnemyGrid();
    this.broadcastState(move);
    this.applyShotFx(shooter, move, this.game);

    if (this.game.winner !== null) {
      this.clearTimer();
      this.timer = setTimeout(() => this.gameOver(), this.endDelay);
      return;
    }
    this.timer = setTimeout(() => void this.runTurn(), this.nextTurnDelay);
  }

  private applyShotFx(shooter: number, move: BattleshipMove, newGame: BattleshipState): void {
    const result = newGame.fleets[1 - shooter].shots[cellKey(move.row, move.col)];
    if (!result) return;

    if (result === 'miss') {
      playSound('miss');
    } else if (result === 'sunk') {
      playSound('sunk');
    } else {
      playSound('hit');
    }

    if (!this.fx) return;
    if (result !== 'hit' && result !== 'sunk') return;

    const isMyShot = shooter === this.mySeat;
    const cells = isMyShot ? this.enemyCells : this.myCells;
    const cell = cells[move.row]?.[move.col];
    if (!cell) return;

    const rect = cell.getBoundingClientRect();
    if (rect.width === 0) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = isMyShot
      ? ['#ef4444', '#f97316', '#fbbf24', '#ffffff']
      : ['#3b82f6', '#60a5fa', '#bfdbfe', '#ffffff'];
    const count = result === 'sunk' ? 25 : 12;
    this.fx.emit(cx, cy, {
      count,
      speed: 3.5,
      spread: Math.PI * 2,
      colors,
      size: 5,
      duration: 650,
      gravity: 0.08,
    });
    if (result === 'sunk') {
      this.fx.emit(cx, cy, {
        count: 15,
        speed: 5.5,
        spread: Math.PI * 2,
        colors,
        size: 3,
        duration: 950,
        gravity: 0.04,
      });
    }
    if (!isMyShot) {
      screenShake(result === 'sunk' ? 10 : 5, 300);
    }
  }

  /** Renders the active view (placement grid, or both combat grids). */
  protected renderState(): void {
    if (this.phase === 'placement') {
      this.renderPlacement();
    } else {
      this.renderMyGrid();
      this.renderEnemyGrid();
    }
  }

  protected updateTurnDisplay(): void {
    this.updateHud();
  }

  private renderShipList(): void {
    const el = this.shipListEl;
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < SHIP_DEFS.length; i++) {
      const def = SHIP_DEFS[i];
      const item = document.createElement('div');
      item.className = 'bs-ship-item';
      if (i < this.myFleet.length) item.classList.add('is-placed');
      if (i === this.myFleet.length) item.classList.add('is-current');

      const label = document.createElement('span');
      label.className = 'bs-ship-label';
      label.textContent = `${t(`ship_${def.id}`)} (${def.size})`;

      const bar = document.createElement('div');
      bar.className = 'bs-ship-bar';
      bar.style.setProperty('--ship-size', String(def.size));

      item.append(label, bar);
      el.appendChild(item);
    }
  }

  private renderPlacement(): void {
    const placedKeys = new Set(
      this.myFleet.flatMap((s) => shipCells(s).map((c) => cellKey(c.row, c.col)))
    );

    let previewKeys = new Set<string>();
    let previewValid = false;
    if (this.hoverCell && this.pendingShipIdx < SHIP_DEFS.length) {
      const def = SHIP_DEFS[this.pendingShipIdx];
      const candidate: ShipPlacement = {
        id: def.id,
        size: def.size,
        row: this.hoverCell.row,
        col: this.hoverCell.col,
        orientation: this.orientation,
      };
      previewValid = isValidPlacement(this.myFleet, candidate);
      previewKeys = new Set(shipCells(candidate).map((c) => cellKey(c.row, c.col)));
    }

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const cell = this.placementCells[row]?.[col];
        if (!cell) continue;
        const key = cellKey(row, col);
        const placed = placedKeys.has(key);
        const preview = previewKeys.has(key);
        cell.classList.toggle('is-ship', placed && !preview);
        cell.classList.toggle('is-preview', preview);
        cell.classList.toggle('is-invalid', preview && !previewValid);
      }
    }
  }

  private renderMyGrid(): void {
    if (this.phase !== 'combat') return;
    const fleet = this.game.fleets[this.mySeat];
    const occupied = new Set(
      fleet.ships.flatMap((s) => shipCells(s).map((c) => cellKey(c.row, c.col)))
    );
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const cell = this.myCells[row]?.[col];
        if (!cell) continue;
        const key = cellKey(row, col);
        const shot = fleet.shots[key];
        cell.classList.toggle('is-ship', occupied.has(key) && !shot);
        cell.classList.toggle('is-hit', shot === 'hit');
        cell.classList.toggle('is-sunk', shot === 'sunk');
        cell.classList.toggle('is-miss', shot === 'miss');
      }
    }
  }

  private renderEnemyGrid(): void {
    if (this.phase !== 'combat') return;
    const fleet = this.game.fleets[1 - this.mySeat];
    const canShoot = this.awaitingHuman && this.game.winner === null;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const cell = this.enemyCells[row]?.[col];
        if (!cell) continue;
        const key = cellKey(row, col);
        const shot = fleet.shots[key];
        cell.classList.toggle('is-miss', shot === 'miss');
        cell.classList.toggle('is-hit', shot === 'hit');
        cell.classList.toggle('is-sunk', shot === 'sunk');
        cell.classList.toggle('is-targetable', canShoot && !shot);
      }
    }
    this.enemySideEl?.classList.toggle('is-active', canShoot);
  }

  private updateHud(): void {
    if (this.phase !== 'combat') {
      this.clearHud();
      return;
    }
    const myFleet = this.game.fleets[this.mySeat];
    const enemyFleet = this.game.fleets[1 - this.mySeat];
    this.hud?.set('mine', myFleet.ships.length - myFleet.sunkIds.length);
    this.hud?.set('enemy', enemyFleet.ships.length - enemyFleet.sunkIds.length);
    if (this.game.winner !== null) {
      this.hud?.set('turn', '—');
    } else if (this.game.current === this.mySeat) {
      this.hud?.set('turn', 'My turn');
    } else if (this.humanSeats.has(this.game.current)) {
      this.hud?.set('turn', 'Your turn');
    } else {
      this.hud?.set('turn', "Bot's turn");
    }
  }

  private clearHud(): void {
    this.hud?.set('mine', null);
    this.hud?.set('enemy', null);
    this.hud?.set('turn', null);
    this.hud?.set('time', null);
  }

  /** Host: broadcasts a per-recipient sanitized snapshot (unsunk enemy ships hidden). */
  protected broadcastState(move: BattleshipMove | null = null): void {
    if (this.mode !== 'net' || this.net?.role !== 'host') return;
    const guestSeat = 1 - this.mySeat;
    const sanitized: BattleshipState = {
      ...this.game,
      fleets: [
        guestSeat === 0 ? this.game.fleets[0] : sanitizeFleet(this.game.fleets[0]),
        guestSeat === 1 ? this.game.fleets[1] : sanitizeFleet(this.game.fleets[1]),
      ] as [Fleet, Fleet],
    };
    this.broadcast(BoardGame.OP_STATE, { game: sanitized, move });
  }

  /** Enters a relayed session in the placement phase (combat starts once both are ready). */
  protected beginNet(net: NetMatch): void {
    this.net = net;
    this.mode = 'net';
    this.mySeat = net.seat;
    this.onNetActiveChanged(true);
    net.onMessage((msg) => this.handleNetMessage(msg));
    net.onPeerLeave((seat) => this.onPeerLeave(seat));
    dismissStartOverlay();
    this.overlay.hide();
    this.stop();
    this.humanSeats = new Set(Array.from({ length: net.players }, (_, i) => i));
    this.state.isRunning = true;
    this.state.isGameOver = false;
    this.gen++;
    this.enterPlacement();
  }

  /** Multiplayer freezes the solo-only settings (bot difficulty). */
  protected onNetActiveChanged(active: boolean): void {
    this.settings?.setDisabled(active);
  }

  protected onPeerLeave(seat: number): void {
    this.humanSeats.delete(seat);
    if (this.phase === 'combat' && this.pendingSeat === seat) {
      this.resolvePending(this.decideBotMove([]));
    }
  }

  /** Routes the placement handshake on top of the standard turn protocol. */
  protected handleGameMessage(msg: MatchMessage): void {
    if (this.net?.role === 'host' && msg.opCode === BoardGame.OP_READY) {
      const d = msg.data as { ships?: ShipPlacement[] } | null;
      if (d?.ships) this.onGuestReadyFleet(d.ships);
    }
  }

  private onGuestReadyFleet(ships: ShipPlacement[]): void {
    this.guestFleet = ships;
    if (this.localReady) this.startCombat(this.myFleet, this.guestFleet);
  }

  /** Guest: adopts the host's snapshot; the first one flips it into the combat phase. */
  protected applyNetState(game: BattleshipState, move: BattleshipMove | null): void {
    const prevGame = this.phase === 'combat' ? this.game : null;
    if (this.phase === 'placement') {
      this.phase = 'combat';
      this.boardEl?.classList.add('is-combat');
      document.body.classList.add('bs-combat-active');
      if (this.placementView) this.placementView.hidden = true;
      if (this.combatView) this.combatView.hidden = false;
      this.state.isRunning = true;
      this.gen++;
    }
    this.game = game;
    this.updateHud();
    const ended = game.winner !== null;
    this.awaitingHuman = !ended && game.current === this.mySeat;
    this.renderMyGrid();
    this.renderEnemyGrid();
    if (ended) {
      this.clearTimer();
      this.timer = setTimeout(() => this.gameOver(), this.endDelay);
    }
    if (move && prevGame) {
      this.applyShotFx(prevGame.current, move, game);
    }
  }

  /** Guest: the host called a rematch — back to a fresh placement. */
  protected guestRestart(): void {
    this.clearTimer();
    this.overlay.hide();
    this.state.isRunning = true;
    this.state.isGameOver = false;
    this.awaitingHuman = false;
    this.enterPlacement();
  }

  /** Host: starts a fresh online round — both players place again. */
  protected hostRematch(): void {
    this.broadcast(BoardGame.OP_RESTART, null);
    this.gen++;
    this.clearTimer();
    this.stopCountdown();
    this.overlay.hide();
    this.awaitingHuman = false;
    this.pendingSeat = null;
    this.resetState();
    this.enterPlacement();
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.state.isRunning = true;
    this.state.isGameOver = false;
    this.state.isPaused = false;
    this.gen++;
    this.enterPlacement();
  }

  reset(): void {
    this.gen++;
    this.clearTimer();
    this.stopCountdown();
    this.awaitingHuman = false;
    this.pendingSeat = null;
    this.resetState();
    this.enterPlacement();
  }

  handleInput(event: KeyboardEvent): void {
    if (this.phase === 'placement' && (event.key === 'r' || event.key === 'R')) {
      this.toggleOrientation();
      event.preventDefault();
    }
  }

  protected getGameOverTitle(): string {
    if (this.phase !== 'combat') return t('gameOver');
    return this.game.winner === this.mySeat ? t('victory') : t('defeat');
  }

  protected getGameOverContent(): string {
    if (this.phase !== 'combat') return '';
    return this.game.winner === this.mySeat ? t('battleshipWin') : t('battleshipLose');
  }
}
