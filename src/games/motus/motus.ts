/**
 * Motus / Wordle — pure logic, no DOM. Guess scoring and word normalisation,
 * fully deterministic and unit-tested in isolation.
 */

export const WORD_LEN = 5;
export const MAX_TRIES = 6;

/** Per-letter result of a guess. */
export type Verdict = 'correct' | 'present' | 'absent';

/**
 * Normalises a raw dictionary/word entry: strips accents, upper-cases, and keeps
 * it only if it is exactly {@link WORD_LEN} plain letters (A-Z). Returns null for
 * anything else (wrong length, hyphen, apostrophe, digits…).
 */
export function normalizeWord(raw: string): string | null {
  const up = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  return new RegExp(`^[A-Z]{${WORD_LEN}}$`).test(up) ? up : null;
}

/**
 * Scores `guess` against `target` with the classic two-pass Wordle rule: exact
 * positions first ('correct'), then remaining letters that exist elsewhere
 * ('present') while respecting each letter's remaining count, so duplicates are
 * handled correctly. Everything else is 'absent'.
 */
export function scoreGuess(guess: string, target: string): Verdict[] {
  const n = target.length;
  const res: Verdict[] = Array.from({ length: n }, () => 'absent');
  const remaining: Record<string, number> = {};
  for (const ch of target) remaining[ch] = (remaining[ch] ?? 0) + 1;

  for (let i = 0; i < n; i++) {
    if (guess[i] === target[i]) {
      res[i] = 'correct';
      remaining[guess[i]]--;
    }
  }
  for (let i = 0; i < n; i++) {
    if (res[i] === 'correct') continue;
    const ch = guess[i];
    if ((remaining[ch] ?? 0) > 0) {
      res[i] = 'present';
      remaining[ch]--;
    }
  }
  return res;
}
