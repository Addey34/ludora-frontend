import { setupPopover } from './popover.js';
import { t } from '../i18n/i18n.js';

/**
 * Generic "Settings" popover for the game-shell header.
 *
 * Data-driven and game-agnostic: a game passes a list of {@link SettingsField}
 * (each a labelled segmented control), and the panel renders them into the shell
 * markup (`#settingsControl` / `#settingsToggle` / `#settingsPanel`) and reports
 * picks back via `onChange`. Open/close is delegated to {@link setupPopover}, like
 * the Levels / Leaderboard panels. Reusable by any future game that opts into
 * `settings: true` (see the games array in vite.config.ts).
 */

/** One selectable value of a field. */
export interface SettingsChoice {
  label: string;
  value: string;
}

/** A labelled segmented control (single choice among a few options). */
export interface SettingsField {
  /** Stable id (used for the option name + aria wiring). */
  id: string;
  label: string;
  choices: SettingsChoice[];
  /** Currently selected value. */
  value: string;
  /** Called with the newly picked value. */
  onChange: (value: string) => void;
}

/**
 * Ready-made, translated **Difficulty** field (Easy / Medium / Hard) — the
 * ubiquitous bot/level-difficulty control. A game passes only its current value
 * and change handler instead of repeating the same three choices everywhere.
 */
export function difficultyField(
  value: string,
  onChange: (value: string) => void,
  label: string = t('difficulty')
): SettingsField {
  return {
    id: 'difficulty',
    label,
    value,
    choices: [
      { label: t('easy'), value: 'easy' },
      { label: t('medium'), value: 'medium' },
      { label: t('hard'), value: 'hard' },
    ],
    onChange,
  };
}

/**
 * Ready-made **Language** field (EN / FR) for content-language games (Typing,
 * Motus, Anagrams, Hangman). The option labels stay the language codes (EN/FR
 * read the same in both locales); only the field label is translated.
 */
export function languageField(value: string, onChange: (value: string) => void): SettingsField {
  return {
    id: 'language',
    label: t('language'),
    value,
    choices: [
      { label: 'EN', value: 'en' },
      { label: 'FR', value: 'fr' },
    ],
    onChange,
  };
}

/**
 * Ready-made **numeric-choice** field: a segmented control over a small set of
 * numbers (question count, timer seconds, lives…). Reusable by any game that lets
 * the player pick among a few numeric values. `format` renders each choice's label
 * (e.g. `(n) => `${n}s``); `onChange` receives the picked value already parsed back
 * to a number.
 */
export function numberField(
  id: string,
  label: string,
  value: number,
  choices: number[],
  onChange: (value: number) => void,
  format: (n: number) => string = String
): SettingsField {
  return {
    id,
    label,
    value: String(value),
    choices: choices.map((n) => ({ label: format(n), value: String(n) })),
    onChange: (v) => onChange(Number(v)),
  };
}

/** Handle returned by {@link setupSettingsPanel}. */
export interface SettingsPanelHandle {
  /** Greys out and blocks the whole panel (e.g. while in a multiplayer session). */
  setDisabled(disabled: boolean): void;
}

/**
 * Wires the settings panel. Returns null when the shell markup is absent (a game
 * without `settings: true`), so callers can safely ignore the result.
 */
export function setupSettingsPanel(fields: SettingsField[]): SettingsPanelHandle | null {
  const pop = setupPopover({
    control: 'settingsControl',
    toggle: 'settingsToggle',
    panel: 'settingsPanel',
  });
  if (!pop) return null;
  const { panel } = pop;

  const title = document.createElement('p');
  title.className = 'game-pop-title';
  title.textContent = t('settings');

  const fieldEls: HTMLElement[] = [title];
  for (const field of fields) {
    const wrap = document.createElement('div');
    wrap.className = 'game-setting';

    const label = document.createElement('span');
    label.className = 'game-setting-label';
    label.textContent = field.label;
    wrap.appendChild(label);

    const seg = document.createElement('div');
    seg.className = 'game-seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', field.label);

    let current = field.value;
    const mark = (): void => {
      seg.querySelectorAll<HTMLButtonElement>('.game-seg-option').forEach((btn) => {
        const active = btn.dataset.value === current;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
    };

    for (const choice of field.choices) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'game-seg-option';
      btn.dataset.value = choice.value;
      btn.textContent = choice.label;
      btn.addEventListener('click', () => {
        if (current === choice.value) return;
        current = choice.value;
        mark();
        field.onChange(choice.value);
      });
      seg.appendChild(btn);
    }
    mark();

    wrap.appendChild(seg);
    fieldEls.push(wrap);
  }

  panel.replaceChildren(...fieldEls);

  return {
    setDisabled(disabled: boolean): void {
      if (disabled) pop.close();
      panel.querySelectorAll<HTMLButtonElement>('.game-seg-option').forEach((btn) => {
        btn.disabled = disabled;
      });
    },
  };
}
