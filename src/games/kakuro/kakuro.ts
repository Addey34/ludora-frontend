export type KCellKind = 'black' | 'clue' | 'fill';

export interface KCell {
  kind: KCellKind;
  across?: number;
  down?: number;
  answer?: number;
}

export interface KakuroPuzzle {
  id: number;
  difficulty: 'easy' | 'medium' | 'hard';
  rows: number;
  cols: number;
  grid: KCell[][];
}

function B(): KCell {
  return { kind: 'black' };
}
function C(down?: number, across?: number): KCell {
  return { kind: 'clue', down, across };
}
function F(answer: number): KCell {
  return { kind: 'fill', answer };
}

export const PUZZLES: KakuroPuzzle[] = [
  {
    id: 1,
    difficulty: 'easy',
    rows: 4,
    cols: 4,
    // 3×3 fill area. Row sums: 7,10,7. Col sums: 6,7,11.
    grid: [
      [B(), C(6), C(7), C(11)],
      [C(undefined, 7), F(1), F(4), F(2)],
      [C(undefined, 10), F(3), F(2), F(5)],
      [C(undefined, 7), F(2), F(1), F(4)],
    ],
  },
  {
    id: 2,
    difficulty: 'easy',
    rows: 4,
    cols: 4,
    // Row sums: 9,7,9. Col sums: 9,7,9.
    grid: [
      [B(), C(9), C(7), C(9)],
      [C(undefined, 9), F(3), F(1), F(5)],
      [C(undefined, 7), F(2), F(4), F(1)],
      [C(undefined, 9), F(4), F(2), F(3)],
    ],
  },
  {
    id: 3,
    difficulty: 'medium',
    rows: 5,
    cols: 4,
    // 4 rows × 3 fill cols. Row sums: 8,11,14,17. Col sums: 10,26,14.
    grid: [
      [B(), C(10), C(26), C(14)],
      [C(undefined, 8), F(1), F(5), F(2)],
      [C(undefined, 11), F(2), F(6), F(3)],
      [C(undefined, 14), F(3), F(7), F(4)],
      [C(undefined, 17), F(4), F(8), F(5)],
    ],
  },
  {
    id: 4,
    difficulty: 'medium',
    rows: 4,
    cols: 5,
    // 3 rows × 4 fill cols. Row sums: 10,26,18. Col sums: 15,11,11,17.
    grid: [
      [B(), C(15), C(11), C(11), C(17)],
      [C(undefined, 10), F(1), F(2), F(3), F(4)],
      [C(undefined, 26), F(5), F(6), F(7), F(8)],
      [C(undefined, 18), F(9), F(3), F(1), F(5)],
    ],
  },
  {
    id: 5,
    difficulty: 'hard',
    rows: 5,
    cols: 5,
    // 4 rows × 4 fill cols. Row sums: 12,13,20,20. Col sums: 11,21,19,14.
    grid: [
      [B(), C(11), C(21), C(19), C(14)],
      [C(undefined, 12), F(1), F(5), F(2), F(4)],
      [C(undefined, 13), F(3), F(2), F(7), F(1)],
      [C(undefined, 20), F(5), F(8), F(1), F(6)],
      [C(undefined, 20), F(2), F(6), F(9), F(3)],
    ],
  },
  {
    id: 6,
    difficulty: 'hard',
    rows: 6,
    cols: 5,
    // 5 rows × 4 fill cols. Built systematically.
    // r1: 1 7 3 2 → 13. r2: 4 2 5 1 → 12. r3: 6 3 1 8 → 18. r4: 2 5 7 4 → 18. r5: 8 1 4 3 → 16
    // c1: 1+4+6+2+8=21. c2: 7+2+3+5+1=18. c3: 3+5+1+7+4=20. c4: 2+1+8+4+3=18
    grid: [
      [B(), C(21), C(18), C(20), C(18)],
      [C(undefined, 13), F(1), F(7), F(3), F(2)],
      [C(undefined, 12), F(4), F(2), F(5), F(1)],
      [C(undefined, 18), F(6), F(3), F(1), F(8)],
      [C(undefined, 18), F(2), F(5), F(7), F(4)],
      [C(undefined, 16), F(8), F(1), F(4), F(3)],
    ],
  },
];

export function getPuzzle(id: number): KakuroPuzzle {
  return PUZZLES.find((p) => p.id === id) ?? PUZZLES[0];
}

export function getRunsForGrid(grid: KCell[][]): {
  acrossRuns: { r: number; c: number; len: number; sum: number }[];
  downRuns: { r: number; c: number; len: number; sum: number }[];
} {
  const rows = grid.length;
  const cols = grid[0].length;
  const acrossRuns: { r: number; c: number; len: number; sum: number }[] = [];
  const downRuns: { r: number; c: number; len: number; sum: number }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.kind === 'clue' && cell.across !== undefined) {
        let len = 0;
        let nc = c + 1;
        while (nc < cols && grid[r][nc].kind === 'fill') {
          len++;
          nc++;
        }
        if (len > 0) acrossRuns.push({ r, c, len, sum: cell.across });
      }
      if (cell.kind === 'clue' && cell.down !== undefined) {
        let len = 0;
        let nr = r + 1;
        while (nr < rows && grid[nr][c].kind === 'fill') {
          len++;
          nr++;
        }
        if (len > 0) downRuns.push({ r, c, len, sum: cell.down });
      }
    }
  }
  return { acrossRuns, downRuns };
}

export function checkSolution(
  puzzle: KakuroPuzzle,
  values: (number | null)[][]
): { correct: boolean; errors: Set<string> } {
  const { grid, rows, cols } = puzzle;
  const errors = new Set<string>();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.kind === 'clue' && cell.across !== undefined) {
        let sum = 0;
        const seen = new Set<number>();
        let nc = c + 1;
        while (nc < cols && grid[r][nc].kind === 'fill') {
          const v = values[r][nc];
          if (v === null) {
            sum = -1;
            break;
          }
          if (seen.has(v)) {
            for (let x = c + 1; x < nc + 1; x++) errors.add(`${r},${x}`);
          }
          seen.add(v);
          sum += v;
          nc++;
        }
        if (sum !== -1 && sum !== cell.across) {
          for (let x = c + 1; x < nc; x++) errors.add(`${r},${x}`);
        }
      }
      if (cell.kind === 'clue' && cell.down !== undefined) {
        let sum = 0;
        const seen = new Set<number>();
        let nr = r + 1;
        while (nr < rows && grid[nr][c].kind === 'fill') {
          const v = values[nr][c];
          if (v === null) {
            sum = -1;
            break;
          }
          if (seen.has(v)) {
            for (let x = r + 1; x < nr + 1; x++) errors.add(`${x},${c}`);
          }
          seen.add(v);
          sum += v;
          nr++;
        }
        if (sum !== -1 && sum !== cell.down) {
          for (let x = r + 1; x < nr; x++) errors.add(`${x},${c}`);
        }
      }
    }
  }

  let correct = errors.size === 0;
  if (correct) {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (grid[r][c].kind === 'fill' && values[r][c] === null) {
          correct = false;
          break;
        }
  }
  return { correct, errors };
}
