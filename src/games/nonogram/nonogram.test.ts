import { describe, it, expect } from 'vitest';
import {
  lineClue,
  parsePuzzle,
  isSolved,
  emptyMarks,
  filledCount,
  lineCandidates,
  solveByLogic,
  isUniquelySolvable,
  FILLED,
  CROSS,
} from './nonogram.js';
import { LEVELS } from './nonogramLevels.js';

describe('lineClue', () => {
  it('reads run-lengths of consecutive filled cells', () => {
    expect(lineClue([true, true, false, true])).toEqual([2, 1]);
    expect(lineClue([false, false, false])).toEqual([]);
    expect(lineClue([true, true, true])).toEqual([3]);
    expect(lineClue([true, false, true, false, true])).toEqual([1, 1, 1]);
  });
});

describe('parsePuzzle', () => {
  const p = parsePuzzle(['.#.', '###', '#.#']);

  it('marks non-blank characters as filled', () => {
    expect(p.rows).toBe(3);
    expect(p.cols).toBe(3);
    expect(p.solution[0]).toEqual([false, true, false]);
    expect(p.solution[1]).toEqual([true, true, true]);
  });

  it('derives row and column clues', () => {
    expect(p.rowClues).toEqual([[1], [3], [1, 1]]);
    expect(p.colClues).toEqual([[2], [2], [2]]);
  });
});

describe('isSolved', () => {
  const p = parsePuzzle(['.#', '##']);

  it('is true only when filled marks match the picture exactly', () => {
    const marks = emptyMarks(p);
    expect(isSolved(p, marks)).toBe(false);
    marks[0][1] = FILLED;
    marks[1][0] = FILLED;
    marks[1][1] = FILLED;
    expect(isSolved(p, marks)).toBe(true);
  });

  it('ignores crosses (known-empty pencil marks)', () => {
    const marks = emptyMarks(p);
    marks[0][1] = FILLED;
    marks[1][0] = FILLED;
    marks[1][1] = FILLED;
    marks[0][0] = CROSS; // annotating an empty cell must not break the win
    expect(isSolved(p, marks)).toBe(true);
  });

  it('is false when an extra cell is filled', () => {
    const marks = emptyMarks(p);
    marks[0][0] = FILLED; // this cell is empty in the picture
    marks[0][1] = FILLED;
    marks[1][0] = FILLED;
    marks[1][1] = FILLED;
    expect(isSolved(p, marks)).toBe(false);
  });
});

describe('filledCount', () => {
  it('counts the filled cells of the picture', () => {
    expect(filledCount(parsePuzzle(['##', '#.']))).toBe(3);
  });
});

describe('lineCandidates', () => {
  it('enumerates a single run in a short line', () => {
    expect(lineCandidates([2], 3)).toEqual([
      [true, true, false],
      [false, true, true],
    ]);
  });

  it('returns the all-empty line for a blank clue', () => {
    expect(lineCandidates([], 3)).toEqual([[false, false, false]]);
  });

  it('respects the mandatory gap between runs', () => {
    expect(lineCandidates([1, 1], 3)).toEqual([[true, false, true]]);
  });
});

describe('solveByLogic', () => {
  it('reconstructs a picture that the clues fully determine', () => {
    const p = parsePuzzle(['##', '#.']);
    expect(solveByLogic(p)).toEqual([
      [true, true],
      [true, false],
    ]);
  });
});

describe('shipped levels', () => {
  it('has at least a handful of levels', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(5);
  });

  it.each(LEVELS.map((rows, i) => [i + 1, rows] as const))(
    'level %i is uniquely solvable by pure logic (no guessing)',
    (_n, rows) => {
      expect(isUniquelySolvable(parsePuzzle(rows))).toBe(true);
    }
  );

  it.each(LEVELS.map((rows, i) => [i + 1, rows] as const))(
    'level %i is rectangular',
    (_n, rows) => {
      const width = rows[0].length;
      expect(rows.every((r) => r.length === width)).toBe(true);
    }
  );
});
