// Generate a slim Font Awesome stylesheet that ships ONLY the icons the app
// actually uses. Font Awesome's full `all.min.css` is ~89 KB (render-blocking in
// <head> on every page) yet we use ~90 solid glyphs out of ~1600. This reads the
// committed full FA6 CSS (scripts/assets/fontawesome-full.css), scans the source
// for used icons, and writes a minimal stylesheet to the served vendor path.
//
// Reproducible and dependency-free (pure string parsing) — runs anywhere,
// including CI and the Render build. Run with `npm run icons`. A parity test
// (src/shared/ui/faIcons.test.ts) fails `npm run verify` if a newly-used icon
// is missing from the generated file, so the two never drift.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'scripts/assets/fontawesome-full.css');
const OUT = join(ROOT, 'public/vendor/fontawesome/css/all.min.css');
const SCAN_DIRS = [join(ROOT, 'src'), join(ROOT, 'public/css')];
// vite.config.ts is the single source of truth for the game list AND the sidebar
// category `icon:` classes (fa-brain, fa-chess, …), so it must be scanned too or
// those category icons would be dropped from the subset and render blank.
const SCAN_FILES = [join(ROOT, 'vite.config.ts')];
const SCAN_EXT = new Set(['.hbs', '.html', '.ts', '.css']);

/** Recursively collect files under a dir with a scannable extension. */
function walk(dir, out = []) {
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

/**
 * Scan the source for every used solid icon name. Two shapes:
 *  - static markup / css: `fa-<name>` class tokens
 *  - HUD icons: `icon: '<name>'` (bare, hud.ts renders `fas fa-${name}`) and
 *    sidebar category `icon: 'fa-<name>'` (already prefixed) in vite.config.ts.
 * Excludes the style aliases (fa-solid/regular/…) which are not glyphs.
 */
function usedIconNames(files) {
  const STYLE_ALIASES = new Set(['solid', 'regular', 'brands', 'light', 'thin', 'duotone']);
  const names = new Set();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/fa-([a-z0-9]+(?:-[a-z0-9]+)*)/g)) {
      if (!STYLE_ALIASES.has(m[1])) names.add(m[1]);
    }
    if (file.endsWith('.ts')) {
      // strip a leading `fa-` so `icon: 'fa-bolt'` and `icon: 'bomb'` both land as bare names
      for (const m of text.matchAll(/\bicon:\s*'([a-z0-9-]+)'/g))
        names.add(m[1].replace(/^fa-/, ''));
    }
  }
  return names;
}

/** Parse `.fa-<name>:before{content:"\fXXX"}` (incl. grouped aliases) → Map name→codepoint. */
function codepointMap(fullCss) {
  const map = new Map();
  for (const m of fullCss.matchAll(/([^{}]*?):before\{content:"(\\[0-9a-f]+)"\}/g)) {
    const codepoint = m[2];
    for (const sel of m[1].matchAll(/\.fa-([a-z0-9-]+)/g)) map.set(sel[1], codepoint);
  }
  return map;
}

/** The solid @font-face, woff2 only (the .ttf fallback file is not shipped). */
function solidFontFace(fullCss) {
  const block = fullCss.match(
    /@font-face\{font-family:"Font Awesome 6 Free";[^}]*?fa-solid-900\.woff2[^}]*\}/
  );
  if (!block) throw new Error('solid @font-face not found in source FA CSS');
  return block[0].replace(/,url\([^)]*\.ttf\)\s*format\("truetype"\)/, '');
}

function build() {
  const fullCss = readFileSync(SOURCE, 'utf8');
  const files = SCAN_DIRS.flatMap((dir) => walk(dir)).concat(SCAN_FILES);
  const used = [...usedIconNames(files)].sort();
  const map = codepointMap(fullCss);

  const missing = used.filter((n) => !map.has(n));
  if (missing.length) {
    console.error('✖ Used FA icons with no glyph in free FA6 (fix the name):', missing.join(', '));
    process.exit(1);
  }

  const header =
    '/*! Font Awesome Free 6.0.0 (subset) — CC BY 4.0 / SIL OFL 1.1 / MIT — https://fontawesome.com */\n';
  const base =
    '.fa,.fas,.fa-solid{font-family:"Font Awesome 6 Free";font-weight:900;' +
    '-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;' +
    'display:var(--fa-display,inline-block);font-style:normal;font-variant:normal;' +
    'line-height:1;text-rendering:auto}';
  const glyphs = used.map((n) => `.fa-${n}:before{content:"${map.get(n)}"}`).join('');

  writeFileSync(OUT, header + solidFontFace(fullCss) + base + glyphs + '\n');
  console.log(`✓ Wrote ${used.length} icons to ${OUT.replace(ROOT, '.')}`);
}

// Only generate when run directly (`npm run icons`), not when the parity test
// imports `usedIconNames` from this module.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) build();
