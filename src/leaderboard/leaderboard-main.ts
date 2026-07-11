/**
 * Leaderboard with three direct tabs:
 *  - Personal: the player's best server-backed score in every score-enabled game.
 *  - Friends: GamesZone Points scoped to the friend graph.
 *  - Global: the public GamesZone Points ranking.
 */
import { applyTranslations, t } from '../shared/i18n/i18n.js';
import { requireGoogleUser } from '../shared/net/authGuard.js';
import {
  getMyBestScores,
  getMyGlobalRank,
  listFriendRanking,
  listGlobalRanking,
  type GlobalRankEntry,
} from '../shared/net/nakama.js';
import { SCORE_GAMES } from '../shared/score/scoreGames.js';

interface GameRow {
  key: string;
  best: number | null;
}

let gameRows: GameRow[] = [];
let filteredGameRows: GameRow[] = [];

function nameOf(key: string): string {
  return t(`game_${key}`);
}

function formatScore(score: number | null): string {
  return score === null ? '-' : String(score);
}

function gameRow(row: GameRow, rank: number): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = `lb-record-row${row.best === null ? ' is-unplayed' : ''}`;
  link.href = `/${row.key}`;
  link.style.setProperty('--nav-accent', `var(--color-${row.key})`);

  const pos = document.createElement('span');
  pos.className = 'lb-record-pos';
  pos.textContent = String(rank);

  const game = document.createElement('span');
  game.className = 'lb-record-game';

  const icon = document.createElement('span');
  icon.className = 'profile-card-icon lb-record-icon';
  icon.style.setProperty('--game-icon', `url(/icons/${row.key}.svg)`);
  icon.setAttribute('aria-hidden', 'true');

  const title = document.createElement('span');
  title.className = 'lb-record-title';
  title.textContent = nameOf(row.key);

  game.append(icon, title);

  const best = document.createElement('span');
  best.className = 'lb-record-score';
  best.textContent = formatScore(row.best);

  const state = document.createElement('span');
  state.className = 'lb-record-state';
  state.textContent = row.best === null ? t('profileNotPlayed') : t('play');

  link.append(pos, game, best, state);
  return link;
}

function updateSummary(): void {
  const summary = document.getElementById('gameSummary');
  if (!summary) return;
  const played = gameRows.filter((row) => row.best !== null).length;
  summary.textContent = t('leaderboardGameSummary', {
    shown: filteredGameRows.length,
    total: gameRows.length,
    played,
  });
}

function renderPersonalRows(): void {
  const table = document.getElementById('profileGrid');
  if (!table) return;
  table.replaceChildren(...filteredGameRows.map((row, index) => gameRow(row, index + 1)));
  updateSummary();
}

function setupGameSearch(): void {
  const input = document.getElementById('gameSearch') as HTMLInputElement | null;
  if (!input || input.dataset.ready === '1') return;
  input.dataset.ready = '1';
  input.addEventListener('input', () => {
    const query = input.value.trim().toLocaleLowerCase();
    filteredGameRows = query
      ? gameRows.filter((row) => nameOf(row.key).toLocaleLowerCase().includes(query))
      : gameRows;
    renderPersonalRows();
  });
}

async function renderPersonal(): Promise<void> {
  const best = await getMyBestScores().catch((): Record<string, number> => ({}));
  const rows: GameRow[] = SCORE_GAMES.map((game) => {
    const value = best[game.key];
    return { key: game.key, best: typeof value === 'number' ? value : null };
  });

  const byScoreThenName = (a: GameRow, b: GameRow): number => {
    if (a.best !== null && b.best !== null && a.best !== b.best) return b.best - a.best;
    if (a.best !== null && b.best === null) return -1;
    if (a.best === null && b.best !== null) return 1;
    return nameOf(a.key).localeCompare(nameOf(b.key));
  };

  gameRows = rows.sort(byScoreThenName);
  filteredGameRows = gameRows;
  setupGameSearch();
  renderPersonalRows();
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
      panels.forEach((panel) => (panel.hidden = panel.dataset.panel !== name));
      if (name === 'friends') void renderFriends();
      if (name === 'global') void renderGlobal();
    });
  }
}

applyTranslations();
void (async () => {
  const user = await requireGoogleUser();
  if (!user) return;
  setupTabs();
  void renderPersonal();

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
