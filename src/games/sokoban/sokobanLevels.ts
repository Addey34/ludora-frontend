/**
 * Sokoban levels, authored as character rows (see `sokoban.ts` for the legend).
 * Ordered by difficulty; each unlocks the next. Every level here is proven
 * solvable by the BFS solver in `sokoban.test.ts`, so none can ship broken.
 */

export const LEVELS: string[][] = [
  // 1 — one box, one push right.
  [
    '#####', //
    '#   #',
    '#@$.#',
    '#   #',
    '#####',
  ],
  // 2 — one box, push it up.
  [
    '#####', //
    '#  .#',
    '#  $#',
    '#@  #',
    '#####',
  ],
  // 3 — two boxes, push each to the right on its own row.
  [
    '######', //
    '#    #',
    '#@$ .#',
    '#    #',
    '# $ .#',
    '######',
  ],
  // 4 — one box up, one box down.
  [
    '######', //
    '#  . #',
    '#  $ #',
    '#@   #',
    '#  $ #',
    '#  . #',
    '######',
  ],
  // 5 — three boxes down three columns; route around the top.
  [
    '#######', //
    '#     #',
    '# $$$ #',
    '#     #',
    '#  @  #',
    '# ... #',
    '#######',
  ],
  // 6 — a central wall splits the room; push both boxes down.
  [
    '#######', //
    '#     #',
    '# $#$ #',
    '# . . #',
    '#@    #',
    '#######',
  ],
];
