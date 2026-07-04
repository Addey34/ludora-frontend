/**
 * Minesweeper — pure logic, no DOM, no time. Board generation, flood reveal and
 * the win test live here (deterministic given an `rng`), so they are unit-tested
 * in isolation, exactly like the other games' rules.
 */

export interface Board {
  rows: number;
  cols: number;
  /** Actual number of mines placed. */
  mines: number;
  /** `mine[r][c]` — a mine sits on that cell. */
  mine: boolean[][];
  /** `count[r][c]` — number of adjacent mines (0..8). */
  count: number[][];
}

/** The up-to-8 in-bounds neighbours of a cell. */
export function neighbors(
  r: number,
  c: number,
  rows: number,
  cols: number
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc]);
    }
  }
  return out;
}

function grid<T>(rows: number, cols: number, fill: T): T[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));
}

/**
 * Builds a board with `mineCount` mines placed at random (via `rng`), keeping the
 * first-clicked cell `(safeR, safeC)` AND its neighbours mine-free — so the first
 * reveal always opens an area (the clicked cell has an adjacent count of 0 and
 * floods) rather than landing on a lone number. Adjacent counts are computed from
 * the final layout.
 */
export function createBoard(
  rows: number,
  cols: number,
  mineCount: number,
  safeR: number,
  safeC: number,
  rng: () => number = Math.random
): Board {
  const mine = grid(rows, cols, false);

  // The clicked cell plus its neighbours form the guaranteed-safe zone.
  const safe = new Set<number>([safeR * cols + safeC]);
  for (const [nr, nc] of neighbors(safeR, safeC, rows, cols)) safe.add(nr * cols + nc);

  const cells: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!safe.has(r * cols + c)) cells.push([r, c]);
    }
  }
  // Fisher-Yates shuffle, then take the first `mineCount` cells.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const placed = Math.min(mineCount, cells.length);
  for (let k = 0; k < placed; k++) {
    const [r, c] = cells[k];
    mine[r][c] = true;
  }

  const count = grid(rows, cols, 0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      count[r][c] = neighbors(r, c, rows, cols).filter(([nr, nc]) => mine[nr][nc]).length;
    }
  }

  return { rows, cols, mines: placed, mine, count };
}

/**
 * Reveals `(r, c)` in-place on `revealed`; empty (0-count) cells flood-fill their
 * neighbours. Mines are never revealed here (a mine hit is the game's concern).
 */
export function floodReveal(board: Board, revealed: boolean[][], r: number, c: number): void {
  if (board.mine[r][c] || revealed[r][c]) return;
  const stack: Array<[number, number]> = [[r, c]];
  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!;
    if (revealed[cr][cc] || board.mine[cr][cc]) continue;
    revealed[cr][cc] = true;
    if (board.count[cr][cc] === 0) {
      for (const [nr, nc] of neighbors(cr, cc, board.rows, board.cols)) {
        if (!revealed[nr][nc]) stack.push([nr, nc]);
      }
    }
  }
}

/** The board is won once every non-mine cell has been revealed. */
export function isWin(board: Board, revealed: boolean[][]): boolean {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (!board.mine[r][c] && !revealed[r][c]) return false;
    }
  }
  return true;
}
