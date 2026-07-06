/**
 * Klondike Solitaire — pure game logic (no DOM). All state is immutable:
 * every function returns a new state object.
 *
 * Pit layout (14 pits indexed 0–13):
 *   stock   — face-down draw pile (top = last element)
 *   waste   — drawn cards, top face-up (last element)
 *   foundations[0..3] — one pile per suit (S/H/D/C), build A→K same suit
 *   tableau[0..6]     — 7 columns, alternating colours, build K→A
 *
 * Rules implemented: draw-1 from stock, stock recycle, waste→foundation,
 * waste→tableau, tableau→foundation, tableau→tableau (sequences).
 */

import { Card, Suit, isRed, freshDeck, shuffleDeck } from '../../shared/cards/cards.js';

export interface PlacedCard extends Card {
  faceUp: boolean;
}

export interface SolitaireState {
  /** Face-down draw pile; last element is on top. */
  stock: PlacedCard[];
  /** Drawn cards; last element is the face-up top card. */
  waste: PlacedCard[];
  /** Four foundation piles indexed by suit (see {@link SUIT_INDEX}). */
  foundations: PlacedCard[][];
  /** Seven tableau columns; last element of each is the top card. */
  tableau: PlacedCard[][];
}

export type Source = { zone: 'waste' } | { zone: 'tableau'; col: number; cardIdx: number };

export type Dest = { zone: 'foundation'; suit: Suit } | { zone: 'tableau'; col: number };

export const SUIT_INDEX: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };

function cloneState(s: SolitaireState): SolitaireState {
  return {
    stock: [...s.stock],
    waste: [...s.waste],
    foundations: s.foundations.map((f) => [...f]),
    tableau: s.tableau.map((c) => [...c]),
  };
}

export function deal(rng = Math.random): SolitaireState {
  const deck: PlacedCard[] = shuffleDeck(freshDeck(), rng).map((c) => ({
    ...c,
    faceUp: false,
  }));
  const tableau: PlacedCard[][] = [];
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    const column: PlacedCard[] = [];
    for (let j = 0; j <= col; j++) {
      column.push({ ...deck[idx++], faceUp: j === col });
    }
    tableau.push(column);
  }
  return {
    stock: deck.slice(idx),
    waste: [],
    foundations: [[], [], [], []],
    tableau,
  };
}

export function drawFromStock(state: SolitaireState): SolitaireState {
  const s = cloneState(state);
  if (s.stock.length > 0) {
    s.waste.push({ ...s.stock.pop()!, faceUp: true });
  } else {
    s.stock = [...s.waste].reverse().map((c) => ({ ...c, faceUp: false }));
    s.waste = [];
  }
  return s;
}

export function canPlaceOnFoundation(card: PlacedCard, pile: PlacedCard[]): boolean {
  if (!card.faceUp) return false;
  if (pile.length === 0) return card.rank === 1;
  const top = pile[pile.length - 1];
  return card.suit === top.suit && card.rank === top.rank + 1;
}

export function canPlaceOnTableau(card: PlacedCard, col: PlacedCard[]): boolean {
  if (!card.faceUp) return false;
  if (col.length === 0) return card.rank === 13;
  const top = col[col.length - 1];
  return top.faceUp && isRed(card.suit) !== isRed(top.suit) && card.rank === top.rank - 1;
}

export function applyMove(state: SolitaireState, source: Source, dest: Dest): SolitaireState {
  const s = cloneState(state);
  let cards: PlacedCard[];

  if (source.zone === 'waste') {
    cards = [s.waste.pop()!];
  } else {
    cards = s.tableau[source.col].splice(source.cardIdx);
    const col = s.tableau[source.col];
    if (col.length > 0 && !col[col.length - 1].faceUp) {
      col[col.length - 1] = { ...col[col.length - 1], faceUp: true };
    }
  }

  if (dest.zone === 'foundation') {
    s.foundations[SUIT_INDEX[dest.suit]].push(...cards.map((c) => ({ ...c, faceUp: true })));
  } else {
    s.tableau[dest.col].push(...cards.map((c) => ({ ...c, faceUp: true })));
  }
  return s;
}

export function isWon(state: SolitaireState): boolean {
  return state.foundations.every((f) => f.length === 13);
}

/** Points scored for a given move (standard Klondike scoring). */
export function scoreMove(source: Source, dest: Dest): number {
  if (dest.zone === 'foundation') return 10;
  if (source.zone === 'waste') return 5;
  return 0;
}
