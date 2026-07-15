import { describe, it, expect } from 'vitest';
import {
  deal,
  drawFromStock,
  canPlaceOnFoundation,
  canPlaceOnTableau,
  applyMove,
  isWon,
  scoreMove,
  type PlacedCard,
  type SolitaireState,
} from './solitaire.js';

const card = (rank: number, suit: 'S' | 'H' | 'D' | 'C', faceUp = true): PlacedCard =>
  ({ rank, suit, faceUp }) as PlacedCard;

describe('solitaire', () => {
  describe('deal', () => {
    const s = deal(() => 0.42); // deterministic

    it('lays out 7 tableau columns of increasing size, only the top face-up', () => {
      expect(s.tableau).toHaveLength(7);
      s.tableau.forEach((col, i) => {
        expect(col).toHaveLength(i + 1);
        expect(col[col.length - 1].faceUp).toBe(true);
        expect(col.slice(0, -1).every((c) => !c.faceUp)).toBe(true);
      });
    });

    it('puts the remaining 24 cards in the stock, waste and foundations empty', () => {
      expect(s.stock).toHaveLength(52 - 28);
      expect(s.waste).toEqual([]);
      expect(s.foundations).toEqual([[], [], [], []]);
    });
  });

  describe('drawFromStock', () => {
    it('moves the top stock card to the waste, face up', () => {
      const s = deal(() => 0.1);
      const before = s.stock.length;
      const next = drawFromStock(s);
      expect(next.stock).toHaveLength(before - 1);
      expect(next.waste).toHaveLength(1);
      expect(next.waste[0].faceUp).toBe(true);
    });

    it('recycles the waste back into the stock when empty', () => {
      const base = deal(() => 0.2);
      const drained: SolitaireState = { ...base, stock: [], waste: [card(5, 'H'), card(9, 'S')] };
      const next = drawFromStock(drained);
      expect(next.waste).toEqual([]);
      expect(next.stock).toHaveLength(2);
      expect(next.stock.every((c) => !c.faceUp)).toBe(true);
    });
  });

  describe('canPlaceOnFoundation', () => {
    it('accepts an ace on an empty pile, then the next rank of the same suit', () => {
      expect(canPlaceOnFoundation(card(1, 'S'), [])).toBe(true);
      expect(canPlaceOnFoundation(card(2, 'S'), [card(1, 'S')])).toBe(true);
    });
    it('rejects a non-ace on empty, wrong suit, or a face-down card', () => {
      expect(canPlaceOnFoundation(card(2, 'S'), [])).toBe(false);
      expect(canPlaceOnFoundation(card(2, 'H'), [card(1, 'S')])).toBe(false);
      expect(canPlaceOnFoundation(card(1, 'S', false), [])).toBe(false);
    });
  });

  describe('canPlaceOnTableau', () => {
    it('accepts a king on an empty column and a descending alternating colour', () => {
      expect(canPlaceOnTableau(card(13, 'S'), [])).toBe(true);
      expect(canPlaceOnTableau(card(6, 'H'), [card(7, 'S')])).toBe(true); // red on black
    });
    it('rejects same colour, wrong rank, or a non-king on empty', () => {
      expect(canPlaceOnTableau(card(6, 'S'), [card(7, 'C')])).toBe(false); // black on black
      expect(canPlaceOnTableau(card(5, 'H'), [card(7, 'S')])).toBe(false); // rank gap
      expect(canPlaceOnTableau(card(5, 'H'), [])).toBe(false); // not a king
    });
  });

  describe('applyMove', () => {
    it('moves the waste card to a foundation and flips the newly exposed tableau card', () => {
      const s: SolitaireState = {
        stock: [],
        waste: [card(1, 'S')],
        foundations: [[], [], [], []],
        tableau: [[card(9, 'C', false), card(4, 'H')], [], [], [], [], [], []],
      };
      const afterFound = applyMove(s, { zone: 'waste' }, { zone: 'foundation', suit: 'S' });
      expect(afterFound.foundations[0]).toHaveLength(1);
      expect(afterFound.waste).toEqual([]);

      // Moving the face-up tableau top exposes and flips the card beneath it.
      const afterTab = applyMove(
        s,
        { zone: 'tableau', col: 0, cardIdx: 1 },
        { zone: 'tableau', col: 1 }
      );
      expect(afterTab.tableau[1]).toHaveLength(1);
      expect(afterTab.tableau[0][0].faceUp).toBe(true);
    });
  });

  describe('scoring & win', () => {
    it('scores foundation moves highest, waste→tableau some, tableau→tableau none', () => {
      expect(scoreMove({ zone: 'waste' }, { zone: 'foundation', suit: 'S' })).toBe(10);
      expect(scoreMove({ zone: 'waste' }, { zone: 'tableau', col: 0 })).toBe(5);
      expect(scoreMove({ zone: 'tableau', col: 0, cardIdx: 0 }, { zone: 'tableau', col: 1 })).toBe(
        0
      );
    });

    it('isWon is true only when all four foundations are complete', () => {
      const full = Array.from({ length: 13 }, (_, i) => card(i + 1, 'S'));
      expect(
        isWon({ stock: [], waste: [], foundations: [full, full, full, full], tableau: [] })
      ).toBe(true);
      expect(isWon(deal(() => 0.3))).toBe(false);
    });
  });
});
