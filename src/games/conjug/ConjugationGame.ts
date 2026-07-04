import { QuizGame } from '../../shared/quiz/QuizGame.js';
import { Question } from '../../shared/quiz/quiz.js';

type Tense = 'présent' | 'imparfait' | 'futur';

interface Verb {
  verb: string;
  présent: string[];
  imparfait: string[];
  futur: string[];
}

/** Subject pronouns, in the conjugation table order. */
const PRONOUNS = ['je', 'tu', 'il/elle', 'nous', 'vous', 'ils/elles'];

/** Tense display labels (English UI for a French-verb trainer). */
const TENSE_LABEL: Record<Tense, string> = {
  présent: 'present',
  imparfait: 'imperfect',
  futur: 'future',
};

/** Tenses unlocked per difficulty (adds one tense each step). */
const TENSES_BY_DIFFICULTY: Record<string, Tense[]> = {
  easy: ['présent'],
  medium: ['présent', 'futur'],
  hard: ['présent', 'imparfait', 'futur'],
};

const FALLBACK: Verb[] = [
  {
    verb: 'être',
    présent: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'],
    imparfait: ['étais', 'étais', 'était', 'étions', 'étiez', 'étaient'],
    futur: ['serai', 'seras', 'sera', 'serons', 'serez', 'seront'],
  },
  {
    verb: 'avoir',
    présent: ['ai', 'as', 'a', 'avons', 'avez', 'ont'],
    imparfait: ['avais', 'avais', 'avait', 'avions', 'aviez', 'avaient'],
    futur: ['aurai', 'auras', 'aura', 'aurons', 'aurez', 'auront'],
  },
];

/** Whether "je" elides to "j'" before this form (vowel or mute h start). */
function elides(form: string): boolean {
  return /^[aeiouyàâäéèêëîïôöûüh]/i.test(form);
}

/**
 * French conjugation trainer: given a verb, a tense and a subject pronoun, type
 * the conjugated form. Typed-answer quiz on QuizGame; difficulty unlocks more
 * tenses (présent → + futur → + imparfait). Accents are forgiven by the shared
 * answer normalisation, so "etait" is accepted for "était".
 */
export class ConjugationGame extends QuizGame {
  private verbs: Verb[] = FALLBACK;

  constructor() {
    super({
      storageKey: 'conjug-scores',
      leaderboardId: 'conjug',
      basePoints: 120,
      rounds: 10,
      timedSeconds: 75,
    });
  }

  protected async loadData(): Promise<void> {
    try {
      const res = await fetch('/data/verbs.json');
      const data = (await res.json()) as Verb[];
      if (Array.isArray(data) && data.length >= 2) this.verbs = data;
    } catch {
      this.verbs = FALLBACK;
    }
  }

  protected makeQuestion(): Question {
    const tenses = TENSES_BY_DIFFICULTY[this.difficulty] ?? TENSES_BY_DIFFICULTY.easy;
    const tense = tenses[Math.floor(Math.random() * tenses.length)];
    const verb = this.verbs[Math.floor(Math.random() * this.verbs.length)];
    const index = Math.floor(Math.random() * PRONOUNS.length);
    const form = verb[tense][index];

    const pronoun = index === 0 && elides(form) ? "j'" : `${PRONOUNS[index]} `;

    return {
      prompt:
        `Conjugate <strong>${verb.verb}</strong> (<em>${TENSE_LABEL[tense]}</em>):` +
        `<br><span class="conj-blank">${pronoun}______</span>`,
      answer: form,
      hint: `${pronoun}${form}`,
    };
  }
}
