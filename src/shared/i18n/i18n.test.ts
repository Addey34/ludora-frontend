import { describe, it, expect } from 'vitest';
import { CATALOG, LOCALES, t } from './i18n.js';

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
