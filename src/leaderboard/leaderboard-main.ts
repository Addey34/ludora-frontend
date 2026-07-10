/**
 * Leaderboard with three direct tabs:
 *  - Personal: the player's best local score in every score-enabled game.
 *  - Friends: GamesZone Points scoped to the friend graph.
 *  - Global: the public GamesZone Points ranking.
 * Best-effort throughout; ranking panels show their empty state when the
 * backend cannot answer or when there is no data yet.
 */
import { applyTranslations, t } from '../shared/i18n/i18n.js';
import { requireGoogleLogin } from '../shared/net/authGuard.js';
import { SCORE_GAMES } from '../shared/score/scoreGames.js';
import {
  getMyBestScores,
  getMyGlobalRank,
  listFriendRanking,
  listGlobalRanking,
  type GlobalRankEntry,
} from '../shared/net/nakama.js';

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

async function renderPersonal(): Promise<void> {
  const grid = document.getElementById('profileGrid');
  if (!grid) return;
  const best = await getMyBestScores();
  const rows: Row[] = SCORE_GAMES.map((g) => {
    const value = best[g.key];
    return { key: g.key, best: typeof value === 'number' ? value : null };
  });
  const byName = (a: Row, b: Row): number => nameOf(a.key).localeCompare(nameOf(b.key));
  const played = rows.filter((r) => r.best !== null).sort(byName);
  const unplayed = rows.filter((r) => r.best === null).sort(byName);
  grid.replaceChildren(...[...played, ...unplayed].map(gameCard));
}

function rankRow(entry: GlobalRankEntry): HTMLLIElement {
  const li = document.createElement('li');
  li.className = `global-row${entry.isMe ? ' is-me' : ''}`;

  const rank = document.createElement('span');
  rank.className = 'global-rank';
  if (entry.rank <= 3) {
    rank.classList.add('is-medal', `medal-${entry.rank}`);
    rank.textContent = String(entry.rank);
  } else {
    rank.textContent = `#${entry.rank}`;
  }

  const name = document.createElement('span');
  name.className = 'global-name';
  name.textContent = entry.username;

  const pts = document.createElement('span');
  pts.className = 'global-pts';
  pts.textContent = t('globalPoints', { score: entry.score });

  li.append(rank, name, pts);
  return li;
}

let globalLoaded = false;
async function renderGlobal(): Promise<void> {
  if (globalLoaded) return;
  globalLoaded = true;
  const list = document.getElementById('globalList');
  const empty = document.getElementById('rankEmpty');
  const myEl = document.getElementById('profileMyRank');
  if (!list) return;

  const [top, mine] = await Promise.all([listGlobalRanking(50), getMyGlobalRank()]);
  if (top.length === 0) {
    if (empty) empty.hidden = false;
    if (myEl) myEl.textContent = t('globalUnranked');
    return;
  }
  list.replaceChildren(...top.map(rankRow));
  if (myEl) {
    myEl.textContent = mine
      ? t('globalMyRank', { rank: mine.rank, score: mine.score })
      : t('globalUnranked');
  }
}

let friendsLoaded = false;
async function renderFriends(): Promise<void> {
  if (friendsLoaded) return;
  friendsLoaded = true;
  const list = document.getElementById('friendsRankList');
  const empty = document.getElementById('friendsRankEmpty');
  if (!list) return;

  const ranking = await listFriendRanking();
  if (ranking.length <= 1) {
    if (empty) empty.hidden = false;
    return;
  }
  list.replaceChildren(...ranking.map(rankRow));
}

function setupTabs(): void {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('.lb-tab')];
  const panels = [...document.querySelectorAll<HTMLElement>('.lb-panel')];
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      tabs.forEach((tb) => tb.classList.toggle('is-active', tb === tab));
      panels.forEach((p) => (p.hidden = p.dataset.panel !== name));
      if (name === 'friends') void renderFriends();
      if (name === 'global') void renderGlobal();
    });
  }
}

applyTranslations();
void (async () => {
  if (!(await requireGoogleLogin())) return;
  void renderPersonal();
  setupTabs();

  const params = new URLSearchParams(location.search);
  const initialTab = params.get('tab');
  const tabAliases: Record<string, string> = {
    perso: 'personal',
    personal: 'personal',
    friends: 'friends',
    world: 'global',
    ranking: 'global',
    global: 'global',
  };
  const tabName = initialTab ? tabAliases[initialTab] : null;
  if (tabName) {
    document.querySelector<HTMLButtonElement>(`.lb-tab[data-tab="${tabName}"]`)?.click();
  }
})();
