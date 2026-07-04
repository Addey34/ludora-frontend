import { QuizGame } from '../../shared/quiz/QuizGame.js';
import { Question, buildChoices } from '../../shared/quiz/quiz.js';
import { SettingsField } from '../../shared/ui/settingsPanel.js';

interface Country {
  name: string;
  capital: string;
  /** SVG flag URL (from the data pipeline); absent on the offline fallback. */
  flag?: string;
}

/** Offline fallback if the country list can't be fetched (dev without network). */
const FALLBACK: Country[] = [
  { name: 'France', capital: 'Paris' },
  { name: 'Germany', capital: 'Berlin' },
  { name: 'Spain', capital: 'Madrid' },
  { name: 'Italy', capital: 'Rome' },
  { name: 'Portugal', capital: 'Lisbon' },
  { name: 'Japan', capital: 'Tokyo' },
  { name: 'Brazil', capital: 'Brasília' },
  { name: 'Canada', capital: 'Ottawa' },
];

type QuizType = 'capital' | 'flag' | 'mixed';

/**
 * Geo Quiz: match countries with their capitals or flags. A data-driven quiz on
 * {@link QuizGame} — the round, scoring, streak, mode and recap are inherited;
 * this only turns the country list into MCQs. A "Quiz" setting picks capitals,
 * flags (uses the SVG flag URLs from the pipeline), or a mix; difficulty sets the
 * option count (and, on hard capitals, occasionally reverses the direction).
 */
export class GeoGame extends QuizGame {
  private countries: Country[] = FALLBACK;
  private quizType: QuizType = 'capital';

  constructor() {
    super({
      storageKey: 'geoquiz-scores',
      leaderboardId: 'geoquiz',
      basePoints: 100,
      rounds: 10,
      timedSeconds: 60,
    });
  }

  protected async loadData(): Promise<void> {
    try {
      const res = await fetch('/data/countries.json');
      const data = (await res.json()) as Country[];
      if (Array.isArray(data) && data.length >= 4) this.countries = data;
    } catch {
      this.countries = FALLBACK;
    }
  }

  protected extraSettings(): SettingsField[] {
    return [
      {
        id: 'quizType',
        label: 'Quiz',
        choices: [
          { label: 'Capitals', value: 'capital' },
          { label: 'Flags', value: 'flag' },
          { label: 'Mixed', value: 'mixed' },
        ],
        value: this.quizType,
        onChange: (v) => {
          this.quizType = v === 'flag' ? 'flag' : v === 'mixed' ? 'mixed' : 'capital';
          this.restartRound();
        },
      },
    ];
  }

  protected makeQuestion(): Question {
    const count = this.difficulty === 'easy' ? 3 : 4;
    const flagsAvailable = this.countries.some((c) => c.flag);
    const wantFlag =
      flagsAvailable &&
      (this.quizType === 'flag' || (this.quizType === 'mixed' && Math.random() < 0.5));

    if (wantFlag) return this.flagQuestion(count);
    return this.capitalQuestion(count);
  }

  /** "Which country is this flag?" — flag image prompt, country-name choices. */
  private flagQuestion(count: number): Question {
    const withFlags = this.countries.filter((c) => c.flag);
    const country = withFlags[Math.floor(Math.random() * withFlags.length)];
    return {
      prompt: `Which country is this?<br><img class="geo-flag" src="${country.flag}" alt="" />`,
      choices: buildChoices(
        country.name,
        this.countries.map((c) => c.name),
        count
      ),
      answer: country.name,
    };
  }

  /** "Capital of X?" (or, on hard, the reverse "which country's capital is Y?"). */
  private capitalQuestion(count: number): Question {
    const list = this.countries;
    const country = list[Math.floor(Math.random() * list.length)];
    const reverse = this.difficulty === 'hard' && Math.random() < 0.5;

    if (reverse) {
      return {
        prompt: `Which country's capital is <strong>${country.capital}</strong>?`,
        choices: buildChoices(
          country.name,
          list.map((c) => c.name),
          count
        ),
        answer: country.name,
      };
    }

    return {
      prompt: `Capital of <strong>${country.name}</strong>?`,
      choices: buildChoices(
        country.capital,
        list.map((c) => c.capital),
        count
      ),
      answer: country.capital,
    };
  }
}
