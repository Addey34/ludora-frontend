import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATALOG } from './i18n.js';

/**
 * Integrity guard for the per-game "How to play" control lines. Their English
 * text (authored as `keys:` / `action:` in `vite.config.ts`) doubles as the
 * translation key, with the French side stored in `CONTROLS_FR` and the English
 * side generated as identity (see i18n.ts). This test reads the config the same
 * way the build does and asserts that every translatable line actually has a
 * French rendering — so a new game with untranslated controls fails CI instead of
 * silently showing English under the French locale.
 */

/** Pulls every controls `keys:` / `action:` string literal out of vite.config.ts. */
function controlStrings(): string[] {
  const src = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
  const out = new Set<string>();
  const re = /\b(?:keys|action):\s*(['"])((?:\\.|(?!\1).)*)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.add(m[2].replace(/\\'/g, "'"));
  return [...out];
}

/**
 * Whether a line needs no French entry: keycaps inside `<kbd>…</kbd>` stay as
 * authored (like WASD), so we strip whole `<kbd>` spans and only require a French
 * entry when translatable words remain outside them.
 */
function isKeycapOnly(s: string): boolean {
  return !/[a-z]/i.test(s.replace(/<kbd>.*?<\/kbd>/g, ''));
}

describe('control-line i18n', () => {
  const strings = controlStrings();

  it('finds the control strings in vite.config.ts', () => {
    expect(strings.length).toBeGreaterThan(50);
  });

  it('every translatable control line has a French entry', () => {
    const missing = strings.filter((s) => !isKeycapOnly(s) && !(s in CATALOG.fr));
    expect(missing, 'missing French translations').toEqual([]);
  });

  it('no control line collides with a base catalog key', () => {
    // A control string is looked up by its own English text, so its generated
    // English entry must be the identity (`value === key`). If it instead matched
    // a short base id, that base translation would be shadowed — this catches it.
    const collisions = strings.filter((s) => s in CATALOG.en && CATALOG.en[s] !== s);
    expect(collisions, 'control strings shadowing base keys').toEqual([]);
  });
});
