import { describe, expect, it } from 'vitest';
import { ReversiState, Cell, SIZE, initialState, legalMoves, applyMove } from './reversi.js';
import { decideMove } from './reversiBot.js';

const idx = (r: number, c: number): number => r * SIZE + c;

describe('decideMove', () => {
  it('always returns a legal move', () => {
    const s = initialState();
    const legal = legalMoves(s);
    const chosen = decideMove(s, legal, 'medium', () => 0.5);
    expect(legal.some((m) => m.index === chosen.index)).toBe(true);
  });

  it('grabs a corner when one is available (positional weight)', () => {
    // Black at (0,1) and white at (0,2): black playing the (0,0) corner brackets
    // and flips (0,1)? No — set white between corner and a black anchor so the
    // corner move is legal and hugely valuable.
    const board: Cell[] = Array.from({ length: SIZE * SIZE }, () => null);
    board[idx(0, 1)] = 1; // white
    board[idx(0, 2)] = 0; // black anchor → (0,0) brackets (0,1)
    // Give the position a couple more discs so other moves exist to choose from.
    board[idx(4, 4)] = 1;
    board[idx(4, 3)] = 0;
    const s: ReversiState = { board, current: 0, done: false, winner: null };
    const legal = legalMoves(s);
    expect(legal.some((m) => m.index === idx(0, 0))).toBe(true);
    // Hard search should prefer the corner over the alternatives.
    expect(decideMove(s, legal, 'hard').index).toBe(idx(0, 0));
  });

  it('easy plays the random move its rng selects', () => {
    const s = initialState();
    const legal = legalMoves(s);
    expect(decideMove(s, legal, 'easy', () => 0)).toEqual(legal[0]);
  });

  it('produces a playable move deep in a real game', () => {
    // Advance a few plies, then make sure the bot still returns a legal reply.
    let s = initialState();
    for (let k = 0; k < 6; k++) s = applyMove(s, legalMoves(s)[0]);
    const legal = legalMoves(s);
    const chosen = decideMove(s, legal, 'hard');
    expect(legal.some((m) => m.index === chosen.index)).toBe(true);
  });
});
