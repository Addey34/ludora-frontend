import { describe, expect, it } from 'vitest';
import { matchesSearch, normalizeSearchText } from './homeSearch.js';

describe('home search', () => {
  it('normalizes accents, punctuation and case', () => {
    expect(normalizeSearchText('  Mémoire-à-DEUX  ')).toBe('memoire a deux');
  });

  it('matches every query term in any order', () => {
    const index = 'Space Invaders Envahisseurs action arcade multijoueur';
    expect(matchesSearch(index, 'arcade space')).toBe(true);
    expect(matchesSearch(index, 'espace stratégie')).toBe(false);
  });

  it('supports bilingual and partial terms', () => {
    const index = 'Minesweeper Démineur puzzle mines';
    expect(matchesSearch(index, 'demin')).toBe(true);
    expect(matchesSearch(index, 'mine puzz')).toBe(true);
  });

  it('matches an empty query', () => {
    expect(matchesSearch('Snake serpent', '  ')).toBe(true);
  });
});
