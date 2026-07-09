import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { SCORE_GAMES } from '../score/scoreGames.js';

/**
 * Feature-wiring integrity: every capability a game *declares* in the
 * `vite.config.ts` games array must actually be wired in its source. These are
 * the drift catchers a pure-logic test can't be — e.g. a game that adds a
 * `settings` difficulty but forgets to scope its leaderboard per difficulty
 * (one shared table for every difficulty) fails here instead of shipping.
 */

const root = process.cwd();
const gamesDir = resolve(root, 'src/games');

interface GameEntry {
  key: string;
  hasControls: boolean;
  settings: boolean;
  leaderboard: boolean;
  levels: boolean;
  multiplayer: boolean;
}

/** Parses the `const games = [ … ]` array out of vite.config.ts (flags only). */
function parseGames(): GameEntry[] {
  const src = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
  const anchor = 'const games = [';
  const start = src.indexOf(anchor) + anchor.length;
  let depth = 1;
  let i = start;
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') depth--;
  }
  const block = src.slice(start, i - 1);

  // Split top-level `{ … }` objects (brace depth), keeping nested control arrays.
  const objects: string[] = [];
  let d = 0;
  let cur = '';
  for (const ch of block) {
    if (ch === '{') {
      if (d === 0) cur = '';
      d++;
    }
    if (d > 0) cur += ch;
    if (ch === '}') {
      d--;
      if (d === 0) objects.push(cur);
    }
  }

  return objects
    .map((o) => ({
      key: (o.match(/key:\s*['"]([\w-]+)['"]/) || [])[1] ?? '',
      hasControls: /controls:\s*\[/.test(o),
      settings: /\bsettings:\s*true/.test(o),
      leaderboard: /\bleaderboard:\s*true/.test(o),
      levels: /\blevels:\s*true/.test(o),
      multiplayer: /\bmultiplayer:\s*true/.test(o),
    }))
    .filter((g) => g.key);
}

/** Concatenated (non-test) TypeScript of a game folder. */
function gameSource(key: string): string {
  const dir = resolve(gamesDir, key);
  if (!existsSync(dir)) return '';
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => readFileSync(resolve(dir, f), 'utf8'))
    .join('\n');
}

function baseClass(src: string): 'QuizGame' | 'BoardGame' | 'GameEngine' {
  if (/extends\s+QuizGame/.test(src)) return 'QuizGame';
  if (/extends\s+BoardGame/.test(src)) return 'BoardGame';
  return 'GameEngine';
}

const games = parseGames();

describe('game feature wiring', () => {
  it('parses the games array', () => {
    expect(games.length).toBeGreaterThan(30);
  });

  // "Infos (toujours)": the How-to-play panel only renders when a game declares
  // controls, so every game must have them.
  it.each(games)('$key declares controls (the info panel)', (g) => {
    expect(g.hasControls, `${g.key} is missing a controls: [...] block`).toBe(true);
  });

  it.each(games.filter((g) => g.settings))('$key with settings wires a settings panel', (g) => {
    const src = gameSource(g.key);
    const wired =
      /setupSettingsPanel/.test(src) ||
      baseClass(src) === 'QuizGame' || // QuizGame provides the settings panel
      /extraSettings/.test(src);
    expect(wired, `${g.key} declares settings but never wires setupSettingsPanel`).toBe(true);
  });

  it.each(games.filter((g) => g.multiplayer))('$key with multiplayer wires versus', (g) => {
    const src = gameSource(g.key);
    const wired =
      /setupVersus/.test(src) ||
      /setupMultiplayerPanel/.test(src) ||
      /setupScoreRace/.test(src) ||
      /setupCompletionRace/.test(src);
    expect(wired, `${g.key} declares multiplayer but never wires it`).toBe(true);
  });

  it.each(games.filter((g) => g.levels))('$key with levels wires setupLevels', (g) => {
    expect(
      /setupLevels/.test(gameSource(g.key)),
      `${g.key} declares levels but no setupLevels`
    ).toBe(true);
  });

  it.each(games.filter((g) => g.leaderboard))(
    '$key with a leaderboard is in the cross-game score registry',
    (g) => {
      const registryKeys = new Set(SCORE_GAMES.map((s) => s.key));
      expect(
        registryKeys.has(g.key),
        `${g.key} declares a leaderboard but is missing from SCORE_GAMES (scoreGames.ts)`
      ).toBe(true);
    }
  );

  it('the sitemap lists every game route', () => {
    const sitemap = readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8');
    const missing = games.filter((g) => !sitemap.includes(`/${g.key}</loc>`)).map((g) => g.key);
    expect(missing, `missing from public/sitemap.xml: ${missing.join(', ')}`).toEqual([]);
  });

  // The leaderboard-per-setting rule: a plain (GameEngine) game that has BOTH a
  // settings knob and a leaderboard must scope the board per setting, otherwise
  // incomparable runs (e.g. Easy vs Hard) share one table. QuizGame handles this
  // via its own hook; BoardGame games have no leaderboard.
  const needsVariant = games.filter(
    (g) => g.settings && g.leaderboard && baseClass(gameSource(g.key)) === 'GameEngine'
  );
  it.each(needsVariant)('$key scopes its leaderboard per setting', (g) => {
    expect(
      /setLeaderboardVariant/.test(gameSource(g.key)),
      `${g.key} has settings + leaderboard but never calls setLeaderboardVariant ` +
        `(every difficulty/size would share one table)`
    ).toBe(true);
  });
});
