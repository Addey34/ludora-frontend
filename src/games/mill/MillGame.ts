import { Difficulty } from '../../shared/bot/difficulty.js';
import { t } from '../../shared/i18n/i18n.js';
import { BoardGame } from '../../shared/turn/BoardGame.js';
import type { TurnRules } from '../../shared/turn/turnGame.js';
import { setupHud } from '../../shared/ui/hud.js';
import {
  difficultyField,
  setupSettingsPanel,
  SettingsPanelHandle,
} from '../../shared/ui/settingsPanel.js';
import { showToast } from '../../shared/ui/toast.js';
import {
  createMillState,
  millRules,
  PIECES_PER_PLAYER,
  POINT_COUNT,
  SEATS,
  type MillMove,
  type MillState,
} from './mill.js';
import { decideMove } from './millBot.js';

/** Grid coordinates (0–6) of each of the 24 points, matching the SVG board lines. */
const COORDS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [3, 0],
  [6, 0],
  [1, 1],
  [3, 1],
  [5, 1],
  [2, 2],
  [3, 2],
  [4, 2],
  [0, 3],
  [1, 3],
  [2, 3],
  [4, 3],
  [5, 3],
  [6, 3],
  [2, 4],
  [3, 4],
  [4, 4],
  [1, 5],
  [3, 5],
  [5, 5],
  [0, 6],
  [3, 6],
  [6, 6],
];

export class MillGame extends BoardGame<MillState, MillMove> {
  private points: HTMLButtonElement[] = [];
  private selected: number | null = null;
  private removePrompted = false;

  private difficulty: Difficulty = 'medium';
  private settings: SettingsPanelHandle | null = null;
  /** Solo only: whether the bot (white) takes the first move (Settings). */
  private botStarts = false;

  constructor() {
    super({ storageKey: 'mill-scores' });
  }

  protected get rules(): TurnRules<MillState, MillMove> {
    return millRules;
  }

  initialize(): void {
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

  /** A fresh board; in solo the bot (seat 1) takes the first turn when configured. */
  protected freshGame(): MillState {
    const state = createMillState();
    if (this.mode === 'solo' && this.botStarts) state.current = 1;
    return state;
  }

  /** Clears the pending selection between rounds. */
  protected onRoundReset(): void {
    this.selected = null;
    this.removePrompted = false;
  }

  /** Multiplayer freezes the solo-only settings (difficulty / first move). */
  protected onNetActiveChanged(active: boolean): void {
    this.settings?.setDisabled(active);
  }

  handleInput(_event: KeyboardEvent): void {
    // Pointer-driven game; no keyboard mapping.
  }

  protected moveEquals(a: MillMove, b: MillMove): boolean {
    if (a.type !== b.type) return false;
    if (a.type === 'place' && b.type === 'place') return a.to === b.to;
    if (a.type === 'move' && b.type === 'move') return a.from === b.from && a.to === b.to;
    if (a.type === 'remove' && b.type === 'remove') return a.at === b.at;
    return false;
  }

  protected decideBotMove(legalMoves: MillMove[]): MillMove {
    return decideMove(this.game, legalMoves, this.difficulty);
  }

  protected isRoundOver(): boolean {
    return this.game.winner !== null;
  }

  protected getGameOverTitle(): string {
    if (this.game.winner === null) return t('draw');
    return this.game.winner === this.mySeat ? t('youWin') : t('youLose');
  }

  protected renderState(): void {
    // Drop a stale selection (e.g. after a rematch resets the board).
    if (this.selected !== null && this.game.board[this.selected] !== this.mySeat)
      this.selected = null;
    const myTurn = this.awaitingHuman && this.game.current === this.mySeat && !this.isRoundOver();
    this.points.forEach((point, index) => {
      const seat = this.game.board[index];
      point.classList.toggle('is-seat-0', seat === 0);
      point.classList.toggle('is-seat-1', seat === 1);
      point.classList.toggle('is-empty', seat === null);
      point.classList.toggle('is-selected', this.selected === index);
      point.disabled = !myTurn;
    });

    // Prompt the human once when their mill forces a capture.
    const prompt = myTurn && this.game.mustRemove;
    if (prompt && !this.removePrompted) showToast(t('millCapture'), 'combo');
    this.removePrompted = prompt;
  }

  private buildBoard(): void {
    const host = document.querySelector<HTMLElement>('.mill-points');
    if (!host) return;
    host.replaceChildren();
    this.points = Array.from({ length: POINT_COUNT }, (_, index) => {
      const [x, y] = COORDS[index];
      const point = document.createElement('button');
      point.type = 'button';
      point.className = 'mill-point is-empty';
      point.dataset.index = String(index);
      point.style.left = `${(x / 6) * 100}%`;
      point.style.top = `${(y / 6) * 100}%`;
      point.setAttribute('aria-label', String(index + 1));
      point.addEventListener('click', () => this.onPoint(index));
      host.append(point);
      return point;
    });
  }

  private onPoint(index: number): void {
    if (!this.awaitingHuman || this.game.current !== this.mySeat || this.isRoundOver()) return;

    if (this.game.mustRemove) {
      this.commit({ type: 'remove', at: index });
      return;
    }

    if (this.game.placed[this.mySeat] < PIECES_PER_PLAYER) {
      this.commit({ type: 'place', to: index });
      return;
    }

    // Moving / flying: first pick one of your pieces, then a destination.
    if (this.game.board[index] === this.mySeat) {
      this.selected = this.selected === index ? null : index;
      this.renderState();
      return;
    }
    if (this.selected !== null) {
      this.commit({ type: 'move', from: this.selected, to: index });
    }
  }

  private commit(move: MillMove): void {
    if (!this.rules.legalMoves(this.game).some((m) => this.moveEquals(m, move))) return;
    this.selected = null;
    this.playLocalMove(move);
  }
}
