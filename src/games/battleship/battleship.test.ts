import { describe, expect, it } from 'vitest';
import {
  SHIP_DEFS,
  GRID_SIZE,
  ShipPlacement,
  cellKey,
  shipCells,
  isValidPlacement,
  randomFleet,
  initialState,
  legalMoves,
  applyMove,
  sanitizeFleet,
} from './battleship.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function h(
  id: (typeof SHIP_DEFS)[number]['id'],
  size: number,
  row: number,
  col: number
): ShipPlacement {
  return { id, size, row, col, orientation: 'h' };
}
function v(
  id: (typeof SHIP_DEFS)[number]['id'],
  size: number,
  row: number,
  col: number
): ShipPlacement {
  return { id, size, row, col, orientation: 'v' };
}

/**
 * Deterministic PRNG (mulberry32) for tests: reproducible but **varying**.
 * A constant RNG would make `randomFleet` loop forever (the same overlapping
 * placements, never rejected any other way).
 */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── shipCells ───────────────────────────────────────────────────────────────

describe('shipCells', () => {
  it('horizontal ship spans the row', () => {
    const cells = shipCells(h('destroyer', 2, 3, 4));
    expect(cells).toEqual([
      { row: 3, col: 4 },
      { row: 3, col: 5 },
    ]);
  });

  it('vertical ship spans the column', () => {
    const cells = shipCells(v('cruiser', 3, 1, 2));
    expect(cells).toEqual([
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 3, col: 2 },
    ]);
  });
});

// ─── isValidPlacement ────────────────────────────────────────────────────────

describe('isValidPlacement', () => {
  it('accepts a ship inside the grid', () => {
    expect(isValidPlacement([], h('destroyer', 2, 0, 0))).toBe(true);
  });

  it('rejects a ship that overflows the right edge', () => {
    expect(isValidPlacement([], h('destroyer', 2, 0, GRID_SIZE - 1))).toBe(false);
  });

  it('rejects a ship that overflows the bottom edge', () => {
    expect(isValidPlacement([], v('destroyer', 2, GRID_SIZE - 1, 0))).toBe(false);
  });

  it('rejects overlap with an existing ship', () => {
    const placed = [h('destroyer', 2, 0, 0)];
    expect(isValidPlacement(placed, h('cruiser', 3, 0, 1))).toBe(false);
  });

  it('accepts adjacent (non-overlapping) ships', () => {
    const placed = [h('destroyer', 2, 0, 0)];
    expect(isValidPlacement(placed, h('cruiser', 3, 1, 0))).toBe(true);
  });
});

// ─── randomFleet ─────────────────────────────────────────────────────────────

describe('randomFleet', () => {
  it('places exactly one ship per definition', () => {
    const fleet = randomFleet(seededRng(42));
    const ids = fleet.map((s) => s.id).sort();
    expect(ids).toEqual(SHIP_DEFS.map((d) => d.id).sort());
  });

  it('produces a fully valid fleet (no overlaps, in bounds)', () => {
    for (let i = 0; i < 10; i++) {
      const fleet = randomFleet();
      for (let j = 0; j < fleet.length; j++) {
        expect(isValidPlacement(fleet.slice(0, j), fleet[j])).toBe(true);
      }
    }
  });
});

// ─── applyMove (combat) ──────────────────────────────────────────────────────

describe('applyMove', () => {
  const twoShipState = () => {
    const fleet0 = [h('destroyer', 2, 0, 0)];
    const fleet1 = [h('destroyer', 2, 9, 0)];
    return initialState(fleet0, fleet1);
  };

  it('records a miss on an empty cell', () => {
    const s = applyMove(twoShipState(), { row: 5, col: 5 });
    expect(s.fleets[1].shots[cellKey(5, 5)]).toBe('miss');
  });

  it('records a hit when a ship cell is shot', () => {
    const s = applyMove(twoShipState(), { row: 9, col: 0 });
    expect(s.fleets[1].shots[cellKey(9, 0)]).toBe('hit');
    expect(s.fleets[1].sunkIds).toHaveLength(0);
  });

  it('sinks a ship when all its cells are hit', () => {
    let s = twoShipState();
    s = applyMove(s, { row: 9, col: 0 }); // seat 0 hits first cell
    s = applyMove(s, { row: 0, col: 0 }); // seat 1 misses
    s = applyMove(s, { row: 9, col: 1 }); // seat 0 hits second cell → sunk
    expect(s.fleets[1].shots[cellKey(9, 0)]).toBe('sunk');
    expect(s.fleets[1].shots[cellKey(9, 1)]).toBe('sunk');
    expect(s.fleets[1].sunkIds).toContain('destroyer');
  });

  it('sets winner when the last ship is sunk', () => {
    let s = twoShipState();
    s = applyMove(s, { row: 9, col: 0 });
    s = applyMove(s, { row: 0, col: 0 });
    s = applyMove(s, { row: 9, col: 1 });
    expect(s.winner).toBe(0);
  });

  it('alternates turns after a miss', () => {
    const s = applyMove(twoShipState(), { row: 5, col: 5 });
    expect(s.current).toBe(1);
  });

  it('does not advance the turn when the last ship is sunk (winner holds)', () => {
    let s = twoShipState();
    s = applyMove(s, { row: 9, col: 0 });
    s = applyMove(s, { row: 0, col: 1 }); // seat 1 misses
    s = applyMove(s, { row: 9, col: 1 });
    expect(s.winner).toBe(0);
    expect(s.current).toBe(0); // stays on winner's seat
  });
});

// ─── legalMoves ──────────────────────────────────────────────────────────────

describe('legalMoves', () => {
  it('returns all 100 cells on a fresh board', () => {
    const s = initialState([], []);
    expect(legalMoves(s)).toHaveLength(GRID_SIZE * GRID_SIZE);
  });

  it('excludes already-shot cells', () => {
    let s = initialState([h('destroyer', 2, 0, 0)], [h('destroyer', 2, 9, 0)]);
    s = applyMove(s, { row: 9, col: 0 }); // seat 0 hits fleet 1 → turn passes to seat 1
    s = applyMove(s, { row: 0, col: 5 }); // seat 1 misses → turn back to seat 0
    const moves = legalMoves(s); // seat 0 targets fleet 1 again
    expect(moves.some((m) => m.row === 9 && m.col === 0)).toBe(false);
  });

  it('returns no moves after the game ends', () => {
    let s = initialState([h('destroyer', 2, 0, 0)], [h('destroyer', 2, 9, 0)]);
    s = applyMove(s, { row: 9, col: 0 });
    s = applyMove(s, { row: 0, col: 1 });
    s = applyMove(s, { row: 9, col: 1 });
    expect(legalMoves(s)).toHaveLength(0);
  });
});

// ─── sanitizeFleet ───────────────────────────────────────────────────────────

describe('sanitizeFleet', () => {
  it('hides unsunk ships', () => {
    const fleet = {
      ships: [h('destroyer', 2, 0, 0)],
      shots: {},
      sunkIds: [] as (typeof SHIP_DEFS)[number]['id'][],
    };
    expect(sanitizeFleet(fleet).ships).toHaveLength(0);
  });

  it('reveals sunk ships', () => {
    const fleet = {
      ships: [h('destroyer', 2, 0, 0)],
      shots: { '0,0': 'sunk' as const, '0,1': 'sunk' as const },
      sunkIds: ['destroyer' as const],
    };
    expect(sanitizeFleet(fleet).ships).toHaveLength(1);
  });
});
