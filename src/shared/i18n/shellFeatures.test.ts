import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The shared shell renders three things on *every* game page regardless of any
 * per-game flag: the Feedback control, the immersive/Zen fullscreen toggle, and
 * the scripts that power them. This guards against a refactor silently dropping
 * one — a behaviour that's otherwise invisible until you open a game.
 */
const shell = readFileSync(resolve(process.cwd(), 'src/partials/shell-open.hbs'), 'utf8');

describe('shell always-on features', () => {
  it('renders the Feedback control on every game', () => {
    expect(shell).toMatch(/id="feedbackControl"/);
    expect(shell).toMatch(/id="feedbackToggle"/);
    expect(shell).toMatch(/feedbackPanel\.ts/);
  });

  it('renders the Zen / immersive fullscreen toggle on every game', () => {
    expect(shell).toMatch(/game-fullscreen-toggle/);
    expect(shell).toMatch(/zenMode\.ts/);
  });

  it('wires the How-to-play (info) panel from a game’s controls', () => {
    expect(shell).toMatch(/game-info-panel/);
    expect(shell).toMatch(/data-i18n="howToPlay"/);
  });
});
