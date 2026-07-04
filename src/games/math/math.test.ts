import { describe, it, expect } from 'vitest';
import { makeMathQuestion, MATH_PARAMS } from './math.js';

/** A tiny deterministic RNG so the generated question is predictable. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('makeMathQuestion', () => {
  it('keeps subtraction non-negative', () => {
    // op index 1 = '-', then operands that would be a<b before the swap.
    const q = makeMathQuestion('easy', seq([1 / 2, 0.1, 0.9]));
    const answer = Number(q.answer);
    expect(answer).toBeGreaterThanOrEqual(0);
    expect(q.answer).toBe(String(answer));
  });

  it('produces exact (whole-number) divisions', () => {
    // Force op '÷' (last of hard's 4 ops → index 3 → rng ~0.9).
    const q = makeMathQuestion('hard', seq([0.9, 0.2, 0.5]));
    expect(q.prompt).toContain('÷');
    expect(Number.isInteger(Number(q.answer))).toBe(true);
    // The prompt "a ÷ b" must divide evenly to the answer.
    const [a, , b] = q.prompt.split(' ');
    expect(Number(a) % Number(b)).toBe(0);
    expect(Number(a) / Number(b)).toBe(Number(q.answer));
  });

  it('only uses the operations allowed by the difficulty', () => {
    for (let i = 0; i < 50; i++) {
      const q = makeMathQuestion('easy');
      const op = q.prompt.split(' ')[1] as (typeof MATH_PARAMS.easy.ops)[number];
      expect(MATH_PARAMS.easy.ops).toContain(op);
    }
  });
});
