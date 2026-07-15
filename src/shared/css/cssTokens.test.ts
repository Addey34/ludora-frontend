import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

/**
 * CSS design-token integrity: every `var(--token)` referenced in the stylesheets
 * must resolve to a token defined somewhere in `public/css/**` (or be provided at
 * runtime — see WHITELIST). A missing token is not an error in CSS: the browser
 * silently drops the declaration and falls back to the inherited/initial value,
 * so a typo like `var(--shadow-md)` (there is only `--shadow`) fails invisibly.
 * This test turns that class of bug into a red build.
 *
 * The single source of truth for tokens is `public/css/base/variables.css`
 * (+ the per-theme overrides in `components/themes.css`); see the "Assets and
 * styling" section of CLAUDE.md.
 */

const root = process.cwd();
const cssRoot = resolve(root, 'public/css');

/**
 * Tokens NOT defined in CSS because they are injected at runtime — set via
 * `element.style.setProperty('--x', …)` in a game's TS, or via an inline
 * `style="--x: …"` in a partial/page. Kept in sync by hand; adding a game that
 * introduces a new dynamic token means adding it here.
 */
const WHITELIST = new Set<string>([
  // JS `setProperty` (per-game renderers / layout sizing)
  '--bi-size',
  '--cell-size',
  '--col',
  '--cols',
  '--db-owner',
  '--dice-accent',
  '--drop-from',
  '--game-icon',
  '--kak-cols',
  '--kak-rows',
  '--len',
  '--memory-icon',
  '--move-ms',
  '--n',
  '--nav-accent',
  '--row',
  '--rows',
  '--seat-color',
  '--ship-size',
  '--size',
  '--sol-ch',
  '--sol-cw',
  '--template-cell-size',
  // Inline `style="--x: …"` in markup
  '--cat-accent',
  '--title-color',
]);

function walk(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, ext));
    else if (name.endsWith(ext)) out.push(full);
  }
  return out;
}

/** Strip CSS block comments so tokens named in prose don't count as defs/refs. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const files = walk(cssRoot, '.css');

const defined = new Set<string>();
/** token -> list of "file:line" where it is referenced */
const references = new Map<string, string[]>();

const DEF_RE = /(--[\w-]+)\s*:/g;
const REF_RE = /var\(\s*(--[\w-]+)/g;

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/');
  const src = stripComments(readFileSync(file, 'utf8'));
  const lines = src.split('\n');

  for (const [i, line] of lines.entries()) {
    // A declaration `--token:` defines it. `var(--token)` on the same line is a
    // reference, never a definition, so gather refs first then blank them out.
    let m: RegExpExecArray | null;
    REF_RE.lastIndex = 0;
    while ((m = REF_RE.exec(line))) {
      const token = m[1];
      const at = `${rel}:${i + 1}`;
      (references.get(token) ?? references.set(token, []).get(token)!).push(at);
    }
    const withoutRefs = line.replace(REF_RE, 'var(');
    DEF_RE.lastIndex = 0;
    while ((m = DEF_RE.exec(withoutRefs))) defined.add(m[1]);
  }
}

const referencedTokens = [...references.keys()].sort();

describe('CSS design tokens', () => {
  it('parses the stylesheets', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(defined.has('--primary-color')).toBe(true);
    expect(referencedTokens.length).toBeGreaterThan(50);
  });

  it.each(referencedTokens)('var(%s) resolves to a defined token', (token) => {
    const ok = defined.has(token) || WHITELIST.has(token);
    const where = references.get(token)!.slice(0, 5).join(', ');
    expect(ok, `var(${token}) is never defined (first uses: ${where})`).toBe(true);
  });
});
