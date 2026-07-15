import { describe, it, expect } from 'vitest';
import { PUZZLES, checkSolution, type KakuroPuzzle } from './kakuro.js';

/** Build the answer-value grid for a puzzle (null for non-fill cells). */
function answerGrid(p: KakuroPuzzle): (number | null)[][] {
  return p.grid.map((row) =>
    row.map((cell) => (cell.kind === 'fill' ? (cell.answer ?? null) : null))
  );
}

describe('kakuro', () => {
  describe('built-in puzzles', () => {
    it.each(PUZZLES)('puzzle #$id ($difficulty) solves with no errors', (puzzle) => {
      const { correct, errors } = checkSolution(puzzle, answerGrid(puzzle));
      expect([...errors]).toEqual([]);
      expect(correct).toBe(true);
    });

    it('every across/down run sums to its clue', () => {
      // Independent re-derivation, so this fails if a puzzle's data drifts even
      // if checkSolution ever regressed.
      for (const p of PUZZLES) {
        const v = answerGrid(p);
        for (let r = 0; r < p.rows; r++) {
          for (let c = 0; c < p.cols; c++) {
            const cell = p.grid[r][c];
            if (cell.kind !== 'clue') continue;
            if (cell.across !== undefined) {
              let sum = 0;
              for (let nc = c + 1; nc < p.cols && p.grid[r][nc].kind === 'fill'; nc++)
                sum += v[r][nc]!;
              expect(sum, `puzzle ${p.id} across at ${r},${c}`).toBe(cell.across);
            }
            if (cell.down !== undefined) {
              let sum = 0;
              for (let nr = r + 1; nr < p.rows && p.grid[nr][c].kind === 'fill'; nr++)
                sum += v[nr][c]!;
              expect(sum, `puzzle ${p.id} down at ${r},${c}`).toBe(cell.down);
            }
          }
        }
      }
    });
  });

  describe('checkSolution', () => {
    const p = PUZZLES[0];

    it('reports incomplete when a fill cell is blank', () => {
      const v = answerGrid(p);
      v[1][1] = null;
      expect(checkSolution(p, v).correct).toBe(false);
    });

    it('flags the cells of a wrong run', () => {
      const v = answerGrid(p);
      v[1][1] = (v[1][1] ?? 0) + 1; // break the row sum
      const { correct, errors } = checkSolution(p, v);
      expect(correct).toBe(false);
      expect(errors.size).toBeGreaterThan(0);
    });

    it('flags duplicate digits within a run', () => {
      const v = answerGrid(p);
      // Force the first two fill cells of row 1 to be equal.
      v[1][2] = v[1][1];
      const { errors } = checkSolution(p, v);
      expect(errors.has('1,1')).toBe(true);
    });
  });
});
