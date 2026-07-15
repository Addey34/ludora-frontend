import { describe, it, expect } from 'vitest';
import {
  handValue,
  isBust,
  initialState,
  startDeal,
  hit,
  resolveDealer,
  STARTING_CHIPS,
  type BJState,
  type Card,
} from './blackjack.js';

const card = (rank: number): Card => ({ rank, suit: 'S' }) as Card;

describe('blackjack', () => {
  describe('handValue', () => {
    it('counts an ace as 11 unless it would bust', () => {
      expect(handValue([card(1), card(13)])).toBe(21); // A + K
      expect(handValue([card(1), card(1), card(9)])).toBe(21); // 11 + 1 + 9
      expect(handValue([card(1), card(1), card(1)])).toBe(13); // 11 + 1 + 1
    });
    it('counts face cards as 10', () => {
      expect(handValue([card(11), card(12), card(13)])).toBe(30);
      expect(handValue([card(10), card(7)])).toBe(17);
    });
  });

  it('isBust over 21', () => {
    expect(isBust([card(10), card(10), card(5)])).toBe(true);
    expect(isBust([card(10), card(10)])).toBe(false);
  });

  it('initialState starts in the bet phase with the standard chip stack', () => {
    const s = initialState();
    expect(s.chips).toBe(STARTING_CHIPS);
    expect(s.phase).toBe('bet');
    expect(s.deck).toHaveLength(52);
  });

  describe('startDeal', () => {
    it('deals two cards to each hand', () => {
      const s = startDeal(initialState());
      expect(s.playerHand).toHaveLength(2);
      expect(s.dealerHand).toHaveLength(2);
      expect(['play', 'dealer']).toContain(s.phase);
    });
    it('jumps straight to the dealer phase on a natural blackjack', () => {
      // Deck pops from the end; player gets the 1st and 3rd pops. Needs ≥15 cards
      // or startDeal reshuffles a fresh deck — only the last four matter here.
      const filler = Array.from({ length: 12 }, () => card(2));
      const s: BJState = {
        ...initialState(),
        deck: [...filler, card(6), card(10), card(5), card(1)],
      };
      const dealt = startDeal(s); // player = [A, 10] = 21
      expect(handValue(dealt.playerHand)).toBe(21);
      expect(dealt.phase).toBe('dealer');
    });
  });

  it('hit moves to the dealer phase when the player busts', () => {
    const s: BJState = {
      ...initialState(),
      phase: 'play',
      playerHand: [card(10), card(10)],
      deck: [card(5)],
    };
    const next = hit(s);
    expect(next.playerHand).toHaveLength(3);
    expect(next.phase).toBe('dealer');
  });

  describe('resolveDealer', () => {
    it('hits the dealer to at least 17 and settles chips on a loss', () => {
      const s: BJState = {
        ...initialState(),
        phase: 'dealer',
        bet: 20,
        chips: 100,
        playerHand: [card(10), card(10)], // 20
        dealerHand: [card(10), card(5)], // 15 → must hit
        deck: [card(6)], // → 21, dealer stands
      };
      const done = resolveDealer(s);
      expect(handValue(done.dealerHand)).toBe(21);
      expect(done.result).toBe('lose');
      expect(done.chips).toBe(80); // -bet
      expect(done.phase).toBe('result');
    });

    it('pays the player on a dealer bust', () => {
      const s: BJState = {
        ...initialState(),
        phase: 'dealer',
        bet: 10,
        chips: 100,
        playerHand: [card(10), card(9)], // 19
        dealerHand: [card(10), card(6)], // 16 → hit
        deck: [card(10)], // → 26 bust
      };
      const done = resolveDealer(s);
      expect(isBust(done.dealerHand)).toBe(true);
      expect(done.result).toBe('win');
      expect(done.chips).toBe(110);
    });
  });
});
