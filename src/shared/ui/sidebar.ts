import { applyTranslations, getLocale, setLocale, t } from '../i18n/i18n.js';
import { markSpotlight } from '../weekly/weeklyFeature.js';

const sidebar = document.querySelector('.sidebar');
if (sidebar) {
  const path = window.location.pathname;
  let activeLink: HTMLElement | null = null;
  for (const link of document.querySelectorAll<HTMLElement>('.sidebar-link')) {
    const nav = link.dataset.nav;
    if (nav && (path === `/${nav}` || path.startsWith(`/${nav}/`))) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
      activeLink = link;
    }
  }

  // Categories: click to open (accordion on mobile, flyout on desktop). Opening
  // one closes the others; a click outside or Escape closes them all — same
  // click-to-toggle model as the game-shell panels.
  const cats = [...document.querySelectorAll<HTMLElement>('.sidebar-cat')];
  const closeCats = (): void => {
    for (const cat of cats) {
      cat.classList.remove('is-open');
      cat.querySelector('.sidebar-cat-head')?.setAttribute('aria-expanded', 'false');
    }
  };
  for (const head of document.querySelectorAll<HTMLElement>('.sidebar-cat-head')) {
    head.addEventListener('click', () => {
      const cat = head.closest('.sidebar-cat');
      const willOpen = !cat?.classList.contains('is-open');
      closeCats();
      if (cat && willOpen) {
        cat.classList.add('is-open');
        head.setAttribute('aria-expanded', 'true');
      }
    });
  }
  document.addEventListener('click', (event) => {
    if (!(event.target as HTMLElement).closest('.sidebar-cat')) closeCats();
  });

  // Highlight the category holding the active game (no pre-open, so the desktop
  // flyout doesn't pop on load).
  activeLink?.closest('.sidebar-cat')?.classList.add('has-active');

  if (path === '/' || path === '/index.html') {
    document.querySelector('.sidebar-brand')?.setAttribute('aria-current', 'page');
  }

  const toggle = document.querySelector('.sidebar-toggle');
  const scrim = document.querySelector<HTMLElement>('.sidebar-scrim');

  const setOpen = (open: boolean): void => {
    document.body.classList.toggle('sidebar-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    if (scrim) scrim.hidden = !open;
  };

  toggle?.addEventListener('click', () =>
    setOpen(!document.body.classList.contains('sidebar-open'))
  );
  scrim?.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      closeCats();
    }
  });
}

(function wireLanguageToggle() {
  applyTranslations();
  const btn = document.getElementById('langToggle');
  if (!btn) return;
  const current = getLocale();
  // The visible EN/FR code is CSS-driven from <html lang> (set pre-paint in
  // head.hbs) to avoid a flash; here we only wire the accessible label + toggle.
  btn.setAttribute('aria-label', `${t('language')}: ${current.toUpperCase()}`);
  btn.addEventListener('click', () => setLocale(getLocale() === 'en' ? 'fr' : 'en'));
})();

(function wireSoundToggle() {
  const btn = document.getElementById('soundToggle');
  const icon = document.getElementById('soundIcon');
  if (!btn || !icon) return;

  const STORAGE_KEY = 'gz-sound';
  const isMuted = () => localStorage.getItem(STORAGE_KEY) === '0';

  const updateIcon = (animate = false) => {
    const muted = isMuted();
    icon.className = muted ? 'fas fa-volume-xmark' : 'fas fa-volume-high';
    btn.setAttribute('aria-label', muted ? t('enableSound') : t('muteSound'));
    btn.classList.toggle('is-muted', muted);
    if (animate) {
      btn.style.transform = 'scale(0.82)';
      setTimeout(() => {
        btn.style.transform = '';
      }, 120);
    }
  };

  updateIcon();
  btn.addEventListener('click', () => {
    const nowMuted = !isMuted();
    localStorage.setItem(STORAGE_KEY, nowMuted ? '0' : '1');
    window.dispatchEvent(new CustomEvent('gz-sound-change', { detail: { muted: nowMuted } }));
    updateIcon(true);
  });

  window.addEventListener('gz-sound-change', () => updateIcon());
})();

// Badge the daily pick and this week's weekly set (icon + tooltip) on their
// sidebar links and, on the home page, their tiles. Client-side so it's never stale.
markSpotlight();

export {};
