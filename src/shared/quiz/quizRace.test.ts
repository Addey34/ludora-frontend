import { describe, it, expect } from 'vitest';
import { stripAnswer, allAnswered, scoreRound, type RaceRound } from './quizRace.js';
import type { Question } from './quiz.js';

const Q: Question = { prompt: 'What is 2+2?', answer: '4', choices: ['3', '4', '5', '6'] };

function round(answers: (string | null | undefined)[], final = false): RaceRound {
  return { roundIndex: 1, question: Q, answers, final };
}

describe('stripAnswer', () => {
  it('omits the answer field', () => {
    const q = stripAnswer(Q, 1);
    expect('answer' in q).toBe(false);
  });

  it('preserves roundIndex, prompt and choices', () => {
    const q = stripAnswer(Q, 3);
    expect(q.roundIndex).toBe(3);
    expect(q.prompt).toBe(Q.prompt);
    expect(q.choices).toEqual(Q.choices);
  });

  it('omits choices when the question has none', () => {
    const noChoice: Question = { prompt: 'Capital of France?', answer: 'Paris' };
    expect(stripAnswer(noChoice, 1).choices).toBeUndefined();
  });

  it('copies the choices array (no shared reference)', () => {
    const q = stripAnswer(Q, 1);
    expect(q.choices).not.toBe(Q.choices);
  });
});

describe('allAnswered', () => {
  it('returns false when all answers are undefined', () => {
    expect(allAnswered(round([undefined, undefined]), 2)).toBe(false);
  });

  it('returns false when only one of two seats answered', () => {
    expect(allAnswered(round(['4', undefined]), 2)).toBe(false);
    expect(allAnswered(round([undefined, '3']), 2)).toBe(false);
  });

  it('returns true when all seats submitted a string', () => {
    expect(allAnswered(round(['4', '3']), 2)).toBe(true);
  });

  it('returns true when all seats timed out (null)', () => {
    expect(allAnswered(round([null, null]), 2)).toBe(true);
  });

  it('returns true for a mix of string and null', () => {
    expect(allAnswered(round(['4', null]), 2)).toBe(true);
  });

  it('only checks up to playerCount seats (ignores extras)', () => {
    expect(allAnswered(round(['4', '3', undefined]), 2)).toBe(true);
  });
});

describe('scoreRound', () => {
  it('awards points only to the correct seat', () => {
    const { result, newScores } = scoreRound(round(['4', '3']), 2, 100, 'easy', [0, 0], [0, 0]);
    expect(result.correct).toEqual([true, false]);
    expect(newScores[0]).toBeGreaterThan(0);
    expect(newScores[1]).toBe(0);
  });

  it('treats null (timeout) as wrong', () => {
    const { result } = scoreRound(round([null, '4']), 2, 100, 'easy', [0, 0], [0, 0]);
    expect(result.correct).toEqual([false, true]);
  });

  it('increments streak on correct and resets on wrong', () => {
    const { newStreaks } = scoreRound(round(['4', '3']), 2, 100, 'easy', [0, 0], [0, 0]);
    expect(newStreaks[0]).toBe(1);
    expect(newStreaks[1]).toBe(0);
  });

  it('accumulates scores across rounds', () => {
    const r1 = scoreRound(round(['4', '3']), 2, 100, 'easy', [0, 0], [0, 0]);
    const r2 = scoreRound(round(['4', '4']), 2, 100, 'easy', r1.newScores, r1.newStreaks);
    expect(r2.newScores[0]).toBeGreaterThan(r1.newScores[0]);
    expect(r2.newScores[1]).toBeGreaterThan(0);
  });

  it('propagates the final flag to the result', () => {
    const { result } = scoreRound(round(['4', '4'], true), 2, 100, 'easy', [0, 0], [0, 0]);
    expect(result.final).toBe(true);
  });

  it('exposes the correct answer in the result', () => {
    const { result } = scoreRound(round(['4', '3']), 2, 100, 'easy', [0, 0], [0, 0]);
    expect(result.correctAnswer).toBe('4');
  });

  it('does not mutate the input score/streak arrays', () => {
    const scores = [50, 30];
    const streaks = [2, 0];
    scoreRound(round(['4', '3']), 2, 100, 'easy', scores, streaks);
    expect(scores).toEqual([50, 30]);
    expect(streaks).toEqual([2, 0]);
  });
});
