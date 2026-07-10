/**
 * Leaderboard with three tabs:
 *  - Personal: the player's best score in every game (localStorage, per-game).
 *  - Friends: placeholder for now (a friend graph is a later feature).
 *  - World: the global "GamesZone Points" ranking (incremental Nakama board).
 * Best-effort throughout; the World tab reveals itself only when the backend
 * answers.
 */
import { applyTranslations, t } from '../shared/i18n/i18n.js';
import { SCORE_GAMES, readBestScore } from '../shared/score/scoreGames.js';
import { getMyGlobalRank, listGlobalRanking, type GlobalRankEntry } from '../shared/net/nakama.js';

// --- Personal tab -----------------------------------------------------------

interface Row {
  key: string;
  best: number | null;
}

function nameOf(key: string): string {
  return t(`game_${key}`);
}

function gameCard(row: Row): HTMLAnchorElement {
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

function renderPersonal(): void {
  const grid = document.getElementById('profileGrid');
  if (!grid) return;
  const rows: Row[] = SCORE_GAMES.map((g) => ({
    key: g.key,
    best: readBestScore(localStorage, g.storageKey),
  }));
  const byName = (a: Row, b: Row): number => nameOf(a.key).localeCompare(nameOf(b.key));
  const played = rows.filter((r) => r.best !== null).sort(byName);
  const unplayed = rows.filter((r) => r.best === null).sort(byName);
  grid.replaceChildren(...[...played, ...unplayed].map(gameCard));
}

// --- World tab --------------------------------------------------------------

function rankRow(entry: GlobalRankEntry): HTMLLIElement {
  const li = document.createElement('li');
  li.className = `global-row${entry.isMe ? ' is-me' : ''}`;

  const rank = document.createElement('span');
  rank.className = 'global-rank';
  rank.textContent = `#${entry.rank}`;

  const name = document.createElement('span');
  name.className = 'global-name';
  name.textContent = entry.username;

  const pts = document.createElement('span');
  pts.className = 'global-pts';
  pts.textContent = t('globalPoints', { score: entry.score });

  li.append(rank, name, pts);
  return li;
}

let worldLoaded = false;
async function renderWorld(): Promise<void> {
  if (worldLoaded) return;
  worldLoaded = true;
  const list = document.getElementById('globalList');
  const empty = document.getElementById('rankEmpty');
  const myEl = document.getElementById('profileMyRank');
  if (!list) return;

  const [top, mine] = await Promise.all([listGlobalRanking(50), getMyGlobalRank()]);
  if (top.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  list.replaceChildren(...top.map(rankRow));
  if (myEl) {
    myEl.textContent = mine
      ? t('globalMyRank', { rank: mine.rank, score: mine.score })
      : t('globalUnranked');
  }
}

// --- Tabs -------------------------------------------------------------------

function setupTabs(): void {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('.lb-tab')];
  const panels = [...document.querySelectorAll<HTMLElement>('.lb-panel')];
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      tabs.forEach((tb) => tb.classList.toggle('is-active', tb === tab));
      panels.forEach((p) => (p.hidden = p.dataset.panel !== name));
      if (name === 'world') void renderWorld();
    });
  }
}

applyTranslations();
renderPersonal();
setupTabs();

// Open a specific tab when linked (e.g. the sidebar "Friends" shortcut).
const initialTab = new URLSearchParams(location.search).get('tab');
if (initialTab) {
  document.querySelector<HTMLButtonElement>(`.lb-tab[data-tab="${initialTab}"]`)?.click();
}
