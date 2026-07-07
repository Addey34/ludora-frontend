import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATALOG } from './i18n.js';

/**
 * Structural integrity of the game pages. Pure Vitest logic can't load a page,
 * but it can catch the drift that breaks one: a game folder missing its entry
 * HTML, its `*-main.ts` module, its SVG icon, or its i18n name. This is the cheap
 * safety net for "adding a game = one folder + one vite.config entry".
 */
const root = process.cwd();
const gamesDir = resolve(root, 'src/games');
const iconsDir = resolve(root, 'public/icons');

const gameKeys = readdirSync(gamesDir).filter((name) =>
  statSync(resolve(gamesDir, name)).isDirectory()
);

describe('game pages structure', () => {
  it('discovers the game folders', () => {
    expect(gameKeys.length).toBeGreaterThan(0);
  });

  it.each(gameKeys)('"%s" has its entry HTML, main module, icon and i18n name', (key) => {
    const dir = resolve(gamesDir, key);
    expect(existsSync(resolve(dir, 'index.html')), `${key}/index.html`).toBe(true);
    expect(existsSync(resolve(dir, `${key}-main.ts`)), `${key}/${key}-main.ts`).toBe(true);
    expect(existsSync(resolve(iconsDir, `${key}.svg`)), `icons/${key}.svg`).toBe(true);
    expect(CATALOG.en[`game_${key}`], `game_${key} i18n key`).toBeTruthy();
  });

  it('has no orphan game icons (every icon maps to a game)', () => {
    const games = new Set(gameKeys);
    const orphans = readdirSync(iconsDir)
      .filter((f) => f.endsWith('.svg'))
      .map((f) => f.replace(/\.svg$/, ''))
      .filter((name) => !games.has(name));
    expect(orphans, `unused icons in public/icons: ${orphans.join(', ')}`).toEqual([]);
  });
});
