import { describe, it, expect, beforeEach } from 'vitest';
import { featuredGame } from './weekly.js';
import { SCORE_GAMES } from '../score/scoreGames.js';
import { markWeeklyChallenge } from './weeklyFeature.js';

// The real featured game for the current week — so the test tracks the same
// rotation the app uses, whatever week it runs in.
const featured = featuredGame(SCORE_GAMES.map((g) => g.key))!;

describe('markWeeklyChallenge', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="game-grid">
        <a class="game-tile" data-game="${featured}"></a>
        <a class="game-tile" data-game="__other__"></a>
      </div>
      <nav class="sidebar">
        <a class="sidebar-link" data-nav="${featured}">
          <span class="sidebar-label">x</span><span class="sidebar-mode" data-mode="solo"></span>
        </a>
        <a class="sidebar-link" data-nav="__other__"><span class="sidebar-mode"></span></a>
      </nav>`;
  });

  it('flames only the featured game, on its home tile and sidebar link', () => {
    markWeeklyChallenge();

    const tile = document.querySelector(`.game-tile[data-game="${featured}"]`)!;
    const other = document.querySelector('.game-tile[data-game="__other__"]')!;
    expect(tile.querySelector('.weekly-flame')).not.toBeNull();
    expect(other.querySelector('.weekly-flame')).toBeNull();

    const flame = document
      .querySelector(`.sidebar-link[data-nav="${featured}"]`)!
      .querySelector('.sidebar-flame');
    expect(flame).not.toBeNull();
    // Sits immediately left of the players badge.
    expect(flame!.nextElementSibling?.classList.contains('sidebar-mode')).toBe(true);
    // Carries an explanatory tooltip.
    expect(flame!.getAttribute('title')).toBeTruthy();
  });

  it('is idempotent — a second run adds no duplicate flame', () => {
    markWeeklyChallenge();
    markWeeklyChallenge();

    const tile = document.querySelector(`.game-tile[data-game="${featured}"]`)!;
    expect(tile.querySelectorAll('.weekly-flame')).toHaveLength(1);
    const link = document.querySelector(`.sidebar-link[data-nav="${featured}"]`)!;
    expect(link.querySelectorAll('.sidebar-flame')).toHaveLength(1);
  });
});
