/**
 * Lightweight game-over overlay shown over the game shell (replaces the old
 * modal). It carries the title, the score (or rich content), an optional save
 * prompt, and action buttons (Play again / View leaderboard).
 *
 * For games with a leaderboard, the engine never auto-saves: the overlay shows a
 * save prompt with the player's name pre-filled and editable, so the player
 * chooses whether to record the score (and under which name).
 */

import { t } from '../i18n/i18n.js';

/** An action button rendered at the bottom of the overlay. */
export interface GameOverlayButton {
  text: string;
  /** Primary style + receives the initial focus (Enter triggers it). */
  primary?: boolean;
  onClick: () => void;
}

/** Everything needed to render the overlay. */
interface GameOverlayOptions {
  title: string;
  /** Rich HTML body (trusted, built by the game). Falls back to a plain score. */
  bodyHtml?: string;
  /** Plain score shown when `bodyHtml` is omitted. */
  score?: number;
  /** Trusted HTML shown under the body (e.g. the Ludora Points breakdown). */
  footerHtml?: string;
  buttons: GameOverlayButton[];
}

/**
 * Drives the game-over overlay, mounted into the game shell (`.game-shell`,
 * which is positioned) so it covers the play area without a full-screen modal.
 */
export class GameOverlay {
  private host: HTMLElement | null;
  private root: HTMLElement | null = null;

  /** @param host Element to overlay (defaults to the game shell). */
  constructor(host?: HTMLElement | null) {
    this.host = host ?? document.querySelector<HTMLElement>('.game-shell');
  }

  /** Builds and shows the overlay. Replaces any previous one. */
  show(options: GameOverlayOptions): void {
    if (!this.host) return;
    this.hide();

    const root = document.createElement('div');
    root.className = 'game-over';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', t('gameOverAria'));

    const card = document.createElement('div');
    card.className = 'game-over-card';

    const title = document.createElement('h2');
    title.className = 'game-over-title';
    title.textContent = options.title;
    card.appendChild(title);

    const body = document.createElement('div');
    body.className = 'game-over-body';
    if (options.bodyHtml !== undefined) {
      body.innerHTML = options.bodyHtml;
    } else if (options.score !== undefined) {
      body.textContent = t('scoreValue', { score: options.score });
    }
    card.appendChild(body);

    if (options.footerHtml) {
      const footer = document.createElement('div');
      footer.className = 'game-over-footer';
      footer.innerHTML = options.footerHtml;
      card.appendChild(footer);
    }

    const actions = document.createElement('div');
    actions.className = 'game-over-actions';
    let primaryButton: HTMLButtonElement | null = null;
    for (const config of options.buttons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = config.text;
      button.className = config.primary ? 'btn btn--primary' : 'btn btn--secondary';
      button.addEventListener('click', config.onClick);
      if (config.primary) primaryButton = button;
      actions.appendChild(button);
    }
    card.appendChild(actions);

    root.appendChild(card);
    this.host.appendChild(root);
    this.root = root;

    primaryButton?.focus();
  }

  /** Removes the overlay if it is shown. */
  hide(): void {
    this.root?.remove();
    this.root = null;
  }
}
