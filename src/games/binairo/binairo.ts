export type Cell = 0 | 1 | null;

export interface BinairoState {
  size: number;
  solution: (0 | 1)[][];
  puzzle: Cell[][];
  grid: Cell[][];
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isPartialRowColValid(
  grid: (0 | 1 | null)[][],
  r: number,
  c: number,
  size: number
): boolean {
  const v = grid[r][c];
  if (v === null) return true;
  // no 3 consecutive in row
  if (c >= 2 && grid[r][c - 1] === v && grid[r][c - 2] === v) return false;
  if (c >= 1 && c + 1 < size && grid[r][c - 1] === v && grid[r][c + 1] === v) return false;
  if (c + 2 < size && grid[r][c + 1] === v && grid[r][c + 2] === v) return false;
  // no 3 consecutive in col
  if (r >= 2 && grid[r - 1][c] === v && grid[r - 2][c] === v) return false;
  if (r >= 1 && r + 1 < size && grid[r - 1][c] === v && grid[r + 1][c] === v) return false;
  if (r + 2 < size && grid[r + 1][c] === v && grid[r + 2][c] === v) return false;
  // balance: row count so far
  if (c === size - 1) {
    let ones = 0;
    for (let i = 0; i < size; i++) ones += grid[r][i] === 1 ? 1 : 0;
    if (ones !== size / 2) return false;
    // unique rows
    for (let pr = 0; pr < r; pr++) {
      if (grid[pr].every((val, i) => val === grid[r][i])) return false;
    }
  }
  if (r === size - 1) {
    let ones = 0;
    for (let i = 0; i < size; i++) ones += grid[i][c] === 1 ? 1 : 0;
    if (ones !== size / 2) return false;
    for (let pc = 0; pc < c; pc++) {
      let same = true;
      for (let i = 0; i < size; i++) {
        if (grid[i][pc] !== grid[i][c]) {
          same = false;
          break;
        }
      }
      if (same) return false;
    }
  }
  return true;
}

function fillGrid(grid: (0 | 1)[][], r: number, c: number, size: number): boolean {
  if (r === size) return true;
  const nr = c === size - 1 ? r + 1 : r;
  const nc = c === size - 1 ? 0 : c + 1;
  const order: (0 | 1)[] = Math.random() < 0.5 ? [0, 1] : [1, 0];
  for (const v of order) {
    grid[r][c] = v;
    if (isPartialRowColValid(grid, r, c, size) && fillGrid(grid, nr, nc, size)) return true;
  }
  (grid[r][c] as unknown) = null;
  return false;
}

function generateSolution(size: number): (0 | 1)[][] {
  const grid: (0 | 1)[][] = Array.from(
    { length: size },
    () => new Array(size).fill(0) as (0 | 1)[]
  );
  if (!fillGrid(grid, 0, 0, size)) {
    // Fallback alternating pattern (always valid for even sizes)
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) grid[r][c] = ((r + c) % 2) as 0 | 1;
  }
  return grid;
}

export function generatePuzzle(size: 6 | 8 = 8): BinairoState {
  const solution = generateSolution(size);
  const puzzle: Cell[][] = solution.map((row) => [...row] as Cell[]);
  const cells: [number, number][] = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) cells.push([r, c]);
  shuffle(cells);
  const toRemove = Math.floor(cells.length * 0.52);
  for (let i = 0; i < toRemove; i++) {
    const [r, c] = cells[i];
    puzzle[r][c] = null;
  }
  const grid: Cell[][] = puzzle.map((row) => [...row]);
  return { size, solution, puzzle, grid };
}

export function isConflict(grid: Cell[][], r: number, c: number, size: number): boolean {
  const v = grid[r][c];
  if (v === null) return false;
  let streak = 1;
  for (let i = c - 1; i >= 0 && grid[r][i] === v; i--) streak++;
  for (let i = c + 1; i < size && grid[r][i] === v; i++) streak++;
  if (streak >= 3) return true;
  streak = 1;
  for (let i = r - 1; i >= 0 && grid[i][c] === v; i--) streak++;
  for (let i = r + 1; i < size && grid[i][c] === v; i++) streak++;
  if (streak >= 3) return true;
  return false;
}

export function isSolved(grid: Cell[][], size: number): boolean {
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (grid[r][c] === null || isConflict(grid, r, c, size)) return false;
  for (let r = 0; r < size; r++) {
    const ones = grid[r].reduce((s: number, v) => s + (v ?? 0), 0);
    if (ones !== size / 2) return false;
  }
  for (let c = 0; c < size; c++) {
    let ones = 0;
    for (let r = 0; r < size; r++) ones += grid[r][c] ?? 0;
    if (ones !== size / 2) return false;
  }
  return true;
}
