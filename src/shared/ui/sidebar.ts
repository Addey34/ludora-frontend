const sidebar = document.querySelector('.sidebar');
if (sidebar) {
  const path = window.location.pathname;
  for (const link of document.querySelectorAll<HTMLElement>('.sidebar-link')) {
    const nav = link.dataset.nav;
    if (nav && (path === `/${nav}` || path.startsWith(`/${nav}/`))) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
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

(function wireSoundToggle() {
  const btn = document.getElementById('soundToggle');
  const icon = document.getElementById('soundIcon');
  if (!btn || !icon) return;

  const STORAGE_KEY = 'gz-sound';
  const isMuted = () => localStorage.getItem(STORAGE_KEY) === '0';

  const updateIcon = (animate = false) => {
    const muted = isMuted();
    icon.className = muted ? 'fas fa-volume-xmark' : 'fas fa-volume-high';
    btn.setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound');
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
