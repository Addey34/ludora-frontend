/**
 * Words — the shared FR/EN (+ more) word service used by the language games
 * (Typing, Anagrams, Hangman, …). This is the **pure** part: the word model,
 * scrambling, hangman masking and the keyboard (accent-free) form, all
 * deterministic and unit-tested. Async loading lives in {@link ./wordBank.ts}.
 *
 * Words keep their real spelling (accents included) and carry a difficulty tier,
 * so a game can pick easy/medium/hard words. Games that need an A–Z keyboard
 * (Anagrams, Hangman) strip accents via {@link keyboardForm}; Typing uses the
 * real spelling so accents are actually typed.
 */

import { Difficulty } from '../quiz/quiz.js';

export type Lang = 'fr' | 'en';

/** A word: its real spelling (`w`, accents kept) and its difficulty tier (`d`). */
export interface WordEntry {
  w: string;
  d: Difficulty;
}

/** Accent-free uppercase form (A–Z), for the on-screen-keyboard games. */
export function keyboardForm(word: string): string {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

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
 * Picks a random word of the given difficulty tier; falls back to the whole list
 * when that tier is empty (so a game never stalls). Returns the real spelling.
 * Pure given `rng`.
 */
export function pickWord(
  entries: readonly WordEntry[],
  difficulty: Difficulty,
  rng: () => number = Math.random
): string {
  const tier = entries.filter((e) => e.d === difficulty);
  const pool = tier.length > 0 ? tier : entries;
  return pool[Math.floor(rng() * pool.length)]?.w ?? '';
}
