import type { Question } from '../../shared/quiz/quiz.js';
import { QuizGame } from '../../shared/quiz/QuizGame.js';
import { make{{Class}}Question } from './{{key}}.js';

export class {{Class}}Game extends QuizGame {
  constructor() {
    super({
      storageKey: '{{key}}-scores',
      basePoints: 100,
      rounds: 10,
      timedSeconds: 60,
      roundChoices: [5, 10, 20],
      timeChoices: [30, 60, 120],
      livesChoices: [1, 3, 5],
    });
  }

  protected makeQuestion(): Question {
    return make{{Class}}Question(this.difficulty);
  }

  protected get inputMode(): 'text' | 'numeric' {
    return 'numeric';
  }
}
