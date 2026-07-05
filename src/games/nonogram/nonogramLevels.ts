/**
 * Nonogram pictures, authored as character rows (`#` = filled, `.`/space = empty;
 * see `nonogram.ts` for the legend). Ordered by size/difficulty; each unlocks the
 * next. Every picture here is proven *uniquely* solvable by pure logic in
 * `nonogram.test.ts`, so none can ship ambiguous (a puzzle that needs guessing).
 */

export const LEVELS: string[][] = [
  // 1 — Heart (5×5).
  [
    '.#.#.', //
    '#####',
    '#####',
    '.###.',
    '..#..',
  ],
  // 2 — Diamond (5×5).
  [
    '..#..', //
    '.###.',
    '#####',
    '.###.',
    '..#..',
  ],
  // 3 — Arrow up (5×5).
  [
    '..#..', //
    '.###.',
    '#####',
    '..#..',
    '..#..',
  ],
  // 4 — Smiley face (10×10).
  [
    '..######..', //
    '.########.',
    '##.##.##.#',
    '##.##.##.#',
    '##########',
    '##.....###',
    '##########',
    '#.####..##',
    '.#....##..',
    '..####....',
  ],
  // 5 — Space invader (10×10).
  [
    '..#....#..', //
    '..#....#..',
    '..######..',
    '.##.##.##.',
    '##########',
    '#.######.#',
    '#.#....#.#',
    '#.#....#.#',
    '...####...',
    '..#....#..',
  ],
  // 6 — House (10×10).
  [
    '....#.....', //
    '...###....',
    '..#####...',
    '.#######..',
    '#########.',
    '.#######..',
    '.#####....',
    '.#####....',
    '.#####....',
    '.#####....',
  ],
];
