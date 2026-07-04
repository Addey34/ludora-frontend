import { QuizGame } from '../../shared/quiz/QuizGame.js';
import { Question } from '../../shared/quiz/quiz.js';
import { SettingsField } from '../../shared/ui/settingsPanel.js';
import { Lang, LENGTH_BY_DIFFICULTY, pickWord, scramble } from '../../shared/words/words.js';
import { loadWords } from '../../shared/words/wordBank.js';

/**
 * Anagrams: unscramble the letters to find the word. A typed quiz on QuizGame,
 * powered by the shared word service — difficulty picks the word length and a
 * Language setting (FR/EN) swaps the list. Both lists are loaded up front so the
 * language toggle is instant.
 */
export class AnagramGame extends QuizGame {
  private lang: Lang = 'en';
  private words: Record<Lang, string[]> = { fr: [], en: [] };

  constructor() {
    super({
      storageKey: 'anagram-scores',
      leaderboardId: 'anagram',
      basePoints: 120,
      rounds: 10,
      timedSeconds: 75,
    });
  }

  protected async loadData(): Promise<void> {
    const [fr, en] = await Promise.all([loadWords('fr'), loadWords('en')]);
    this.words = { fr, en };
  }

  protected extraSettings(): SettingsField[] {
    return [
      {
        id: 'lang',
        label: 'Language',
        choices: [
          { label: 'FR', value: 'fr' },
          { label: 'EN', value: 'en' },
        ],
        value: this.lang,
        onChange: (v) => {
          this.lang = v === 'en' ? 'en' : 'fr';
          this.restartRound();
        },
      },
    ];
  }

  protected makeQuestion(): Question {
    const [min, max] = LENGTH_BY_DIFFICULTY[this.difficulty];
    const word = pickWord(this.words[this.lang], min, max);
    const letters = scramble(word).split('').join(' ');
    return {
      prompt:
        `<span class="anagram-letters">${letters}</span>` +
        `<span class="anagram-count">${word.length} letters</span>`,
      answer: word,
    };
  }
}
