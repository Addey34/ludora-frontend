const toggle = document.querySelector<HTMLButtonElement>('.game-fullscreen-toggle');
const container = document.querySelector<HTMLElement>('.game-container');

if (toggle && container) {
  const icon = toggle.querySelector('i');

  const isZen = (): boolean => document.body.classList.contains('zen-mode');

  const sync = (active: boolean): void => {
    document.body.classList.toggle('zen-mode', active);
    toggle.setAttribute('aria-pressed', String(active));
    toggle.setAttribute('aria-label', active ? 'Exit immersive mode' : 'Immersive mode');
    icon?.classList.toggle('fa-expand', !active);
    icon?.classList.toggle('fa-compress', active);
  };

  const enter = (): void => {
    sync(true);
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    }
  };

  const exit = (): void => {
    sync(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  toggle.addEventListener('click', () => (isZen() ? exit() : enter()));

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && isZen()) sync(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isZen()) exit();
  });
}

export {};
