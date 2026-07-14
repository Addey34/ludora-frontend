import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATALOG } from './i18n.js';
import { UI_THEMES, THEME_IDS, DEFAULT_THEME } from '../ui/themes.js';

/**
 * Theme-wiring integrity. `src/shared/ui/themes.ts` is the single source of truth
 * for the visual-direction switcher, but two surfaces keep literal copies that
 * can't import it — the anti-FOUC bootstrap in `head.hbs` (runs before any module)
 * and the switcher menu markup in `sidebar.hbs` (whose literal `data-i18n` keys the
 * other i18n tests validate). This test pins both copies, plus the i18n labels and
 * the per-theme CSS, to `UI_THEMES` — so adding a theme in one place fails loudly
 * until every surface is wired. Mirrors gamesStructure.test.ts for games.
 */
const root = process.cwd();
const read = (rel: string): string => readFileSync(resolve(root, rel), 'utf8');

describe('UI theme wiring', () => {
  it('has themes and a valid default', () => {
    expect(UI_THEMES.length).toBeGreaterThan(0);
    expect(THEME_IDS).toContain(DEFAULT_THEME);
  });

  it.each(UI_THEMES)('"$id" label ($labelKey) is translated in EN and FR', ({ labelKey }) => {
    expect(CATALOG.en[labelKey], `${labelKey} missing from CATALOG.en`).toBeTruthy();
    expect(CATALOG.fr[labelKey], `${labelKey} missing from CATALOG.fr`).toBeTruthy();
  });

  it.each(UI_THEMES.filter((theme) => theme.id !== DEFAULT_THEME))(
    '"$id" (non-default) has a themes.css override block',
    ({ id }) => {
      const css = read('public/css/components/themes.css');
      expect(css.includes(`[data-ui-theme='${id}']`), `[data-ui-theme='${id}'] missing`).toBe(true);
    }
  );

  it('sidebar.hbs menu lists exactly the themes with their label keys', () => {
    const hbs = read('src/partials/sidebar.hbs');
    const found = new Map<string, string>();
    const re = /data-theme-option="([^"]+)"[^>]*data-i18n="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(hbs))) found.set(m[1], m[2]);
    expect([...found.keys()].sort(), 'sidebar theme buttons').toEqual([...THEME_IDS].sort());
    for (const { id, labelKey } of UI_THEMES) {
      expect(found.get(id), `sidebar button for "${id}"`).toBe(labelKey);
    }
  });

  it('keeps the global controls inside the sidebar above authentication', () => {
    const hbs = read('src/partials/sidebar.hbs');
    const controlsStart = hbs.indexOf('<div class="sidebar-utility-controls">');
    const authStart = hbs.indexOf('<div class="sidebar-auth"');
    const sidebarEnd = hbs.indexOf('</nav>');
    const controls = hbs.slice(controlsStart, authStart);

    expect(controlsStart).toBeGreaterThan(-1);
    expect(authStart).toBeGreaterThan(controlsStart);
    expect(sidebarEnd).toBeGreaterThan(authStart);
    for (const id of ['themeControl', 'langToggle', 'soundToggle']) {
      expect(controls).toContain(`id="${id}"`);
      expect(hbs.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1);
    }
  });

  it('head.hbs anti-FOUC bootstrap array matches the theme ids and default', () => {
    const hbs = read('src/partials/head.hbs');
    const arr = hbs.match(/var themes = \[([^\]]*)\]/);
    expect(arr, 'anti-FOUC `var themes = [...]` array in head.hbs').not.toBeNull();
    const ids = [...(arr?.[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(ids.sort(), 'head.hbs bootstrap ids').toEqual([...THEME_IDS].sort());
    expect(hbs.includes(`: '${DEFAULT_THEME}';`), `default '${DEFAULT_THEME}' fallback`).toBe(true);
  });
});
