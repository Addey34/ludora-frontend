/**
 * Global ranking — the cross-game "GamesZone Points" leaderboard. Reads the
 * incremental `global` Nakama board (top players + the viewer's own rank). All
 * best-effort: if the backend is unreachable or the board is empty, it shows the
 * empty state instead of failing.
 */
import { applyTranslations, t } from '../shared/i18n/i18n.js';
import { getMyGlobalRank, listGlobalRanking, type GlobalRankEntry } from '../shared/net/nakama.js';

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

async function render(): Promise<void> {
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

applyTranslations();
void render();
