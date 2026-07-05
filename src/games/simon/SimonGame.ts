import { GameEngine } from '../../shared/engine/GameEngine.js';
import { setupHud } from '../../shared/ui/hud.js';
import { t } from '../../shared/i18n/i18n.js';
import { dismissStartOverlay } from '../../shared/ui/startOverlay.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound, playTone } from '../../shared/fx/sound.js';
import { extendSequence, flashInterval, PADS, Pad } from './simon.js';

/** A distinct note per pad (E4, C4, A3, E3) — the classic Simon-style chord. */
const PAD_FREQS = [329.63, 261.63, 220.0, 164.81];

/**
 * Simon: watch a growing sequence of coloured flashes, then reproduce it. Each
 * completed round adds one flash and speeds the playback up; a single wrong pad
 * ends the game. The score is the length of the longest sequence reproduced.
 *
 * Like 2048/Typing this game is event-driven (pad clicks + keys), so it doesn't
 * use the engine's `requestAnimationFrame` loop: {@link start} kicks off the
 * first round and everything else is driven by timers and input. A generation
 * counter ({@link gen}) invalidates any in-flight playback when the game is
 * reset, so a stale flash can never touch a fresh round.
 */
export class SimonGame extends GameEngine {
  private boardEl: HTMLElement | null = null;
  private pads: HTMLButtonElement[] = [];
  private fx: ParticleSystem | null = null;

  /** The sequence to reproduce (pad indices). */
  private sequence: Pad[] = [];
  /** How far the player has got in reproducing the current sequence. */
  private inputIndex = 0;
  /** True only while the player's input is expected (not during playback). */
  private acceptingInput = false;
  /** Bumped on every reset/start so a scheduled flash from an old round bails. */
  private gen = 0;
  /** Pending playback/echo timers, cleared on reset. */
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    super({ storageKey: 'simon-scores', leaderboardId: 'simon' });
  }

  initialize(): void {
    this.boardEl = document.getElementById('board');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'score', icon: 'star', label: t('hudRound') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
      { key: 'status', icon: 'eye', label: t('hudStatus') },
    ]);

    this.buildPads();
    this.setupEventListeners();
    this.renderScoreTable();
    this.updateScoreDisplay();
  }

  private buildPads(): void {
    const board = this.boardEl;
    if (!board) return;
    board.innerHTML = '';
    this.pads = [];
    for (let i = 0; i < PADS; i++) {
      const pad = document.createElement('button');
      pad.type = 'button';
      pad.className = `simon-pad simon-pad--${i}`;
      pad.dataset.pad = String(i);
      pad.setAttribute('aria-label', `Pad ${i + 1}`);
      pad.addEventListener('click', () => this.onPad(i));
      board.appendChild(pad);
      this.pads.push(pad);
    }
  }

  /** Event-driven: activate the state and launch the first round (no rAF loop). */
  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.resetState();
    this.state.isRunning = true;
    this.sequence = [];
    this.gen++;
    this.updateScoreDisplay();
    this.nextRound();
  }

  reset(): void {
    this.gen++;
    this.clearTimers();
    this.resetState();
    this.sequence = [];
    this.inputIndex = 0;
    this.acceptingInput = false;
    this.pads.forEach((p) => p.classList.remove('is-lit', 'is-wrong'));
    this.hud?.set('status', null);
    this.updateScoreDisplay();
  }

  /** Grows the sequence by one pad and plays it back before the player's turn. */
  private nextRound(): void {
    this.sequence = extendSequence(this.sequence);
    this.inputIndex = 0;
    this.acceptingInput = false;
    this.setPadsEnabled(false);
    this.hud?.set('status', 'Watch');
    this.playbackSequence();
  }

  private playbackSequence(): void {
    const gen = this.gen;
    const interval = flashInterval(this.sequence.length);
    this.sequence.forEach((pad, i) => {
      this.schedule(
        () => {
          if (gen !== this.gen) return;
          this.flashPad(pad, interval * 0.55);
        },
        i * interval + 400
      );
    });
    // Hand over to the player once the whole sequence has been shown.
    this.schedule(
      () => {
        if (gen !== this.gen) return;
        this.acceptingInput = true;
        this.setPadsEnabled(true);
        this.hud?.set('status', 'Your turn');
      },
      this.sequence.length * interval + 400
    );
  }

  /** Lights a pad and plays its note for `ms` milliseconds. */
  private flashPad(pad: Pad, ms: number): void {
    const el = this.pads[pad];
    if (!el) return;
    el.classList.add('is-lit');
    playTone(PAD_FREQS[pad] ?? 220);
    this.schedule(() => el.classList.remove('is-lit'), ms);
  }

  private onPad(pad: Pad): void {
    if (!this.acceptingInput || !this.state.isRunning) return;

    if (pad !== this.sequence[this.inputIndex]) {
      // Wrong pad: light it red and shake so the mistake is visible, then hand
      // over to the game-over flow after a short beat (guarded by the generation
      // counter so a reset in between cancels it).
      this.acceptingInput = false;
      this.setPadsEnabled(false);
      const el = this.pads[pad];
      el?.classList.add('is-lit', 'is-wrong');
      screenShake(6, 300);
      playSound('die');
      const gen = this.gen;
      this.schedule(() => {
        if (gen !== this.gen) return;
        el?.classList.remove('is-lit', 'is-wrong');
        this.gameOver();
      }, 550);
      return;
    }

    this.flashPad(pad, 180);
    this.inputIndex++;
    if (this.inputIndex === this.sequence.length) {
      // Round cleared: score is the sequence length reproduced.
      this.acceptingInput = false;
      this.setPadsEnabled(false);
      this.addScore(1);
      playSound('score');
      this.emitBurst();
      this.hud?.set('status', 'Nice!');
      this.schedule(() => this.nextRound(), 700);
    }
  }

  private emitBurst(): void {
    if (!this.fx || !this.boardEl) return;
    const rect = this.boardEl.getBoundingClientRect();
    if (rect.width === 0) return;
    this.fx.emit(rect.left + rect.width / 2, rect.top + rect.height / 2, {
      count: 16,
      speed: 3,
      spread: Math.PI * 2,
      colors: ['#22c55e', '#ef4444', '#eab308', '#3b82f6', '#ffffff'],
      size: 4,
      duration: 700,
      gravity: 0.06,
    });
  }

  private setPadsEnabled(on: boolean): void {
    this.pads.forEach((p) => (p.disabled = !on));
  }

  private schedule(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  /** Keyboard shortcut: keys 1-4 trigger the four pads. */
  handleInput(event: KeyboardEvent): void {
    const pad = ['1', '2', '3', '4'].indexOf(event.key);
    if (pad >= 0) this.onPad(pad);
  }

  update(): void {}
  render(): void {}

  protected updateScoreDisplay(): void {
    this.hud?.set('score', this.state.score);
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  protected onGameOver(): void {
    this.hud?.set('status', null);
    super.onGameOver();
  }

  protected getGameOverContent(): string {
    const s = this.state.score;
    return `<p>You reproduced a sequence of <strong>${s}</strong> step${s === 1 ? '' : 's'}.</p>`;
  }
}
