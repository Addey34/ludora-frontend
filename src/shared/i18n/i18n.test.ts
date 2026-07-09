import { describe, it, expect, afterEach } from 'vitest';
import { CATALOG, LOCALES, t, applyTranslations } from './i18n.js';

/**
 * Guards the interface-translation work: the two locales must stay in sync so no
 * string silently falls back to English (or to the raw key) after an edit.
 */
describe('i18n catalog', () => {
  it('exposes exactly the locales in LOCALES', () => {
    expect(Object.keys(CATALOG).sort()).toEqual([...LOCALES].sort());
  });

  it('has the same set of keys in every locale (no missing translation)', () => {
    const enKeys = Object.keys(CATALOG.en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(CATALOG[locale]).sort(), `locale "${locale}"`).toEqual(enKeys);
    }
  });

  it('has no empty translation value', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(CATALOG[locale])) {
        expect(value.trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('keeps the same {placeholder} tokens across locales', () => {
    const tokens = (s: string): string[] => (s.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of Object.keys(CATALOG.en)) {
      const expected = tokens(CATALOG.en[key]);
      for (const locale of LOCALES) {
        expect(tokens(CATALOG[locale][key]), `${locale}.${key} placeholders`).toEqual(expected);
      }
    }
  });

  it('interpolates {name} params and leaves unknown tokens intact', () => {
    expect(t('scoreSavedAs', { name: 'Bob' })).toContain('Bob');
    expect(t('scoreValue', { score: 42 })).toContain('42');
  });

  it('falls back to the key itself when it is unknown', () => {
    expect(t('__does_not_exist__')).toBe('__does_not_exist__');
  });
});

/**
 * The per-game "How to play" lines carry their English text as the data-i18n key
 * (see CONTROLS_FR in i18n.ts). This guards that applyTranslations swaps them to
 * French — including the `data-i18n-html` keys that carry <kbd> markup.
 */
describe('applyTranslations (control help lines)', () => {
  afterEach(() => localStorage.removeItem('gz-lang'));

  const infoPanel = (): { root: HTMLElement; keys: HTMLElement; action: HTMLElement } => {
    const root = document.createElement('div');
    const keys = document.createElement('span');
    keys.dataset.i18nHtml = '<kbd>↑ ↓ ← →</kbd> or <kbd>W A S D</kbd>';
    const action = document.createElement('span');
    action.dataset.i18n = '2D: steer on the board. 3D: left/right turn relative to the snake';
    action.textContent = '2D: steer on the board. 3D: left/right turn relative to the snake';
    root.append(keys, action);
    return { root, keys, action };
  };

  it('translates a control action to French (data-i18n)', () => {
    localStorage.setItem('gz-lang', 'fr');
    const { root, action } = infoPanel();
    applyTranslations(root);
    expect(action.textContent).toBe(
      '2D : dirige sur le plateau. 3D : gauche/droite tourne par rapport au serpent'
    );
  });

  it('translates a control key with <kbd> markup to French (data-i18n-html)', () => {
    localStorage.setItem('gz-lang', 'fr');
    const { root, keys } = infoPanel();
    applyTranslations(root);
    expect(keys.innerHTML).toContain('ou');
    expect(keys.querySelectorAll('kbd').length).toBe(2);
  });

  it('leaves the English text in place under the English locale', () => {
    const { root, action } = infoPanel();
    applyTranslations(root);
    expect(action.textContent).toBe(
      '2D: steer on the board. 3D: left/right turn relative to the snake'
    );
  });
});
