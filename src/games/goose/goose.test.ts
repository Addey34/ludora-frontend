import { describe, test, expect } from 'vitest';
import {
  initialState,
  legalMoves,
  applyMove,
  squareToCell,
  PASS,
  FINISH,
  GOOSE_SQUARES,
  BRIDGE_TO,
  INN,
  WELL,
  LABYRINTH_TO,
  PRISON,
  INN_SKIP,
  WELL_SKIP,
  PRISON_SKIP,
  SEATS,
  OFF_BOARD,
} from './goose.js';

describe('initialState', () => {
  test('all players off-board, seat 0 to play, no skips', () => {
    const s = initialState();
    expect(s.positions).toEqual([OFF_BOARD, OFF_BOARD, OFF_BOARD, OFF_BOARD]);
    expect(s.current).toBe(0);
    expect(s.winner).toBeNull();
    expect(s.skipTurns).toEqual([0, 0, 0, 0]);
  });
});

describe('legalMoves', () => {
  test('returns 2-12 on a normal turn', () => {
    expect(legalMoves(initialState())).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test('returns [PASS] when current player must skip', () => {
    const s = { ...initialState(), skipTurns: [3, 0, 0, 0] as [number, number, number, number] };
    expect(legalMoves(s)).toEqual([PASS]);
  });

  test('returns [] after the game is won', () => {
    expect(legalMoves({ ...initialState(), winner: 0 })).toEqual([]);
  });
});

describe('applyMove — normal advance', () => {
  test('first roll enters the board at that square', () => {
    const s = applyMove(initialState(), 7);
    expect(s.positions[0]).toBe(7);
    expect(s.current).toBe(1);
  });

  test('subsequent roll advances from current position', () => {
    let s = { ...initialState(), positions: [10, 0, 0, 0] as [number, number, number, number] };
    s = applyMove(s, 5);
    expect(s.positions[0]).toBe(15);
  });

  test('does not mutate the input state', () => {
    const s = initialState();
    const before = JSON.stringify(s);
    applyMove(s, 5);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('applyMove — PASS', () => {
  test('decrements skipTurns and advances seat', () => {
    const s = { ...initialState(), skipTurns: [2, 0, 0, 0] as [number, number, number, number] };
    const next = applyMove(s, PASS);
    expect(next.skipTurns[0]).toBe(1);
    expect(next.current).toBe(1);
  });
});

describe('applyMove — goose chain', () => {
  test('landing on a goose from the board chains by the same roll', () => {
    // From square 10, roll 5: 15 (not goose). No chain.
    const s0 = { ...initialState(), positions: [10, 0, 0, 0] as [number, number, number, number] };
    const s = applyMove(s0, 5);
    expect(s.positions[0]).toBe(15);
  });

  test('landing on a goose from the board chains twice', () => {
    // From square 4, roll 5: 9 (goose) → 14 (goose) → 19 (inn — no further chain).
    const s0 = { ...initialState(), positions: [4, 0, 0, 0] as [number, number, number, number] };
    const s = applyMove(s0, 5);
    expect(s.positions[0]).toBe(19); // INN
    expect(s.skipTurns[0]).toBe(INN_SKIP);
  });

  test('rolling 5 from start lands on square 5 — no goose chain on first move', () => {
    const s = applyMove(initialState(), 5);
    expect(s.positions[0]).toBe(5);
  });

  test('rolling 9 from start lands on 9 — no goose chain on first move', () => {
    // The classic chain 9→18→27→36→45→54→63 is suppressed on a player's very
    // first move to prevent an instant win before the game properly begins.
    expect(GOOSE_SQUARES.has(9)).toBe(true);
    const s = applyMove(initialState(), 9);
    expect(s.positions[0]).toBe(9);
    expect(s.winner).toBeNull();
  });

  test('rolling 9 from square 9 (second move) still chains all the way to FINISH', () => {
    // Once on the board, the chain applies normally.
    const s0 = { ...initialState(), positions: [9, 0, 0, 0] as [number, number, number, number] };
    const s = applyMove(s0, 9);
    expect(s.positions[0]).toBe(FINISH);
    expect(s.winner).toBe(0);
  });
});

describe('applyMove — bridge', () => {
  test('landing on BRIDGE_FROM (6) jumps to BRIDGE_TO (12)', () => {
    const s = applyMove(initialState(), 6);
    expect(s.positions[0]).toBe(BRIDGE_TO);
  });
});

describe('applyMove — special squares', () => {
  test('Inn (19) sets skipTurns to INN_SKIP', () => {
    const s = { ...initialState(), positions: [17, 0, 0, 0] as [number, number, number, number] };
    const next = applyMove(s, 2);
    expect(next.positions[0]).toBe(INN);
    expect(next.skipTurns[0]).toBe(INN_SKIP);
  });

  test('Well (31) sets skipTurns to WELL_SKIP', () => {
    const s = { ...initialState(), positions: [29, 0, 0, 0] as [number, number, number, number] };
    const next = applyMove(s, 2);
    expect(next.positions[0]).toBe(WELL);
    expect(next.skipTurns[0]).toBe(WELL_SKIP);
  });

  test('Labyrinth (42) sends player back to LABYRINTH_TO (39)', () => {
    const s = { ...initialState(), positions: [40, 0, 0, 0] as [number, number, number, number] };
    const next = applyMove(s, 2);
    expect(next.positions[0]).toBe(LABYRINTH_TO);
  });

  test('Prison (52) sets skipTurns to PRISON_SKIP', () => {
    const s = { ...initialState(), positions: [50, 0, 0, 0] as [number, number, number, number] };
    const next = applyMove(s, 2);
    expect(next.positions[0]).toBe(PRISON);
    expect(next.skipTurns[0]).toBe(PRISON_SKIP);
  });

  test('Death (58) sends player back to square 1', () => {
    const s = { ...initialState(), positions: [56, 0, 0, 0] as [number, number, number, number] };
    const next = applyMove(s, 2);
    expect(next.positions[0]).toBe(1);
  });
});

describe('applyMove — finish', () => {
  test('exact landing on 63 wins the game', () => {
    const s = { ...initialState(), positions: [60, 0, 0, 0] as [number, number, number, number] };
    const next = applyMove(s, 3);
    expect(next.positions[0]).toBe(FINISH);
    expect(next.winner).toBe(0);
  });

  test('overshoot bounces back and no win', () => {
    // pos=60, roll=5 → 65 → bounce: 63-(65-63)=61
    const s = { ...initialState(), positions: [60, 0, 0, 0] as [number, number, number, number] };
    const next = applyMove(s, 5);
    expect(next.positions[0]).toBe(61);
    expect(next.winner).toBeNull();
  });
});

describe('applyMove — bump', () => {
  test('arriving on an occupied square sends the occupant back to the mover old position', () => {
    const s = {
      ...initialState(),
      positions: [10, 12, 0, 0] as [number, number, number, number],
    };
    // Seat 0 rolls 2: moves from 10 to 12 (where seat 1 is)
    const next = applyMove(s, 2);
    expect(next.positions[0]).toBe(12);
    expect(next.positions[1]).toBe(10); // bumped to seat 0's old position
  });

  test('bumping from off-board sends occupant to OFF_BOARD', () => {
    // Seat 0 off-board, rolls 7, lands on 7 where seat 1 sits → bumps seat 1 to OFF_BOARD
    const s2 = {
      ...initialState(),
      positions: [OFF_BOARD, 7, 0, 0] as [number, number, number, number],
    };
    const next = applyMove(s2, 7);
    expect(next.positions[0]).toBe(7);
    expect(next.positions[1]).toBe(OFF_BOARD);
  });
});

describe('squareToCell', () => {
  test('square 1 is bottom-left (row 8, col 0)', () => {
    expect(squareToCell(1)).toEqual({ row: 8, col: 0 });
  });

  test('square 7 is bottom-right (row 8, col 6)', () => {
    expect(squareToCell(7)).toEqual({ row: 8, col: 6 });
  });

  test('square 8 is on the next row, right side (row 7, col 6)', () => {
    expect(squareToCell(8)).toEqual({ row: 7, col: 6 });
  });

  test('square 14 is on the same row as 8, left side (row 7, col 0)', () => {
    expect(squareToCell(14)).toEqual({ row: 7, col: 0 });
  });

  test('square 63 is top-right (row 0, col 6)', () => {
    expect(squareToCell(63)).toEqual({ row: 0, col: 6 });
  });

  test('all 63 squares map to distinct grid cells', () => {
    const seen = new Set<string>();
    for (let sq = 1; sq <= 63; sq++) {
      const { row, col } = squareToCell(sq);
      const key = `${row},${col}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  test('consecutive squares are in adjacent cells', () => {
    for (let sq = 1; sq < 63; sq++) {
      const a = squareToCell(sq);
      const b = squareToCell(sq + 1);
      const dist = Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
      expect(dist).toBe(1);
    }
  });

  test('all SEATS values are 0..3', () => {
    expect([0, 1, 2, 3].every((s) => s < SEATS)).toBe(true);
  });
});
