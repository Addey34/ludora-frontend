import { describe, expect, it } from 'vitest';
import { Dir, SokobanState, parseLevel, move, isSolved } from './sokoban.js';
import { LEVELS } from './sokobanLevels.js';

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

/** A compact, order-independent key for a state (player + box positions). */
function key(state: SokobanState): string {
  const boxes: string[] = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) if (state.boxes[r][c]) boxes.push(`${r},${c}`);
  }
  return `${state.player.r},${state.player.c}|${boxes.sort().join(';')}`;
}

/** Breadth-first search: is the level winnable within `cap` explored states? */
function solvable(start: SokobanState, cap = 200_000): boolean {
  if (isSolved(start)) return true;
  const seen = new Set<string>([key(start)]);
  const queue: SokobanState[] = [start];
  let explored = 0;
  while (queue.length > 0 && explored < cap) {
    const state = queue.shift()!;
    explored++;
    for (const dir of DIRS) {
      const next = move(state, dir);
      if (next === state) continue; // blocked
      const k = key(next);
      if (seen.has(k)) continue;
      if (isSolved(next)) return true;
      seen.add(k);
      queue.push(next);
    }
  }
  return false;
}

describe('parseLevel', () => {
  it('reads walls, targets, boxes and the player', () => {
    const s = parseLevel(['#####', '#@$.#', '#####']);
    expect(s.rows).toBe(3);
    expect(s.cols).toBe(5);
    expect(s.player).toEqual({ r: 1, c: 1 });
    expect(s.boxes[1][2]).toBe(true);
    expect(s.targets[1][3]).toBe(true);
    expect(s.walls[0][0]).toBe(true);
    expect(isSolved(s)).toBe(false);
  });
});

describe('move', () => {
  const level = ['#####', '#   #', '#@$.#', '#   #', '#####'];

  it('walks into empty floor and counts the move', () => {
    const s = parseLevel(['#####', '#@ .#', '#####']);
    const next = move(s, 'right');
    expect(next.player).toEqual({ r: 1, c: 2 });
    expect(next.moves).toBe(1);
    expect(next.pushes).toBe(0);
  });

  it('pushes a box into an empty square and solves the level', () => {
    const s = parseLevel(level);
    const next = move(s, 'right');
    expect(next.boxes[2][3]).toBe(true); // box slid onto the target
    expect(next.pushes).toBe(1);
    expect(isSolved(next)).toBe(true);
  });

  it('returns the same reference when blocked by a wall', () => {
    const s = parseLevel(['###', '#@#', '###']);
    expect(move(s, 'up')).toBe(s);
    expect(move(s, 'left')).toBe(s);
  });

  it('cannot push two boxes at once', () => {
    // @ $ $ #  → pushing right would need to shove two boxes: blocked.
    const s = parseLevel(['######', '#@$$ #', '######']);
    expect(move(s, 'right')).toBe(s);
  });

  it('does not mutate the input state', () => {
    const s = parseLevel(level);
    move(s, 'right');
    expect(s.boxes[2][2]).toBe(true); // original box position intact
    expect(s.player).toEqual({ r: 2, c: 1 });
  });
});

describe('shipped levels', () => {
  it('are all solvable', () => {
    LEVELS.forEach((rows, i) => {
      expect(solvable(parseLevel(rows)), `level ${i + 1} must be solvable`).toBe(true);
    });
  });

  it('each has as many boxes as targets', () => {
    for (const rows of LEVELS) {
      const s = parseLevel(rows);
      let boxes = 0;
      let targets = 0;
      for (let r = 0; r < s.rows; r++) {
        for (let c = 0; c < s.cols; c++) {
          if (s.boxes[r][c]) boxes++;
          if (s.targets[r][c]) targets++;
        }
      }
      expect(boxes).toBe(targets);
    }
  });
});
