/**
 * Battleship — pure rules (no DOM, no time, no randomness).
 * Testable in isolation (`battleship.test.ts`). Plugs into the turn-based engine
 * via {@link TurnRules} for the combat phase only.
 *
 * 10×10 grid, 5 standard ships. Each player places their fleet (a phase handled
 * by the controller), then players fire in turn at the opponent's grid.
 * The first to sink all the enemy ships wins.
 */

import { Seat, TurnRules, nextSeat } from '../../shared/turn/turnGame.js';

export const GRID_SIZE = 10;
export const SEATS = 2;

/** Standard fleet, ordered largest to smallest (placement order). */
export const SHIP_DEFS = [
  { id: 'carrier', size: 5, label: 'Carrier' },
  { id: 'battleship', size: 4, label: 'Battleship' },
  { id: 'cruiser', size: 3, label: 'Cruiser' },
  { id: 'submarine', size: 3, label: 'Submarine' },
  { id: 'destroyer', size: 2, label: 'Destroyer' },
] as const;

export type ShipId = (typeof SHIP_DEFS)[number]['id'];
export type Orientation = 'h' | 'v';

export interface ShipPlacement {
  id: ShipId;
  size: number;
  row: number;
  col: number;
  orientation: Orientation;
}

export type ShotResult = 'miss' | 'hit' | 'sunk';

export interface Fleet {
  ships: ShipPlacement[];
  /** Shots received by this fleet, keyed `row,col`. */
  shots: Record<string, ShotResult>;
  sunkIds: ShipId[];
}

export interface BattleshipState {
  fleets: [Fleet, Fleet];
  current: Seat;
  winner: Seat | null;
}

export type BattleshipMove = { row: number; col: number };

export const eqMove = (a: BattleshipMove, b: BattleshipMove): boolean =>
  a.row === b.row && a.col === b.col;

/** Canonical key for a grid cell. */
export const cellKey = (row: number, col: number): string => `${row},${col}`;

/** All the cells occupied by a placed ship. */
export function shipCells(ship: ShipPlacement): { row: number; col: number }[] {
  return Array.from({ length: ship.size }, (_, i) => ({
    row: ship.orientation === 'v' ? ship.row + i : ship.row,
    col: ship.orientation === 'h' ? ship.col + i : ship.col,
  }));
}

/** True if `candidate` fits inside the grid and overlaps no `existing` ship. */
export function isValidPlacement(existing: ShipPlacement[], candidate: ShipPlacement): boolean {
  const cells = shipCells(candidate);
  for (const c of cells) {
    if (c.row < 0 || c.row >= GRID_SIZE || c.col < 0 || c.col >= GRID_SIZE) return false;
  }
  const occupied = new Set(existing.flatMap((s) => shipCells(s).map((c) => cellKey(c.row, c.col))));
  return cells.every((c) => !occupied.has(cellKey(c.row, c.col)));
}

/** Places the full fleet at random; `rng` is injectable for tests. */
export function randomFleet(rng: () => number = Math.random): ShipPlacement[] {
  const placed: ShipPlacement[] = [];
  for (const def of SHIP_DEFS) {
    let ok = false;
    while (!ok) {
      const orientation: Orientation = rng() < 0.5 ? 'h' : 'v';
      const maxRow = orientation === 'v' ? GRID_SIZE - def.size : GRID_SIZE - 1;
      const maxCol = orientation === 'h' ? GRID_SIZE - def.size : GRID_SIZE - 1;
      const row = Math.floor(rng() * (maxRow + 1));
      const col = Math.floor(rng() * (maxCol + 1));
      const candidate: ShipPlacement = { id: def.id, size: def.size, row, col, orientation };
      if (isValidPlacement(placed, candidate)) {
        placed.push(candidate);
        ok = true;
      }
    }
  }
  return placed;
}

/** A blank fleet ready for combat. */
export function emptyFleet(ships: ShipPlacement[]): Fleet {
  return { ships, shots: {}, sunkIds: [] };
}

/** Initial combat state from the placed fleets. */
export function initialState(fleet0: ShipPlacement[], fleet1: ShipPlacement[]): BattleshipState {
  return { fleets: [emptyFleet(fleet0), emptyFleet(fleet1)], current: 0, winner: null };
}

export function currentSeat(state: BattleshipState): Seat {
  return state.current;
}

/** All the cells not yet fired at on the opponent's grid. */
export function legalMoves(state: BattleshipState): BattleshipMove[] {
  if (state.winner !== null) return [];
  const opp = state.fleets[1 - state.current];
  const moves: BattleshipMove[] = [];
  for (let row = 0; row < GRID_SIZE; row++)
    for (let col = 0; col < GRID_SIZE; col++)
      if (!opp.shots[cellKey(row, col)]) moves.push({ row, col });
  return moves;
}

/** Applies a shot; returns the new state (without mutating the old one). */
export function applyMove(state: BattleshipState, move: BattleshipMove): BattleshipState {
  const oppIdx = 1 - state.current;
  const oldFleet = state.fleets[oppIdx];
  const key = cellKey(move.row, move.col);
  const shots = { ...oldFleet.shots };
  const sunkIds = [...oldFleet.sunkIds] as ShipId[];

  const hitShip = oldFleet.ships.find((s) =>
    shipCells(s).some((c) => c.row === move.row && c.col === move.col)
  );

  if (hitShip) {
    const cells = shipCells(hitShip);
    const allNowHit = cells.every((c) => {
      const k = cellKey(c.row, c.col);
      return k === key || shots[k] === 'hit' || shots[k] === 'sunk';
    });
    if (allNowHit) {
      for (const c of cells) shots[cellKey(c.row, c.col)] = 'sunk';
      sunkIds.push(hitShip.id);
    } else {
      shots[key] = 'hit';
    }
  } else {
    shots[key] = 'miss';
  }

  const newFleet: Fleet = { ...oldFleet, shots, sunkIds };
  const fleets: [Fleet, Fleet] =
    oppIdx === 0 ? [newFleet, state.fleets[1]] : [state.fleets[0], newFleet];

  const won = sunkIds.length === oldFleet.ships.length;
  return {
    fleets,
    current: won ? state.current : nextSeat(state.current, SEATS),
    winner: won ? state.current : null,
  };
}

export function winner(state: BattleshipState): Seat | null {
  return state.winner;
}

/**
 * Returns a copy of `fleet` without the ships that aren't sunk yet.
 * Used when broadcasting over the network: the opponent must not see
 * where the host's intact ships are.
 */
export function sanitizeFleet(fleet: Fleet): Fleet {
  return {
    ...fleet,
    ships: fleet.ships.filter((s) => (fleet.sunkIds as string[]).includes(s.id)),
  };
}

export const rules: TurnRules<BattleshipState, BattleshipMove> = {
  seats: SEATS,
  initialState: () => initialState([], []),
  currentSeat,
  legalMoves,
  applyMove,
  winner,
};
