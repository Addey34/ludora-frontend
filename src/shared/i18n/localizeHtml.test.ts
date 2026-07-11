import { describe, it, expect } from 'vitest';
import { rewriteNavPath, translateHtml } from './localizeHtml.js';
import { CATALOG } from './i18n.js';

describe('rewriteNavPath', () => {
  it('prefixes internal page paths with /fr for French', () => {
    expect(rewriteNavPath('/snake', 'fr')).toBe('/fr/snake');
    expect(rewriteNavPath('/', 'fr')).toBe('/fr/');
    expect(rewriteNavPath('/profile', 'fr')).toBe('/fr/profile');
  });

  it('leaves English untouched', () => {
    expect(rewriteNavPath('/snake', 'en')).toBe('/snake');
  });

  it('never rewrites assets, files, externals, anchors or already-localized paths', () => {
    for (const href of [
      '/css/home.css',
      '/icons/snake.svg',
      '/favicon.svg',
      '/vendor/fontawesome/css/all.min.css',
      'https://example.com/x',
      '//cdn.example.com/x',
      'mailto:a@b.com',
      '#section',
      '/fr/snake',
    ]) {
      expect(rewriteNavPath(href, 'fr'), href).toBe(href);
    }
  });
});

describe('translateHtml', () => {
  const page = [
    '<!doctype html>',
    '<html lang="en">',
    '<head><link rel="canonical" href="https://games-zone.onrender.com/snake" />',
    '<meta property="og:url" content="https://games-zone.onrender.com/snake" /></head>',
    '<body>',
    '<h1 data-i18n="home">Home</h1>',
    '<input data-i18n-placeholder="leaderboardSearch" />',
    '<a href="/snake">go</a>',
    '<a href="/css/x.css">asset</a>',
    '<script>var a = 1 < 2;</script>',
    '</body></html>',
  ].join('\n');

  it('returns English unchanged', () => {
    expect(translateHtml(page, 'en', CATALOG)).toBe(page);
  });

  it('bakes French text, attributes, lang, links and canonical', () => {
    const out = translateHtml(page, 'fr', CATALOG);
    expect(out).toMatch(/^<!doctype html>/i);
    expect(out).toContain('<html lang="fr">');
    expect(out).toContain(`>${CATALOG.fr.home}<`);
    expect(out).toContain(`placeholder="${CATALOG.fr.leaderboardSearch}"`);
    expect(out).toContain('href="/fr/snake"');
    expect(out).toContain('href="/css/x.css"'); // asset untouched
    expect(out).toContain('href="https://games-zone.onrender.com/fr/snake"'); // canonical
    expect(out).toContain('content="https://games-zone.onrender.com/fr/snake"'); // og:url
    expect(out).toContain('var a = 1 < 2;'); // script body preserved verbatim
  });
});
