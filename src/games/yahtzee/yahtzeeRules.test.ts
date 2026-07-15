import { describe, it, expect } from 'vitest';
import { YahtzeeRules, applyRoll, totalFor, ROLLS_PER_TURN, type YState } from './yahtzeeRules.js';
import { ALL_KEYS, type Die, type ScoreKey } from './yahtzee.js';

type Card = Partial<Record<ScoreKey, number>>;

describe('yahtzeeRules', () => {
  const rules = new YahtzeeRules(2);

  it('initial state: seat 0, full rolls, empty scorecards', () => {
    const s = rules.initialState();
    expect(s.seat).toBe(0);
    expect(s.rollsLeft).toBe(ROLLS_PER_TURN);
    expect(s.rolledThisTurn).toBe(false);
    expect(s.cards).toHaveLength(2);
    expect(s.cards.every((c) => Object.keys(c).length === 0)).toBe(true);
    expect(rules.currentSeat(s)).toBe(0);
  });

  describe('applyRoll', () => {
    it('sets the dice, decrements the rolls and marks the turn as rolled', () => {
      const s = rules.initialState();
      const rolled = applyRoll(s, [2, 3, 4, 5, 6] as Die[]);
      expect(rolled.dice).toEqual([2, 3, 4, 5, 6]);
      expect(rolled.rollsLeft).toBe(ROLLS_PER_TURN - 1);
      expect(rolled.rolledThisTurn).toBe(true);
    });

    it('never drops rollsLeft below zero', () => {
      const s: YState = { ...rules.initialState(), rollsLeft: 0 };
      expect(applyRoll(s, [1, 1, 1, 1, 1] as Die[]).rollsLeft).toBe(0);
    });
  });

  describe('legalMoves', () => {
    it('offers every still-empty category, shrinking as they fill', () => {
      const s = rules.initialState();
      expect(rules.legalMoves(s)).toHaveLength(ALL_KEYS.length);
      const scored: YState = { ...s, cards: [{ ones: 3 }, {}] };
      expect(rules.legalMoves(scored)).toHaveLength(ALL_KEYS.length - 1);
      expect(rules.legalMoves(scored).some((m) => m.category === 'ones')).toBe(false);
    });
  });

  describe('applyMove', () => {
    it('scores the category for the active seat and passes the turn', () => {
      const s = applyRoll(rules.initialState(), [3, 3, 3, 5, 2] as Die[]);
      const next = rules.applyMove(s, { category: 'threes' });
      expect(next.cards[0].threes).toBe(9);
      expect(next.cards[1]).toEqual({});
      expect(next.seat).toBe(1);
      expect(next.rollsLeft).toBe(ROLLS_PER_TURN); // fresh turn for seat 1
      expect(next.rolledThisTurn).toBe(false);
    });
  });

  describe('winner', () => {
    const full = (bonus: Card = {}): Card => {
      const card: Card = {};
      for (const k of ALL_KEYS) card[k] = 0;
      return { ...card, ...bonus };
    };

    it('is null until every scorecard is complete', () => {
      const s: YState = { ...rules.initialState(), cards: [full(), {}] };
      expect(rules.winner(s)).toBeNull();
    });

    it('names the highest total once all cards are full', () => {
      const s: YState = {
        ...rules.initialState(),
        cards: [full({ chance: 20 }), full({ chance: 5 })],
      };
      expect(rules.winner(s)).toBe(0);
      expect(rules.legalMoves(s)).toEqual([]);
    });

    it('returns null on a tie', () => {
      const s: YState = {
        ...rules.initialState(),
        cards: [full({ chance: 10 }), full({ chance: 10 })],
      };
      expect(rules.winner(s)).toBeNull();
    });
  });

  it('totalFor reflects the upper bonus (63+ → +35)', () => {
    expect(totalFor({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 })).toBe(
      63 + 35
    );
    expect(totalFor({ ones: 3 })).toBe(3);
  });
});
