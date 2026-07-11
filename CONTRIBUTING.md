# Contributing to GamesZone

Thanks for wanting to contribute! 🎮 Whether it's fixing a bug, improving a game, or
adding a new one, all help is welcome.

## In short

The project works through **Pull Requests (PRs)**: you work on your own copy, then
propose your changes. Nobody pushes directly to `main` — every change goes through a PR
validated by continuous integration (CI) before being merged.

## Steps to contribute

1. **Fork** the repository (the "Fork" button at the top right on GitHub): you get your
   own copy.
2. **Clone** your copy to your computer:
   ```bash
   git clone https://github.com/<your-username>/GAMES-ZONE.git
   cd GAMES-ZONE
   ```
3. **Create a branch** for your change (don't work on `main`):
   ```bash
   git checkout -b feat/my-awesome-game
   ```
4. **Install and run** the project:
   ```bash
   npm install
   npm run dev      # http://localhost:3000
   ```
5. **Make your changes**, then run the **same checks as the CI** in a single command:
   ```bash
   npm run verify   # format, lint, build + tests — all must pass
   ```
   If Prettier reports formatting issues, fix them with `npm run format`, then re-run.
6. **Commit and push** to your branch:
   ```bash
   git add .
   git commit -m "Add the Pong game"
   git push origin feat/my-awesome-game
   ```
7. **Open a Pull Request** targeting `main` of the original repository. Describe what you
   did. The CI runs automatically; once green ✅, the PR can be merged.

## Adding a new game

The architecture is designed to make this simple. To add a game `pong`:

1. **One entry** in the `games` array of `vite.config.ts` (the single source of truth):
   ```ts
   { key: 'pong', label: 'Pong', color: '--color-pong', mode: 'duo', controls: [ /* ... */ ] }
   ```
   - `key` = the folder name (also used as the icon name and the sidebar active state)
   - `color` = a color token defined in `public/css/base/variables.css`
   - `mode` = the player-count badge in the sidebar: `'solo'`, `'duo'` (1-v-1) or `'multi'` (3+)
   - `controls` = the "How to play" help lines (English text — see the i18n note below)
2. Create the page and the code in `src/games/pong/`:
   - `src/games/pong/index.html` — the page (~15 lines, see an existing game)
   - `src/games/pong/pong-main.ts` — the entry point (~3 lines, calls `bootstrapGame`)
   - `src/games/pong/PongGame.ts` — the controller, which **extends a shared base** (below)
3. Create the icon `public/icons/pong.svg`.

The game then appears **automatically** in the sidebar and on the home page (everything is
driven by the `games` array). Take inspiration from an existing game such as `snake`.

### Pick the right base class

Every game extends one of three shared bases, so it only writes what is genuinely its own:

- **`GameEngine`** (`src/shared/engine/GameEngine.ts`) — real-time games driven by a RAF loop
  (Snake, Tetris, Breakout…). It owns the loop, scoring and the game-over overlay.
- **`BoardGame`** (`src/shared/turn/BoardGame.ts`) — **turn-based** games (Connect 4, Ludo,
  Checkers…). They supply their **pure rules** through the `TurnRules` model (state + legal
  moves + a reducer — no DOM, no time, so they are fully unit-testable), plus rendering and a
  bot; the base drives the turn sequence, the bot and all the networking. Start from
  `src/games/connect4/` (the simplest reference).
- **`QuizGame`** (`src/shared/quiz/QuizGame.ts`) — question/answer **educational** games
  (Mental Math, Geo Quiz, Trivia…). They supply only `makeQuestion()`; the base owns the
  round, scoring, difficulty/mode settings and the recap. Start from `src/games/geoquiz/`.

Put the game's pure logic in its own `<key>.ts` file (no DOM, no randomness in the reducer)
and unit-test it — that's how the board, quiz and puzzle games stay robust.

### New game checklist

Before opening a PR for a new game, make sure it has:

- one `vite.config.ts` entry with accurate capabilities (`settings`, `leaderboard`, `multiplayer`, `levels` when applicable);
- a game page, main entry and game controller under `src/games/<key>/`;
- visible strings wired through i18n;
- controls documented in the "How to play" panel;
- shared HUD stats instead of per-game score markup;
- pure logic covered by co-located tests when the game has rules, scoring or generators;
- `npm run verify` passing locally.

### Online play

To make a game playable **online**, add `settings: true` and `multiplayer: true` to its
`games` entry and reuse the shared lobby (`versus/multiplayerPanel.ts`). The networking
(`net/match.ts`) is relayed and **host-authoritative**, so no server change is needed — the
game stays fully playable solo against bots if the backend is unreachable. Online
**leaderboards** and **levels** need a `leaderboardId` / `levels` config on the game (see the
architecture notes in `CLAUDE.md`).

### Translations (EN / FR)

The interface is bilingual. Any visible string must have an English and a French version:

- **Static markup** → mark it `data-i18n="key"` (text), `data-i18n-html="key"` (markup) or
  `data-i18n-aria="key"` (aria-label); `applyTranslations()` fills it on load.
- **Strings built in TS** → wrap them in `t('key')`.
- Add the `key` to both `en` and `fr` in the `CATALOG` of `src/shared/i18n/i18n.ts` (a parity
  test enforces that the two locales stay in sync).
- The **"How to play" control lines** are a special case: their English text (authored in
  `vite.config.ts`) doubles as the translation key, so you only add the French side to the
  `CONTROLS_FR` map in `i18n.ts` — the English side is generated automatically.

## Best practices

- **One PR = one topic** (one game, one bug, one improvement). The more focused it is,
  the easier it is to review and merge.
- Follow the existing style (TypeScript `strict`, CSS design tokens, mobile-first).
  Formatting is handled by **Prettier** and code style by **ESLint** — run `npm run verify`
  before pushing so the CI passes on the first try.
- Scores are server-authoritative for signed-in players. Guests can choose "Sign in to save";
  the run is stashed only long enough to complete Google sign-in, then recorded through Nakama.
  Offline scores are not queued.
- A question or an idea before coding? Open an **Issue** to discuss it.

Thanks! 🙌
