/**
 * "My Scores" — a cross-game profile that shows the player's best score in every
 * game on this device. Client-only: it reads each game's local leaderboard
 * boards from the shared {@link SCORE_GAMES} registry (base + per-variant), so it
 * needs no backend. Signed-in cross-device sync is a later pass.
 */
import { applyTranslations, t } from '../shared/i18n/i18n.js';
import { SCORE_GAMES, readBestScore } from '../shared/score/scoreGames.js';

interface Row {
  key: string;
  best: number | null;
}

function nameOf(key: string): string {
  return t(`game_${key}`);
}

function card(row: Row): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = `profile-card${row.best === null ? ' is-unplayed' : ''}`;
  a.href = `/${row.key}`;
  a.style.setProperty('--nav-accent', `var(--color-${row.key})`);

  const icon = document.createElement('span');
  icon.className = 'profile-card-icon';
  icon.style.setProperty('--game-icon', `url(/icons/${row.key}.svg)`);
  icon.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'profile-card-body';

  const name = document.createElement('span');
  name.className = 'profile-card-name';
  name.textContent = nameOf(row.key);

  const score = document.createElement('span');
  score.className = 'profile-card-score';
  score.innerHTML =
    row.best === null ? t('profileNotPlayed') : t('profileBest', { score: row.best });

  body.append(name, score);
  a.append(icon, body);
  return a;
}

function render(): void {
  const grid = document.getElementById('profileGrid');
  if (!grid) return;

  const rows: Row[] = SCORE_GAMES.map((g) => ({
    key: g.key,
    best: readBestScore(localStorage, g.storageKey),
  }));
  const byName = (a: Row, b: Row): number => nameOf(a.key).localeCompare(nameOf(b.key));
  const played = rows.filter((r) => r.best !== null).sort(byName);
  const unplayed = rows.filter((r) => r.best === null).sort(byName);

  grid.replaceChildren(...[...played, ...unplayed].map(card));

  const summary = document.getElementById('profileSummary');
  if (summary) {
    summary.removeAttribute('data-i18n'); // fully owned by JS now; keep applyTranslations off it
    summary.textContent = t('profileSummary', { played: played.length, total: rows.length });
  }
}

applyTranslations();
render();
