import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

/**
 * Source-hygiene guard. A UTF-8 byte-order mark (EF BB BF) at the start of a
 * `.ts`/`.css`/`.html` file is invisible in most editors, can trip tooling, and
 * slips past Prettier (which preserves it) — so the usual format check won't
 * catch it. This integrity test does, keeping the tree BOM-free.
 */
const root = process.cwd();
const SCAN_DIRS = ['src', 'public/css', 'scripts'];
const SOURCE_EXT = /\.(ts|tsx|js|mjs|cjs|html|css)$/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (SOURCE_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((dir) => walk(resolve(root, dir)));

describe('source hygiene', () => {
  it('discovers source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('has no source file starting with a UTF-8 BOM', () => {
    const offenders = files
      .filter((file) => {
        const buf = readFileSync(file);
        return buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
      })
      .map((file) => relative(root, file));
    expect(offenders, `files with a UTF-8 BOM: ${offenders.join(', ')}`).toEqual([]);
  });
});
