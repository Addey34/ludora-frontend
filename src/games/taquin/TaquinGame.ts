import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { setupSettingsPanel, difficultyField } from '../../shared/ui/settingsPanel.js';
import { Stopwatch, formatClock } from '../../shared/ui/stopwatch.js';
import { playSound } from '../../shared/fx/sound.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { Difficulty } from '../../shared/quiz/quiz.js';
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
    ]);
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

  private buildBoard(): void {
    const board = this.boardEl;
    if (!board) return;
    const { size } = this.def;
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
    this.puzzle = next;
    this.moves++;
    this.hud?.set('moves', this.moves);
    playSound('move');
    this.renderBoard();
    if (isSolved(this.puzzle)) this.onSolved();
  }

  private onSolved(): void {
    this.clock.stop();
    const { base, movePenalty } = this.def;
    const score = Math.max(0, base - this.moves * movePenalty);
    this.addScore(score);
    playSound('win');
    this.emitBurst();
    this.gameOver();
  }

  private emitBurst(): void {
    if (!this.fx || !this.boardEl) return;
    const rect = this.boardEl.getBoundingClientRect();
    if (rect.width === 0) return;
    this.fx.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
      count: 30,
      speed: 5,
      spread: Math.PI * 2,
      colors: ['#e11d48', '#fbbf24', '#ffffff', '#34d399'],
      size: 6,
      duration: 1100,
      gravity: 0.06,
    });
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
