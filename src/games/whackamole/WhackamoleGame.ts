import { type Difficulty } from '../../shared/bot/difficulty.js';
import { GameEngine } from '../../shared/engine/GameEngine.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound } from '../../shared/fx/sound.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { difficultyField, numberField, setupSettingsPanel } from '../../shared/ui/settingsPanel.js';
import { WhackamoleDOMRenderer } from './WhackamoleDOMRenderer.js';
import {
  chooseMoleKind,
  chooseNextHole,
  createWhackamoleState,
  expireMole,
  HOLE_COUNT,
  hitMole,
  spawnMole,
  type HitOutcome,
} from './whackamoleLogic.js';
import type { WhackamoleState } from './whackamoleState.js';

const SECOND_MS = 1_000;
const INITIAL_SPAWN_DELAY_MS = 320;
const WRONG_HIT_SHAKE = 3;
const WRONG_HIT_SHAKE_MS = 180;
const PARTICLE_COUNT = 10;
const PARTICLE_SPEED = 2.8;
const PARTICLE_DURATION_MS = 420;
const PARTICLE_SIZE = 4;
const DURATION_CHOICES = [30, 60, 90];

const TUNING: Record<Difficulty, { visibleMs: number; gapMs: number }> = {
  easy: { visibleMs: 1_200, gapMs: 360 },
  medium: { visibleMs: 900, gapMs: 260 },
  hard: { visibleMs: 650, gapMs: 180 },
};

export class WhackamoleGame extends GameEngine {
  private game: WhackamoleState = createWhackamoleState();
  private renderer: WhackamoleDOMRenderer | null = null;
  private fx: ParticleSystem | null = null;
  private difficulty: Difficulty = 'medium';
  private durationSeconds = 60;
  private elapsedMs = 0;
  private nextSpawnMs = INITIAL_SPAWN_DELAY_MS;
  private expiresMs = Infinity;

  constructor() {
    super({ storageKey: 'whackamole-scores', leaderboardId: 'whackamole' });
  }

  initialize(): void {
    const board = document.getElementById('board');
    this.hud = setupHud([
      { key: 'score', icon: 'star', label: t('score') },
      { key: 'time', icon: 'clock', label: t('hudTime') },
      { key: 'streak', icon: 'fire', label: t('hudStreak') },
      { key: 'hits', icon: 'hammer', label: t('whackHits') },
      { key: 'misses', icon: 'xmark', label: t('whackMisses') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);
    if (board) {
      this.renderer = new WhackamoleDOMRenderer(board, (hole) => this.onHole(hole));
      this.fx = new ParticleSystem();
    }
    setupSettingsPanel([
      difficultyField(this.difficulty, (value) => {
        this.difficulty = value as Difficulty;
        this.applySettings();
      }),
      numberField(
        'duration',
        t('whackDuration'),
        this.durationSeconds,
        DURATION_CHOICES,
        (value) => {
          this.durationSeconds = value;
          this.applySettings();
        },
        (value) => `${value}s`
      ),
    ]);
    this.setupEventListeners();
    this.applyLeaderboardVariant();
    this.reset();
  }

  update(deltaTime: number): void {
    this.elapsedMs += deltaTime;
    const durationMs = this.durationSeconds * SECOND_MS;
    if (this.elapsedMs >= durationMs) {
      this.elapsedMs = durationMs;
      this.updateScoreDisplay();
      this.gameOver();
      return;
    }

    if (this.game.active && this.elapsedMs >= this.expiresMs) {
      this.game = expireMole(this.game);
      this.nextSpawnMs = this.elapsedMs + TUNING[this.difficulty].gapMs;
      this.expiresMs = Infinity;
      playSound('miss');
    }
    if (!this.game.active && this.elapsedMs >= this.nextSpawnMs) {
      const hole = chooseNextHole(this.game.lastHole);
      this.game = spawnMole(this.game, hole, chooseMoleKind());
      this.expiresMs = this.elapsedMs + TUNING[this.difficulty].visibleMs;
    }
    this.updateScoreDisplay();
  }

  render(): void {
    this.renderer?.render(this.game);
  }

  handleInput(event: KeyboardEvent): void {
    const hole = Number(event.key) - 1;
    if (!Number.isInteger(hole) || hole < 0 || hole >= HOLE_COUNT) return;
    event.preventDefault();
    this.onHole(hole);
  }

  reset(): void {
    this.resetState();
    this.game = createWhackamoleState();
    this.elapsedMs = 0;
    this.nextSpawnMs = INITIAL_SPAWN_DELAY_MS;
    this.expiresMs = Infinity;
    this.updateScoreDisplay();
    this.render();
  }

  protected updateScoreDisplay(): void {
    super.updateScoreDisplay();
    const remaining = Math.max(
      0,
      Math.ceil((this.durationSeconds * SECOND_MS - this.elapsedMs) / SECOND_MS)
    );
    this.hud?.set('time', `${remaining}s`);
    this.hud?.toggle('time', 'is-low', remaining <= 10);
    this.hud?.set('streak', this.game.combo);
    this.hud?.set('hits', this.game.hits);
    this.hud?.set('misses', this.game.misses);
  }

  protected getGameOverContent(): string {
    return t('whackRecap', {
      score: this.state.score,
      hits: this.game.hits,
      streak: this.game.bestCombo,
    });
  }

  private onHole(hole: number): void {
    if (!this.state.isRunning || this.state.isGameOver) return;
    const result = hitMole(this.game, hole);
    this.game = result.state;
    this.renderer?.animate(hole, result.outcome);
    if (result.outcome === 'miss') {
      screenShake(WRONG_HIT_SHAKE, WRONG_HIT_SHAKE_MS);
      playSound('mismatch');
    } else {
      this.addScore(result.points);
      this.nextSpawnMs = this.elapsedMs + TUNING[this.difficulty].gapMs;
      this.expiresMs = Infinity;
      playSound(result.outcome === 'golden' ? 'combo' : 'hit');
      this.emitHit(hole, result.outcome);
    }
    this.updateScoreDisplay();
    this.render();
  }

  private emitHit(hole: number, outcome: HitOutcome): void {
    const center = this.renderer?.holeCenter(hole);
    if (!this.fx || !center) return;
    const style = getComputedStyle(document.documentElement);
    this.fx.emit(center.x, center.y, {
      count: PARTICLE_COUNT,
      speed: PARTICLE_SPEED,
      duration: PARTICLE_DURATION_MS,
      size: PARTICLE_SIZE,
      gravity: 0.08,
      colors:
        outcome === 'golden'
          ? [
              style.getPropertyValue('--whack-golden').trim(),
              style.getPropertyValue('--whack-golden-light').trim(),
            ]
          : [
              style.getPropertyValue('--whack-mole').trim(),
              style.getPropertyValue('--color-whackamole').trim(),
            ],
    });
  }

  private applySettings(): void {
    this.applyLeaderboardVariant();
    this.stop();
    this.reset();
    this.presentStartScreen();
  }

  private applyLeaderboardVariant(): void {
    this.setLeaderboardVariant(
      `${this.difficulty}-${this.durationSeconds}`,
      `${t(this.difficulty)} · ${this.durationSeconds}s`
    );
  }
}
