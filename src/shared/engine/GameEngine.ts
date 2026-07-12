import { ScoreManager, ScoreEntry } from '../score/ScoreManager.js';
import { GameOverlay } from '../ui/gameOverlay.js';
import { showStartOverlay, dismissStartOverlay } from '../ui/startOverlay.js';
import { getPlayerName } from '../net/playerName.js';
import {
  recordRun,
  buildScoreMetadata,
  listLeaderboardScores,
  submitGlobalScore,
  getCachedUser,
  getFriendCode,
  getCachedFriendCode,
  addFriendByCode,
} from '../net/nakama.js';
import { gzPoints } from '../score/gzPoints.js';
import { gzpMultiplier } from '../weekly/weekly.js';
import { SCORE_GAMES } from '../score/scoreGames.js';
import { storePendingScore } from '../score/pendingScore.js';
import {
  LevelsConfig,
  LevelProgress,
  isLevelUnlocked,
  loadProgress,
  saveProgress,
} from '../levels/levels.js';
import { setupLevelPanel, LevelPanelHandle } from '../levels/levelPanel.js';
import { setupLeaderboardPanel, LeaderboardPanelHandle } from '../score/leaderboardPanel.js';
import { HudHandle } from '../ui/hud.js';
import { showToast } from '../ui/toast.js';
import {
  Challenge,
  buildChallengeUrl,
  challengeBeaten,
  parseChallenge,
} from '../versus/challengeLink.js';
import { t } from '../i18n/i18n.js';
import { track } from '../analytics/analytics.js';

/**
 * Configuration shared by all games, passed to the engine constructor.
 */
export interface GameConfig {
  /** Logical canvas width (px). */
  canvasWidth?: number;
  /** Logical canvas height (px). */
  canvasHeight?: number;
  /** Initial loop rate (ms). */
  initialSpeed?: number;
  /** Legacy local leaderboard key; kept for constructor compatibility. */
  storageKey?: string;
  /** Legacy local leaderboard size; kept for constructor compatibility. */
  maxScores?: number;
  /**
   * id of the online Nakama leaderboard for this game (e.g. 'snake'). When set,
   * scores are submitted to and displayed from the backend. When omitted, the
   * game has no persistent leaderboard. Backend calls are best-effort.
   */
  leaderboardId?: string;
  /**
   * Level / unlocking configuration. When set (and the game calls
   * {@link GameEngine.setupLevels} from `initialize`), the engine drives the
   * "Levels" panel, level selection and progress persistence; the game only
   * maps the selected level to its parameters via {@link GameEngine.onLevelSelected}.
   */
  levels?: LevelsConfig;
}

/**
 * Runtime state shared by all games.
 */
interface GameState {
  /** Current score of the game. */
  score: number;
  /** The game loop is running. */
  isRunning: boolean;
  /** The game is over. */
  isGameOver: boolean;
  /** The game is paused. */
  isPaused: boolean;
}

/**
 * Abstract base class of all games.
 *
 * `GameEngine` owns the `requestAnimationFrame` loop, the lifecycle
 * (`start`/`stop`/`pause`/`gameOver`) and the shared state ({@link GameState}). It
 * also composes the collaborators {@link ScoreManager} (leaderboard) and
 * {@link GameOverlay} (game-over overlay), and carries the whole game-over flow
 * (the optional save prompt, the Play again/Leaderboard overlay, score table).
 *
 * A subclass must implement {@link initialize}, {@link update},
 * {@link render}, {@link handleInput} and {@link reset}, and only overrides the
 * small `protected` hooks (`getGameOverTitle`, `getGameOverContent`,
 * `buildScoreEntry`, `scoreTableRow`, `updateScoreDisplay`…) where its
 * behavior differs.
 *
 * Lifecycle contract: `initialize()` runs **only once**
 * (DOM binding, listeners, first render); `start()` only (re)starts the
 * loop without re-initializing. A restart is therefore `reset()` + `start()`,
 * never a second `initialize()` (otherwise listeners stack up).
 */
export abstract class GameEngine {
  protected config: GameConfig;
  protected state: GameState;
  protected animationFrameId: number | null = null;
  protected lastTime: number = 0;

  /**
   * Cap on the `deltaTime` passed to `update()` (ms). When the tab goes to the
   * background, `requestAnimationFrame` is frozen: on resume, the first frame
   * would report a delta of several seconds, making any simulation "jump"
   * (ball going through a wall, etc.). We therefore clamp the delta so the
   * resume starts from a reasonable step. Games can still reduce it further.
   */
  protected static readonly MAX_FRAME_DELTA = 100;

  /** Tracks the in-session high score for the HUD (persistence is server-side). */
  protected scoreManager: ScoreManager;
  /**
   * The game's base online leaderboard id (captured once), so per-variant boards
   * can suffix it (`<base>-<variant>`) while the base still aggregates the
   * player's best across variants for the profile. Undefined = no online board.
   */
  private readonly baseLeaderboardId: string | undefined;
  /** Game-over overlay (replaces the old modal). */
  protected overlay: GameOverlay;
  /** Handle to the "Leaderboard" panel, when the game opts into one. */
  private leaderboardPanel: LeaderboardPanelHandle | null = null;
  /** Whether the leaderboard panel has been wired (lazy, once). */
  private leaderboardPanelReady = false;

  /** Currently selected level (1 when the game has no levels). */
  protected currentLevel: number = 1;
  /** Player progress for the level system (null until {@link setupLevels}). */
  private levelProgress: LevelProgress | null = null;
  /** Handle to refresh the level panel after progress changes. */
  private levelPanel: LevelPanelHandle | null = null;

  /** Incoming friend challenge (`?challenge=<score>&by=<name>`), if any. */
  private incomingChallenge: Challenge | null = null;
  /** True once the incoming challenge has been beaten (toast shown once). */
  private challengeWon = false;

  /**
   * @param config Game configuration (default values applied).
   */
  constructor(config: GameConfig = {}) {
    this.config = {
      canvasWidth: 800,
      canvasHeight: 600,
      initialSpeed: 1000,
      ...config,
    };
    this.state = {
      score: 0,
      isRunning: false,
      isGameOver: false,
      isPaused: false,
    };

    this.baseLeaderboardId = this.config.leaderboardId;
    // Persistence is server-authoritative (see {@link recordScore}); the
    // ScoreManager only tracks the in-session high score for the HUD.
    this.scoreManager = new ScoreManager();
    this.overlay = new GameOverlay();

    if (typeof location !== 'undefined') {
      this.incomingChallenge = parseChallenge(location.search);
      const challenge = this.incomingChallenge;
      if (challenge) {
        // Announce shortly after load, once the page chrome has settled.
        setTimeout(() => void this.announceChallenge(challenge), 600);
      }
    }
  }

  /**
   * Shows the "beat this score" toast for an incoming challenge, and — when the
   * link carries the sender's friend code and I'm signed in as someone else —
   * offers a one-tap "add friend" action so the challenge doubles as an invite.
   * `getFriendCode()` returns a code only for a Google-signed-in player, so it
   * doubles as the sign-in check (race-free vs. the cached-user flag).
   */
  private async announceChallenge(challenge: Challenge): Promise<void> {
    track('challenge_opened', {
      game: this.baseLeaderboardId ?? '',
      hasCode: Boolean(challenge.code),
    });
    const message = challenge.by
      ? t('challengeReceived', { name: challenge.by, score: challenge.score })
      : t('challengeReceivedAnon', { score: challenge.score });

    const code = challenge.code;
    const myCode = code ? await getFriendCode() : null;
    if (!code || !myCode || code === myCode) {
      showToast(message, 'info', 6000);
      return;
    }
    showToast(message, 'info', 9000, {
      label: challenge.by ? t('challengeAddFriend', { name: challenge.by }) : t('addFriend'),
      onClick: () => {
        addFriendByCode(code)
          .then(() => showToast(t('friendAdded'), 'success'))
          .catch(() => showToast(t('friendAddError'), 'warning'));
      },
    });
  }

  /**
   * Scopes the leaderboard to a variant (e.g. one board per difficulty/language),
   * so incomparable runs never share a table. Per-variant boards are **online**
   * too (`<base>-<variant>`, created on demand by the server), while every run
   * also feeds the base board so the profile still shows one best per game. The
   * `label` is shown under the "Leaderboard" title. Call from the game on start
   * and whenever the relevant settings change; pass `null` to use the base board.
   */
  protected setLeaderboardVariant(variant: string | null, label = ''): void {
    const base = this.baseLeaderboardId;
    this.config.leaderboardId = base && variant ? `${base}-${variant}` : base;
    const badge = document.getElementById('leaderboardVariant');
    if (badge) badge.textContent = variant ? label : '';
    this.renderScoreTable();
    this.updateScoreDisplay();
  }

  /** DOM binding, listeners and first render. Runs only once. */
  abstract initialize(): void | Promise<void>;
  /**
   * Updates the game logic.
   * @param deltaTime Time elapsed since the previous frame (ms).
   */
  abstract update(deltaTime: number): void;
  /** Draws the current state into the DOM. */
  abstract render(): void;
  /** Handles a keyboard input. */
  abstract handleInput(event: KeyboardEvent): void;
  /** Resets the game to its initial state (without restarting the loop). */
  abstract reset(): void;

  /**
   * Wires up the default keyboard input (`keydown` → {@link handleInput}). To
   * be called from `initialize()`. Games listening to something other than the
   * keyboard (e.g. text typing) override this method.
   */
  protected setupEventListeners(): void {
    document.addEventListener('keydown', (e) => {
      if (this.isFormFieldTarget(e.target)) return;
      this.handleInput(e);
    });
  }

  /**
   * Tells whether the event targets a form field (input/textarea/editable area),
   * in which case the game must not intercept the keystroke — otherwise the
   * control keys (arrows, letters) are stolen from the leaderboard name field.
   */
  protected isFormFieldTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    return (
      element instanceof HTMLElement &&
      (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable)
    );
  }

  /**
   * Starts the game loop. No-op if it is already running. Does not re-run
   * `initialize()`: a restart goes through `reset()` then `start()`.
   */
  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();

    this.state.isRunning = true;
    this.state.isGameOver = false;
    this.state.isPaused = false;
    this.lastTime = performance.now();

    this.gameLoop();
  }

  /**
   * Shows the modular Play screen and starts the loop only when the player clicks
   * it. Called by `bootstrapGame` instead of an immediate auto-start, so no game
   * begins before the player decides. Games with their own event-based start
   * (`autoStart: false`, e.g. Typing) bypass this; override for a custom start.
   */
  presentStartScreen(): void {
    showStartOverlay(() => this.start());
  }

  /**
   * Stops the game loop and cancels the scheduled frame.
   */
  stop(): void {
    this.state.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Toggles the pause state. On resume, restarts the loop (which stops
   * rescheduling itself as soon as pause is entered).
   */
  pause(): void {
    if (!this.state.isRunning) return;
    this.state.isPaused = !this.state.isPaused;

    if (!this.state.isPaused) {
      this.lastTime = performance.now();
      this.gameLoop();
    }
  }

  /**
   * Ends the game: stops the loop and triggers the game-over flow
   * ({@link onGameOver}).
   */
  gameOver(): void {
    this.state.isGameOver = true;
    this.state.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    document.exitPointerLock?.();
    this.scoreManager.noteScore(this.getRecordedScore());
    this.updateLevelProgress();
    this.onGameOver();
  }

  /**
   * Sets up the level system: loads progress from Nakama Storage (the single
   * source of truth), selects the saved level, builds the "Levels" panel and
   * applies the level's parameters. Games with a `levels` config `await` this
   * once from `initialize()` so the saved level is applied before the first
   * start. No-op when no levels are configured.
   */
  protected async setupLevels(): Promise<void> {
    const config = this.config.levels;
    if (!config) return;

    this.levelProgress = await loadProgress(config.gameKey);

    this.currentLevel = this.clampSelectedLevel(this.levelProgress.selected);
    this.onLevelSelected(this.currentLevel);

    this.levelPanel = setupLevelPanel({
      config,
      progress: this.levelProgress,
      selected: this.currentLevel,
      onSelect: (id) => this.selectLevel(id),
    });
  }

  /**
   * Applies a player-picked level: stores it, persists the choice, lets the game
   * reconfigure ({@link onLevelSelected}), then restarts from a clean state.
   */
  private selectLevel(levelId: number): void {
    const config = this.config.levels;
    if (!config || !this.levelProgress) return;
    this.currentLevel = levelId;
    this.levelProgress.selected = levelId;
    saveProgress(config.gameKey, this.levelProgress);
    this.onLevelSelected(levelId);
    this.reset();
    this.start();
  }

  /**
   * The id of the level right after the current one, but only when it exists and
   * is actually unlocked (sequential clears unlock it; score-gated levels still
   * need their threshold). Null otherwise — including on the last level. Drives
   * the game-over "Next level" button.
   */
  private nextUnlockedLevelId(): number | null {
    const config = this.config.levels;
    if (!config || !this.levelProgress) return null;
    const idx = config.levels.findIndex((l) => l.id === this.currentLevel);
    const next = idx >= 0 ? config.levels[idx + 1] : undefined;
    if (!next) return null;
    return isLevelUnlocked(next, this.levelProgress) ? next.id : null;
  }

  /** Clamps a saved level to one that is actually unlocked (else level 1). */
  private clampSelectedLevel(levelId: number): number {
    const config = this.config.levels;
    if (!config || !this.levelProgress) return 1;
    const level = config.levels.find((l) => l.id === levelId);
    return level && isLevelUnlocked(level, this.levelProgress) ? levelId : 1;
  }

  /**
   * Updates and persists level progress at game over: records the best score and,
   * if the current level was cleared ({@link didWinLevel}), unlocks the next one.
   */
  private updateLevelProgress(): void {
    const config = this.config.levels;
    if (!config || !this.levelProgress) return;
    this.levelProgress.bestScore = Math.max(this.levelProgress.bestScore, this.state.score);
    if (this.didWinLevel()) {
      this.levelProgress.cleared = Math.max(this.levelProgress.cleared, this.currentLevel);
    }
    saveProgress(config.gameKey, this.levelProgress);
    this.levelPanel?.refresh(this.levelProgress);
  }

  /**
   * Maps the selected level to the game's parameters (speed, difficulty…).
   * Hook for level-based games to override; must not start the loop.
   */
  protected onLevelSelected(_levelId: number): void {}

  /**
   * Whether the current level counts as cleared (so the next unlocks). Default
   * `false`; games with a win condition override it (e.g. Pac-Man returns its
   * "all pellets eaten" win).
   */
  protected didWinLevel(): boolean {
    return false;
  }

  /**
   * Main loop: computes the `deltaTime`, updates then renders the game, and
   * reschedules itself via `requestAnimationFrame` as long as the game runs.
   */
  protected gameLoop(): void {
    if (!this.state.isRunning || this.state.isPaused) return;

    const currentTime = performance.now();
    const deltaTime = Math.min(currentTime - this.lastTime, GameEngine.MAX_FRAME_DELTA);
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Adds points to the score and triggers the display update.
   */
  protected addScore(points: number): void {
    this.state.score += points;
    this.scoreManager.noteScore(this.getRecordedScore());
    this.onScoreChange(this.state.score);
  }

  /**
   * Hook called on every score change; refreshes the display by default.
   */
  protected onScoreChange(newScore: number): void {
    this.updateScoreDisplay();
    if (
      this.incomingChallenge &&
      !this.challengeWon &&
      challengeBeaten(newScore, this.incomingChallenge.score)
    ) {
      this.challengeWon = true;
      showToast(t('challengeWon', { score: this.incomingChallenge.score }), 'success', 5000);
    }
  }

  /**
   * Shares a "beat my score" challenge link for the current score: uses the
   * native share sheet when available (mobile), else copies the link. Wired into
   * the game-over overlay for score-based games.
   */
  protected shareChallenge(): void {
    if (typeof location === 'undefined') return;
    track('challenge_shared', { game: this.baseLeaderboardId ?? '' });
    const url = buildChallengeUrl(
      location.href,
      this.state.score,
      getPlayerName(),
      getCachedFriendCode()
    );
    const shareData = {
      title: 'Games Zone',
      text: t('challengeShareText', { score: this.state.score }),
      url,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => showToast(t('challengeCopied'), 'success'))
        .catch(() => showToast(url, 'info'));
    } else {
      showToast(url, 'info');
    }
  }

  /**
   * The live-stats bar (`.game-details`). A game builds it once in `initialize()`
   * with {@link setupHud} (`this.hud = setupHud([...])`), declaring its readouts
   * (`score`, `high`, `time`, `lives`…); the engine and the game then update
   * values by key. Null for games that don't show any stat.
   */
  protected hud: HudHandle | null = null;

  /**
   * Updates the score readouts on the {@link hud}. The default sets the `score`
   * and (when declared) `high` stats — the common case. Games with extra stats
   * call `super.updateScoreDisplay()` then set theirs (Tetris `lines`, Breakout
   * `lives`); games with different stats (Pong/Memory's two scores) override it.
   */
  protected updateScoreDisplay(): void {
    this.hud?.set('score', this.state.score);
    this.hud?.set('high', this.scoreManager.getHighScore());
  }

  /**
   * Resets the shared run state (score, game-over and pause flags) to a fresh
   * game. Call from a subclass `reset()` before re-seeding its own state, so
   * the three flags aren't recopied in every game.
   */
  protected resetState(): void {
    this.state.score = 0;
    this.state.isGameOver = false;
    this.state.isPaused = false;
  }

  /**
   * Entry point of the game-over flow; shows the game-over overlay (with a save
   * prompt for leaderboard games) by default. Override to add side effects (e.g.
   * disabling an input).
   */
  protected onGameOver(): void {
    this.showGameOverOverlay();
  }

  /**
   * Shows the game-over overlay: title, score/details, and — when the game has a
   * leaderboard and the score makes the top-N board — a save prompt (pseudo
   * pre-filled and editable). The engine never auto-saves: the player always
   * decides whether to record the score (and under which name). Always shows
   * "Play again" (+ "View leaderboard" when the game has a leaderboard panel).
   */
  protected showGameOverOverlay(): void {
    const content = this.getGameOverContent();
    const scoreable = this.getRecordedScore() > 0;
    const user = getCachedUser();
    const loggedIn = user?.loggedIn === true;

    // On a cleared level with a further unlocked level, lead with "Next level"
    // and demote "Play again" (which replays the current level).
    const nextLevelId = this.didWinLevel() ? this.nextUnlockedLevelId() : null;

    const buttons: { text: string; primary?: boolean; onClick: () => void }[] = [];
    if (nextLevelId !== null) {
      buttons.push({
        text: t('nextLevel'),
        primary: true,
        onClick: () => {
          this.overlay.hide();
          this.selectLevel(nextLevelId);
        },
      });
    }
    buttons.push({
      text: t('playAgain'),
      primary: nextLevelId === null,
      onClick: () => {
        this.overlay.hide();
        this.restartAfterGameOver();
      },
    });
    if (this.leaderboardPanel) {
      buttons.push({
        text: t('viewLeaderboard'),
        primary: false,
        onClick: () => {
          // Don't leave the player on the dead finished game: reset to the start
          // ("Play") screen, then open the leaderboard over it — closing the panel
          // reveals the Play screen. "Play again" stays a direct relaunch.
          this.overlay.hide();
          this.reset();
          this.presentStartScreen();
          this.leaderboardPanel?.open();
        },
      });
    }
    // Recording a score needs a Google account: guests get a sign-in prompt.
    if (scoreable && !loggedIn) {
      buttons.push({ text: t('signInToSave'), primary: false, onClick: () => this.signInToSave() });
    }
    // Score-based games only (board games leave the score at 0): dare a friend.
    if (scoreable) {
      // Warm the shareable friend code now so shareChallenge can embed it
      // synchronously (the "add friend" hook on the opener's side).
      if (loggedIn) void getFriendCode();
      buttons.push({
        text: t('challengeButton'),
        primary: false,
        onClick: () => this.shareChallenge(),
      });
    }

    // Signed in: record the run automatically under the Google name.
    if (scoreable && loggedIn) this.recordScore(user.displayName);

    this.overlay.show({
      title: this.getGameOverTitle(),
      bodyHtml: content,
      score: content === undefined ? this.getRecordedScore() : undefined,
      buttons,
    });
  }

  /**
   * The leaderboards a run is written to: the base board (cross-variant best,
   * read by the profile) plus the active variant board, de-duplicated. Empty
   * when the game has no online board.
   */
  private targetBoards(): string[] {
    const base = this.baseLeaderboardId;
    if (!base) return [];
    const active = this.config.leaderboardId;
    return active && active !== base ? [base, active] : [base];
  }

  /**
   * Records a run under `username`, server-authoritative: the run is written to
   * its leaderboard(s) and the global GamesZone Points total through Nakama. No
   * score is written to localStorage. If the backend is unreachable the run is
   * lost and the player is warned (offline scores are not queued).
   */
  private recordScore(username: string): void {
    const entry = this.buildScoreEntry(username);
    const score = this.getRecordedScore();
    const boards = this.targetBoards();
    if (boards.length > 0 && this.baseLeaderboardId) {
      recordRun({
        game: this.baseLeaderboardId,
        boards,
        score,
        metadata: buildScoreMetadata(entry),
      })
        .then(() => this.renderScoreTable())
        .catch((err) => {
          console.warn('[nakama] score submission failed:', err);
          showToast(t('scoreNotSaved'), 'warning');
        });
    }
    submitGlobalScore(this.weeklyGzp(score), username).catch((err) =>
      console.warn('[nakama] global score submission failed:', err)
    );
    track('score_saved', { game: this.baseLeaderboardId ?? '', score });
    this.onScoreSaved();
  }

  /**
   * GamesZone Points for a run, boosted this week if this is the featured game
   * (the weekly spotlight — see `src/shared/weekly/`). The bonus is baked in at
   * play time, so a guest who signs in later still keeps the week's multiplier.
   */
  private weeklyGzp(score: number): number {
    const key = this.baseLeaderboardId ?? '';
    const mult = gzpMultiplier(
      key,
      SCORE_GAMES.map((g) => g.key)
    );
    return gzPoints(score) * mult;
  }

  /** Guest chose to save: stash the run and trigger Google sign-in. */
  private signInToSave(): void {
    const score = this.getRecordedScore();
    storePendingScore({
      game: this.baseLeaderboardId,
      boards: this.targetBoards(),
      score,
      extra: this.buildScoreEntry('').additionalData,
      gzp: this.weeklyGzp(score),
    });
    window.dispatchEvent(new CustomEvent('gz-request-login'));
  }

  /**
   * Title of the game-over overlay. Override to customize it (e.g. "You won!").
   */
  protected getGameOverTitle(): string {
    return t('gameOver');
  }

  /**
   * Rich HTML injected into the overlay body. Return `undefined` (default) to
   * show a plain "Score: N".
   */
  protected getGameOverContent(): string | undefined {
    return undefined;
  }

  /**
   * The score used for ranking — the leaderboard record, GamesZone Points and
   * the "best" HUD stat. Defaults to the live game score; level games rank on
   * the level reached instead (so every game contributes coherently and a level
   * game's in-game score, if any, stays a display-only value). Override for a
   * custom ranking metric.
   */
  protected getRecordedScore(): number {
    return this.config.levels ? this.currentLevel : this.state.score;
  }

  /**
   * Builds the entry written to the leaderboard. Override to add game-specific
   * data (e.g. typing speed).
   */
  protected buildScoreEntry(username: string): ScoreEntry {
    return { username, score: this.getRecordedScore(), date: new Date() };
  }

  /**
   * Hook called after a successful save; refreshes the displayed leaderboard.
   */
  protected onScoreSaved(): void {
    this.renderScoreTable();
  }

  /** Body of the score table (`#scoreTable tbody`), resolved lazily. */
  protected scoreTableBody: HTMLElement | null = null;

  /**
   * Renders the leaderboard into `#scoreTable`. To be called from `initialize()`
   * for the initial display; re-rendered automatically after each save.
   */
  protected renderScoreTable(): void {
    if (!this.leaderboardPanelReady) {
      this.leaderboardPanelReady = true;
      this.leaderboardPanel = setupLeaderboardPanel();
    }

    const leaderboardId = this.config.leaderboardId;
    if (!leaderboardId) return;
    listLeaderboardScores(leaderboardId, this.config.maxScores ?? 10)
      .then((scores) => this.renderScoreRows(scores))
      .catch((err) => console.warn('[nakama] online leaderboard unavailable:', err));
  }

  /** Fills `#scoreTable tbody` with the given entries (one `<tr>` each). */
  private renderScoreRows(entries: ScoreEntry[]): void {
    if (!this.scoreTableBody) {
      this.scoreTableBody = document.querySelector('#scoreTable tbody');
    }
    if (!this.scoreTableBody) return;

    this.scoreTableBody.innerHTML = entries
      .map((entry) => `<tr>${this.scoreTableRow(entry)}</tr>`)
      .join('');
  }

  /**
   * Returns the `<td>` cells of one leaderboard row. Override to add columns
   * (default: name + score).
   */
  protected scoreTableRow(entry: ScoreEntry): string {
    return `<td>${this.escapeHtml(entry.username)}</td><td>${entry.score}</td>`;
  }

  /**
   * Escapes a user-entered value before HTML injection (anti-XSS).
   */
  protected escapeHtml(value: string): string {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }

  /**
   * Behavior triggered by "Restart". Default: `reset()` + `start()`.
   * Override for a different restart (e.g. restart on the first keystroke).
   */
  protected restartAfterGameOver(): void {
    this.reset();
    this.start();
  }

  /**
   * Returns the current state, read-only.
   */
  getState(): Readonly<GameState> {
    return this.state;
  }

  /**
   * Returns the configuration, read-only.
   */
  getConfig(): Readonly<GameConfig> {
    return this.config;
  }
}
