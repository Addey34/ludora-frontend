import { GameEngine, GameConfig } from '../engine/GameEngine.js';
import { setupHud } from '../ui/hud.js';
import { dismissStartOverlay } from '../ui/startOverlay.js';
import {
  setupSettingsPanel,
  SettingsField,
  SettingsPanelHandle,
  difficultyField,
  numberField,
} from '../ui/settingsPanel.js';
import { runCountdown } from '../ui/countdown.js';
import { CountdownTimer } from '../ui/countdownTimer.js';
import { playSound } from '../fx/sound.js';
import { t } from '../i18n/i18n.js';
import {
  Difficulty,
  DIFFICULTIES,
  Question,
  QuizMode,
  QuizStats,
  accuracy,
  answered,
  emptyStats,
  isCorrect,
  recordAnswer,
  scoreForCorrect,
} from './quiz.js';
import { NetMatch, MatchMessage } from '../net/match.js';
import { setupMultiplayerPanel } from '../versus/multiplayerPanel.js';
import {
  OP_QUESTION,
  OP_ANSWER,
  OP_RESULT,
  OP_RESTART,
  stripAnswer,
  allAnswered,
  scoreRound,
  type RaceQuestion,
  type RaceRound,
  type RaceResult,
} from './quizRace.js';

/** Configuration shared by every quiz-style game. */
export interface QuizGameConfig extends GameConfig {
  /** Base points for a correct answer (before difficulty scaling + combo). */
  basePoints?: number;
  /** Questions per round in classic mode (default 10). */
  rounds?: number;
  /** Seconds per round in timed mode (default 60). */
  timedSeconds?: number;
  /** Seconds to answer each multiplayer race question (default 20). */
  answerSeconds?: number;
  /** Starting lives in survival mode (default 3). */
  survivalLives?: number;

  // --- Optional player-facing settings (each opt-in: pass a few values to add a
  // segmented control to the shared settings panel; omit to keep the fixed value).

  /** Selectable question counts (classic + race length). Include {@link rounds}. */
  roundChoices?: number[];
  /** Selectable timed-mode durations in seconds. Include {@link timedSeconds}. */
  timeChoices?: number[];
  /** Selectable per-question race timeouts in seconds. Include {@link answerSeconds}. */
  answerChoices?: number[];
  /** Selectable survival lives. Include {@link survivalLives}. */
  livesChoices?: number[];
}

/**
 * Base class for question/answer educational games — the quiz equivalent of
 * {@link BoardGame} for turn games. It owns the whole round: difficulty + mode
 * settings, the question lifecycle, multiple-choice **or** typed answers, the
 * streak/combo scoring, the optional timed-challenge mode, and the enriched
 * game-over recap (score / accuracy / best streak). A concrete game supplies only
 * its questions via {@link makeQuestion} (using {@link difficulty}), plus optional
 * async data via {@link loadData} and a numeric keyboard via {@link inputMode}.
 *
 * Multiplayer race mode: call {@link setupVersus} from `initialize()` (and set
 * `multiplayer: true` in the games array). Both players receive the same question
 * from the host, answer independently, and the host broadcasts the scored result.
 * Solo mode is completely unchanged.
 *
 * Event-driven (clicks/keys), so it doesn't use the engine's rAF loop. A
 * generation counter guards the between-questions delay so a reset can't let a
 * stale timeout advance a fresh round.
 */
const SURVIVAL_LIVES = 3;
export abstract class QuizGame extends GameEngine {
  protected boardEl: HTMLElement | null = null;
  private promptEl: HTMLElement | null = null;
  private answerEl: HTMLElement | null = null;
  private feedbackEl: HTMLElement | null = null;
  private settingsPanel: SettingsPanelHandle | null = null;

  protected difficulty: Difficulty = 'easy';
  protected mode: QuizMode = 'classic';
  /** Remaining lives in Survival mode. */
  private lives = 0;
  /** Starting lives in survival mode (settings-adjustable). */
  private survivalLives: number;

  protected stats: QuizStats = emptyStats();
  protected current: Question | null = null;
  private roundIndex = 0;

  private readonly basePoints: number;
  private rounds: number;
  private timedSeconds: number;
  private answerSeconds: number;
  private readonly roundChoices?: number[];
  private readonly timeChoices?: number[];
  private readonly answerChoices?: number[];
  private readonly livesChoices?: number[];

  private readonly timer = new CountdownTimer();
  private readonly answerTimer = new CountdownTimer();
  /** Bumped on every start/reset so a pending "next question" timeout bails. */
  private gen = 0;
  /** True between answering and the next question (blocks double answers). */
  protected locked = false;

  // --- Net race state (inactive / irrelevant in solo mode) ------------------

  /** 'net' while a relayed session is active; 'solo' otherwise. */
  protected netMode: 'solo' | 'net' = 'solo';
  protected net: NetMatch | null = null;
  /** This client's seat (0 = host). */
  protected mySeat = 0;
  private netPlayers = 2;
  /** Cumulative scores per seat (authoritative on host, mirrored on guest). */
  private raceScores: number[] = [];
  /** Current streak per seat (host-authoritative for combo scoring). */
  private raceStreaks: number[] = [];
  /** Host-only: active round state while waiting for all answers. */
  private currentRound: RaceRound | null = null;
  /** Invalidates a pending multiplayer start countdown when a remote question arrives. */
  private netStartToken = 0;
  /** The last answer this client submitted (used to mark the UI on OP_RESULT). */
  private myLastAnswer = '';

  constructor(config: QuizGameConfig) {
    super(config);
    this.basePoints = config.basePoints ?? 100;
    this.rounds = config.rounds ?? config.roundChoices?.[0] ?? 10;
    this.timedSeconds = config.timedSeconds ?? config.timeChoices?.[0] ?? 60;
    this.answerSeconds = config.answerSeconds ?? config.answerChoices?.[0] ?? 20;
    this.survivalLives = config.survivalLives ?? config.livesChoices?.[0] ?? SURVIVAL_LIVES;
    this.roundChoices = config.roundChoices;
    this.timeChoices = config.timeChoices;
    this.answerChoices = config.answerChoices;
    this.livesChoices = config.livesChoices;
  }

  // --- Hooks a concrete game implements / overrides -------------------------

  /** Produces the next question for the current {@link difficulty}. */
  protected abstract makeQuestion(): Question;

  /** Optional async data load (e.g. a country list) before the first round. */
  protected async loadData(): Promise<void> {}

  /** Called after the difficulty changes, before the round restarts. */
  protected onDifficultyChanged(): void {}

  /** Keyboard hint for typed answers ('numeric' for maths). */
  protected get inputMode(): 'text' | 'numeric' {
    return 'text';
  }

  /**
   * Extra settings fields a concrete game adds to the shared Difficulty/Mode
   * controls (e.g. a category or language picker).
   */
  protected extraSettings(): SettingsField[] {
    return [];
  }

  /**
   * Optional per-variant leaderboard: return a `{ key, label }` to give this
   * difficulty/mode/… combination its own board, or `null` to use the single board.
   */
  protected leaderboardVariant(): { key: string; label: string } | null {
    return null;
  }

  // --- Lifecycle ------------------------------------------------------------

  async initialize(): Promise<void> {
    this.boardEl = document.getElementById('board');
    this.buildScaffold();
    this.hud = setupHud([
      { key: 'progress', icon: 'list-ol', label: t('hudQuestion') },
      { key: 'time', icon: 'clock', label: t('hudTime') },
      { key: 'lives', icon: 'heart', label: t('hudLives') },
      { key: 'score', icon: 'star', label: t('score') },
      { key: 'streak', icon: 'fire', label: t('hudStreak') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
      { key: 'opponent', icon: 'user', label: t('hudOpponent') },
    ]);
    this.setupEventListeners();
    this.setupQuizSettings();
    this.renderScoreTable();
    await this.loadData();
    this.clearHud();
  }

  private buildScaffold(): void {
    const board = this.boardEl;
    if (!board) return;
    board.innerHTML = '';

    this.promptEl = document.createElement('div');
    this.promptEl.className = 'quiz-prompt';

    this.answerEl = document.createElement('div');
    this.answerEl.className = 'quiz-answer';

    this.feedbackEl = document.createElement('div');
    this.feedbackEl.className = 'quiz-feedback';
    this.feedbackEl.setAttribute('aria-live', 'polite');

    board.append(this.promptEl, this.answerEl, this.feedbackEl);
  }

  private setupQuizSettings(): void {
    const difficulty = difficultyField(this.difficulty, (v) => {
      if (!DIFFICULTIES.includes(v as Difficulty)) return;
      this.difficulty = v as Difficulty;
      this.onDifficultyChanged();
      this.restartRound();
    });
    const mode: SettingsField = {
      id: 'mode',
      label: t('mode'),
      choices: [
        { label: t('classic'), value: 'classic' },
        { label: t('timed'), value: 'timed' },
        { label: t('survival'), value: 'survival' },
      ],
      value: this.mode,
      onChange: (v) => {
        this.mode = v === 'timed' ? 'timed' : v === 'survival' ? 'survival' : 'classic';
        this.restartRound();
      },
    };
    const secs = (n: number): string => `${n}s`;
    const fields: SettingsField[] = [difficulty, ...this.extraSettings(), mode];
    if (this.roundChoices) {
      fields.push(
        numberField('rounds', t('roundsSetting'), this.rounds, this.roundChoices, (n) => {
          this.rounds = n;
          this.restartRound();
        })
      );
    }
    if (this.timeChoices) {
      fields.push(
        numberField(
          'time',
          t('timeSetting'),
          this.timedSeconds,
          this.timeChoices,
          (n) => {
            this.timedSeconds = n;
            this.restartRound();
          },
          secs
        )
      );
    }
    if (this.answerChoices) {
      fields.push(
        numberField(
          'answerTime',
          t('answerTimeSetting'),
          this.answerSeconds,
          this.answerChoices,
          (n) => {
            this.answerSeconds = n;
            this.restartRound();
          },
          secs
        )
      );
    }
    if (this.livesChoices) {
      fields.push(
        numberField('lives', t('livesSetting'), this.survivalLives, this.livesChoices, (n) => {
          this.survivalLives = n;
          this.restartRound();
        })
      );
    }
    this.settingsPanel = setupSettingsPanel(fields);
  }

  /** Stops the current round and optionally starts a fresh one. */
  protected restartRound(forceStart = false): void {
    const wasRunning = this.state.isRunning;
    this.overlay.hide();
    this.stop();
    this.reset();
    if (forceStart || wasRunning) {
      this.start();
    }
  }

  start(): void {
    if (this.state.isRunning) return;
    dismissStartOverlay();
    this.resetState();
    this.state.isRunning = true;
    this.gen += 1;
    const variant = this.leaderboardVariant();
    if (variant) this.setLeaderboardVariant(variant.key, variant.label);
    this.stats = emptyStats();
    this.roundIndex = 0;
    this.lives = this.survivalLives;
    this.locked = false;

    if (this.netMode === 'net') {
      this.raceScores = new Array(this.netPlayers).fill(0);
      this.raceStreaks = new Array(this.netPlayers).fill(0);
      this.myLastAnswer = '';
    }

    this.hud?.set('time', null);
    this.hud?.set('progress', null);
    this.hud?.set('lives', null);
    this.hud?.set('opponent', null);

    if (this.mode === 'timed' && this.netMode === 'solo') {
      const gen = this.gen;
      this.timer.start({
        seconds: this.timedSeconds,
        onTick: (remaining) => {
          this.hud?.set('time', `${remaining}s`);
          this.hud?.toggle('time', 'is-low', remaining <= 10);
        },
        onExpire: () => {
          if (gen === this.gen) this.finish();
        },
      });
    }

    this.updateHud();
    this.nextQuestion();
  }

  reset(): void {
    this.gen += 1;
    this.timer.stop();
    this.clearAnswerTimer();
    this.resetState();
    this.stats = emptyStats();
    this.roundIndex = 0;
    this.current = null;
    this.locked = false;
    this.currentRound = null;
    this.myLastAnswer = '';
    if (this.promptEl) this.promptEl.textContent = '';
    if (this.answerEl) this.answerEl.replaceChildren();
    if (this.feedbackEl) this.feedbackEl.textContent = '';
    this.clearHud();
  }

  stop(): void {
    super.stop();
    this.timer.stop();
    this.clearAnswerTimer();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    if (this.netMode === 'net' && this.net?.role === 'host') {
      this.net.send(OP_RESTART, null);
      this.startNetRoundWithCountdown(this.net);
      return;
    }
    this.reset();
    this.start();
  }

  // --- Multiplayer setup ----------------------------------------------------

  /**
   * Wires the shared multiplayer panel for a quiz-race session. Call from
   * `initialize()` in any quiz game that declares `multiplayer: true`. Safe
   * no-op when the panel elements are absent from the DOM.
   */
  protected setupVersus(capacity = 2): void {
    setupMultiplayerPanel({
      capacity,
      onSessionStart: (net) => {
        this.net = net;
        this.netMode = 'net';
        this.mySeat = net.seat;
        this.netPlayers = net.players;
        this.settingsPanel?.setDisabled(true);
        net.onMessage((msg) => this.handleNetMessage(msg));
        net.onPeerLeave(() => this.returnToSolo());
        net.onClose(() => this.returnToSolo());
        this.startNetRoundWithCountdown(net);
      },
      onSessionEnd: () => this.returnToSolo(),
    });
  }

  private returnToSolo(): void {
    this.netStartToken += 1;
    this.net = null;
    this.netMode = 'solo';
    this.mySeat = 0;
    this.netPlayers = 2;
    this.settingsPanel?.setDisabled(false);
    this.restartRound(true);
  }

  private handleNetMessage(msg: MatchMessage): void {
    const { opCode, data } = msg;

    if (opCode === OP_QUESTION) {
      // Guest receives a new question from the host.
      const q = data as RaceQuestion | null;
      if (!q) return;
      this.netStartToken += 1;
      if (!this.state.isRunning) {
        dismissStartOverlay();
        this.state.isRunning = true;
      }
      this.locked = false;
      this.roundIndex = q.roundIndex;
      // Build a stub Question (answer intentionally blank until OP_RESULT).
      this.current = { prompt: q.prompt, answer: '', choices: q.choices };
      this.renderQuestion();
      this.updateHud();
      this.startPassiveAnswerTimer(this.gen);
      return;
    }

    if (opCode === OP_ANSWER) {
      // Host receives a guest's answer.
      if (!this.currentRound) return;
      const m = data as { roundIndex?: number; answer?: string; seat?: number } | null;
      if (m?.roundIndex !== this.currentRound.roundIndex) return; // stale
      const seat = m?.seat;
      if (typeof seat !== 'number' || seat < 0 || seat >= this.netPlayers) return;
      if (this.currentRound.answers[seat] !== undefined) return; // already recorded
      this.currentRound.answers[seat] = m?.answer ?? null;
      if (allAnswered(this.currentRound, this.netPlayers)) {
        this.clearAnswerTimer();
        this.broadcastResult(this.gen);
      }
      return;
    }

    if (opCode === OP_RESULT) {
      // Both host and guest apply the authoritative result.
      const result = data as RaceResult | null;
      if (result) this.applyRaceResult(result);
      return;
    }

    if (opCode === OP_RESTART) {
      // Host restarted — guest follows.
      if (this.net?.role === 'guest' && this.net) {
        this.startNetRoundWithCountdown(this.net);
      }
    }
  }

  private startNetRoundWithCountdown(net: NetMatch): void {
    this.overlay.hide();
    this.stop();
    this.reset();
    const token = (this.netStartToken += 1);
    void runCountdown(3).then(() => {
      if (this.netStartToken !== token || this.net !== net || this.netMode !== 'net') return;
      this.start();
    });
  }

  // --- Round flow -----------------------------------------------------------

  private nextQuestion(): void {
    if (this.netMode === 'net') {
      // Host generates and broadcasts; guest waits for OP_QUESTION.
      if (this.net?.role !== 'host') return;
      this.locked = false;
      this.current = this.makeQuestion();
      this.roundIndex += 1;
      const final = this.roundIndex >= this.rounds;
      this.currentRound = {
        roundIndex: this.roundIndex,
        question: this.current,
        answers: new Array(this.netPlayers).fill(undefined),
        final,
      };
      this.net.send(OP_QUESTION, stripAnswer(this.current, this.roundIndex));
      this.startAnswerTimer(this.gen);
      this.renderQuestion();
      this.updateHud();
      return;
    }

    // Solo mode (unchanged).
    if (this.mode === 'classic' && this.roundIndex >= this.rounds) {
      this.finish();
      return;
    }
    this.locked = false;
    this.current = this.makeQuestion();
    this.roundIndex += 1;
    this.renderQuestion();
    this.updateHud();
  }

  protected renderQuestion(): void {
    const question = this.current;
    if (!question || !this.promptEl || !this.answerEl || !this.feedbackEl) return;

    this.promptEl.innerHTML = question.prompt;
    this.answerEl.classList.remove('is-correct', 'is-wrong');
    this.feedbackEl.textContent = '';
    this.feedbackEl.className = 'quiz-feedback';

    if (question.choices && question.choices.length > 0) {
      this.renderChoices(question.choices);
    } else {
      this.renderInput();
    }
  }

  private renderChoices(choices: string[]): void {
    const host = this.answerEl;
    if (!host) return;
    const grid = document.createElement('div');
    grid.className = 'quiz-choices';
    choices.forEach((choice, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-choice';
      btn.dataset.value = choice;
      btn.innerHTML = `<span class="quiz-choice-key">${index + 1}</span>${this.escapeHtml(choice)}`;
      btn.addEventListener('click', () => this.answer(choice));
      grid.appendChild(btn);
    });
    host.replaceChildren(grid);
  }

  private renderInput(): void {
    const host = this.answerEl;
    if (!host) return;
    const form = document.createElement('form');
    form.className = 'quiz-form';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input-field quiz-input';
    input.autocomplete = 'off';
    input.setAttribute('autocapitalize', 'off');
    if (this.inputMode === 'numeric') input.inputMode = 'numeric';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn--primary quiz-submit';
    submit.textContent = 'OK';

    form.append(input, submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (value !== '') this.answer(value);
    });
    host.replaceChildren(form);
    input.focus();
  }

  private answer(given: string): void {
    const question = this.current;
    if (this.locked || !question || !this.state.isRunning) return;
    this.locked = true;
    this.myLastAnswer = given;

    // Net mode — host records answer and waits; guest sends to host and waits.
    if (this.netMode === 'net') {
      this.disableAnswerControls();
      if (this.net?.role === 'host') {
        if (this.currentRound) {
          this.currentRound.answers[0] = given;
          if (allAnswered(this.currentRound, this.netPlayers)) {
            this.clearAnswerTimer();
            this.broadcastResult(this.gen);
          }
        }
      } else {
        this.net?.send(OP_ANSWER, {
          roundIndex: this.roundIndex,
          answer: given,
          seat: this.mySeat,
        });
      }
      return;
    }

    // Solo mode (unchanged).
    const correct = isCorrect(given, question.answer);
    recordAnswer(this.stats, correct);

    if (correct) {
      this.addScore(scoreForCorrect(this.basePoints, this.difficulty, this.stats.streak));
      playSound('score');
    } else {
      playSound('mismatch');
    }

    const ended = !correct && this.mode === 'survival' && (this.lives -= 1) <= 0;

    this.markAnswer(given, correct);
    this.updateHud();

    const gen = this.gen;
    window.setTimeout(
      () => {
        if (gen !== this.gen) return;
        if (ended) this.finish();
        else this.nextQuestion();
      },
      correct ? 550 : 1150
    );
  }

  /** Disables all answer controls while waiting for a net result. */
  private disableAnswerControls(): void {
    this.answerEl
      ?.querySelectorAll<HTMLButtonElement>('.quiz-choice')
      .forEach((btn) => (btn.disabled = true));
    const input = this.answerEl?.querySelector<HTMLInputElement>('.quiz-input');
    const submit = this.answerEl?.querySelector<HTMLButtonElement>('.quiz-submit');
    if (input) input.disabled = true;
    if (submit) submit.disabled = true;
  }

  /** Paints the outcome: highlights choices, or annotates the typed field. */
  private markAnswer(given: string, correct: boolean): void {
    const answer = this.current?.answer ?? '';

    const buttons = this.answerEl?.querySelectorAll<HTMLButtonElement>('.quiz-choice');
    if (buttons && buttons.length > 0) {
      buttons.forEach((btn) => {
        btn.disabled = true;
        if (isCorrect(btn.dataset.value ?? '', answer)) btn.classList.add('is-correct');
        else if (btn.dataset.value === given) btn.classList.add('is-wrong');
      });
    } else {
      const input = this.answerEl?.querySelector<HTMLInputElement>('.quiz-input');
      const button = this.answerEl?.querySelector<HTMLButtonElement>('.quiz-submit');
      if (input) input.disabled = true;
      if (button) button.disabled = true;
      this.answerEl?.classList.toggle('is-correct', correct);
      this.answerEl?.classList.toggle('is-wrong', !correct);
    }

    if (this.feedbackEl) {
      this.feedbackEl.classList.add(correct ? 'is-correct' : 'is-wrong');
      const note = this.current?.hint ? ` — ${this.current.hint}` : '';
      this.feedbackEl.textContent = correct ? 'Correct!' : `Answer: ${answer}${note}`;
    }
  }

  private finish(): void {
    this.timer.stop();
    this.clearAnswerTimer();
    this.gen += 1;
    if (this.netMode === 'net') {
      const myScore = this.raceScores[this.mySeat] ?? 0;
      const oppSeat = this.mySeat === 0 ? 1 : 0;
      const oppScore = this.raceScores[oppSeat] ?? 0;
      playSound(myScore >= oppScore ? 'win' : 'die');
    } else {
      playSound(this.stats.correct >= this.stats.wrong ? 'win' : 'die');
    }
    this.gameOver();
  }

  // --- Net race helpers (host) ----------------------------------------------

  private broadcastResult(gen: number): void {
    if (gen !== this.gen || !this.currentRound || !this.net) return;
    const { result } = scoreRound(
      this.currentRound,
      this.netPlayers,
      this.basePoints,
      this.difficulty,
      this.raceScores,
      this.raceStreaks
    );
    this.net.send(OP_RESULT, result);
    this.applyRaceResult(result);
  }

  private startAnswerTimer(gen: number): void {
    this.clearAnswerTimer();
    this.startAnswerClock(gen, () => {
      if (!this.currentRound) return;
      // Fill any remaining undefined slots with null (timed out).
      for (let i = 0; i < this.netPlayers; i++) {
        if (this.currentRound.answers[i] === undefined) this.currentRound.answers[i] = null;
      }
      this.broadcastResult(gen);
    });
  }

  private startPassiveAnswerTimer(gen: number): void {
    this.clearAnswerTimer();
    this.startAnswerClock(gen, () => this.disableAnswerControls());
  }

  private startAnswerClock(gen: number, onExpire: () => void): void {
    this.answerTimer.start({
      seconds: this.answerSeconds,
      onTick: (remaining) => {
        if (gen !== this.gen) return;
        this.hud?.set('time', `${remaining}s`);
        this.hud?.toggle('time', 'is-low', remaining <= 5);
      },
      onExpire: () => {
        if (gen === this.gen) onExpire();
      },
    });
  }

  private clearAnswerTimer(): void {
    this.answerTimer.stop();
    this.hud?.set('time', null);
    this.hud?.toggle('time', 'is-low', false);
  }

  /** Applied by both host and guest when OP_RESULT is received. */
  private applyRaceResult(result: RaceResult): void {
    this.clearAnswerTimer();
    const gen = this.gen;
    const myCorrect = result.correct[this.mySeat] ?? false;
    this.locked = true;

    // Update cumulative scores and streaks (both host and guest mirror the
    // authoritative result — host uses these for the next scoreRound call).
    const prevMyScore = this.raceScores[this.mySeat] ?? 0;
    this.raceScores = [...result.scores];
    for (let i = 0; i < this.netPlayers; i++) {
      const ok = result.correct[i] ?? false;
      this.raceStreaks[i] = ok ? this.raceStreaks[i] + 1 : 0;
    }

    // Add earned points to state.score so the HUD reflects it.
    const earned = result.scores[this.mySeat] - prevMyScore;
    if (earned > 0) this.addScore(earned);

    // Reveal the correct answer on this.current so markAnswer can highlight it.
    if (this.current) this.current = { ...this.current, answer: result.correctAnswer };

    this.markAnswer(this.myLastAnswer, myCorrect);
    this.updateHud();

    const delay = myCorrect ? 550 : 1150;
    window.setTimeout(() => {
      if (gen !== this.gen) return;
      if (result.final) {
        this.finish();
      } else if (this.net?.role === 'host') {
        this.nextQuestion();
      }
      // Guest: wait for the next OP_QUESTION from the host.
    }, delay);
  }

  // --- Game-over (net mode) -------------------------------------------------

  protected onGameOver(): void {
    if (this.netMode === 'net') {
      this.showNetGameOver();
      return;
    }
    super.onGameOver();
  }

  private showNetGameOver(): void {
    const myScore = this.raceScores[this.mySeat] ?? 0;
    const oppSeat = this.mySeat === 0 ? 1 : 0;
    const oppScore = this.raceScores[oppSeat] ?? 0;

    const resultText =
      myScore > oppScore ? t('youWin') : myScore < oppScore ? t('youLose') : t('draw');

    const bodyHtml =
      `<p>${resultText}</p>` +
      `<p>${t('score')}: <strong>${myScore}</strong> — ` +
      `${t('hudOpponent')}: <strong>${oppScore}</strong></p>`;

    const isHost = this.net?.role === 'host';
    const buttons = isHost
      ? [
          {
            text: t('rematch'),
            primary: true,
            onClick: () => this.restartAfterGameOver(),
          },
          { text: t('quit'), primary: false, onClick: () => this.leaveNet() },
        ]
      : [
          {
            text: t('mpWaitingHost'),
            primary: false,
            onClick: () => {},
          },
          { text: t('quit'), primary: false, onClick: () => this.leaveNet() },
        ];

    this.overlay.show({ title: t('matchOver'), bodyHtml, buttons });
  }

  private leaveNet(): void {
    this.overlay.hide();
    this.net?.leave();
    this.returnToSolo();
  }

  // --- HUD ------------------------------------------------------------------

  private clearHud(): void {
    this.hud?.set('time', null);
    this.hud?.set('progress', null);
    this.hud?.set('lives', null);
    this.hud?.set('score', null);
    this.hud?.set('streak', null);
    this.hud?.set('high', null);
    this.hud?.set('opponent', null);
  }

  protected onScoreSaved(): void {
    super.onScoreSaved();
    this.overlay.hide();
    this.restartAfterGameOver();
  }

  private updateHud(): void {
    this.hud?.set('score', this.state.score);
    this.hud?.set('streak', this.stats.streak);
    this.hud?.set('high', this.scoreManager.getHighScore());

    if (this.netMode === 'net') {
      const oppSeat = this.mySeat === 0 ? 1 : 0;
      this.hud?.set('opponent', this.raceScores[oppSeat] ?? 0);
    }

    if (this.netMode === 'net' || this.mode === 'classic') {
      this.hud?.set('progress', `${Math.min(this.roundIndex, this.rounds)}/${this.rounds}`);
    } else if (this.mode === 'survival') {
      this.hud?.set('lives', Math.max(this.lives, 0));
      this.hud?.toggle('lives', 'is-low', this.lives <= 1);
    }
  }

  // --- Input ----------------------------------------------------------------

  /** Keys 1-9 pick a multiple-choice option (typed answers use the field/Enter). */
  handleInput(event: KeyboardEvent): void {
    if (!this.current?.choices || this.locked) return;
    const index = Number(event.key) - 1;
    if (Number.isInteger(index) && index >= 0 && index < this.current.choices.length) {
      this.answer(this.current.choices[index]);
    }
  }

  update(): void {}
  render(): void {}

  // --- Game-over recap (solo) -----------------------------------------------

  protected getGameOverTitle(): string {
    if (this.netMode === 'net') return t('matchOver');
    return accuracy(this.stats) === 100 && answered(this.stats) > 0
      ? t('flawless')
      : t('roundOver');
  }

  protected getGameOverContent(): string {
    if (this.netMode === 'net') {
      const myScore = this.raceScores[this.mySeat] ?? 0;
      const oppSeat = this.mySeat === 0 ? 1 : 0;
      const oppScore = this.raceScores[oppSeat] ?? 0;
      const resultText =
        myScore > oppScore ? t('youWin') : myScore < oppScore ? t('youLose') : t('draw');
      return (
        `<p>${resultText}</p>` +
        `<p>${t('score')}: <strong>${myScore}</strong> — ` +
        `${t('hudOpponent')}: <strong>${oppScore}</strong></p>`
      );
    }
    const total = answered(this.stats);
    return (
      `<p><strong>${this.stats.correct}/${total}</strong> ${t('correct')} ` +
      `(${accuracy(this.stats)}%)</p>` +
      `<p>${t('bestStreak')}: <strong>${this.stats.bestStreak}</strong> · ` +
      `${t('score')}: <strong>${this.state.score}</strong></p>`
    );
  }
}
