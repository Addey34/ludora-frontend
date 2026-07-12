/**
 * Home page enhancement — the **weekly spotlight** banner.
 *
 * The featured game rotates every week and rewards ×N GamesZone Points (see
 * `src/shared/weekly/`). Because the site is a static build that isn't
 * redeployed weekly, the banner is rendered **client-side** here so it never
 * shows a stale week. It reuses the game tile already on the page for the
 * featured game's label + accent colour, so there is no extra data to plumb.
 */
import { featuredGame, WEEKLY_MULTIPLIER } from './shared/weekly/weekly.js';
import { SCORE_GAMES } from './shared/score/scoreGames.js';
import { getLocale, mirrorPath, t } from './shared/i18n/i18n.js';

const key = featuredGame(SCORE_GAMES.map((g) => g.key));
if (key) renderSpotlight(key);

function renderSpotlight(gameKey: string): void {
  const tile = document.querySelector<HTMLElement>(`.game-grid [data-game="${gameKey}"]`);
  const hero = document.querySelector('.home-main .home-hero');
  if (!tile || !hero) return;

  const label = tile.dataset.label ?? gameKey;
  const accent = tile.style.getPropertyValue('--nav-accent').trim() || 'var(--brand)';

  const section = document.createElement('section');
  section.className = 'game-category home-weekly';
  section.style.setProperty('--nav-accent', accent);

  const card = document.createElement('a');
  card.className = 'home-weekly-card';
  card.href = mirrorPath(`/${gameKey}`, getLocale());
  card.setAttribute('aria-label', `${t('weeklySpotlightTitle')}: ${label}`);
  card.innerHTML = `
    <span class="home-weekly-badge">×${WEEKLY_MULTIPLIER}</span>
    <span class="game-icon" style="--game-icon: url(/icons/${gameKey}.svg)" aria-hidden="true"></span>
    <span class="home-weekly-text">
      <span class="home-weekly-title">${t('weeklySpotlightTitle')}</span>
      <span class="home-weekly-sub">${t('weeklySpotlightSub', { game: label, mult: WEEKLY_MULTIPLIER })}</span>
    </span>`;

  section.appendChild(card);
  hero.insertAdjacentElement('afterend', section);
}
