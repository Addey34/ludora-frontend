/**
 * Mastermind — pure deduction logic (no DOM, no time), unit-tested in isolation
 * (`mastermind.test.ts`). The controller (`MastermindGame`) owns the rendering,
 * the input and the scoring.
 *
 * A hidden **code** is a sequence of colour indices (`0 … colors-1`). The player
 * guesses; each guess is scored with the classic feedback: **black** pegs for
 * right colour in the right spot, **white** pegs for right colour in the wrong
 * spot. The scoring correctly handles duplicate colours (each code peg is matched
 * at most once) — the subtle part that {@link scoreGuess} gets right.
 */

/** Feedback for one guess: exact hits (black) and colour-only hits (white). */
export interface Feedback {
  black: number;
  white: number;
}

/**
 * Generates a secret code of `length` from `colors` colours. With
 * `allowDuplicates === false` the colours are distinct (requires
 * `colors >= length`). Pure given `rng`.
 */
export function generateCode(
  length: number,
  colors: number,
  allowDuplicates: boolean,
  rng: () => number = Math.random
): number[] {
  if (allowDuplicates) {
    return Array.from({ length }, () => Math.floor(rng() * colors));
  }
  const pool = Array.from({ length: colors }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, length);
}

/**
 * Scores `guess` against `secret` (same length). Black = right colour & spot;
 * white = right colour, wrong spot — each code peg counted once, so duplicates
 * never inflate the white count.
 */
export function scoreGuess(secret: number[], guess: number[]): Feedback {
  const n = secret.length;
  let black = 0;
  const secretLeft = new Map<number, number>();
  const guessLeft = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    if (secret[i] === guess[i]) {
      black++;
    } else {
      secretLeft.set(secret[i], (secretLeft.get(secret[i]) ?? 0) + 1);
      guessLeft.set(guess[i], (guessLeft.get(guess[i]) ?? 0) + 1);
    }
  }
  let white = 0;
  for (const [color, count] of guessLeft) {
    white += Math.min(count, secretLeft.get(color) ?? 0);
  }
  return { black, white };
}

/** Whether a guess exactly cracked the code. */
export function isWin(feedback: Feedback, length: number): boolean {
  return feedback.black === length;
}
