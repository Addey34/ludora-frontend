/**
 * Words — the shared FR/EN word service used by the vocabulary games (Anagrams,
 * Hangman, and future spelling games). This file is the **pure** part: scrambling,
 * hangman masking and length filtering, all deterministic and unit-tested. The
 * async loading lives in {@link ./wordBank.ts}. Words are stored uppercase A–Z
 * (accents stripped) so an on-screen keyboard and letter matching stay simple.
 *
 * See the project's "shared dictionary" direction: this is the generic base for
 * every future word/language game (language is a per-game setting).
 */

import { Difficulty } from '../quiz/quiz.js';

export type Lang = 'fr' | 'en';
export const LANGS: Lang[] = ['fr', 'en'];

/** Word-length window per difficulty (used to pick harder/longer words). */
export const LENGTH_BY_DIFFICULTY: Record<Difficulty, [number, number]> = {
  easy: [4, 5],
  medium: [6, 7],
  hard: [8, 12],
};

/** Wrong guesses allowed in Hangman, per difficulty. */
export const HANGMAN_LIVES: Record<Difficulty, number> = {
  easy: 8,
  medium: 6,
  hard: 5,
};

/**
 * Returns a shuffled version of `word` guaranteed different from the original
 * (unless every letter is identical). Pure given `rng`.
 */
export function scramble(word: string, rng: () => number = Math.random): string {
  if (word.length < 2) return word;
  const letters = word.split('');
  for (let attempt = 0; attempt < 12; attempt++) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    const out = letters.join('');
    if (out !== word) return out;
  }
  return letters.join('');
}

/** Reveals the guessed letters of `word`, masking the rest with `_`. */
export function maskWord(word: string, guessed: ReadonlySet<string>): string {
  return word
    .split('')
    .map((ch) => (guessed.has(ch) ? ch : '_'))
    .join('');
}

/** Whether every letter of `word` has been guessed. */
export function isWordGuessed(word: string, guessed: ReadonlySet<string>): boolean {
  return word.split('').every((ch) => guessed.has(ch));
}

/**
 * Picks a random word whose length falls in `[min, max]`; falls back to the whole
 * list when none matches (so a game never stalls). Pure given `rng`.
 */
export function pickWord(
  words: readonly string[],
  min: number,
  max: number,
  rng: () => number = Math.random
): string {
  const inRange = words.filter((w) => w.length >= min && w.length <= max);
  const pool = inRange.length > 0 ? inRange : words;
  return pool[Math.floor(rng() * pool.length)] ?? '';
}
