/**
 * Lightweight, non-blocking toast notification system.
 *
 * Toasts appear centered on-screen, stack vertically, and fade out on their own.
 * They sit on z-index 9500 (above particles at 9000) and never block interaction.
 */

type ToastType = 'info' | 'success' | 'combo' | 'warning';

/** Optional inline action rendered as a button inside the toast. */
interface ToastAction {
  label: string;
  onClick: () => void;
}

let _container: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (!_container) {
    _container = document.createElement('div');
    _container.className = 'toast-container';
    _container.setAttribute('aria-live', 'polite');
    _container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(_container);
  }
  return _container;
}

/**
 * Shows a transient notification that disappears automatically.
 * @param message  Text to display (keep it short, single line).
 * @param type     Visual style: 'info' | 'success' | 'combo' | 'warning'.
 * @param duration Milliseconds the toast stays visible before fading (default 2000).
 * @param action   Optional inline button; clicking runs it and dismisses the toast.
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  duration = 2000,
  action?: ToastAction
): void {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status');

  if (action) {
    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      action.onClick();
      el.classList.remove('is-visible');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 1000);
    });
    el.append(text, btn);
  } else {
    el.textContent = message;
  }

  const c = getContainer();
  c.appendChild(el);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('is-visible'));
  });

  setTimeout(() => {
    el.classList.remove('is-visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 1000);
  }, duration);
}
