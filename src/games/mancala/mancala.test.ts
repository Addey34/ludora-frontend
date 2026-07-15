import { describe, it, expect } from 'vitest';
import { rules, applyMove, legalMoves, storeOf, pitsOf, type MancalaState } from './mancala.js';

const STORE_0 = 6;
const STORE_1 = 13;

/** Build a state from a sparse pit map (unset pits = 0). */
function state(map: Record<number, number>, current: 0 | 1 = 0): MancalaState {
  const pits = new Array<number>(14).fill(0);
  for (const [k, v] of Object.entries(map)) pits[Number(k)] = v;
  return { pits, current, gameOver: false, winner: null };
}

describe('mancala', () => {
  it('initial board: 4 seeds per pit, empty stores, seat 0 to play', () => {
    const s = rules.initialState();
    expect(s.pits).toEqual([4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    expect(s.current).toBe(0);
    expect(legalMoves(s)).toHaveLength(6);
  });

  it('sows counter-clockwise and skips the opponent store', () => {
    const s = rules.initialState();
    const next = applyMove(s, { pit: 2 }); // 4 seeds from pit 2 → 3,4,5,store0
    expect(next.pits[3]).toBe(5);
    expect(next.pits[4]).toBe(5);
    expect(next.pits[5]).toBe(5);
    expect(next.pits[STORE_0]).toBe(1);
    expect(next.pits[2]).toBe(0);
  });

  it('grants an extra turn when the last seed lands in your store', () => {
    // Pit 5 holds exactly 1 seed → lands in store 0.
    const s = state({ 5: 1, 0: 3, 9: 1 }, 0);
    const next = applyMove(s, { pit: 5 });
    expect(next.pits[STORE_0]).toBe(1);
    expect(next.current).toBe(0); // same seat plays again
    expect(next.gameOver).toBe(false);
  });

  it('captures the opposite pit when landing in an empty own pit', () => {
    // Sow 1 seed from pit 0 → lands on empty pit 1; opposite is pit 11 (3 seeds).
    const s = state({ 0: 1, 3: 2, 9: 1, 11: 3 }, 0);
    const next = applyMove(s, { pit: 0 });
    expect(next.pits[STORE_0]).toBe(4); // 3 captured + the sown seed
    expect(next.pits[1]).toBe(0);
    expect(next.pits[11]).toBe(0);
    expect(next.current).toBe(1); // no extra turn on a capture
    expect(next.gameOver).toBe(false);
  });

  it('ends and sweeps once a side is emptied, then names the winner', () => {
    // Seat 0 plays its last seed; its row becomes empty → game ends.
    const s = state({ 5: 1, [STORE_0]: 20, 7: 3, [STORE_1]: 5 }, 0);
    const next = applyMove(s, { pit: 5 });
    expect(next.gameOver).toBe(true);
    // Store 0 gets the seed (lands in store), opponent's remaining seeds are swept
    // into store 1. Seat 0 leads 21 vs 8.
    expect(next.pits[STORE_0]).toBe(21);
    expect(next.pits[STORE_1]).toBe(8);
    expect(next.winner).toBe(0);
    expect(legalMoves(next)).toHaveLength(0);
  });

  it('exposes seat helpers', () => {
    expect(storeOf(0)).toBe(STORE_0);
    expect(storeOf(1)).toBe(STORE_1);
    expect(pitsOf(0)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(pitsOf(1)).toEqual([7, 8, 9, 10, 11, 12]);
  });
});
