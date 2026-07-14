import { describe, it, expect, beforeEach } from 'vitest';
import { dailyGame, weeklyGames } from '../spotlight/spotlight.js';
import { SCORE_GAMES } from '../score/scoreGames.js';
import { markSpotlight } from './weeklyFeature.js';

// Track the same rotation the app uses, whatever day/week the test runs in.
const pool = SCORE_GAMES.map((g) => g.key);
const daily = dailyGame(pool)!;
const weeklyOnly = weeklyGames(pool).find((g) => g !== daily)!;
const cold = pool.find((g) => g !== daily && !weeklyGames(pool).includes(g))!;

describe('markSpotlight', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="game-grid">
        <a class="game-tile" data-game="${daily}"></a>
        <a class="game-tile" data-game="${weeklyOnly}"></a>
        <a class="game-tile" data-game="${cold}"></a>
      </div>
      <nav class="sidebar">
        <a class="sidebar-link" data-nav="${weeklyOnly}">
          <span class="sidebar-label">x</span><span class="sidebar-mode" data-mode="solo"></span>
        </a>
      </nav>`;
  });

  it('badges the daily pick and the weekly set, leaving cold games bare', () => {
    markSpotlight();

    const dailyTile = document.querySelector(`.game-tile[data-game="${daily}"]`)!;
    const weeklyTile = document.querySelector(`.game-tile[data-game="${weeklyOnly}"]`)!;
    const coldTile = document.querySelector(`.game-tile[data-game="${cold}"]`)!;

    expect(dailyTile.querySelector('.daily-flame')).not.toBeNull();
    expect(dailyTile.querySelector('.weekly-flame')).toBeNull(); // daily wins, no double badge
    expect(weeklyTile.querySelector('.weekly-flame')).not.toBeNull();
    expect(coldTile.querySelector('.daily-flame, .weekly-flame')).toBeNull();
  });

  it('badges the sidebar link left of the players badge, with a tooltip', () => {
    markSpotlight();
    const flame = document
      .querySelector(`.sidebar-link[data-nav="${weeklyOnly}"]`)!
      .querySelector('.sidebar-flame')!;
    expect(flame).not.toBeNull();
    expect(flame.nextElementSibling?.classList.contains('sidebar-mode')).toBe(true);
    expect(flame.getAttribute('title')).toBeTruthy();
  });

  it('is idempotent — a second run adds no duplicate badge', () => {
    markSpotlight();
    markSpotlight();
    const dailyTile = document.querySelector(`.game-tile[data-game="${daily}"]`)!;
    expect(dailyTile.querySelectorAll('.daily-flame')).toHaveLength(1);
    const link = document.querySelector(`.sidebar-link[data-nav="${weeklyOnly}"]`)!;
    expect(link.querySelectorAll('.sidebar-flame')).toHaveLength(1);
  });
});
