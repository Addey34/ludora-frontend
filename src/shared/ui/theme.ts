import { t } from '../i18n/i18n.js';
import { DEFAULT_THEME, isTheme, THEME_STORAGE_KEY, type UiTheme } from './themes.js';

function getInitialTheme(): UiTheme {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('theme');
  if (isTheme(requested)) {
    localStorage.setItem(THEME_STORAGE_KEY, requested);
    return requested;
  }

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : DEFAULT_THEME;
}

function applyTheme(theme: UiTheme): void {
  document.body.dataset.uiTheme = theme;
  document.documentElement.dataset.uiTheme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  for (const option of document.querySelectorAll<HTMLButtonElement>('[data-theme-option]')) {
    const active = option.dataset.themeOption === theme;
    option.classList.toggle('is-active', active);
    option.setAttribute('aria-checked', String(active));
  }
}

(function wireThemeControl() {
  const control = document.getElementById('themeControl');
  const toggle = document.getElementById('themeToggle');
  const menu = document.getElementById('themeMenu');
  if (!control || !toggle || !menu) return;

  const close = (): void => {
    menu.hidden = true;
    control.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  const open = (): void => {
    menu.hidden = false;
    control.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
  };

  toggle.setAttribute('aria-label', t('themeSwitcher'));
  applyTheme(getInitialTheme());

  toggle.addEventListener('click', () => {
    if (menu.hidden) open();
    else close();
  });

  for (const option of document.querySelectorAll<HTMLButtonElement>('[data-theme-option]')) {
    option.addEventListener('click', () => {
      const theme = option.dataset.themeOption ?? null;
      if (isTheme(theme)) applyTheme(theme);
      close();
    });
  }

  document.addEventListener('click', (event) => {
    if (!control.contains(event.target as Node)) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
})();

export {};
