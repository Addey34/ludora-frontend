import type { Difficulty, Question } from '../../shared/quiz/quiz.js';

const MAX_OPERAND: Record<Difficulty, number> = {
  easy: 10,
  medium: 25,
  hard: 100,
};

type RandomSource = () => number;

export function make{{Class}}Question(
  difficulty: Difficulty,
  random: RandomSource = Math.random
): Question {
  const max = MAX_OPERAND[difficulty];
  const left = randomInteger(max, random);
  const right = randomInteger(max, random);
  return {
    prompt: String(left) + ' + ' + String(right),
    answer: String(left + right),
  };
}

function randomInteger(max: number, random: RandomSource): number {
  return Math.min(max, Math.floor(random() * max) + 1);
}
