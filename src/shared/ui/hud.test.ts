import { describe, it, expect, beforeEach } from 'vitest';
import { setupHud } from './hud.js';

describe('setupHud', () => {
  let bar: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div class="game-details"></div>';
    bar = document.querySelector('.game-details')!;
  });

  it('renders one chip per stat, hidden until set', () => {
    setupHud([
      { key: 'score', icon: 'star', label: 'Score' },
      { key: 'time', icon: 'clock', label: 'Time' },
    ]);
    const chips = bar.querySelectorAll('.game-stat');
    expect(chips).toHaveLength(2);
    expect(bar.querySelector('[data-stat="time"] i')?.className).toBe('fas fa-clock');
    expect(chips[0].hasAttribute('hidden')).toBe(true);
    expect(bar.querySelector('[data-stat="score"]')?.getAttribute('aria-label')).toBe('Score');
  });

  it('set() writes the value and reveals the chip; 0 still shows', () => {
    const hud = setupHud([{ key: 'score', icon: 'star', label: 'Score' }]);
    hud.set('score', 0);
    const chip = bar.querySelector<HTMLElement>('[data-stat="score"]')!;
    expect(chip.hidden).toBe(false);
    expect(chip.querySelector('.game-stat-value')?.textContent).toBe('0');
  });

  it('set() with empty/null hides the chip', () => {
    const hud = setupHud([{ key: 'time', icon: 'clock', label: 'Time' }]);
    hud.set('time', 12);
    const chip = bar.querySelector<HTMLElement>('[data-stat="time"]')!;
    expect(chip.hidden).toBe(false);
    hud.set('time', null);
    expect(chip.hidden).toBe(true);
    expect(chip.querySelector('.game-stat-value')?.textContent).toBe('');
  });

  it('set() is a no-op for an undeclared key', () => {
    const hud = setupHud([{ key: 'score', icon: 'star', label: 'Score' }]);
    expect(() => hud.set('nope', 5)).not.toThrow();
  });

  it('marks the bar with visible stat classes', () => {
    const hud = setupHud([
      { key: 'score', icon: 'star', label: 'Score' },
      { key: 'high', icon: 'trophy', label: 'Best' },
    ]);
    hud.set('score', 42);
    hud.set('high', 99);
    expect(bar.classList.contains('has-score-stat')).toBe(true);
    expect(bar.classList.contains('has-high-stat')).toBe(true);
    hud.set('score', null);
    expect(bar.classList.contains('has-score-stat')).toBe(false);
    expect(bar.classList.contains('has-high-stat')).toBe(true);
  });

  it('clears stale visible stat classes when rebuilt with different stats', () => {
    const hud = setupHud([{ key: 'score', icon: 'star', label: 'Score' }]);
    hud.set('score', 10);
    expect(bar.classList.contains('has-score-stat')).toBe(true);

    setupHud([{ key: 'time', icon: 'clock', label: 'Time' }]);
    expect(bar.classList.contains('has-score-stat')).toBe(false);
  });

  it('toggle() flips a modifier class on the chip', () => {
    const hud = setupHud([{ key: 'time', icon: 'clock', label: 'Time' }]);
    const chip = bar.querySelector<HTMLElement>('[data-stat="time"]')!;
    hud.toggle('time', 'is-low', true);
    expect(chip.classList.contains('is-low')).toBe(true);
    hud.toggle('time', 'is-low', false);
    expect(chip.classList.contains('is-low')).toBe(false);
  });

  it('rebuilding clears its own chips but keeps sibling markup', () => {
    bar.innerHTML = '<div class="ludo-players"></div>';
    setupHud([{ key: 'time', icon: 'clock', label: 'Time' }]);
    setupHud([{ key: 'time', icon: 'clock', label: 'Time' }]);
    expect(bar.querySelectorAll('.game-stat')).toHaveLength(1);
    expect(bar.querySelector('.ludo-players')).not.toBeNull();
  });

  /** The rendered chips in left→right DOM order. */
  const renderedKeys = (): string[] =>
    [...bar.querySelectorAll('.game-stat')].map((el) => (el as HTMLElement).dataset.stat!);

  it('renders chips in the canonical order, not the declared order', () => {
    // Declared deliberately scrambled: best, time, score, opponent, turn.
    setupHud([
      { key: 'high', icon: 'trophy', label: 'Best' },
      { key: 'time', icon: 'clock', label: 'Time' },
      { key: 'score', icon: 'star', label: 'Score' },
      { key: 'opponent', icon: 'user', label: 'Opponent' },
      { key: 'turn', icon: 'circle-dot', label: 'Turn' },
    ]);
    // turn → score → time → best → opponent.
    expect(renderedKeys()).toEqual(['turn', 'score', 'time', 'high', 'opponent']);
  });

  it('keeps declaration order among stats of equal rank (stable)', () => {
    // Battleship: two per-side counters share no rank collision, but pip-style
    // ties must not reorder. `moves` and `score` are both primary-metric rank.
    setupHud([
      { key: 'score', icon: 'star', label: 'Score' },
      { key: 'moves', icon: 'shoe-prints', label: 'Moves' },
    ]);
    expect(renderedKeys()).toEqual(['score', 'moves']);
  });

  it('sorts an unknown game-specific stat just after the primary metric', () => {
    setupHud([
      { key: 'time', icon: 'clock', label: 'Time' },
      { key: 'wobble', icon: 'star', label: 'Wobble' }, // unlisted → DEFAULT_ORDER
      { key: 'score', icon: 'star', label: 'Score' },
    ]);
    expect(renderedKeys()).toEqual(['score', 'wobble', 'time']);
  });
});
