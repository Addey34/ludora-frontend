import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATALOG } from './i18n.js';

/**
 * Dead-translation guard: flags catalog keys that nothing references, so the
 * `en`/`fr` tables don't slowly fill with orphans over the life of the project.
 *
 * A key counts as "used" if it's called literally (`t('key')`), marked in the
 * markup (`data-i18n="key"`), or authored as a control line in vite.config.ts
 * (whose English text *is* the key). Keys built at runtime from a variable
 * (`game_<key>`, `ship_<id>`, the difficulty tiers…) can't be seen statically,
 * so their known prefixes are allow-listed below.
 */

const root = process.cwd();

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

/**
 * Keys referenced through `t(…)`. To also catch ternaries (`t(c ? 'a' : 'b')`)
 * and multi-arg calls, any quoted identifier on a line that calls `t(` counts —
 * erring toward "used" (a false-negative is harmless; a false-positive isn't).
 */
function tKeys(): Set<string> {
  const keys = new Set<string>();
  const lit = /['"]([A-Za-z0-9_]+)['"]/g;
  for (const file of walk(resolve(root, 'src'), ['.ts', '.hbs', '.html'])) {
    if (file.endsWith('.test.ts')) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.includes('t(')) continue;
      let m: RegExpExecArray | null;
      while ((m = lit.exec(line))) keys.add(m[1]);
    }
  }
  return keys;
}

/** Keys marked via data-i18n* — in the partials/pages AND TS-built markup. */
function markupKeys(): Set<string> {
  const keys = new Set<string>();
  const re = /data-i18n(?:-aria|-label|-html|-placeholder)?=["'`]([^"'`{]+)["'`]/g; // skip {{dynamic}}
  for (const file of walk(resolve(root, 'src'), ['.hbs', '.html', '.ts'])) {
    if (file.endsWith('.test.ts')) continue;
    const src = readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) keys.add(m[1]);
  }
  return keys;
}

/** Control lines from vite.config.ts — their English text is the catalog key. */
function controlKeys(): Set<string> {
  const src = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
  const keys = new Set<string>();
  const re = /\b(?:keys|action):\s*(['"])((?:\\.|(?!\1).)*)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) keys.add(m[2].replace(/\\'/g, "'"));
  return keys;
}

/** Game keys → the `game_<key>` names resolved dynamically in the shell/sidebar. */
function gameNameKeys(): Set<string> {
  const dir = resolve(root, 'src/games');
  const keys = new Set<string>();
  for (const name of readdirSync(dir)) {
    if (statSync(resolve(dir, name)).isDirectory()) keys.add(`game_${name}`);
  }
  return keys;
}

/** Prefixes/keys built from a variable at runtime (can't be seen statically). */
const DYNAMIC_ALLOW = [
  /^game_/, // game_<key> (game titles)
  /^ship_/, // ship_<id> (battleship ship names)
  /^cat_/, // cat_<id> (home categories, if present)
];
const DYNAMIC_KEYS = new Set(['easy', 'medium', 'hard']); // t(this.difficulty)

describe('i18n has no dead keys', () => {
  const used = new Set<string>([...tKeys(), ...markupKeys(), ...controlKeys(), ...gameNameKeys()]);

  const unused = Object.keys(CATALOG.en).filter(
    (key) => !used.has(key) && !DYNAMIC_KEYS.has(key) && !DYNAMIC_ALLOW.some((re) => re.test(key))
  );

  it('every catalog key is referenced somewhere', () => {
    expect(unused, `unused i18n keys:\n${unused.join('\n')}`).toEqual([]);
  });
});
