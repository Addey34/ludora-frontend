import { QuizGame } from '../../shared/quiz/QuizGame.js';
import { Question } from '../../shared/quiz/quiz.js';
import { SettingsField, languageField } from '../../shared/ui/settingsPanel.js';
import { Lang, WordEntry, keyboardForm, pickWord, scramble } from '../../shared/words/words.js';
import { loadWords } from '../../shared/words/wordBank.js';

/**
 * Anagrams: unscramble the letters to find the word. A typed quiz on QuizGame,
 * powered by the shared word service — difficulty picks the word length and a
 * Language setting (FR/EN) swaps the list. Both lists are loaded up front so the
 * language toggle is instant.
 */
export class AnagramGame extends QuizGame {
  private lang: Lang = 'en';
  private words: Record<Lang, WordEntry[]> = { fr: [], en: [] };

  constructor() {
    super({
      storageKey: 'anagram-scores',
      leaderboardId: 'anagram',
      basePoints: 120,
      rounds: 10,
      timedSeconds: 75,
      answerSeconds: 25,
    });
  }

  async initialize(): Promise<void> {
    await super.initialize();
    this.setupVersus();
  }

  protected async loadData(): Promise<void> {
    const [fr, en] = await Promise.all([loadWords('fr'), loadWords('en')]);
    this.words = { fr, en };
  }

  protected extraSettings(): SettingsField[] {
    return [
      languageField(this.lang, (v) => {
        this.lang = v === 'en' ? 'en' : 'fr';
        this.restartRound();
      }),
    ];
  }

  protected leaderboardVariant(): { key: string; label: string } | null {
    const cap = (s: string): string => s[0].toUpperCase() + s.slice(1);
    return {
      key: `${this.lang}-${this.difficulty}-${this.mode}`,
      label: `${this.lang.toUpperCase()} · ${cap(this.difficulty)} · ${cap(this.mode)}`,
    };
  }

  protected makeQuestion(): Question {
    const word = keyboardForm(pickWord(this.words[this.lang], this.difficulty));
    const letters = scramble(word).split('').join(' ');
    return {
      prompt:
        `<span class="anagram-letters">${letters}</span>` +
        `<span class="anagram-count">${word.length} letters</span>`,
      answer: word,
    };
  }
}
