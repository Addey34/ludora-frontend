import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Locale routing parity. Every page must be reachable in both locales: English on
 * its clean URL and French under `/fr/…`. This pins `firebase.json` (prod Firebase
 * Hosting rewrites) and `public/sitemap.xml` to the game list + static pages, so
 * adding a page without its FR route/URL fails `verify`. Mirrors gamesStructure.test.ts.
 */
const root = process.cwd();
const firebaseJson = readFileSync(resolve(root, 'firebase.json'), 'utf8');
const sitemap = readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8');

const gameKeys = readdirSync(resolve(root, 'src/games')).filter(
  (name) => !name.startsWith('_') && statSync(resolve(root, 'src/games', name)).isDirectory()
);
// Static, non-game pages served like the games (see vite.config `static_pages`).
const staticPages = ['privacy', 'legal', 'profile', 'leaderboard', 'friends'];
const routes = [...gameKeys, ...staticPages];

describe('locale routing parity', () => {
  it.each(routes)('"%s" has an English and a French rewrite in firebase.json', (key) => {
    expect(firebaseJson, `source "/${key}" rewrite`).toContain(`"source": "/${key}"`);
    expect(firebaseJson, `source "/fr/${key}" rewrite`).toContain(`"source": "/fr/${key}"`);
  });

  it.each(routes)('"%s" is listed in both locales in the sitemap', (key) => {
    expect(sitemap, `/${key}</loc>`).toContain(`/${key}</loc>`);
    expect(sitemap, `/fr/${key}</loc>`).toContain(`/fr/${key}</loc>`);
  });

  it('routes the French home', () => {
    expect(firebaseJson).toContain('"source": "/fr"');
    expect(sitemap).toContain('/fr/</loc>');
  });
});
