import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { setupSettingsPanel, difficultyField } from '../../shared/ui/settingsPanel.js';
import { Stopwatch, formatClock } from '../../shared/ui/stopwatch.js';
import { playSound } from '../../shared/fx/sound.js';
import { ParticleSystem, celebrate } from '../../shared/fx/particles.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import {
  setupCompletionRace,
  type CompletionRaceHandle,
} from '../../shared/versus/completionRaceController.js';
import {
  TaquinState,
  Dir,
  initial,
  isSolved,
  shuffle,
  move,
  clickTile,
  isMovable,
} from './taquin.js';

interface DiffDef {
  size: number;
  shuffleMoves: number;
  base: number;
  movePenalty: number;
}

const DIFFICULTIES: Record<Difficulty, DiffDef> = {
  easy: { size: 3, shuffleMoves: 200, base: 500, movePenalty: 4 },
  medium: { size: 4, shuffleMoves: 800, base: 1200, movePenalty: 5 },
  hard: { size: 5, shuffleMoves: 1500, base: 2500, movePenalty: 7 },
};

/**
 * Taquin (Sliding Puzzle): rearrange the numbered tiles into order by sliding
 * them into the blank space. Arrow keys move the blank; clicking a tile adjacent
 * to the blank slides it. Fewer moves = higher score. Difficulty sets the grid
 * size (3×3 / 4×4 / 5×5); each has its own leaderboard.
 */
export class TaquinGame extends GameEngine {
  private boardEl: HTMLElement | null = null;
  private tileEls: HTMLElement[] = [];
  private fx: ParticleSystem | null = null;

  private difficulty: Difficulty = 'easy';
  private puzzle: TaquinState = initial(3);
  private moves = 0;
  private race: CompletionRaceHandle | null = null;

  private readonly clock = new Stopwatch((s) => this.hud?.set('time', formatClock(s)));

  constructor() {
    super({ storageKey: 'taquin-scores', leaderboardId: 'taquin' });
  }

  private get def(): DiffDef {
    return DIFFICULTIES[this.difficulty];
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'moves', icon: 'arrows-up-down-left-right', label: t('hudMoves') },
      { key: 'time', icon: 'clock', label: t('hudTime') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
      { key: 'opponent', icon: 'users', label: t('scoreRaceOpponent') },
    ]);
    this.race = setupCompletionRace<TaquinState>(this, {
      finish: { kind: 'bestTime' },
      generateChallenge: () => shuffle(initial(this.def.size), this.def.shuffleMoves),
      applyChallenge: (seed) => this.applyChallenge(seed),
      getElapsedMs: () => this.clock.seconds * 1000,
      onOpponentStatus: (timeMs) =>
        this.hud?.set('opponent', timeMs === null ? '—' : formatClock(Math.round(timeMs / 1000))),
    });
    this.setupEventListeners();
    setupSettingsPanel([
      difficultyField(this.difficulty, (v) => {
        this.difficulty = (v as Difficulty) ?? 'easy';
        this.overlay.hide();
        this.stop();
        this.start();
      }),
    ]);
    this.applyLeaderboardVariant();
    this.newRound();
  }

  private applyLeaderboardVariant(): void {
    const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
    this.setLeaderboardVariant(this.difficulty, cap(this.difficulty));
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.resetState();
    this.applyLeaderboardVariant();
    this.newRound();
    this.state.isRunning = true;
  }

  stop(): void {
    this.clock.stop();
    super.stop();
  }

  reset(): void {
    this.resetState();
    this.newRound();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.start();
  }

  private newRound(): void {
    this.moves = 0;
    this.puzzle = shuffle(initial(this.def.size), this.def.shuffleMoves);
    this.clock.reset();
    this.clock.start();
    this.buildBoard();
    this.hud?.set('moves', 0);
    this.hud?.set('time', formatClock(0));
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  /** Builds and starts the identical shared round from a host-sent challenge. */
  private applyChallenge(seed: TaquinState): void {
    this.overlay.hide();
    this.resetState();
    this.puzzle = seed;
    this.moves = 0;
    this.clock.reset();
    this.clock.start();
    this.buildBoard();
    this.hud?.set('moves', 0);
    this.hud?.set('time', formatClock(0));
    this.hud?.set('high', this.scoreManager.getHighScore());
    this.state.isRunning = true;
  }

  private buildBoard(): void {
    const board = this.boardEl;
    if (!board) return;
    const size = this.puzzle.size;
    board.style.setProperty('--size', String(size));
    board.innerHTML = '';
    this.tileEls = [];
    for (let i = 0; i < size * size; i++) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.dataset['idx'] = String(i);
      tile.addEventListener('click', () => this.onTileClick(i));
      board.appendChild(tile);
      this.tileEls.push(tile);
    }
    this.renderBoard();
  }

  private renderBoard(): void {
    const { grid, blank } = this.puzzle;
    this.tileEls.forEach((el, i) => {
      const val = grid[i];
      el.textContent = val === 0 ? '' : String(val);
      el.className = 'tq-tile';
      if (i === blank) el.classList.add('tq-blank');
      else if (isMovable(this.puzzle, i)) el.classList.add('tq-movable');
    });
  }

  private onTileClick(idx: number): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    const next = clickTile(this.puzzle, idx);
    if (!next) return;
    this.applyMove(next);
  }

  private applyMove(next: TaquinState): void {
    // The tile that slid now sits where the blank used to be — pop it.
    const slidInto = this.puzzle.blank;
    this.puzzle = next;
    this.moves++;
    this.hud?.set('moves', this.moves);
    playSound('move');
    this.renderBoard();
    const el = this.tileEls[slidInto];
    if (el) {
      el.classList.remove('tq-pop');
      void el.offsetWidth; // restart the pop animation
      el.classList.add('tq-pop');
    }
    if (isSolved(this.puzzle)) this.onSolved();
  }

  private onSolved(): void {
    this.clock.stop();
    const { base, movePenalty } = this.def;
    const score = Math.max(0, base - this.moves * movePenalty);
    this.addScore(score);
    playSound('win');
    celebrate(this.fx, this.boardEl);
    this.gameOver();
  }

  handleInput(event: KeyboardEvent): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    const dirMap: Record<string, Dir> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    const dir = dirMap[event.key];
    if (!dir) return;
    event.preventDefault();
    const next = move(this.puzzle, dir);
    if (next) this.applyMove(next);
  }

  update(_dt: number): void {}
  render(): void {}

  protected onGameOver(): void {
    if (this.race?.reportSolved(this.clock.seconds * 1000)) return;
    super.onGameOver();
  }

  protected getGameOverTitle(): string {
    return t('solved');
  }

  protected getGameOverContent(): string {
    return t('taquinRecap', { moves: String(this.moves), score: String(this.state.score) });
  }

  protected updateScoreDisplay(): void {
    this.hud?.set('high', this.scoreManager.getHighScore());
  }
}
