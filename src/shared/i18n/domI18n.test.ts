import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATALOG } from './i18n.js';

/**
 * Markup i18n coverage: every static `data-i18n` / `data-i18n-aria` /
 * `data-i18n-html` key in the partials and game pages must resolve in the
 * catalog (English source + a French entry). Dynamic keys built by Handlebars
 * (`{{…}}`) are skipped — those are covered by the control-line and structure
 * tests. Catches "added a labelled element, forgot to translate it".
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

/** Every literal data-i18n* key found across the partials and game HTML. */
function markupKeys(): Set<string> {
  const files = [
    ...walk(resolve(root, 'src/partials'), ['.hbs']),
    ...walk(resolve(root, 'src/games'), ['index.html']),
  ];
  const keys = new Set<string>();
  const re = /data-i18n(?:-aria|-label|-html)?="([^"]+)"/g;
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const key = m[1];
      if (key.includes('{{')) continue; // dynamic Handlebars key — skip
      keys.add(key);
    }
  }
  return keys;
}

const keys = [...markupKeys()];

describe('markup i18n coverage', () => {
  it('finds translatable markup keys', () => {
    expect(keys.length).toBeGreaterThan(5);
  });

  it.each(keys)('"%s" exists in the English catalog', (key) => {
    // A control line uses its own English text as the key (identity); base keys
    // must have a real entry. Either way the key must be present.
    expect(key in CATALOG.en, `data-i18n="${key}" missing from CATALOG.en`).toBe(true);
  });

  it.each(keys)('"%s" exists in the French catalog', (key) => {
    expect(key in CATALOG.fr, `data-i18n="${key}" missing from CATALOG.fr`).toBe(true);
  });
});
