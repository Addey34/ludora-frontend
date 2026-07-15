import { describe, it, expect } from 'vitest';
import { DotsBoxesRules, type DBMove } from './dotsboxes.js';

describe('DotsBoxesRules', () => {
  it('initial state: no edges, zeroed scores, seat 0 to move', () => {
    const rules = new DotsBoxesRules(3, 2);
    const s = rules.initialState();
    expect(s.filledEdges).toBe(0);
    expect(s.totalEdges).toBe(2 * 3 * (3 + 1)); // 24
    expect(s.scores).toEqual([0, 0]);
    expect(rules.currentSeat(s)).toBe(0);
    expect(rules.legalMoves(s)).toHaveLength(s.totalEdges);
  });

  it('a non-closing move passes the turn to the next seat', () => {
    const rules = new DotsBoxesRules(2, 2);
    const s = rules.applyMove(rules.initialState(), { dir: 'h', row: 0, col: 0 });
    expect(s.filledEdges).toBe(1);
    expect(rules.currentSeat(s)).toBe(1);
    expect(s.scores).toEqual([0, 0]);
  });

  it('closing a box scores it and grants another turn', () => {
    const rules = new DotsBoxesRules(2, 2);
    // Three edges of box (0,0), alternating seats; the 4th closes it.
    const path: DBMove[] = [
      { dir: 'h', row: 0, col: 0 }, // seat 0 -> 1
      { dir: 'h', row: 1, col: 0 }, // seat 1 -> 0
      { dir: 'v', row: 0, col: 0 }, // seat 0 -> 1
      { dir: 'v', row: 0, col: 1 }, // seat 1 closes box (0,0)
    ];
    let s = rules.initialState();
    for (const m of path) s = rules.applyMove(s, m);
    expect(s.boxes[0][0]).toBe(1);
    expect(s.scores).toEqual([0, 1]);
    expect(rules.currentSeat(s)).toBe(1); // extra turn for the closer
    expect(rules.winner(s)).toBeNull(); // game not over yet
  });

  it('declares the higher score the winner once the board is full', () => {
    const rules = new DotsBoxesRules(1, 2); // single box, 4 edges
    let s = rules.initialState();
    let legal = rules.legalMoves(s);
    while (legal.length > 0) {
      s = rules.applyMove(s, legal[0]);
      legal = rules.legalMoves(s);
    }
    expect(s.filledEdges).toBe(s.totalEdges);
    // One box, so exactly one seat scored it → a decisive winner.
    expect(rules.winner(s)).toBe(s.scores.indexOf(Math.max(...s.scores)));
  });
});
