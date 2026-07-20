import { getLocale, t } from '../../shared/i18n/i18n.js';
import type { Difficulty, Question } from '../../shared/quiz/quiz.js';
import { QuizGame } from '../../shared/quiz/QuizGame.js';
import type { SettingsField } from '../../shared/ui/settingsPanel.js';
import { makeSciencequizQuestion, type ScienceTopicFilter } from './sciencequiz.js';

const TOPICS: ScienceTopicFilter[] = ['all', 'biology', 'chemistry', 'physics', 'space', 'earth'];

export class SciencequizGame extends QuizGame {
  private topic: ScienceTopicFilter = 'all';
  private previousQuestionId: string | null = null;

  constructor() {
    super({
      storageKey: 'sciencequiz-scores',
      leaderboardId: 'sciencequiz',
      basePoints: 120,
      rounds: 10,
      timedSeconds: 60,
      answerSeconds: 20,
      roundChoices: [5, 10, 15],
      timeChoices: [30, 60, 120],
      answerChoices: [10, 20, 30],
      livesChoices: [1, 3, 5],
    });
  }

  async initialize(): Promise<void> {
    await super.initialize();
    this.setupVersus();
  }

  protected makeQuestion(): Question {
    const question = makeSciencequizQuestion(
      this.difficulty,
      getLocale(),
      this.topic,
      Math.random,
      this.previousQuestionId
    );
    this.previousQuestionId = question.id;
    return question;
  }

  protected extraSettings(): SettingsField[] {
    return [
      {
        id: 'topic',
        label: t('scienceTopic'),
        choices: TOPICS.map((topic) => ({ value: topic, label: topicLabel(topic) })),
        value: this.topic,
        onChange: (value) => {
          this.topic = TOPICS.includes(value as ScienceTopicFilter)
            ? (value as ScienceTopicFilter)
            : 'all';
          this.previousQuestionId = null;
          this.restartRound();
        },
      },
    ];
  }

  protected onDifficultyChanged(): void {
    this.previousQuestionId = null;
  }

  protected leaderboardVariant(): { key: string; label: string } {
    return {
      key: `${this.difficulty}-${this.topic}`,
      label: `${difficultyLabel(this.difficulty)} · ${topicLabel(this.topic)}`,
    };
  }
}

function topicLabel(topic: ScienceTopicFilter): string {
  switch (topic) {
    case 'biology':
      return t('scienceBiology');
    case 'chemistry':
      return t('scienceChemistry');
    case 'physics':
      return t('sciencePhysics');
    case 'space':
      return t('scienceSpace');
    case 'earth':
      return t('scienceEarth');
    default:
      return t('scienceAllTopics');
  }
}

function difficultyLabel(difficulty: Difficulty): string {
  if (difficulty === 'hard') return t('hard');
  if (difficulty === 'medium') return t('medium');
  return t('easy');
}
