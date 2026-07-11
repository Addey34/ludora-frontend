/**
 * Single source of truth for the UI visual themes (the "visual direction"
 * switcher — the palette bubble top-right). A theme is applied by setting
 * `data-ui-theme="<id>"` on `<html>`/`<body>`; `themes.css` and `home-variants.css`
 * carry the per-theme token overrides (the default `portal` uses the base tokens,
 * so it has no override block).
 *
 * Adding a theme = one entry here, then wire the three surfaces that must stay in
 * sync with this list. `src/shared/i18n/themes.test.ts` fails until all are done:
 *  1. its `labelKey` in `CATALOG.en` and `CATALOG.fr` (i18n.ts),
 *  2. its `[data-ui-theme='<id>']` block in `public/css/components/themes.css`,
 *  3. its `data-theme-option` button in `src/partials/sidebar.hbs` and its id in the
 *     anti-FOUC bootstrap array in `src/partials/head.hbs`.
 *
 * Consumers: `theme.ts` (the switcher control) imports the list/helpers directly;
 * the two partials keep literal copies that the integrity test pins to this file.
 */

/** localStorage key holding the chosen theme id. */
export const THEME_STORAGE_KEY = 'gz-theme';

interface UiThemeDef {
  /** Stored value, `data-ui-theme` value and `?theme=` URL value. Lowercase a–z. */
  readonly id: string;
  /** i18n catalog key for the theme's label in the switcher menu. */
  readonly labelKey: string;
}

/** The themes, in switcher order. `portal` (first) is the default base look. */
export const UI_THEMES = [
  { id: 'portal', labelKey: 'themePortal' },
  { id: 'arcade', labelKey: 'themeArcade' },
  { id: 'console', labelKey: 'themeConsole' },
  { id: 'esports', labelKey: 'themeEsports' },
  { id: 'cards', labelKey: 'themeCards' },
] as const satisfies readonly UiThemeDef[];

export type UiTheme = (typeof UI_THEMES)[number]['id'];

/** Base look; carries no CSS override block (it *is* the default token set). */
export const DEFAULT_THEME: UiTheme = 'portal';

/** Just the ids, for validation and the bootstrap array. */
export const THEME_IDS: readonly UiTheme[] = UI_THEMES.map((theme) => theme.id);

export function isTheme(value: string | null): value is UiTheme {
  return value !== null && (THEME_IDS as readonly string[]).includes(value);
}
