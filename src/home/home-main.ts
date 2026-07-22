import { t } from '../shared/i18n/i18n.js';
import {
  loadGameLibrary,
  toggleFavoriteGame,
  type LoadedGameLibrary,
} from '../shared/discovery/gameLibrary.js';
import { SCORE_GAMES } from '../shared/score/scoreGames.js';
import { dailyGame, weeklyGames } from '../shared/spotlight/spotlight.js';
import { markSpotlight } from '../shared/weekly/weeklyFeature.js';
import { matchesSearch } from './homeSearch.js';

const catalogue = document.querySelector<HTMLElement>('.game-grid-all');
const featured = document.getElementById('featuredGames');
const search = document.getElementById('gameSearch') as HTMLInputElement | null;
const count = document.getElementById('gameCount');
const empty = document.getElementById('homeEmpty');
const clearSearch = document.getElementById('clearSearch') as HTMLButtonElement | null;
const catalogueTitle = document.getElementById('allGamesTitle');
const catalogueKicker = document.querySelector<HTMLElement>('.home-catalogue .home-section-kicker');
const filters = [...document.querySelectorAll<HTMLButtonElement>('[data-category-filter]')];
const tiles = [...document.querySelectorAll<HTMLElement>('.game-grid-all .game-tile')];
const recentSection = document.getElementById('recentGamesSection');
const recentGames = document.getElementById('recentGames');
const favoriteSection = document.getElementById('favoriteGamesSection');
const favoriteGames = document.getElementById('favoriteGames');

let library: LoadedGameLibrary | null = null;

function favoriteLabel(key: string, favorite: boolean): string {
  const gameLabel =
    catalogue
      ?.querySelector<HTMLElement>(`.game-tile[data-game="${key}"]`)
      ?.getAttribute('aria-label') ?? key;
  return t(favorite ? 'removeFromFavorites' : 'addToFavorites', { game: gameLabel });
}

function createFavoriteButton(key: string, favorite: boolean): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'game-favorite';
  button.type = 'button';
  button.dataset.favoriteToggle = '';
  button.dataset.favoriteGame = key;
  button.classList.toggle('is-favorite', favorite);
  button.setAttribute('aria-pressed', String(favorite));
  button.setAttribute('aria-label', favoriteLabel(key, favorite));
  button.title = favoriteLabel(key, favorite);
  button.innerHTML = '<i class="fas fa-star" aria-hidden="true"></i>';
  return button;
}

function createPersonalCard(key: string): HTMLElement | null {
  const source = catalogue?.querySelector<HTMLElement>(`.game-tile[data-game="${key}"]`);
  if (!source || !library) return null;
  const tile = source.cloneNode(true) as HTMLElement;
  tile.hidden = false;
  tile.querySelectorAll('.weekly-flame, .daily-flame').forEach((badge) => badge.remove());
  const card = document.createElement('div');
  card.className = 'game-card';
  card.dataset.gameCard = key;
  card.append(tile, createFavoriteButton(key, library.favorites.includes(key)));
  return card;
}

function renderPersonalGrid(
  section: HTMLElement | null,
  grid: HTMLElement | null,
  keys: string[]
): void {
  if (!section || !grid) return;
  grid.replaceChildren();
  for (const key of keys) {
    const card = createPersonalCard(key);
    if (card) grid.append(card);
  }
  section.hidden = grid.childElementCount === 0;
}

function renderLibrary(): void {
  if (!library) return;
  renderPersonalGrid(
    recentSection,
    recentGames,
    library.recent.map((item) => item.key)
  );
  renderPersonalGrid(favoriteSection, favoriteGames, library.favorites);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-favorite-toggle]')) {
    const key = button.dataset.favoriteGame ?? '';
    const favorite = library.favorites.includes(key);
    button.classList.toggle('is-favorite', favorite);
    button.setAttribute('aria-pressed', String(favorite));
    button.setAttribute('aria-label', favoriteLabel(key, favorite));
    button.title = favoriteLabel(key, favorite);
  }
  markSpotlight();
}

async function initLibrary(): Promise<void> {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-favorite-toggle]')) {
    const key = button.dataset.favoriteGame ?? '';
    button.setAttribute('aria-label', favoriteLabel(key, false));
    button.title = favoriteLabel(key, false);
  }
  library = await loadGameLibrary();
  renderLibrary();
}

function buildFeatured(): void {
  if (!catalogue || !featured) return;
  const pool = SCORE_GAMES.map((game) => game.key);
  const daily = dailyGame(pool);
  const picks = [daily, ...weeklyGames(pool)].filter(
    (key, index, values): key is string => Boolean(key) && values.indexOf(key) === index
  );

  for (const key of picks.slice(0, 5)) {
    const source = catalogue.querySelector<HTMLElement>(`.game-tile[data-game="${key}"]`);
    if (!source) continue;
    const clone = source.cloneNode(true) as HTMLElement;
    clone.classList.add('featured-tile');
    if (key === daily) clone.classList.add('featured-tile--daily');
    featured.appendChild(clone);
  }
  markSpotlight();
}

let activeCategory = 'all';

function setActiveCategory(category: string): void {
  activeCategory = filters.some((filter) => filter.dataset.categoryFilter === category)
    ? category
    : 'all';
  for (const filter of filters) {
    const selected = filter.dataset.categoryFilter === activeCategory;
    filter.classList.toggle('is-active', selected);
    filter.setAttribute('aria-pressed', String(selected));
  }
}

function syncDiscoveryUrl(query: string): void {
  const url = new URL(window.location.href);
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  if (activeCategory !== 'all') url.searchParams.set('category', activeCategory);
  else url.searchParams.delete('category');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function applyFilters({ syncUrl = true }: { syncUrl?: boolean } = {}): void {
  const query = search?.value.trim() ?? '';
  const isSearching = query.length > 0;
  if (isSearching && activeCategory !== 'all') setActiveCategory('all');

  document.body.classList.toggle('home-searching', isSearching);
  if (clearSearch) clearSearch.hidden = !isSearching;
  if (catalogueTitle) catalogueTitle.textContent = t(isSearching ? 'searchResults' : 'allGames');
  if (catalogueKicker) {
    catalogueKicker.textContent = t(isSearching ? 'searchResultsKicker' : 'browseKicker');
  }

  let visible = 0;
  for (const tile of tiles) {
    const matchesText = matchesSearch(tile.dataset.search ?? tile.dataset.label ?? '', query);
    const matchesCategory = activeCategory === 'all' || tile.dataset.category === activeCategory;
    const show = matchesText && matchesCategory;
    const card = tile.closest<HTMLElement>('.game-card');
    if (card) card.hidden = !show;
    else tile.hidden = !show;
    if (show) visible += 1;
  }

  if (count) {
    count.textContent =
      visible === 1 ? t('gameShown') : t('gamesShown').replace('{count}', String(visible));
  }
  if (empty) empty.hidden = visible !== 0;
  if (syncUrl) syncDiscoveryUrl(query);
}

function resetSearch(): void {
  if (!search) return;
  search.value = '';
  applyFilters();
  search.focus();
}

for (const filter of filters) {
  filter.addEventListener('click', () => {
    setActiveCategory(filter.dataset.categoryFilter ?? 'all');
    applyFilters();
  });
}

search?.addEventListener('input', () => applyFilters());
search?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && search.value) {
    event.preventDefault();
    resetSearch();
    return;
  }
  if (event.key !== 'Enter') return;
  const firstResult = tiles.find((tile) => !tile.closest<HTMLElement>('.game-card')?.hidden);
  const href = firstResult?.getAttribute('href');
  if (href) window.location.assign(href);
});
clearSearch?.addEventListener('click', resetSearch);
document.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-favorite-toggle]');
  const key = button?.dataset.favoriteGame;
  if (!button || !key) return;
  button.disabled = true;
  void toggleFavoriteGame(key).then((next) => {
    library = next;
    renderLibrary();
  });
});

const initialParams = new URL(window.location.href).searchParams;
const initialQuery = initialParams.get('q') ?? '';
const initialCategory = initialParams.get('category') ?? 'all';
if (search) search.value = initialQuery;
setActiveCategory(initialQuery ? 'all' : initialCategory);
buildFeatured();
applyFilters({ syncUrl: false });
void initLibrary();

export {};
