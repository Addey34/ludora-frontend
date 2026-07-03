/**
 * Simon — pure logic, no DOM, no time. The whole game state is just the growing
 * sequence of pad indices; everything here is deterministic given an `rng`, so
 * it is trivially unit-testable (cf. the project's "pure rules" convention).
 */

/** Number of coloured pads. */
export const PADS = 4;

/** A pad index, 0..3 (top-left, top-right, bottom-left, bottom-right). */
export type Pad = number;

/**
 * Returns a NEW sequence with one extra random pad appended. Pure given `rng`
 * (defaults to `Math.random`), so tests can feed a deterministic generator.
 */
export function extendSequence(seq: readonly Pad[], rng: () => number = Math.random): Pad[] {
  return [...seq, Math.floor(rng() * PADS)];
}

/**
 * Playback interval (ms) between two flashes for a sequence of `length` steps:
 * it speeds up as the sequence grows, clamped so it never becomes unplayable.
 */
export function flashInterval(length: number): number {
  return Math.max(320, 700 - length * 30);
}
