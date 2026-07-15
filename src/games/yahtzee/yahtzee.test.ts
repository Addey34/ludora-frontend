import { describe, it, expect } from 'vitest';
import {
  scoreFor,
  upperTotal,
  upperBonus,
  grandTotal,
  type Die,
  type ScoreKey,
} from './yahtzee.js';

const d = (...v: number[]): Die[] => v as Die[];

describe('yahtzee scoring', () => {
  describe('upper section', () => {
    it('sums only the matching face value', () => {
      expect(scoreFor('ones', d(1, 1, 3, 4, 1))).toBe(3);
      expect(scoreFor('fours', d(4, 4, 4, 2, 6))).toBe(12);
      expect(scoreFor('sixes', d(1, 2, 3, 4, 5))).toBe(0);
    });
  });

  describe('combinations', () => {
    it('three/four of a kind score the total of all dice', () => {
      expect(scoreFor('threeOfKind', d(5, 5, 5, 2, 1))).toBe(18);
      expect(scoreFor('threeOfKind', d(5, 5, 2, 2, 1))).toBe(0);
      expect(scoreFor('fourOfKind', d(6, 6, 6, 6, 1))).toBe(25);
      expect(scoreFor('fourOfKind', d(6, 6, 6, 2, 1))).toBe(0);
    });

    it('full house is a flat 25', () => {
      expect(scoreFor('fullHouse', d(3, 3, 3, 5, 5))).toBe(25);
      expect(scoreFor('fullHouse', d(3, 3, 3, 3, 5))).toBe(0); // four+one is not a full house
      expect(scoreFor('fullHouse', d(2, 2, 4, 4, 6))).toBe(0);
    });

    it('straights score flat 30 / 40', () => {
      expect(scoreFor('smallStraight', d(1, 2, 3, 4, 6))).toBe(30);
      expect(scoreFor('smallStraight', d(2, 3, 4, 5, 5))).toBe(30);
      expect(scoreFor('smallStraight', d(1, 2, 3, 5, 6))).toBe(0);
      expect(scoreFor('largeStraight', d(2, 3, 4, 5, 6))).toBe(40);
      expect(scoreFor('largeStraight', d(1, 2, 3, 4, 6))).toBe(0);
    });

    it('yahtzee is 50 for five of a kind, chance is the raw sum', () => {
      expect(scoreFor('yahtzee', d(4, 4, 4, 4, 4))).toBe(50);
      expect(scoreFor('yahtzee', d(4, 4, 4, 4, 2))).toBe(0);
      expect(scoreFor('chance', d(1, 2, 3, 4, 5))).toBe(15);
    });
  });

  describe('totals & bonus', () => {
    const scores: Partial<Record<ScoreKey, number>> = {
      ones: 3,
      twos: 6,
      threes: 9,
      fours: 12,
      fives: 15,
      sixes: 18, // upper total = 63 → bonus
      fullHouse: 25,
    };

    it('upperTotal and the 63-point bonus', () => {
      expect(upperTotal(scores)).toBe(63);
      expect(upperBonus(scores)).toBe(true);
      expect(upperBonus({ ones: 3 })).toBe(false);
    });

    it('grandTotal adds the upper bonus and yahtzee bonuses', () => {
      // 63 (upper) + 35 (bonus) + 25 (full house) + 2×100 (yahtzee bonus) = 323
      expect(grandTotal(scores, 2)).toBe(323);
    });

    it('grandTotal without the bonus', () => {
      const low: Partial<Record<ScoreKey, number>> = { ones: 3, chance: 20 };
      expect(grandTotal(low, 0)).toBe(23);
    });
  });
});
