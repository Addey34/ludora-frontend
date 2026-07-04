import { defineConfig } from 'vite';
import handlebars from 'vite-plugin-handlebars';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(projectRoot, 'src');

// =============================================================================
// SINGLE SOURCE OF TRUTH for the games. Everything derives from it:
//   - the build entry points (rollupOptions.input);
//   - the Handlebars context (`games`) that feeds the rail (sidebar.hbs) AND the
//     home menu (index.html) via {{#each games}}.
// Adding a game = ADD ONE LINE here (then create src/<key>/index.html +
// <key>-main.ts + <Key>.ts). Convention: each game lives in src/<key>/, its page
// is src/<key>/index.html (served at the clean URL /<key>). `key` is the folder
// name (also used as data-nav for the rail's active state AND as the name of its
// SVG logo: public/icons/<key>.svg).
// `color` = a solid-color token (base/variables.css) to color the rail's active
// item (and, via --title-color, the game page title).
// `mode` = the player-count badge shown next to the rail label: 'solo' (1
// player), 'duo' (1-v-1) or 'multi' (3+); rendered by sidebar.hbs.
// `controls` = { keys, action } lines shown in the "How to play" help
// (the "i" button), rendered by shell-open via the per-page context (see below).
// `keys` may contain <kbd>…</kbd> HTML (rendered unescaped, trusted content
// defined here) to display real keys; e.g. arrows + WASD.
// `levels: true` (optional) renders the shell's collapsible "Levels" panel for
// that game; the level set + unlock rules are declared in the game's own code.
// `leaderboard: true` (optional) renders the collapsible "Leaderboard" panel
// (hosting the score table); omit it for games where a high-score board makes no
// sense (e.g. Pac-Man, which is level-based).
// `speed: true` (optional) adds the typing game's extra "Speed" column to that
// leaderboard table.
// `settings: true` (optional) renders the shell's "Settings" popover (filled by
// ui/settingsPanel.ts; e.g. Pong's bot difficulty + win score).
// `multiplayer: true` (optional) renders the shell's "Multiplayer" popover for
// relayed 1-v-1 sessions (versus/multiplayerPanel.ts; e.g. Pong).
// =============================================================================
const games = [
  {
    key: 'typing',
    label: 'Typing',
    color: '--color-typing',
    mode: 'solo',
    leaderboard: true,
    speed: true,
    controls: [
      { keys: 'Type', action: 'Retype the displayed words' },
      { keys: 'Timer', action: 'Starts on the first letter' },
    ],
  },
  {
    key: 'snake',
    label: 'Snake',
    color: '--color-snake',
    mode: 'solo',
    leaderboard: true,
    controls: [
      { keys: '<kbd>↑ ↓ ← →</kbd> or <kbd>W A S D</kbd>', action: 'Steer the snake' },
      { keys: 'Swipe (mobile)', action: 'Steer the snake with your finger' },
      { keys: 'Goal', action: 'Eat the mice, avoid your tail' },
    ],
  },
  {
    key: 'pacman',
    label: 'Pacman',
    color: '--color-pacman',
    mode: 'solo',
    // Drives the shell's "Levels" panel (the level config itself lives in
    // PacmanGame); set `levels: true` on any game that opts into level selection.
    levels: true,
    controls: [
      { keys: '<kbd>↑ ↓ ← →</kbd> or <kbd>W A S D</kbd>', action: 'Move Pac-Man' },
      { keys: 'Swipe (mobile)', action: 'Move Pac-Man with your finger' },
      { keys: 'Goal', action: 'Eat all the pellets' },
    ],
  },
  {
    key: '2048',
    label: '2048',
    color: '--color-2048',
    mode: 'solo',
    leaderboard: true,
    controls: [
      { keys: '<kbd>↑ ↓ ← →</kbd> or <kbd>W A S D</kbd>', action: 'Slide the tiles' },
      { keys: 'Swipe (mobile)', action: 'Slide the tiles with your finger' },
      { keys: 'Goal', action: 'Merge tiles to reach 2048' },
    ],
  },
  {
    key: 'simon',
    label: 'Simon',
    color: '--color-simon',
    mode: 'solo',
    leaderboard: true,
    controls: [
      { keys: 'Watch', action: 'Memorise the flashing colour sequence' },
      { keys: 'Click / tap', action: 'Repeat the sequence in order' },
      { keys: '<kbd>1 2 3 4</kbd>', action: 'Trigger the pads with the keyboard' },
      { keys: 'Goal', action: 'Reproduce the longest sequence you can' },
    ],
  },
  {
    key: 'motus',
    label: 'Motus',
    color: '--color-motus',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Type', action: 'Enter a 5-letter word, then Enter' },
      { keys: '<kbd>Enter</kbd> / <kbd>⌫</kbd>', action: 'Submit / delete a letter' },
      { keys: 'Green / Yellow / Grey', action: 'Right spot / wrong spot / not in word' },
      { keys: 'Goal', action: 'Find the hidden word in 6 tries' },
    ],
  },
  {
    key: 'tetris',
    label: 'Tetris',
    color: '--color-tetris',
    mode: 'solo',
    leaderboard: true,
    controls: [
      { keys: '<kbd>← →</kbd> or <kbd>A D</kbd>', action: 'Move the piece' },
      { keys: '<kbd>↑</kbd> or <kbd>W</kbd> (or tap)', action: 'Rotate' },
      { keys: '<kbd>↓</kbd> or <kbd>S</kbd>', action: 'Soft drop' },
      { keys: '<kbd>Space</kbd>', action: 'Hard drop' },
      { keys: 'Swipe (mobile)', action: '← → to move, ↓ to drop' },
    ],
  },
  {
    key: 'memory',
    label: 'Memory',
    color: '--color-memory',
    mode: 'duo',
    settings: true,
    multiplayer: true,
    controls: [
      { keys: 'Click / tap', action: 'Flip two cards' },
      { keys: 'Pair', action: 'Found → you play again (+1)' },
      { keys: 'Timer', action: '15 s per turn, otherwise an auto move' },
      { keys: 'Goal', action: 'More pairs than your opponent' },
    ],
  },
  {
    key: 'minesweeper',
    label: 'Minesweeper',
    color: '--color-minesweeper',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Click / tap', action: 'Reveal a cell (the first click is always safe)' },
      { keys: 'Right-click', action: 'Flag a suspected mine' },
      { keys: '🚩 button', action: 'Toggle flag mode (tap to flag on touch)' },
      { keys: 'Goal', action: 'Reveal every safe cell without hitting a mine' },
    ],
  },
  {
    key: 'breakout',
    label: 'Breakout',
    color: '--color-breakout',
    mode: 'solo',
    controls: [
      { keys: '<kbd>← →</kbd> or <kbd>A D</kbd>', action: 'Move the paddle' },
      { keys: 'Drag / mouse', action: 'Move the paddle' },
      { keys: 'Goal', action: 'Destroy all the bricks' },
    ],
  },
  {
    key: 'pong',
    label: 'Pong',
    color: '--color-pong',
    mode: 'duo',
    // Enables the shell's "Settings" popover (bot config) and the "Multiplayer"
    // panel (code-based session); both driven by the game.
    settings: true,
    multiplayer: true,
    controls: [
      { keys: '<kbd>↑ ↓</kbd> or <kbd>W S</kbd>', action: 'Move your paddle' },
      { keys: 'Drag / mouse', action: 'Move your paddle' },
      { keys: 'Goal', action: 'Score past the opponent paddle' },
    ],
  },
  {
    key: 'ludo',
    label: 'Ludo',
    color: '--color-ludo',
    mode: 'multi',
    // "Settings" popover (bot difficulty) + "Multiplayer" panel (up to 4 players
    // over the relay); both driven by the game.
    settings: true,
    multiplayer: true,
    controls: [
      { keys: 'Die', action: 'Rolled automatically on your turn' },
      { keys: 'Click / tap', action: 'Choose which horse to move' },
      { keys: '<kbd>6</kbd>', action: 'Brings a horse out of the stable and rolls again' },
      { keys: 'Goal', action: 'Bring your 4 horses home to the center' },
    ],
  },
  {
    key: 'connect4',
    label: 'Connect 4',
    color: '--color-connect4',
    mode: 'duo',
    // Turn-based 2-player: "Settings" popover (bot difficulty) + "Multiplayer"
    // panel (1-v-1 over the relay); both driven by the game.
    settings: true,
    multiplayer: true,
    controls: [
      { keys: 'Click / tap', action: 'Drop a disc in a column' },
      { keys: '<kbd>← →</kbd>', action: 'Aim a column' },
      { keys: '<kbd>↓</kbd> / <kbd>Enter</kbd>', action: 'Drop the disc' },
      { keys: 'Goal', action: 'Line up four of your discs in a row' },
    ],
  },
  {
    key: 'battleship',
    label: 'Battleship',
    color: '--color-battleship',
    mode: 'duo',
    // Two phases: ship placement (local) then turn-based combat. "Settings"
    // (bot difficulty) + "Multiplayer" (1-v-1 relay); host-authoritative.
    settings: true,
    multiplayer: true,
    controls: [
      { keys: 'Click / tap', action: 'Place a ship or fire a shot' },
      { keys: '<kbd>R</kbd>', action: 'Rotate the ship during placement' },
      { keys: 'Auto-place', action: 'Place the remaining ships randomly' },
      { keys: 'Goal', action: 'Sink all 5 enemy ships first' },
    ],
  },
  {
    key: 'goose',
    label: 'Game of the Goose',
    color: '--color-goose',
    mode: 'multi',
    settings: true,
    multiplayer: true,
    controls: [
      { keys: 'Click / tap', action: 'Roll the dice' },
      { keys: '🦢 Goose', action: 'Roll again, moving forward by the same number' },
      { keys: '🌉 Bridge (6→12)', action: 'Jump straight to square 12' },
      { keys: '⚓ Inn (19)', action: 'Skip 1 turn' },
      { keys: '🌀 Well (31) / Prison (52)', action: 'Skip 3 turns' },
      { keys: '💀 Death (58)', action: 'Back to square 1' },
      { keys: 'Finish (63)', action: 'Exact count required — first to arrive wins' },
    ],
  },
  {
    key: 'math',
    label: 'Mental Math',
    color: '--color-math',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Type', action: 'Answer the sum and press Enter' },
      { keys: 'Settings', action: 'Pick a difficulty and Classic / Timed mode' },
      { keys: 'Goal', action: 'Chain correct answers — a streak boosts the score' },
    ],
  },
  {
    key: 'geoquiz',
    label: 'Geo Quiz',
    color: '--color-geoquiz',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Click / tap', action: 'Pick the right answer' },
      { keys: '<kbd>1 2 3 4</kbd>', action: 'Choose an option with the keyboard' },
      { keys: 'Settings', action: 'Pick a difficulty and Classic / Timed mode' },
      { keys: 'Goal', action: 'Match countries and capitals; keep your streak alive' },
    ],
  },
  {
    key: 'trivia',
    label: 'Trivia',
    color: '--color-trivia',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Click / tap', action: 'Pick the right answer' },
      { keys: '<kbd>1 2 3 4</kbd>', action: 'Choose an option with the keyboard' },
      { keys: 'Settings', action: 'Choose a category, difficulty and mode' },
      { keys: 'Goal', action: 'Answer general-knowledge questions; build a streak' },
    ],
  },
  {
    key: 'conjug',
    label: 'Conjugation',
    color: '--color-conjug',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Type', action: 'Write the conjugated form and press Enter' },
      { keys: 'Settings', action: 'Difficulty unlocks more tenses; Classic / Timed' },
      { keys: 'Goal', action: 'Conjugate French verbs; accents are forgiven' },
    ],
  },
  {
    key: 'anagram',
    label: 'Anagrams',
    color: '--color-anagram',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Type', action: 'Unscramble the letters and press Enter' },
      { keys: 'Settings', action: 'Language (FR/EN), difficulty and mode' },
      { keys: 'Goal', action: 'Find the hidden word from its shuffled letters' },
    ],
  },
  {
    key: 'pendu',
    label: 'Hangman',
    color: '--color-pendu',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Click / tap', action: 'Guess a letter on the keyboard' },
      { keys: '<kbd>A – Z</kbd>', action: 'Guess a letter with the keyboard' },
      { keys: 'Settings', action: 'Language (FR/EN) and difficulty (word length)' },
      { keys: 'Goal', action: 'Find the word before the figure is complete (6 misses)' },
    ],
  },
  {
    key: 'sudoku',
    label: 'Sudoku',
    color: '--color-sudoku',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Click / tap', action: 'Select a cell' },
      { keys: '<kbd>1 – 9</kbd>', action: 'Fill the selected cell (0 / Backspace clears)' },
      { keys: '<kbd>↑ ↓ ← →</kbd>', action: 'Move the selection' },
      { keys: 'Goal', action: 'Fill every row, column and box with 1–9' },
    ],
  },
];

// Dev/preview equivalent of render.yaml's clean-URL rewrites.
// Three cases handled, in order:
//   1. `/<key>`      → 301 to `/<key>/` (trailing-slash redirect so that the
//      browser resolves sub-resource URLs like `./ludo-main.ts` relative to
//      `/<key>/`, which this middleware then rewrites to the real path below).
//   2. `/<key>/`     → serve `src/games/<key>/index.html` (the game's entry
//      point; static pages like /privacy stay under src/<key>/ not src/games/).
//   3. `/<key>/foo`  → serve `src/games/<key>/foo` (the game's JS/TS modules
//      and other sub-resources, e.g. `/ludo/ludo-main.ts` → `/games/ludo/ludo-main.ts`).
//      Without this the browser's relative import `./ludo-main.ts` would 404
//      because Vite would look in `src/ludo/` which no longer exists.
const games_keys = new Set(games.map((g) => g.key));
const static_pages = new Set(['privacy', 'legal']);
interface RewriteRes {
  writeHead(status: number, headers: Record<string, string>): void;
  end(): void;
}
function rewriteCleanUrl(req: { url?: string }, res: RewriteRes, next: () => void): void {
  if (req.url) {
    const [path, rest = ''] = req.url.split(/(?=[?#])/);
    // Split into segments: '/ludo/ludo-main.ts' → ['ludo', 'ludo-main.ts']
    const segments = path.split('/').filter(Boolean);
    const key = segments[0] ?? '';

    if (games_keys.has(key)) {
      if (segments.length <= 1 && !path.endsWith('/')) {
        // Case 1: `/<key>` → redirect to `/<key>/`
        res.writeHead(301, { Location: `/${key}/${rest}` });
        res.end();
        return;
      }
      if (segments.length <= 1) {
        // Case 2: `/<key>/` → game entry point
        req.url = `/games/${key}/index.html${rest}`;
      } else {
        // Case 3: `/<key>/foo` → game sub-resource
        req.url = `/games/${key}/${segments.slice(1).join('/')}${rest}`;
      }
    } else if (static_pages.has(key)) {
      if (!path.endsWith('/')) {
        res.writeHead(301, { Location: `/${key}/${rest}` });
        res.end();
        return;
      }
      req.url = `/${key}/index.html${rest}`;
    }
  }
  next();
}

export default defineConfig({
  // The HTML pages (= entry points) live in src/, co-located with their code.
  // `publicDir` and `outDir` stay at the project root.
  root: srcRoot,
  publicDir: resolve(projectRoot, 'public'),
  // Multi-page app: disable the SPA fallback that would otherwise serve the home
  // index.html for any unmatched route (the bug where game URLs showed the home).
  appType: 'mpa',
  plugins: [
    // Clean URLs in dev & preview, mirroring render.yaml's rewrites in prod.
    {
      name: 'gameszone-clean-urls',
      configureServer(server) {
        server.middlewares.use(rewriteCleanUrl);
      },
      configurePreviewServer(server) {
        server.middlewares.use(rewriteCleanUrl);
      },
    },
    // Shared HTML partials (head, game chrome, sidebar) included via {{> name }}.
    // `games` is exposed to every page ({{#each}} loop); `game` is the current
    // page's game (derived from the path), used by shell-open for the help.
    handlebars({
      partialDirectory: resolve(srcRoot, 'partials'),
      context(pagePath: string) {
        // Each game page lives in src/<key>/index.html: we find the current game
        // by its folder segment (the home page, src/index.html, has none).
        const path = pagePath.replace(/\\/g, '/');
        const game = games.find((g) => path.includes(`/${g.key}/`));
        return { games, game };
      },
    }),
  ],
  build: {
    outDir: resolve(projectRoot, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      // index + one entry per game, derived from the `games` list. Each game page
      // is src/<key>/index.html -> built to dist/<key>/index.html, served at the
      // clean URL /<key> (see render.yaml for the rewrite).
      input: {
        main: resolve(srcRoot, 'index.html'),
        privacy: resolve(srcRoot, 'privacy/index.html'),
        legal: resolve(srcRoot, 'legal/index.html'),
        ...Object.fromEntries(
          games.map((g) => [g.key, resolve(srcRoot, `games/${g.key}/index.html`)])
        ),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
