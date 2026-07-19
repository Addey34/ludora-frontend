import { nextSeat, type Seat, type TurnRules } from '../../shared/turn/turnGame.js';

/** A domino tile. In a hand it is canonical (`[low, high]`); in the chain it is
 *  oriented so `chain[i][1] === chain[i + 1][0]` always holds. */
export type Tile = readonly [number, number];

const SEAT_COUNT = 2;
const MAX_PIPS = 6;
export const HAND_SIZE = 7;

export type DominoesMove =
  | { type: 'place'; tile: Tile; end: 'left' | 'right' }
  | { type: 'draw' }
  | { type: 'pass' };

export interface DominoesState {
  hands: [Tile[], Tile[]];
  boneyard: Tile[];
  chain: Tile[];
  current: Seat;
  winner: Seat | null;
  finished: boolean;
  /** True when the round ended blocked (both seats passed) rather than by an empty hand. */
  blocked: boolean;
  passes: number;
}

/** The 28 tiles of a double-six set, canonical order. */
export function fullDominoSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let low = 0; low <= MAX_PIPS; low++) {
    for (let high = low; high <= MAX_PIPS; high++) tiles.push([low, high]);
  }
  return tiles;
}

/** Deals `tiles` in order: HAND_SIZE each, the rest becomes the boneyard.
 *  Pass a pre-shuffled set for a real game, an ordered one for tests. */
export function createDominoesState(tiles: Tile[]): DominoesState {
  return {
    hands: [tiles.slice(0, HAND_SIZE), tiles.slice(HAND_SIZE, HAND_SIZE * 2)],
    boneyard: tiles.slice(HAND_SIZE * 2),
    chain: [],
    current: 0,
    winner: null,
    finished: false,
    blocked: false,
    passes: 0,
  };
}

function sameTile(a: Tile, b: Tile): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

/** Sum of the pips left in a hand (blocked-game tiebreaker). */
export function pipTotal(hand: Tile[]): number {
  return hand.reduce((sum, tile) => sum + tile[0] + tile[1], 0);
}

export function legalDominoesMoves(state: DominoesState): DominoesMove[] {
  if (state.finished) return [];
  const hand = state.hands[state.current];
  if (state.chain.length === 0) {
    return hand.map((tile) => ({ type: 'place', tile, end: 'right' as const }));
  }
  const leftEnd = state.chain[0][0];
  const rightEnd = state.chain[state.chain.length - 1][1];
  const placements: DominoesMove[] = [];
  for (const tile of hand) {
    if (tile[0] === rightEnd || tile[1] === rightEnd) {
      placements.push({ type: 'place', tile, end: 'right' });
    }
    if (tile[0] === leftEnd || tile[1] === leftEnd) {
      placements.push({ type: 'place', tile, end: 'left' });
    }
  }
  if (placements.length > 0) return placements;
  return state.boneyard.length > 0 ? [{ type: 'draw' }] : [{ type: 'pass' }];
}

export function applyDominoesMove(state: DominoesState, move: DominoesMove): DominoesState {
  if (move.type === 'draw') {
    const hands: [Tile[], Tile[]] = [state.hands[0].slice(), state.hands[1].slice()];
    hands[state.current].push(state.boneyard[0]);
    // Same seat keeps the turn: it must draw until it can play or the pile empties.
    return { ...state, hands, boneyard: state.boneyard.slice(1) };
  }

  if (move.type === 'pass') {
    const passes = state.passes + 1;
    if (passes < SEAT_COUNT) {
      return { ...state, passes, current: nextSeat(state.current, SEAT_COUNT) };
    }
    // Both seats passed with an empty boneyard: blocked game, lowest pip count wins.
    const totals = state.hands.map(pipTotal);
    const winner: Seat | null = totals[0] === totals[1] ? null : totals[0] < totals[1] ? 0 : 1;
    return { ...state, passes, winner, finished: true, blocked: true };
  }

  const hands: [Tile[], Tile[]] = [state.hands[0].slice(), state.hands[1].slice()];
  const hand = hands[state.current];
  hand.splice(
    hand.findIndex((tile) => sameTile(tile, move.tile)),
    1
  );

  const chain = state.chain.slice();
  if (chain.length === 0) {
    chain.push(move.tile);
  } else if (move.end === 'right') {
    const rightEnd = chain[chain.length - 1][1];
    chain.push(move.tile[0] === rightEnd ? move.tile : [move.tile[1], move.tile[0]]);
  } else {
    const leftEnd = chain[0][0];
    chain.unshift(move.tile[1] === leftEnd ? move.tile : [move.tile[1], move.tile[0]]);
  }

  const won = hand.length === 0;
  return {
    ...state,
    hands,
    chain,
    passes: 0,
    winner: won ? state.current : null,
    finished: won,
    current: won ? state.current : nextSeat(state.current, SEAT_COUNT),
  };
}

function shuffledSet(): Tile[] {
  const tiles = fullDominoSet();
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

export const dominoesRules: TurnRules<DominoesState, DominoesMove> = {
  seats: SEAT_COUNT,
  initialState: () => createDominoesState(shuffledSet()),
  currentSeat: (state) => state.current,
  legalMoves: legalDominoesMoves,
  applyMove: applyDominoesMove,
  winner: (state) => state.winner,
};
