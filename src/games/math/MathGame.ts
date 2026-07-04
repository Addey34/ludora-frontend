import { QuizGame } from '../../shared/quiz/QuizGame.js';
import { Question } from '../../shared/quiz/quiz.js';
import { makeMathQuestion } from './math.js';

/**
 * Mental Math: solve generated arithmetic as fast as you can. A pure quiz game —
 * all the round/scoring/streak/timed/recap machinery comes from {@link QuizGame};
 * this only generates the next sum (typed answer, numeric keyboard) for the
 * chosen difficulty. Nothing to load: questions are produced on the fly.
 */
export class MathGame extends QuizGame {
  constructor() {
    super({
      storageKey: 'math-scores',
      leaderboardId: 'math',
      basePoints: 100,
      rounds: 10,
      timedSeconds: 60,
    });
  }

  protected makeQuestion(): Question {
    return makeMathQuestion(this.difficulty);
  }

  protected get inputMode(): 'text' | 'numeric' {
    return 'numeric';
  }
}
