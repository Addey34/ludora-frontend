import { QuizGame } from '../../shared/quiz/QuizGame.js';
import { Question, buildChoices } from '../../shared/quiz/quiz.js';
import { SettingsField } from '../../shared/ui/settingsPanel.js';
import { getLocale } from '../../shared/i18n/i18n.js';

interface TriviaItem {
  category: string;
  question: string;
  answer: string;
}

/** Category ids ↔ display labels (also drives the settings picker). */
const CATEGORIES: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'science', label: 'Science' },
  { value: 'history', label: 'History' },
  { value: 'culture', label: 'Culture' },
  { value: 'nature', label: 'Nature' },
];

const FALLBACK: TriviaItem[] = [
  { category: 'science', question: 'Chemical symbol for gold?', answer: 'Au' },
  { category: 'science', question: 'Closest planet to the Sun?', answer: 'Mercury' },
  { category: 'history', question: 'Year the Second World War ended?', answer: '1945' },
  { category: 'history', question: 'First man on the Moon?', answer: 'Neil Armstrong' },
  { category: 'culture', question: 'Who painted the Mona Lisa?', answer: 'Leonardo da Vinci' },
  { category: 'nature', question: 'Largest animal in the world?', answer: 'Blue whale' },
];

/**
 * General-knowledge trivia: multiple-choice questions across categories
 * (science, history, culture, nature). Data-driven on QuizGame — this only loads
 * the question bank and turns an item into an MCQ, drawing plausible decoys from
 * other answers of the same category. A Category setting filters the pool.
 */
export class TriviaGame extends QuizGame {
  private items: TriviaItem[] = FALLBACK;
  private category = 'all';

  constructor() {
    super({
      storageKey: 'trivia-scores',
      leaderboardId: 'trivia',
      basePoints: 120,
      rounds: 10,
      timedSeconds: 60,
    });
  }

  protected async loadData(): Promise<void> {
    // Content follows the interface language (English until other languages are
    // curated — there is no free multilingual trivia source).
    for (const file of [`trivia-${getLocale()}.json`, 'trivia-en.json']) {
      try {
        const res = await fetch(`/data/${file}`);
        const data = (await res.json()) as TriviaItem[];
        if (Array.isArray(data) && data.length >= 4) {
          this.items = data;
          return;
        }
      } catch {
        /* try the English fallback, then the built-in list */
      }
    }
    this.items = FALLBACK;
  }

  protected extraSettings(): SettingsField[] {
    return [
      {
        id: 'category',
        label: 'Category',
        choices: CATEGORIES,
        value: this.category,
        onChange: (v) => {
          this.category = v;
          this.restartRound();
        },
      },
    ];
  }

  protected makeQuestion(): Question {
    const pool =
      this.category === 'all' ? this.items : this.items.filter((i) => i.category === this.category);
    const list = pool.length >= 4 ? pool : this.items;
    const item = list[Math.floor(Math.random() * list.length)];
    const count = this.difficulty === 'easy' ? 3 : 4;
    // Decoys drawn from the same category so the options stay plausible.
    const sameCategory = this.items
      .filter((i) => i.category === item.category)
      .map((i) => i.answer);
    return {
      prompt: item.question,
      choices: buildChoices(item.answer, sameCategory, count),
      answer: item.answer,
    };
  }
}
