import { Card, freshDeck, shuffleDeck } from '../../shared/cards/cards.js';
export type { Card };

export type BJPhase = 'bet' | 'play' | 'dealer' | 'result';
export type BJResult = 'blackjack' | 'win' | 'push' | 'lose' | 'bust';

export interface BJState {
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[];
  phase: BJPhase;
  bet: number;
  chips: number;
  result: BJResult | null;
  doubled: boolean;
}

export const STARTING_CHIPS = 200;
export const MIN_BET = 5;
export const MAX_BET = 100;
export const BET_STEP = 5;

export function handValue(hand: Card[]): number {
  let value = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.rank === 1) {
      aces++;
      value += 11;
    } else if (c.rank >= 10) {
      value += 10;
    } else {
      value += c.rank;
    }
  }
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  return value;
}

export function isBust(hand: Card[]): boolean {
  return handValue(hand) > 21;
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21;
}

export function dealerShouldHit(hand: Card[]): boolean {
  return handValue(hand) < 17;
}

export function getResult(playerHand: Card[], dealerHand: Card[]): BJResult {
  if (isBust(playerHand)) return 'bust';
  if (isBlackjack(playerHand) && !isBlackjack(dealerHand)) return 'blackjack';
  if (isBust(dealerHand)) return 'win';
  const p = handValue(playerHand);
  const d = handValue(dealerHand);
  if (p > d) return 'win';
  if (p === d) return 'push';
  return 'lose';
}

export function chipsDelta(result: BJResult, bet: number): number {
  if (result === 'blackjack') return Math.floor(bet * 1.5);
  if (result === 'win') return bet;
  if (result === 'push') return 0;
  return -bet;
}

function popCard(deck: Card[]): [Card[], Card] {
  const d = [...deck];
  const c = d.pop()!;
  return [d, c];
}

export function initialState(): BJState {
  return {
    deck: shuffleDeck(freshDeck()),
    playerHand: [],
    dealerHand: [],
    phase: 'bet',
    bet: 10,
    chips: STARTING_CHIPS,
    result: null,
    doubled: false,
  };
}

export function startDeal(state: BJState): BJState {
  const base = state.deck.length < 15 ? shuffleDeck(freshDeck()) : [...state.deck];
  const [d1, c1] = popCard(base);
  const [d2, c2] = popCard(d1);
  const [d3, c3] = popCard(d2);
  const [deck, c4] = popCard(d3);
  const playerHand = [c1, c3];
  const dealerHand = [c2, c4];
  const phase: BJPhase = isBlackjack(playerHand) ? 'dealer' : 'play';
  return { ...state, deck, playerHand, dealerHand, phase, result: null, doubled: false };
}

export function hit(state: BJState): BJState {
  const [deck, card] = popCard(state.deck);
  const playerHand = [...state.playerHand, card];
  if (isBust(playerHand)) {
    return { ...state, deck, playerHand, phase: 'dealer' };
  }
  return { ...state, deck, playerHand };
}

export function stand(state: BJState): BJState {
  return { ...state, phase: 'dealer' };
}

export function doubleDown(state: BJState): BJState {
  const newBet = state.bet * 2;
  let s = hit({ ...state, bet: newBet, doubled: true });
  if (s.phase !== 'dealer') s = { ...s, phase: 'dealer' };
  return s;
}

export function resolveDealer(state: BJState): BJState {
  let deck = [...state.deck];
  let dealerHand = [...state.dealerHand];
  while (dealerShouldHit(dealerHand)) {
    const [nextDeck, card] = popCard(deck);
    deck = nextDeck;
    dealerHand = [...dealerHand, card];
  }
  const result = getResult(state.playerHand, dealerHand);
  const delta = chipsDelta(result, state.bet);
  const chips = Math.max(0, state.chips + delta);
  return { ...state, deck, dealerHand, phase: 'result', result, chips };
}
