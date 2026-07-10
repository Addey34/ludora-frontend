/**
 * Mental Math — pure question generation, no DOM. Given a difficulty (and an
 * injectable `rng`), it builds an arithmetic question with a typed answer.
 * Deterministic and unit-tested in isolation, like the other games' logic.
 */

import { Difficulty, Question } from '../../shared/quiz/quiz.js';

type Operation = '+' | '-' | '×' | '÷';

interface MathParams {
  /** Operations allowed at this difficulty. */
  ops: Operation[];
  /** Upper bound of the operands (1..max). */
  max: number;
}

/** Difficulty presets: more operations and bigger numbers as it climbs. */
export const MATH_PARAMS: Record<Difficulty, MathParams> = {
  easy: { ops: ['+', '-'], max: 10 },
  medium: { ops: ['+', '-', '×'], max: 12 },
  hard: { ops: ['+', '-', '×', '÷'], max: 20 },
};

/**
 * Builds one arithmetic question for the given difficulty. Subtractions stay
 * non-negative and divisions are always exact (the dividend is built from the
 * quotient), so the answer is always a clean whole number.
 */
export function makeMathQuestion(
  difficulty: Difficulty,
  rng: () => number = Math.random
): Question {
  const { ops, max } = MATH_PARAMS[difficulty];
  const op = ops[Math.floor(rng() * ops.length)];
  const rand = (n: number): number => Math.floor(rng() * n) + 1; // 1..n

  let a = rand(max);
  let b = rand(max);
  let answer = 0;

  switch (op) {
    case '+':
      answer = a + b;
      break;
    case '-':
      if (b > a) [a, b] = [b, a]; // keep the result ≥ 0
      answer = a - b;
      break;
    case '×':
      answer = a * b;
      break;
    case '÷':
      // Build a clean division: dividend = divisor × quotient.
      answer = rand(max);
      a = b * answer;
      break;
  }

  return { prompt: `${a} ${op} ${b}`, answer: String(answer) };
}
