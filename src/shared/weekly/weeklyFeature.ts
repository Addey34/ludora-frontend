/**
 * Spotlight badges — the lightweight UI for the daily / weekly featured games.
 *
 * Rather than a heavy banner, each spotlit game (see `src/shared/spotlight/`)
 * gets a small badge on its home tile and its sidebar link, with a tooltip
 * saying it earns GamesZone Points this day/week. Rendered client-side (from the
 * always-present sidebar) so a static build never shows a stale day/week.
 *
 * The daily pick takes precedence: a game that is both the daily pick and in the
 * weekly set shows only the (stronger) daily badge.
 */
import { dailyGame, weeklyGames } from '../spotlight/spotlight.js';
import { SCORE_GAMES } from '../score/scoreGames.js';
import { t } from '../i18n/i18n.js';

/** Marks today's daily pick and this week's weekly set (home tiles + sidebar). Idempotent. */
export function markSpotlight(): void {
  const pool = SCORE_GAMES.map((g) => g.key);
  const daily = dailyGame(pool);
  const weekly = weeklyGames(pool);

  const dailyTip = t('spotlightDaily');
  const weeklyTip = t('spotlightWeekly');

  for (const key of weekly) {
    if (key === daily) continue; // the daily badge wins on its own tile
    markGame(key, weeklyTip, 'fa-fire', 'weekly-flame', 'sidebar-flame');
  }
  if (daily) markGame(daily, dailyTip, 'fa-bolt', 'daily-flame', 'sidebar-daily-flame');
}

/** Badges a game's home tile(s) and sidebar link. Guards against re-runs. */
function markGame(
  key: string,
  tip: string,
  icon: string,
  tileClass: string,
  sidebarClass: string
): void {
  document.querySelectorAll<HTMLElement>(`.game-grid [data-game="${key}"]`).forEach((tile) => {
    if (!tile.querySelector(`.${tileClass}`)) tile.appendChild(buildBadge(tip, icon, tileClass));
  });

  const link = document.querySelector<HTMLElement>(`.sidebar-link[data-nav="${key}"]`);
  if (link && !link.querySelector(`.${sidebarClass}`)) {
    const mode = link.querySelector('.sidebar-mode');
    link.insertBefore(buildBadge(tip, icon, sidebarClass), mode); // left of the players badge
  }
}

function buildBadge(tip: string, icon: string, cls: string): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = cls;
  badge.title = tip;
  badge.setAttribute('aria-label', tip);
  badge.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i>`;
  return badge;
}
