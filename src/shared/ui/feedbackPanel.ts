import { setupPopover } from './popover.js';
import { showToast } from './toast.js';
import { t } from '../i18n/i18n.js';
import { submitFeedback } from '../net/nakama.js';

/**
 * Feedback popover for the game-shell header. Present on every game page (the
 * shell renders `#feedbackControl` unconditionally, with the game key in
 * `data-game`), so there is no per-game wiring: this self-installed script finds
 * the control and builds a small form — a 1-5 star rating plus an optional
 * comment — and sends it to the backend via {@link submitFeedback}.
 *
 * Best-effort like the rest of the online layer, but here the result is shown to
 * the player (a toast) since feedback should confirm it went through.
 */

const MAX_STARS = 5;

(function setupFeedbackPanel(): void {
  const pop = setupPopover({
    control: 'feedbackControl',
    toggle: 'feedbackToggle',
    panel: 'feedbackPanel',
  });
  if (!pop) return;
  const { control, panel } = pop;
  const game = control.dataset.game || 'unknown';

  let rating = 0;

  const title = document.createElement('p');
  title.className = 'game-pop-title';
  title.textContent = t('feedback');

  // --- Star rating (a radiogroup) ---
  const stars = document.createElement('div');
  stars.className = 'feedback-stars';
  stars.setAttribute('role', 'radiogroup');
  stars.setAttribute('aria-label', t('feedbackHint'));

  const starEls: HTMLButtonElement[] = [];
  const paint = (upTo: number): void => {
    starEls.forEach((btn, i) => btn.classList.toggle('is-on', i < upTo));
  };
  const select = (value: number): void => {
    rating = value;
    paint(value);
    starEls.forEach((btn, i) => btn.setAttribute('aria-checked', String(i + 1 === value)));
  };

  for (let i = 1; i <= MAX_STARS; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'feedback-star';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.setAttribute('aria-label', String(i));
    btn.innerHTML = '<i class="fas fa-star" aria-hidden="true"></i>';
    btn.addEventListener('click', () => select(i));
    btn.addEventListener('mouseenter', () => paint(i));
    starEls.push(btn);
    stars.appendChild(btn);
  }
  // Leaving the row restores the picked rating (or none).
  stars.addEventListener('mouseleave', () => paint(rating));

  // --- Comment ---
  const comment = document.createElement('textarea');
  comment.className = 'feedback-text';
  comment.rows = 3;
  comment.maxLength = 1000;
  comment.placeholder = t('feedbackPlaceholder');

  // --- Send ---
  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'feedback-send';
  send.textContent = t('send');

  send.addEventListener('click', async () => {
    if (rating === 0) {
      showToast(t('feedbackNeedRating'), 'warning');
      return;
    }
    send.disabled = true;
    send.textContent = t('sending');
    try {
      await submitFeedback(game, rating, comment.value.trim());
      showToast(t('feedbackThanks'), 'success');
      select(0);
      comment.value = '';
      pop.close();
    } catch {
      showToast(t('feedbackError'), 'warning');
    } finally {
      send.disabled = false;
      send.textContent = t('send');
    }
  });

  panel.replaceChildren(title, stars, comment, send);
})();
