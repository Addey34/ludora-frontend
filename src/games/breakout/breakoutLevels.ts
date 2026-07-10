/**
 * Procedural Breakout levels — pure and deterministic, so the same level number
 * always yields the same layout (and it's unit-testable). Levels are grouped
 * into "worlds" that gradually raise the stakes: more rows, tougher (multi-hit)
 * bricks and a faster ball. The layout of each level is picked from a small
 * pattern library seeded by the level number, so hundreds of levels stay varied
 * without ever being hand-authored.
 */

interface BrickSpec {
  row: number;
  col: number;
  /** Hits needed to destroy the brick (1 = normal, 2–3 = reinforced). */
  hp: number;
}

interface LevelSpec {
  level: number;
  world: number;
  cols: number;
  rows: number;
  bricks: BrickSpec[];
  /** Ball-speed multiplier for this level (rises per world). */
  speedMul: number;
}

/** Levels per world (each world nudges the difficulty up a tier). */
export const WORLD_SIZE = 8;
export const BRICK_COLS = 9;

export function worldOf(level: number): number {
  return Math.floor((level - 1) / WORLD_SIZE);
}

/** Deterministic PRNG (mulberry32) so a level's layout is reproducible. */
function rngFor(level: number): () => number {
  let a = (level * 2654435761) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pattern = 'full' | 'checker' | 'pyramid' | 'columns' | 'diamond' | 'gaps';
const PATTERNS: Pattern[] = ['full', 'checker', 'pyramid', 'columns', 'diamond', 'gaps'];

/** Whether a cell is filled for the given pattern. */
function inPattern(p: Pattern, r: number, c: number, rows: number, cols: number): boolean {
  const mid = (cols - 1) / 2;
  switch (p) {
    case 'full':
      return true;
    case 'checker':
      return (r + c) % 2 === 0;
    case 'pyramid':
      return Math.abs(c - mid) <= r; // widening triangle
    case 'columns':
      return c % 2 === 0;
    case 'diamond':
      return Math.abs(c - mid) + Math.abs(r - (rows - 1) / 2) <= Math.max(mid, rows / 2);
    case 'gaps':
      return c % 3 !== 1;
  }
}

/** Builds the (deterministic) brick layout for a level. */
export function generateLevel(level: number): LevelSpec {
  const world = worldOf(level);
  const rng = rngFor(level);
  const cols = BRICK_COLS;
  // Rows grow with the world, then wobble a little per level (capped).
  const rows = Math.min(3 + world + (level % 2), 8);
  const pattern = PATTERNS[Math.floor(rng() * PATTERNS.length)];
  // Reinforced bricks appear from world 1 and get tougher/denser deeper in.
  const toughChance = Math.min(0.5, world * 0.14);
  const maxHp = 1 + Math.min(world, 2); // world 0→1, world 1→2, world 2+→3

  const bricks: BrickSpec[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!inPattern(pattern, r, c, rows, cols)) continue;
      let hp = 1;
      if (maxHp > 1 && rng() < toughChance) {
        hp = 2 + (rng() < toughChance * 0.5 ? 1 : 0);
        hp = Math.min(hp, maxHp);
      }
      bricks.push({ row: r, col: c, hp });
    }
  }
  // Guarantee a non-empty level (a sparse pattern on tiny grids could clear out).
  if (bricks.length === 0) bricks.push({ row: 0, col: Math.floor(cols / 2), hp: 1 });

  return { level, world, cols, rows, bricks, speedMul: 1 + world * 0.06 };
}
