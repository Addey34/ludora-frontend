import { type Seat, type TurnRules } from '../../shared/turn/turnGame.js';

export const POINT_COUNT = 24;
export const CHECKERS_PER_PLAYER = 15;
/** Seat count, exported for the multiplayer panel capacity. */
export const SEATS = 2;
/** `from` sentinel: the checker enters from the bar. */
export const BAR = -1;
/** `to` sentinel: the checker bears off the board. */
export const OFF = 24;

export interface BackgammonMove {
  from: number;
  to: number;
  die: number;
}

/**
 * Points are a signed array: a positive count means seat 0 checkers, negative
 * means seat 1. `bar`/`off` are per-seat counts. `dice` holds the die values still
 * playable this turn (doubles expand to four). Rolling is done by the controller,
 * so every function here stays pure and deterministic.
 */
export interface BackgammonState {
  points: number[];
  bar: [number, number];
  off: [number, number];
  current: Seat;
  dice: number[];
  winner: Seat | null;
}

export function createBackgammonState(): BackgammonState {
  const points = new Array<number>(POINT_COUNT).fill(0);
  // Seat 0 (positive) moves 23 → 0, home 0–5. Seat 1 (negative) mirrors it.
  points[23] = 2;
  points[12] = 5;
  points[7] = 3;
  points[5] = 5;
  points[0] = -2;
  points[11] = -5;
  points[16] = -3;
  points[18] = -5;
  return { points, bar: [0, 0], off: [0, 0], current: 0, dice: [], winner: null };
}

export function owner(value: number): Seat | null {
  if (value > 0) return 0;
  if (value < 0) return 1;
  return null;
}

function sign(seat: Seat): number {
  return seat === 0 ? 1 : -1;
}

function direction(seat: Seat): number {
  return seat === 0 ? -1 : 1;
}

/** Pips from point `p` to bearing off, for `seat`. */
function distanceToOff(seat: Seat, p: number): number {
  return seat === 0 ? p + 1 : POINT_COUNT - p;
}

/** Board point a bar checker enters on with die `d`. */
function entryPoint(seat: Seat, d: number): number {
  return seat === 0 ? POINT_COUNT - d : d - 1;
}

function inHome(seat: Seat, p: number): boolean {
  return seat === 0 ? p <= 5 : p >= 18;
}

/** All of a seat's checkers are in its home board (and none on the bar). */
function allInHome(state: BackgammonState, seat: Seat): boolean {
  if (state.bar[seat] > 0) return false;
  for (let i = 0; i < POINT_COUNT; i++) {
    if (owner(state.points[i]) === seat && !inHome(seat, i)) return false;
  }
  return true;
}

/** Whether `seat` may land on point `to` (empty, own, or a lone opponent blot). */
function canLand(state: BackgammonState, to: number, seat: Seat): boolean {
  const o = owner(state.points[to]);
  return o === null || o === seat || Math.abs(state.points[to]) === 1;
}

/** Whether `seat` may bear a checker off point `p` with die `d` (exact or overshoot). */
function canBearOff(state: BackgammonState, seat: Seat, p: number, d: number): boolean {
  const distance = distanceToOff(seat, p);
  if (d === distance) return true;
  if (d < distance) return false;
  // Overshoot: legal only if no checker sits further from home than `p`.
  if (seat === 0) {
    for (let i = p + 1; i <= 5; i++) if (owner(state.points[i]) === 0) return false;
  } else {
    for (let i = 18; i < p; i++) if (owner(state.points[i]) === 1) return false;
  }
  return true;
}

/** Immediate moves before applying the maximum-dice and higher-die rules. */
function immediateBackgammonMoves(state: BackgammonState): BackgammonMove[] {
  if (state.winner !== null || state.dice.length === 0) return [];
  const seat = state.current;
  const dice = [...new Set(state.dice)];
  const moves: BackgammonMove[] = [];

  // A checker on the bar must re-enter before anything else moves.
  if (state.bar[seat] > 0) {
    for (const d of dice) {
      const to = entryPoint(seat, d);
      if (canLand(state, to, seat)) moves.push({ from: BAR, to, die: d });
    }
    return moves;
  }

  const home = allInHome(state, seat);
  for (let p = 0; p < POINT_COUNT; p++) {
    if (owner(state.points[p]) !== seat) continue;
    for (const d of dice) {
      const to = p + direction(seat) * d;
      if (to >= 0 && to < POINT_COUNT) {
        if (canLand(state, to, seat)) moves.push({ from: p, to, die: d });
      } else if (home && canBearOff(state, seat, p, d)) {
        moves.push({ from: p, to: OFF, die: d });
      }
    }
  }
  return moves;
}

/** Applies one known-legal checker step without deciding whether the turn ends. */
function applyBackgammonStep(state: BackgammonState, move: BackgammonMove): BackgammonState {
  const points = state.points.slice();
  const bar: [number, number] = [state.bar[0], state.bar[1]];
  const off: [number, number] = [state.off[0], state.off[1]];
  const seat = state.current;
  const opponent: Seat = seat === 0 ? 1 : 0;
  const s = sign(seat);

  const dice = state.dice.slice();
  const dieIndex = dice.indexOf(move.die);
  if (dieIndex < 0) throw new Error(`Die ${move.die} is not available`);
  dice.splice(dieIndex, 1);

  if (move.from === BAR) bar[seat]--;
  else points[move.from] -= s;

  if (move.to === OFF) {
    off[seat]++;
  } else {
    if (owner(points[move.to]) === opponent) {
      points[move.to] = 0; // hit the blot
      bar[opponent]++;
    }
    points[move.to] += s;
  }

  if (off[seat] === CHECKERS_PER_PLAYER) {
    return { points, bar, off, current: seat, dice, winner: seat };
  }

  return { points, bar, off, current: seat, dice, winner: null };
}

/** Every playable continuation, used to enforce Backgammon's dice-priority rules. */
function moveSequences(state: BackgammonState): BackgammonMove[][] {
  const moves = immediateBackgammonMoves(state);
  if (moves.length === 0) return [[]];

  const sequences: BackgammonMove[][] = [];
  for (const move of moves) {
    const next = applyBackgammonStep(state, move);
    for (const continuation of moveSequences(next)) {
      sequences.push([move, ...continuation]);
    }
  }
  return sequences;
}

function sameMove(a: BackgammonMove, b: BackgammonMove): boolean {
  return a.from === b.from && a.to === b.to && a.die === b.die;
}

/**
 * Legal first steps for the current dice. A player must use as many dice as
 * possible; when only one of two distinct dice can be used, the higher die wins.
 */
export function legalBackgammonMoves(state: BackgammonState): BackgammonMove[] {
  const sequences = moveSequences(state);
  const maxLength = Math.max(...sequences.map((sequence) => sequence.length));
  if (maxLength === 0) return [];

  let best = sequences.filter((sequence) => sequence.length === maxLength);
  if (state.dice.length === 2 && state.dice[0] !== state.dice[1] && maxLength === 1) {
    const higherDie = Math.max(...state.dice);
    const higherDieSequences = best.filter((sequence) => sequence[0].die === higherDie);
    if (higherDieSequences.length > 0) best = higherDieSequences;
  }

  const moves: BackgammonMove[] = [];
  for (const sequence of best) {
    const move = sequence[0];
    if (!moves.some((candidate) => sameMove(candidate, move))) moves.push(move);
  }
  return moves;
}

export function applyBackgammonMove(state: BackgammonState, move: BackgammonMove): BackgammonState {
  const next = applyBackgammonStep(state, move);
  if (next.winner !== null) return next;

  // The turn continues only while dice remain AND a legal move exists.
  if (next.dice.length === 0 || legalBackgammonMoves(next).length === 0) {
    const nextSeat: Seat = next.current === 0 ? 1 : 0;
    return { ...next, current: nextSeat, dice: [] };
  }
  return next;
}

/** Total pip count for `seat` (bar checkers count as the full 25). */
export function pipCount(state: BackgammonState, seat: Seat): number {
  let pips = state.bar[seat] * 25;
  for (let i = 0; i < POINT_COUNT; i++) {
    if (owner(state.points[i]) === seat) pips += Math.abs(state.points[i]) * distanceToOff(seat, i);
  }
  return pips;
}

function blotCount(state: BackgammonState, seat: Seat): number {
  let blots = 0;
  for (let i = 0; i < POINT_COUNT; i++) {
    if (owner(state.points[i]) === seat && Math.abs(state.points[i]) === 1) blots++;
  }
  return blots;
}

function evaluate(state: BackgammonState, seat: Seat): number {
  const opponent: Seat = seat === 0 ? 1 : 0;
  return (
    pipCount(state, opponent) -
    pipCount(state, seat) +
    (state.off[seat] - state.off[opponent]) * 30 +
    state.bar[opponent] * 20 -
    blotCount(state, seat) * 8
  );
}

/**
 * Greedy per-die bot: picks the single checker step yielding the best resulting
 * position (lower own pip, opponent hit, fewer blots). It plays a turn one die at
 * a time, so it hits blots and bears off sensibly without a deep search.
 */
export function bestBackgammonMove(state: BackgammonState): BackgammonMove | null {
  const moves = legalBackgammonMoves(state);
  if (moves.length === 0) return null;
  const seat = state.current;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = evaluate(applyBackgammonMove(state, move), seat);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

function currentSeat(state: BackgammonState): Seat {
  return state.current;
}

function winner(state: BackgammonState): Seat | null {
  return state.winner;
}

export const backgammonRules: TurnRules<BackgammonState, BackgammonMove> = {
  seats: 2,
  initialState: createBackgammonState,
  currentSeat,
  legalMoves: legalBackgammonMoves,
  applyMove: applyBackgammonMove,
  winner,
};
