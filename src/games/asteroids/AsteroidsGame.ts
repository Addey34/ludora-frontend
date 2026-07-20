import { Difficulty } from '../../shared/bot/difficulty.js';
import { GameEngine } from '../../shared/engine/GameEngine.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound } from '../../shared/fx/sound.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { difficultyField, setupSettingsPanel } from '../../shared/ui/settingsPanel.js';
import { AsteroidsDOMRenderer } from './AsteroidsDOMRenderer.js';
import { BOARD_SIZE, createAsteroidsState, stepAsteroids } from './asteroidsLogic.js';
import type { Asteroid, AsteroidsEvent, AsteroidsState } from './asteroidsState.js';

const LEVEL_CLEAR_BONUS = 250;
const HIT_SHAKE_DISTANCE = 9;
const HIT_SHAKE_DURATION_MS = 320;
const EXPLOSION_PARTICLE_COUNT = 12;
const EXPLOSION_PARTICLE_SPEED = 3.5;
const EXPLOSION_PARTICLE_DURATION_MS = 520;
const EXPLOSION_PARTICLE_SIZE = 4;

const TUNING: Record<Difficulty, { lives: number; speedMultiplier: number }> = {
  easy: { lives: 5, speedMultiplier: 0.82 },
  medium: { lives: 3, speedMultiplier: 1 },
  hard: { lives: 2, speedMultiplier: 1.24 },
};

interface HeldControls {
  left: boolean;
  right: boolean;
  thrust: boolean;
  shoot: boolean;
}

export class AsteroidsGame extends GameEngine {
  private asteroids: AsteroidsState = createAsteroidsState();
  private renderer: AsteroidsDOMRenderer | null = null;
  private board: HTMLElement | null = null;
  private fx: ParticleSystem | null = null;
  private difficulty: Difficulty = 'medium';
  private shootQueued = false;
  private readonly controls: HeldControls = {
    left: false,
    right: false,
    thrust: false,
    shoot: false,
  };

  constructor() {
    super({ storageKey: 'asteroids-scores', leaderboardId: 'asteroids' });
  }

  initialize(): void {
    this.board = document.getElementById('board');
    if (!this.board) return;

    this.renderer = new AsteroidsDOMRenderer(this.board);
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'score', icon: 'star', label: t('score') },
      { key: 'level', icon: 'layer-group', label: t('hudLevel') },
      { key: 'lives', icon: 'heart', label: t('hudLives') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);
    setupSettingsPanel([
      difficultyField(this.difficulty, (value) => {
        this.difficulty = value as Difficulty;
        this.setLeaderboardVariant(this.difficulty, t(this.difficulty));
        this.stop();
        this.reset();
        this.presentStartScreen();
      }),
    ]);
    this.setLeaderboardVariant(this.difficulty, t(this.difficulty));
    this.setupEventListeners();
    this.setupTouchControls();
    this.reset();
  }

  update(deltaTime: number): void {
    const turn = this.controls.left === this.controls.right ? 0 : this.controls.left ? -1 : 1;
    const result = stepAsteroids(
      this.asteroids,
      {
        turn,
        thrust: this.controls.thrust,
        shoot: this.controls.shoot || this.shootQueued,
      },
      deltaTime
    );
    this.shootQueued = false;
    this.asteroids = result.state;
    for (const event of result.events) this.handleEvent(event);
    this.updateScoreDisplay();
  }

  render(): void {
    this.renderer?.render(this.asteroids);
  }

  handleInput(event: KeyboardEvent): void {
    const pressed = event.type === 'keydown';
    let handled = true;
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
      case 'KeyQ':
        this.controls.left = pressed;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.controls.right = pressed;
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'KeyZ':
        this.controls.thrust = pressed;
        break;
      case 'Space':
        this.controls.shoot = pressed;
        if (pressed) this.shootQueued = true;
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  }

  reset(): void {
    this.resetState();
    this.clearControls();
    this.asteroids = this.createLevel(1, TUNING[this.difficulty].lives);
    this.updateScoreDisplay();
    this.render();
  }

  protected setupEventListeners(): void {
    document.addEventListener('keydown', (event) => {
      if (!this.isFormFieldTarget(event.target)) this.handleInput(event);
    });
    document.addEventListener('keyup', (event) => this.handleInput(event));
    window.addEventListener('blur', () => this.clearControls());
  }

  protected updateScoreDisplay(): void {
    super.updateScoreDisplay();
    this.hud?.set('level', this.asteroids.level);
    this.hud?.set('lives', this.asteroids.lives);
  }

  protected getGameOverContent(): string {
    return t('asteroidsRecap', {
      level: this.asteroids.level,
      score: this.state.score,
    });
  }

  private createLevel(level: number, lives: number): AsteroidsState {
    return createAsteroidsState({
      level,
      lives,
      speedMultiplier: TUNING[this.difficulty].speedMultiplier,
    });
  }

  private handleEvent(event: AsteroidsEvent): void {
    if (event.type === 'asteroidDestroyed') {
      this.addScore(event.points);
      this.emitExplosion(event.asteroid);
      playSound('hit');
      return;
    }
    if (event.type === 'shipHit') {
      screenShake(HIT_SHAKE_DISTANCE, HIT_SHAKE_DURATION_MS);
      playSound('die');
      if (this.asteroids.lives === 0) this.gameOver();
      return;
    }

    this.addScore(LEVEL_CLEAR_BONUS * this.asteroids.level);
    playSound('win');
    this.asteroids = this.createLevel(this.asteroids.level + 1, this.asteroids.lives);
  }

  private setupTouchControls(): void {
    if (!this.board) return;
    const controls = document.createElement('div');
    controls.className = 'asteroids-controls';
    controls.setAttribute('aria-label', t('asteroidsTouchControls'));

    this.addHoldButton(controls, 'left', '↶', t('asteroidsTurnLeft'));
    this.addHoldButton(controls, 'thrust', '▲', t('asteroidsThrust'));
    this.addHoldButton(controls, 'right', '↷', t('asteroidsTurnRight'));
    this.addHoldButton(controls, 'shoot', '✦', t('asteroidsShoot'));
    this.board.appendChild(controls);
  }

  private addHoldButton(
    parent: HTMLElement,
    control: keyof HeldControls,
    symbol: string,
    label: string
  ): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `asteroids-control asteroids-control--${control}`;
    button.textContent = symbol;
    button.setAttribute('aria-label', label);

    const setPressed = (pressed: boolean): void => {
      this.controls[control] = pressed;
      if (control === 'shoot' && pressed) this.shootQueued = true;
      button.classList.toggle('is-pressed', pressed);
    };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setPressed(true);
    });
    button.addEventListener('pointerup', () => setPressed(false));
    button.addEventListener('pointercancel', () => setPressed(false));
    button.addEventListener('lostpointercapture', () => setPressed(false));
    parent.appendChild(button);
  }

  private clearControls(): void {
    this.controls.left = false;
    this.controls.right = false;
    this.controls.thrust = false;
    this.controls.shoot = false;
    this.shootQueued = false;
    this.board
      ?.querySelectorAll('.asteroids-control.is-pressed')
      .forEach((button) => button.classList.remove('is-pressed'));
  }

  private emitExplosion(asteroid: Asteroid): void {
    if (!this.board || !this.fx) return;
    const rect = this.board.getBoundingClientRect();
    const style = getComputedStyle(document.documentElement);
    this.fx.emit(
      rect.left + (asteroid.position.x / BOARD_SIZE) * rect.width,
      rect.top + (asteroid.position.y / BOARD_SIZE) * rect.height,
      {
        count: EXPLOSION_PARTICLE_COUNT,
        speed: EXPLOSION_PARTICLE_SPEED,
        duration: EXPLOSION_PARTICLE_DURATION_MS,
        size: EXPLOSION_PARTICLE_SIZE,
        gravity: 0,
        colors: [
          style.getPropertyValue('--asteroids-rock').trim(),
          style.getPropertyValue('--asteroids-flame').trim(),
          style.getPropertyValue('--asteroids-star').trim(),
        ],
      }
    );
  }
}
