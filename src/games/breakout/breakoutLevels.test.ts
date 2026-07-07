import { describe, it, expect } from 'vitest';
import { generateLevel, worldOf, WORLD_SIZE, BRICK_COLS } from './breakoutLevels.js';

describe('breakout levels', () => {
  it('is deterministic for a given level', () => {
    const a = generateLevel(17);
    const b = generateLevel(17);
    expect(a).toEqual(b);
  });

  it('groups levels into worlds', () => {
    expect(worldOf(1)).toBe(0);
    expect(worldOf(WORLD_SIZE)).toBe(0);
    expect(worldOf(WORLD_SIZE + 1)).toBe(1);
  });

  it('always produces at least one brick, within the grid', () => {
    for (let level = 1; level <= 60; level++) {
      const spec = generateLevel(level);
      expect(spec.bricks.length).toBeGreaterThan(0);
      for (const b of spec.bricks) {
        expect(b.col).toBeGreaterThanOrEqual(0);
        expect(b.col).toBeLessThan(BRICK_COLS);
        expect(b.row).toBeGreaterThanOrEqual(0);
        expect(b.row).toBeLessThan(spec.rows);
        expect(b.hp).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('introduces reinforced bricks and faster balls in later worlds', () => {
    const early = generateLevel(1);
    expect(early.bricks.every((b) => b.hp === 1)).toBe(true);
    expect(early.speedMul).toBeCloseTo(1);

    // Somewhere in the first few worlds, tougher bricks and a speed bump appear.
    let sawTough = false;
    let sawFaster = false;
    for (let level = WORLD_SIZE + 1; level <= WORLD_SIZE * 4; level++) {
      const spec = generateLevel(level);
      if (spec.bricks.some((b) => b.hp > 1)) sawTough = true;
      if (spec.speedMul > 1) sawFaster = true;
    }
    expect(sawTough).toBe(true);
    expect(sawFaster).toBe(true);
  });
});
