import { describe, expect, it } from 'vitest';
import { Fleet } from './battleship.js';
import { decideShot } from './battleshipBot.js';

function emptyFleet(): Fleet {
  return { ships: [], shots: {}, sunkIds: [] };
}

const rngZero = () => 0;

describe('decideShot', () => {
  it('easy always returns a random (unshot) cell', () => {
    const fleet = emptyFleet();
    const shot = decideShot(fleet, 'easy', rngZero);
    expect(shot).toMatchObject({ row: expect.any(Number), col: expect.any(Number) });
    expect(fleet.shots[`${shot.row},${shot.col}`]).toBeUndefined();
  });

  it('medium targets an adjacent cell when there is a hit', () => {
    const fleet: Fleet = {
      ships: [],
      shots: { '5,5': 'hit' },
      sunkIds: [],
    };
    // rollChase avec medium (0.55) : rng → 0 < 0.55, so smart
    const shot = decideShot(fleet, 'medium', rngZero);
    // The shot must be adjacent to (5,5)
    const adjacent =
      (shot.row === 4 && shot.col === 5) ||
      (shot.row === 6 && shot.col === 5) ||
      (shot.row === 5 && shot.col === 4) ||
      (shot.row === 5 && shot.col === 6);
    expect(adjacent).toBe(true);
  });

  it('medium ignores a hit already belonging to a sunk ship', () => {
    // If the cell is 'sunk' rather than 'hit', it isn't in unsunkHits.
    const fleet: Fleet = {
      ships: [],
      shots: { '5,5': 'sunk' },
      sunkIds: [],
    };
    // smart mode, no unsunk hits → goes to hunt (random)
    const shot = decideShot(fleet, 'medium', rngZero);
    // Must not be the already-shot cell
    expect(`${shot.row},${shot.col}`).not.toBe('5,5');
  });

  it('hard never shoots a cell with (row+col) % 2 !== 0 when parity cells exist', () => {
    // Leave every cell free; hard must use parity while hunting.
    const fleet = emptyFleet();
    // Several hard draws: all must respect the parity
    for (let i = 0; i < 10; i++) {
      const rng = () => i / 10;
      const shot = decideShot(fleet, 'hard', rng);
      expect((shot.row + shot.col) % 2).toBe(0);
    }
  });

  it('never returns an already-shot cell', () => {
    const shots: Fleet['shots'] = {};
    // Shot all cells except (0,0)
    for (let row = 0; row < 10; row++)
      for (let col = 0; col < 10; col++)
        if (!(row === 0 && col === 0)) shots[`${row},${col}`] = 'miss';
    const fleet: Fleet = { ships: [], shots, sunkIds: [] };
    const shot = decideShot(fleet, 'hard', rngZero);
    expect(shot).toEqual({ row: 0, col: 0 });
  });
});
