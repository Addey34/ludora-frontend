import { GameEngine, GameConfig } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupPaddlePointer } from '../../shared/engine/pointerControl.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import { pongBotTargetY } from './pongBot.js';
import { VersusRole } from '../../shared/versus/opponent.js';
import {
  setupSettingsPanel,
  SettingsPanelHandle,
  difficultyField,
} from '../../shared/ui/settingsPanel.js';
import { setupHud } from '../../shared/ui/hud.js';
import { setupMultiplayerPanel, MultiplayerHandle } from '../../shared/versus/multiplayerPanel.js';
import { NetMatch, MatchMessage } from '../../shared/net/match.js';
import { runCountdown } from '../../shared/ui/countdown.js';
import { GameOverlayButton } from '../../shared/ui/gameOverlay.js';
import { ParticleSystem } from '../../shared/fx/particles.js';
import { screenShake } from '../../shared/fx/screenShake.js';
import { playSound } from '../../shared/fx/sound.js';
import {
  PONG_BASE_SPEED,
  PONG_BOARD,
  PONG_BOT_SPEED,
  PONG_DEFAULT_WIN_SCORE,
  PONG_END_DELAY,
  PONG_OPPONENT_X,
  PONG_PLAYER_SPEED,
  PONG_WIN_SCORES,
  type PongGameState,
  type PongRenderState,
  type PongHostState,
} from './pongState.js';
import { PongDOMRenderer } from './PongDOMRenderer.js';
import {
  approachPongPaddle,
  clampPongPaddle,
  createPongGameState,
  createPongServe,
  stepPongBall,
} from './pongLogic.js';
/** Match-state op codes exchanged over the relay (see net/match.ts). */
const OP_INPUT = 1;
const OP_STATE = 2;
const OP_END = 3;
const OP_RESTART = 4;
/** How often (ms) the host broadcasts state / the guest sends its input (~25 Hz). */
const NET_SEND_MS = 40;

/** Guest correction strength applied to the ball on each snapshot (0–1): low
 *  enough to absorb network jitter, high enough to stay in sync. */
const NET_CORRECT = 0.5;

/**
 * Pong — the first versus game (1-v-1).
 *
 * Two vertical paddles, a ball bouncing between them; first to {@link winScore}
 * points wins. The player drives the left paddle (↑/↓ or Z/S, or drag/mouse on
 * the board); the right paddle is the opponent. In `solo` it is a bot whose skill
 * is tuned in the Settings panel; in multiplayer it is the remote player, with
 * the host simulating the ball authoritatively.
 *
 * Reuses the engine's `requestAnimationFrame` loop: the ball advances in small
 * sub-steps proportional to `deltaTime` so collisions stay reliable at speed
 * (same approach as {@link BreakoutGame}).
 */
export class PongGame extends GameEngine {
  /** Who drives the opponent / who is authoritative (see {@link VersusRole}). */
  protected role: VersusRole = 'solo';
  /** Bot difficulty (solo / host-side fill-in), set from the Settings panel. */
  private difficulty: Difficulty = 'medium';
  /** Points needed to win the match. */
  private winScore = PONG_DEFAULT_WIN_SCORE;

  private pongState: PongGameState = createPongGameState();

  /** Movement keys held down by the player. */
  private readonly keys = { up: false, down: false };

  /** Live relayed match in multiplayer (null in solo). */
  private net: NetMatch | null = null;
  /** Handle to the multiplayer panel (to leave from the game-over overlay). */
  private multiplayer: MultiplayerHandle | null = null;
  /** Handle to the settings panel (disabled while in a session). */
  private settings: SettingsPanelHandle | null = null;
  /** Latest guest paddle target received by the host (host applies it, capped). */
  private guestTargetY = PONG_BOARD / 2;
  /** Guest-side target for the opponent (host) paddle, smoothed each frame. */
  private opponentTargetY = PONG_BOARD / 2;
  /** Guest-side flag: the host is serving, so the guest freezes the ball. */
  private guestServing = false;
  /** Throttle accumulator for network sends (ms). */
  private netSendAcc = 0;

  private fx: ParticleSystem | null = null;

  private boardElement: HTMLElement | null = null;
  private renderer: PongDOMRenderer | null = null;

  constructor(config: GameConfig = {}) {
    super({ ...config, storageKey: 'pong' });
  }

  /**
   * Binds the DOM, builds the board, wires controls + the Settings panel, then
   * performs the first render and arms the kickoff serve.
   */
  initialize(): void {
    this.fx = new ParticleSystem();
    this.boardElement = document.getElementById('board');
    this.hud = setupHud([
      { key: 'score', icon: 'user', label: t('me') },
      { key: 'opp', icon: 'user', label: t('opponent') },
    ]);

    if (this.boardElement) this.renderer = new PongDOMRenderer(this.boardElement);
    this.setupEventListeners();
    this.setupSettings();
    this.multiplayer = setupMultiplayerPanel({
      onSessionStart: (net) => this.beginVersus(net),
      onSessionEnd: () => this.endVersus(),
    });
    this.resetBall(true);
    this.updateScoreDisplay();
    this.render();
  }

  /**
   * Player controls: hold ↑/↓ or Z/S (continuous movement applied in
   * {@link update}) and drag/mouse on the board. Overrides the engine's one-shot
   * keyboard listening.
   */
  protected setupEventListeners(): void {
    document.addEventListener('keydown', (e) => this.setKey(e, true));
    document.addEventListener('keyup', (e) => this.setKey(e, false));
    if (this.boardElement) {
      setupPaddlePointer({
        board: this.boardElement,
        axis: 'y',
        onMove: (ratio) => {
          this.pongState.playerY = clampPongPaddle(ratio * PONG_BOARD);
        },
        getRatio: () => this.pongState.playerY / PONG_BOARD,
      });
    }
  }

  /** Builds the Settings panel (bot difficulty + win score). No-op without markup. */
  private setupSettings(): void {
    this.settings = setupSettingsPanel([
      difficultyField(this.difficulty, (value) => {
        this.difficulty = value as Difficulty;
      }),
      {
        id: 'winScore',
        label: t('firstTo'),
        value: String(this.winScore),
        choices: PONG_WIN_SCORES.map((n) => ({ label: `${n} pts`, value: String(n) })),
        onChange: (value) => {
          this.winScore = Number(value);
          this.reset();
          if (this.state.isRunning) this.start();
        },
      },
    ]);
  }

  /** Tracks a held movement key (and stops the arrows from scrolling the page). */
  private setKey(event: KeyboardEvent, pressed: boolean): void {
    if (this.isFormFieldTarget(event.target)) return;
    if (event.code === 'ArrowUp' || event.code === 'KeyW' || event.code === 'KeyZ') {
      this.keys.up = pressed;
      event.preventDefault();
    } else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
      this.keys.down = pressed;
      event.preventDefault();
    }
  }

  /** Required by the engine; movement is continuous (held keys), handled in update. */
  handleInput(_event: KeyboardEvent): void {}

  /**
   * Advances the match a frame: player paddle, opponent paddle, then the ball
   * (unless a serve countdown is running, or this client is a non-authoritative
   * guest, which only predicts the ball between the host's snapshots).
   */
  update(deltaTime: number): void {
    if (this.state.isPaused || this.state.isGameOver) return;
    const dt = Math.min(deltaTime, 32);

    this.movePlayer(dt);

    if (this.role === 'guest') {
      this.sendGuestInput(dt);
      this.pongState.opponentY = approachPongPaddle(
        this.pongState.opponentY,
        this.opponentTargetY,
        PONG_PLAYER_SPEED * dt
      );
      if (!this.guestServing) this.stepBall(dt, false);
      return;
    }

    this.moveOpponent(dt);

    if (this.pongState.serveTimer > 0) {
      this.pongState.serveTimer -= dt;
    } else {
      this.stepBall(dt, true);
    }
    this.maybeBroadcastState(dt);
  }

  /** Moves the player's paddle from the held keys, clamped to the board. */
  private movePlayer(dt: number): void {
    let dir = 0;
    if (this.keys.up) dir -= 1;
    if (this.keys.down) dir += 1;
    if (dir !== 0)
      this.pongState.playerY = clampPongPaddle(
        this.pongState.playerY + dir * PONG_PLAYER_SPEED * dt
      );
  }

  /**
   * Moves the opponent paddle. In `host` it tracks the guest's last input,
   * capped at the human paddle speed so a tampered guest can't teleport
   * (relayed-mode anti-cheat). In `solo` it follows the bot's target.
   */
  private moveOpponent(dt: number): void {
    let target: number;
    let speed: number;
    if (this.role === 'host') {
      target = this.guestTargetY;
      speed = PONG_PLAYER_SPEED;
    } else {
      target = pongBotTargetY(
        {
          ballX: this.pongState.ball.x,
          ballY: this.pongState.ball.y,
          ballVx: this.pongState.ball.vx,
          ballVy: this.pongState.ball.vy,
          paddleX: PONG_OPPONENT_X,
          boardSize: PONG_BOARD,
        },
        this.difficulty
      );
      speed = PONG_BOT_SPEED;
    }
    this.pongState.opponentY = approachPongPaddle(this.pongState.opponentY, target, speed * dt);
  }

  /**
   * Advances the ball in sub-steps (≤ one radius each), bouncing off the top/
   * bottom walls and the paddles, and awarding a point when it exits a side.
   */
  private stepBall(dt: number, allowScore: boolean): void {
    const result = stepPongBall(
      this.pongState.ball,
      this.pongState.speed,
      { playerY: this.pongState.playerY, opponentY: this.pongState.opponentY },
      dt
    );
    this.pongState.ball = result.ball;
    this.pongState.speed = result.speed;

    if (result.wallBounce) playSound('bounce');
    if (result.paddleBounceDir) this.onPaddleBounce(result.paddleBounceDir);

    if (result.scored === 'opponent') {
      if (allowScore) this.concede(false);
      return;
    }
    if (result.scored === 'player' && allowScore) this.concede(true);
  }

  private onPaddleBounce(dirX: 1 | -1): void {
    playSound('bounce');

    const ballElement = this.renderer?.getBallElement();
    if (this.fx && ballElement) {
      const rect = ballElement.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      this.fx.emit(cx, cy, {
        count: 6,
        speed: 2,
        spread: Math.PI / 3,
        angle: dirX > 0 ? 0 : Math.PI,
        colors: ['#ffffff', 'rgba(255,255,255,0.55)', '#94a3b8'],
        size: 3,
        duration: 340,
        gravity: 0.05,
      });
    }
  }

  /**
   * Awards the point, refreshes the display and either ends the match (a player
   * reached {@link winScore}) or arms the next serve toward the conceding side.
   * @param toPlayer true when the player scored (ball exited the opponent side).
   */
  private concede(toPlayer: boolean): void {
    if (toPlayer) this.addScore(1);
    else this.pongState.opponentScore += 1;
    this.updateScoreDisplay();
    playSound('score');
    screenShake(toPlayer ? 3 : 8, toPlayer ? 180 : 300);

    if (this.state.score >= this.winScore || this.pongState.opponentScore >= this.winScore) {
      if (this.role === 'host') {
        this.net?.send(OP_END, { hs: this.state.score, gs: this.pongState.opponentScore });
      }
      this.endMatch();
      return;
    }
    this.resetBall(!toPlayer);
  }

  /**
   * Freezes the rally and reveals the result after a short beat, so the winning
   * point is visible on the scoreboard before the victory/defeat overlay.
   */
  private endMatch(): void {
    this.stop();
    this.pongState.ball.vx = 0;
    this.pongState.ball.vy = 0;
    this.updateScoreDisplay();
    window.setTimeout(() => this.gameOver(), PONG_END_DELAY);
  }

  /** Recenters the ball and arms a serve toward the given side after a pause. */
  private resetBall(toPlayer: boolean): void {
    const serve = createPongServe(toPlayer);
    this.pongState.speed = serve.speed;
    this.pongState.serveTimer = serve.serveTimer;
    this.pongState.ball = serve.ball;
  }

  /** Positions the ball and both paddles from their logical state. */
  render(): void {
    this.renderer?.render(this.renderState());
  }

  private renderState(): PongRenderState {
    return this.pongState;
  }
  /** Resets scores, paddles, ball and state for a fresh match. */
  reset(): void {
    this.resetState();
    this.pongState = createPongGameState();
    this.opponentTargetY = PONG_BOARD / 2;
    this.guestServing = true;
    this.resetBall(true);
    this.updateScoreDisplay();
    this.render();
  }

  /** Writes both scores into the game header. */
  protected updateScoreDisplay(): void {
    this.hud?.set('score', this.state.score);
    this.hud?.set('opp', this.pongState.opponentScore);
  }

  /** Title of the game-over overlay: win or loss. */
  protected getGameOverTitle(): string {
    return this.state.score > this.pongState.opponentScore ? t('youWin') : t('youLose');
  }

  /** Final score in the overlay body. */
  protected getGameOverContent(): string {
    const oppLabel = this.role === 'solo' ? 'Bot' : 'You';
    return `<div>Me: ${this.state.score} — ${oppLabel}: ${this.pongState.opponentScore}</div>`;
  }

  /**
   * Game-over flow. In solo it uses the engine's default (overlay + Play again); in
   * multiplayer the host first tells the guest the match is over, then both show
   * the versus result overlay (Rematch for the host, Quit for everyone).
   */
  protected onGameOver(): void {
    if (this.role === 'solo') {
      super.onGameOver();
      return;
    }
    this.showVersusGameOver();
  }

  /** Enters a session: adopts the match role and starts a synced round. */
  private beginVersus(net: NetMatch): void {
    this.net = net;
    this.role = net.role;
    this.settings?.setDisabled(true);
    net.onMessage((msg) => this.handleNetMessage(msg));
    this.startRound();
  }

  /** Leaves multiplayer (session ended): back to solo play vs the bot. */
  private endVersus(): void {
    this.net = null;
    this.role = 'solo';
    this.guestTargetY = PONG_BOARD / 2;
    this.settings?.setDisabled(false);
    this.overlay.hide();
    this.reset();
    this.start();
  }

  /** Restarts from a clean state behind a kickoff countdown (host & guest). */
  private startRound(): void {
    this.stop();
    this.overlay.hide();
    this.reset();
    this.netSendAcc = 0;
    void runCountdown(3).then(() => {
      if (this.net) this.start();
    });
  }

  /** Dispatches a relayed message according to this client's role. */
  private handleNetMessage(msg: MatchMessage): void {
    if (this.role === 'host') {
      if (msg.opCode === OP_INPUT) {
        const data = msg.data as { y?: number } | null;
        if (data && typeof data.y === 'number') this.guestTargetY = clampPongPaddle(data.y);
      }
      return;
    }
    if (msg.opCode === OP_STATE) this.applyHostState(msg.data as PongHostState);
    else if (msg.opCode === OP_END) this.applyHostEnd(msg.data as { hs: number; gs: number });
    else if (msg.opCode === OP_RESTART) this.startRound();
  }

  /**
   * Applies an authoritative snapshot on the guest, mirrored so the guest also
   * sees itself on the left: the ball x is flipped, the host paddle becomes the
   * right-hand opponent, and the scores are swapped. The guest keeps driving its
   * own (left) paddle locally for responsiveness.
   */
  private applyHostState(s: PongHostState): void {
    const targetX = PONG_BOARD - s.bx;
    const targetY = s.by;
    if (s.sv) {
      this.pongState.ball.x = targetX;
      this.pongState.ball.y = targetY;
    } else {
      this.pongState.ball.x += (targetX - this.pongState.ball.x) * NET_CORRECT;
      this.pongState.ball.y += (targetY - this.pongState.ball.y) * NET_CORRECT;
    }
    this.pongState.ball.vx = -s.bvx;
    this.pongState.ball.vy = s.bvy;
    this.pongState.speed = Math.hypot(s.bvx, s.bvy) || PONG_BASE_SPEED;
    this.guestServing = s.sv;
    this.opponentTargetY = s.hy;
    this.state.score = s.gs;
    this.pongState.opponentScore = s.hs;
    this.updateScoreDisplay();
  }

  /** Ends the match on the guest from the host's final scores. */
  private applyHostEnd(s: { hs: number; gs: number }): void {
    this.state.score = s.gs;
    this.pongState.opponentScore = s.hs;
    this.endMatch();
  }

  /** Host triggers a rematch: tells the guest, then both restart synced. */
  private hostRematch(): void {
    this.net?.send(OP_RESTART, null);
    this.startRound();
  }

  /** Shows the versus result overlay (Rematch for the host, Quit for all). */
  private showVersusGameOver(): void {
    const won = this.state.score > this.pongState.opponentScore;
    const buttons: GameOverlayButton[] = [];
    if (this.role === 'host') {
      buttons.push({
        text: t('rematch'),
        primary: true,
        onClick: () => {
          this.overlay.hide();
          this.hostRematch();
        },
      });
    }
    buttons.push({
      text: t('quit'),
      primary: this.role !== 'host',
      onClick: () => {
        this.overlay.hide();
        this.multiplayer?.leave();
      },
    });
    const waiting =
      this.role === 'guest' ? `<p class="mp-status">${t('waitingForRematch')}</p>` : '';
    this.overlay.show({
      title: won ? t('youWin') : t('youLose'),
      bodyHtml: `<div>${t('you')}: ${this.state.score} — ${t('opponent')}: ${this.pongState.opponentScore}</div>${waiting}`,
      buttons,
    });
  }

  /** Host: broadcasts the authoritative snapshot at ~25 Hz. */
  private maybeBroadcastState(dt: number): void {
    if (this.role !== 'host' || !this.net) return;
    this.netSendAcc += dt;
    if (this.netSendAcc < NET_SEND_MS) return;
    this.netSendAcc = 0;
    this.net.send(OP_STATE, {
      bx: this.pongState.ball.x,
      by: this.pongState.ball.y,
      bvx: this.pongState.ball.vx,
      bvy: this.pongState.ball.vy,
      hy: this.pongState.playerY,
      hs: this.state.score,
      gs: this.pongState.opponentScore,
      sv: this.pongState.serveTimer > 0,
    });
  }

  /** Guest: sends its paddle position to the host at ~25 Hz. */
  private sendGuestInput(dt: number): void {
    if (!this.net) return;
    this.netSendAcc += dt;
    if (this.netSendAcc < NET_SEND_MS) return;
    this.netSendAcc = 0;
    this.net.send(OP_INPUT, { y: this.pongState.playerY });
  }
}
