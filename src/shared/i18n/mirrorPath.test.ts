import { describe, it, expect } from 'vitest';
import { mirrorPath } from './i18n.js';

describe('mirrorPath', () => {
  it('adds the /fr prefix for French', () => {
    expect(mirrorPath('/', 'fr')).toBe('/fr/');
    expect(mirrorPath('/snake', 'fr')).toBe('/fr/snake');
    expect(mirrorPath('/leaderboard', 'fr')).toBe('/fr/leaderboard');
    expect(mirrorPath('/snake/', 'fr')).toBe('/fr/snake/');
  });

  it('removes the /fr prefix for English', () => {
    expect(mirrorPath('/fr/', 'en')).toBe('/');
    expect(mirrorPath('/fr', 'en')).toBe('/');
    expect(mirrorPath('/fr/snake', 'en')).toBe('/snake');
    expect(mirrorPath('/fr/snake/', 'en')).toBe('/snake/');
  });

  it('is idempotent when already in the target locale', () => {
    expect(mirrorPath('/fr/snake', 'fr')).toBe('/fr/snake');
    expect(mirrorPath('/snake', 'en')).toBe('/snake');
    expect(mirrorPath('/', 'en')).toBe('/');
  });

  it('does not treat a page starting with "fr" as the locale prefix', () => {
    // No such route today, but the regex must only match the /fr segment.
    expect(mirrorPath('/friends', 'fr')).toBe('/fr/friends');
    expect(mirrorPath('/fr/friends', 'en')).toBe('/friends');
  });
});
