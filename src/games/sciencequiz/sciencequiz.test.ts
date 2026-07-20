import { describe, expect, it } from 'vitest';
import { makeSciencequizQuestion, SCIENCE_QUESTIONS, SCIENCE_TOPICS } from './sciencequiz.js';

describe('science quiz question bank', () => {
  it('contains three questions for every topic and difficulty', () => {
    expect(SCIENCE_QUESTIONS).toHaveLength(45);
    for (const topic of SCIENCE_TOPICS) {
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        expect(
          SCIENCE_QUESTIONS.filter((item) => item.topic === topic && item.difficulty === difficulty)
        ).toHaveLength(3);
      }
    }
  });

  it('keeps every prompt, answer, decoy and hint bilingual', () => {
    const ids = new Set<string>();
    for (const item of SCIENCE_QUESTIONS) {
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
      for (const text of [item.prompt, item.answer, item.hint, ...item.decoys]) {
        expect(text[0].trim()).not.toBe('');
        expect(text[1].trim()).not.toBe('');
      }
      expect(new Set(item.decoys.map((decoy) => decoy[0])).has(item.answer[0])).toBe(false);
      expect(new Set(item.decoys.map((decoy) => decoy[1])).has(item.answer[1])).toBe(false);
    }
  });

  it('selects deterministically and localises the result', () => {
    const english = makeSciencequizQuestion('easy', 'en', 'biology', () => 0);
    const french = makeSciencequizQuestion('easy', 'fr', 'biology', () => 0);

    expect(english.id).toBe('biology-easy-heart');
    expect(english.answer).toBe('The heart');
    expect(english.choices).toHaveLength(3);
    expect(french.answer).toBe('Le cœur');
    expect(french.prompt).toContain('Quel organe');
  });

  it('avoids immediately repeating the previous question', () => {
    const first = makeSciencequizQuestion('hard', 'en', 'space', () => 0);
    const next = makeSciencequizQuestion('hard', 'en', 'space', () => 0, first.id);

    expect(next.id).not.toBe(first.id);
    expect(next.choices).toHaveLength(4);
  });
});
