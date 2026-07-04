import { applyTranslations, getLocale, setLocale, t } from '../i18n/i18n.js';

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

  // Category accordions (mobile): the head toggles .is-open on its category. On
  // desktop the flyout is hover-driven, so this class is a harmless no-op there.
  for (const head of document.querySelectorAll<HTMLElement>('.sidebar-cat-head')) {
    head.addEventListener('click', () => {
      const cat = head.closest('.sidebar-cat');
      const open = cat?.classList.toggle('is-open') ?? false;
      head.setAttribute('aria-expanded', String(open));
    });
  }

  // Highlight the category holding the active game, and pre-open its accordion
  // so the current game is visible when the mobile rail slides in.
  const activeCat = activeLink?.closest('.sidebar-cat');
  if (activeCat) {
    activeCat.classList.add('has-active', 'is-open');
    activeCat.querySelector('.sidebar-cat-head')?.setAttribute('aria-expanded', 'true');
  }

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
    if (event.key === 'Escape') setOpen(false);
  });
}

(function wireLanguageToggle() {
  applyTranslations();
  const btn = document.getElementById('langToggle');
  const code = document.getElementById('langCode');
  if (!btn) return;
  const current = getLocale();
  if (code) code.textContent = current.toUpperCase();
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

export {};
