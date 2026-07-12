/**
 * Weekly-challenge flame — the lightweight, non-stale UI for the featured game.
 *
 * Rather than a heavy banner, the featured game of the week (see `weekly.ts`)
 * just gets a small flame badge on its home tile and its sidebar link, with a
 * tooltip explaining the ×N GamesZone Points bonus. Rendered client-side (from
 * the always-present sidebar) so a static build never shows a stale week.
 */
import { featuredGame } from './weekly.js';
import { SCORE_GAMES } from '../score/scoreGames.js';
import { WEEKLY_MULT } from '../score/multipliers.js';
import { t } from '../i18n/i18n.js';

/** Marks this week's featured game (home tile + sidebar link). Idempotent. */
export function markWeeklyChallenge(): void {
  const key = featuredGame(SCORE_GAMES.map((g) => g.key));
  if (!key) return;
  const tip = t('weeklyChallengeTip', { mult: WEEKLY_MULT });

  document
    .querySelectorAll<HTMLElement>(`.game-grid [data-game="${key}"]`)
    .forEach((tile) => addFlame(tile, tip, 'weekly-flame'));

  const link = document.querySelector<HTMLElement>(`.sidebar-link[data-nav="${key}"]`);
  if (link && !link.querySelector('.sidebar-flame')) {
    const mode = link.querySelector('.sidebar-mode');
    link.insertBefore(buildFlame(tip, 'sidebar-flame'), mode); // left of the players badge
  }
}

/** Appends a flame to `host` unless one is already there (guards re-runs). */
function addFlame(host: HTMLElement, tip: string, cls: string): void {
  if (host.querySelector(`.${cls}`)) return;
  host.appendChild(buildFlame(tip, cls));
}

function buildFlame(tip: string, cls: string): HTMLSpanElement {
  const flame = document.createElement('span');
  flame.className = cls;
  flame.title = tip;
  flame.setAttribute('aria-label', tip);
  flame.innerHTML = '<i class="fas fa-fire" aria-hidden="true"></i>';
  return flame;
}
