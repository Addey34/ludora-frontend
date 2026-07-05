import { GameEngine, GameConfig } from '../engine/GameEngine.js';
import { setupHud } from '../ui/hud.js';
import { dismissStartOverlay } from '../ui/startOverlay.js';
import { setupSettingsPanel, SettingsField, difficultyField } from '../ui/settingsPanel.js';
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

/** Configuration shared by every quiz-style game. */
export interface QuizGameConfig extends GameConfig {
  /** Base points for a correct answer (before difficulty scaling + combo). */
  basePoints?: number;
  /** Questions per round in classic mode (default 10). */
  rounds?: number;
  /** Seconds per round in timed mode (default 60). */
  timedSeconds?: number;
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
 * Event-driven (clicks/keys), so it doesn't use the engine's rAF loop. A
 * generation counter guards the between-questions delay so a reset can't let a
 * stale timeout advance a fresh round.
 */
/** Lives in Survival mode: a wrong answer costs one, the run ends at zero. */
const SURVIVAL_LIVES = 3;

export abstract class QuizGame extends GameEngine {
  protected boardEl: HTMLElement | null = null;
  private promptEl: HTMLElement | null = null;
  private answerEl: HTMLElement | null = null;
  private feedbackEl: HTMLElement | null = null;

  protected difficulty: Difficulty = 'easy';
  protected mode: QuizMode = 'classic';
  /** Remaining lives in Survival mode. */
  private lives = 0;

  protected stats: QuizStats = emptyStats();
  protected current: Question | null = null;
  private roundIndex = 0;

  private readonly basePoints: number;
  private readonly rounds: number;
  private readonly timedSeconds: number;

  private readonly timer = new CountdownTimer();
  /** Bumped on every start/reset so a pending "next question" timeout bails. */
  private gen = 0;
  /** True between answering and the next question (blocks double answers). */
  private locked = false;

  constructor(config: QuizGameConfig) {
    super(config);
    this.basePoints = config.basePoints ?? 100;
    this.rounds = config.rounds ?? 10;
    this.timedSeconds = config.timedSeconds ?? 60;
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
   * controls (e.g. a category or language picker). Each field owns its `onChange`,
   * which typically updates game state then calls {@link restartRound}.
   */
  protected extraSettings(): SettingsField[] {
    return [];
  }

  /**
   * Optional per-variant leaderboard: return a `{ key, label }` to give this
   * difficulty/mode/… combination its own board (so incomparable runs don't
   * share a table), or `null` (default) to use the game's single board.
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
    ]);
    this.setupEventListeners();
    this.setupQuizSettings();
    this.renderScoreTable();
    await this.loadData();
    this.updateHud();
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
    setupSettingsPanel([difficulty, ...this.extraSettings(), mode]);
  }

  /** Stops any running round and starts a fresh one (used by settings changes). */
  protected restartRound(): void {
    this.overlay.hide();
    this.stop();
    this.start();
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
    this.lives = SURVIVAL_LIVES;
    this.locked = false;

    // Only the relevant readout is shown; the others are hidden per mode.
    this.hud?.set('time', null);
    this.hud?.set('progress', null);
    this.hud?.set('lives', null);

    if (this.mode === 'timed') {
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
    this.resetState();
    this.stats = emptyStats();
    this.roundIndex = 0;
    this.current = null;
    this.locked = false;
    if (this.promptEl) this.promptEl.textContent = '';
    if (this.answerEl) this.answerEl.replaceChildren();
    if (this.feedbackEl) this.feedbackEl.textContent = '';
    this.updateHud();
  }

  stop(): void {
    super.stop();
    this.timer.stop();
  }

  protected restartAfterGameOver(): void {
    this.overlay.hide();
    this.reset();
    this.start();
  }

  // --- Round flow -----------------------------------------------------------

  private nextQuestion(): void {
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

  private renderQuestion(): void {
    const question = this.current;
    if (!question || !this.promptEl || !this.answerEl || !this.feedbackEl) return;

    this.promptEl.innerHTML = question.prompt;
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
      // Small ordinal so keyboard players (keys 1-9) know the mapping.
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

    const correct = isCorrect(given, question.answer);
    recordAnswer(this.stats, correct);

    if (correct) {
      this.addScore(scoreForCorrect(this.basePoints, this.difficulty, this.stats.streak));
      playSound('score');
    } else {
      playSound('mismatch');
    }

    // Survival: a wrong answer costs a life; the run ends when they run out.
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
    this.gen += 1;
    playSound(this.stats.correct >= this.stats.wrong ? 'win' : 'die');
    this.gameOver();
  }

  private updateHud(): void {
    this.hud?.set('score', this.state.score);
    this.hud?.set('streak', this.stats.streak);
    this.hud?.set('high', this.scoreManager.getHighScore());
    if (this.mode === 'classic') {
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

  // --- Game-over recap ------------------------------------------------------

  protected getGameOverTitle(): string {
    return accuracy(this.stats) === 100 && answered(this.stats) > 0
      ? t('flawless')
      : t('roundOver');
  }

  protected getGameOverContent(): string {
    const total = answered(this.stats);
    return (
      `<p><strong>${this.stats.correct}/${total}</strong> ${t('correct')} ` +
      `(${accuracy(this.stats)}%)</p>` +
      `<p>${t('bestStreak')}: <strong>${this.stats.bestStreak}</strong> · ` +
      `${t('score')}: <strong>${this.state.score}</strong></p>`
    );
  }
}
