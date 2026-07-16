import { describe, expect, it } from 'vitest';
import { make{{Class}}Question } from './{{key}}.js';

describe('{{key}} question generator', () => {
  it('creates a deterministic question with an exact answer', () => {
    const question = make{{Class}}Question('easy', () => 0);
    expect(question).toEqual({ prompt: '1 + 1', answer: '2' });
  });

  it('scales operands with the difficulty', () => {
    const easy = make{{Class}}Question('easy', () => 0.999);
    const hard = make{{Class}}Question('hard', () => 0.999);
    expect(easy.prompt).toBe('10 + 10');
    expect(hard.prompt).toBe('100 + 100');
  });
});
