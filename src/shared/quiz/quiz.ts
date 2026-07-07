/**
 * Quiz — pure logic shared by every question/answer educational game (Mental
 * Math, Geography, and future trivia/vocabulary games). No DOM, no time: the
 * question model, answer checking, streak/combo scoring and accuracy tally live
 * here so they are deterministic and unit-tested in isolation, exactly like the
 * board games' rules. The {@link QuizGame} base wires this to the shared chrome.
 */

// Difficulty is a cross-game primitive; re-exported here so quiz games keep a
// single import surface while `bot/difficulty.ts` stays its one definition.
export { type Difficulty, DIFFICULTIES } from '../bot/difficulty.js';
import type { Difficulty } from '../bot/difficulty.js';

/** How difficulty scales the base points of a correct answer. */
export function difficultyMultiplier(difficulty: Difficulty): number {
  return difficulty === 'hard' ? 2 : difficulty === 'medium' ? 1.5 : 1;
}

/**
 * How a round is bounded: a fixed number of questions (`classic`), a countdown
 * (`timed`), or endless until you run out of lives (`survival`).
 */
export type QuizMode = 'classic' | 'timed' | 'survival';

/**
 * A single question. `choices` present ⇒ multiple-choice (buttons); absent ⇒ the
 * answer is typed. `prompt` is trusted HTML built by the game (a sum, a country
 * name, a flag…). `answer` is the exact expected value (a choice, or the accepted
 * typed text, matched loosely via {@link normalizeAnswer}).
 */
export interface Question {
  prompt: string;
  choices?: string[];
  answer: string;
  /** Optional note revealed on a wrong answer / in the recap. */
  hint?: string;
}

/** Running tally of a quiz round. */
export interface QuizStats {
  correct: number;
  wrong: number;
  /** Current run of consecutive correct answers. */
  streak: number;
  /** Longest streak reached this round. */
  bestStreak: number;
}

export function emptyStats(): QuizStats {
  return { correct: 0, wrong: 0, streak: 0, bestStreak: 0 };
}

/** Records an answer outcome, updating the streak/best-streak. Mutates + returns. */
export function recordAnswer(stats: QuizStats, correct: boolean): QuizStats {
  if (correct) {
    stats.correct += 1;
    stats.streak += 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  } else {
    stats.wrong += 1;
    stats.streak = 0;
  }
  return stats;
}

/** Total questions answered so far. */
export function answered(stats: QuizStats): number {
  return stats.correct + stats.wrong;
}

/** Success rate as a 0–100 integer (0 when nothing has been answered yet). */
export function accuracy(stats: QuizStats): number {
  const total = answered(stats);
  return total === 0 ? 0 : Math.round((stats.correct / total) * 100);
}

/**
 * Points for a correct answer: the base value scaled by difficulty, plus a combo
 * bonus that grows with the current streak (+10 per step, capped at +100 so a
 * long streak can't run away). `streak` is the run *including* this answer.
 */
export function scoreForCorrect(base: number, difficulty: Difficulty, streak: number): number {
  const combo = Math.min(Math.max(streak - 1, 0), 10) * 10;
  return Math.round(base * difficultyMultiplier(difficulty)) + combo;
}

/**
 * Normalises a typed answer for a forgiving comparison: strips accents, trims,
 * lowercases and collapses inner whitespace (so "  New   York " matches
 * "new york", and "Bogotá" matches "bogota").
 */
export function normalizeAnswer(raw: string): string {
  return raw.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Whether a given answer matches the expected one (after normalisation). */
export function isCorrect(given: string, answer: string): boolean {
  return normalizeAnswer(given) === normalizeAnswer(answer);
}

/**
 * Fisher-Yates shuffle returning a NEW array (pure given `rng`), used to lay out
 * multiple-choice options in a random order.
 */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Builds a multiple-choice option set: the `answer` plus up to `count-1` distinct
 * decoys drawn from `pool` (never equal to the answer), all shuffled. Pure given `rng`.
 */
export function buildChoices(
  answer: string,
  pool: readonly string[],
  count: number,
  rng: () => number = Math.random
): string[] {
  const decoys = shuffle(
    pool.filter((option) => option !== answer),
    rng
  ).slice(0, Math.max(0, count - 1));
  return shuffle([answer, ...decoys], rng);
}
