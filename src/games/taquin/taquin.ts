/** Row-major grid of tile values; 0 = blank. */
export type Grid = number[];

export interface TaquinState {
  grid: Grid;
  size: number;
  blank: number; // index of the blank cell
}

export type Dir = 'up' | 'down' | 'left' | 'right';

const REVERSE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** Returns the solved state: tiles 1…n²-1 in order, blank last. */
export function initial(size: number): TaquinState {
  const n = size * size;
  const grid: Grid = Array.from({ length: n }, (_, i) => (i < n - 1 ? i + 1 : 0));
  return { grid, size, blank: n - 1 };
}

export function isSolved(state: TaquinState): boolean {
  const { grid, size } = state;
  const n = size * size;
  for (let i = 0; i < n - 1; i++) if (grid[i] !== i + 1) return false;
  return grid[n - 1] === 0;
}

/** Index of the neighbor of the blank in `dir`, or -1 if out-of-bounds. */
function neighborIdx(state: TaquinState, dir: Dir): number {
  const { blank, size } = state;
  const row = Math.floor(blank / size);
  const col = blank % size;
  if (dir === 'up') return row > 0 ? blank - size : -1;
  if (dir === 'down') return row < size - 1 ? blank + size : -1;
  if (dir === 'left') return col > 0 ? blank - 1 : -1;
  return col < size - 1 ? blank + 1 : -1;
}

/**
 * Moves the blank in the given direction (the adjacent tile slides into the blank).
 * Returns the new state, or null if the move is illegal.
 */
export function move(state: TaquinState, dir: Dir): TaquinState | null {
  const from = neighborIdx(state, dir);
  if (from === -1) return null;
  const grid = [...state.grid];
  grid[state.blank] = grid[from];
  grid[from] = 0;
  return { ...state, grid, blank: from };
}

/**
 * Slides the tile at `idx` toward the blank if it is directly adjacent.
 * Returns the new state or null.
 */
export function clickTile(state: TaquinState, idx: number): TaquinState | null {
  const { blank, size } = state;
  if (idx === blank) return null;
  const br = Math.floor(blank / size);
  const bc = blank % size;
  const tr = Math.floor(idx / size);
  const tc = idx % size;
  if (br === tr && Math.abs(bc - tc) === 1) return move(state, bc > tc ? 'left' : 'right');
  if (bc === tc && Math.abs(br - tr) === 1) return move(state, br > tr ? 'up' : 'down');
  return null;
}

/** Returns true if `idx` is directly adjacent to the blank. */
export function isMovable(state: TaquinState, idx: number): boolean {
  const { blank, size } = state;
  if (idx === blank) return false;
  const br = Math.floor(blank / size);
  const bc = blank % size;
  const tr = Math.floor(idx / size);
  const tc = idx % size;
  return (br === tr && Math.abs(bc - tc) === 1) || (bc === tc && Math.abs(br - tr) === 1);
}

/**
 * Shuffles from the solved state by making `n` random legal moves,
 * never immediately reversing the previous move.
 */
export function shuffle(
  state: TaquinState,
  n: number,
  rng: () => number = Math.random
): TaquinState {
  const dirs: Dir[] = ['up', 'down', 'left', 'right'];
  let s = state;
  let last: Dir | null = null;
  for (let i = 0; i < n; i++) {
    const candidates = dirs.filter(
      (d) => (last === null || d !== REVERSE[last]) && neighborIdx(s, d) !== -1
    );
    const d = candidates[Math.floor(rng() * candidates.length)];
    s = move(s, d)!;
    last = d;
  }
  return s;
}
