import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/**
 * Guards the Font Awesome subset (scripts/build-icons.mjs → the served
 * all.min.css): every icon the source actually uses must be present in the
 * shipped, slimmed stylesheet. So if someone adds `fa-<new>` or a HUD
 * `icon: '<new>'` but forgets to run `npm run icons`, `npm run verify` fails
 * here instead of the icon silently rendering blank in production.
 *
 * The scan mirrors the generator's (kept independent on purpose: the test
 * verifies the shipped file rather than trusting the generator's own scanner).
 */
const ROOT = join(__dirname, '../../..');
const SHIPPED = join(ROOT, 'public/vendor/fontawesome/css/all.min.css');
const SCAN_EXT = new Set(['.hbs', '.html', '.ts', '.css']);
const STYLE_ALIASES = new Set(['solid', 'regular', 'brands', 'light', 'thin', 'duotone']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'vendor' || entry === 'node_modules') continue;
      walk(full, out);
    } else if (SCAN_EXT.has(extname(full)) && !/\.(test|spec)\.ts$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function usedIconNames(files: string[]): string[] {
  const names = new Set<string>();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/fa-([a-z0-9]+(?:-[a-z0-9]+)*)/g)) {
      if (!STYLE_ALIASES.has(m[1])) names.add(m[1]);
    }
    if (file.endsWith('.ts')) {
      for (const m of text.matchAll(/\bicon:\s*'([a-z0-9-]+)'/g)) names.add(m[1]);
    }
  }
  return [...names].sort();
}

describe('Font Awesome subset', () => {
  const css = readFileSync(SHIPPED, 'utf8');
  const used = usedIconNames(walk(join(ROOT, 'src')).concat(walk(join(ROOT, 'public/css'))));

  it('ships every used icon (run `npm run icons` after adding one)', () => {
    const missing = used.filter((name) => !css.includes(`.fa-${name}:before{`));
    expect(missing, `missing from all.min.css: ${missing.join(', ')}`).toEqual([]);
  });

  it('ships the solid font and no unused font files', () => {
    expect(css).toContain('fa-solid-900.woff2');
    expect(css).not.toContain('fa-regular-400');
    expect(css).not.toContain('fa-v4compatibility');
    expect(css).not.toContain('.ttf');
  });
});
