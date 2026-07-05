# 🎮 GamesZone

A collection of browser arcade & educational games gathered into a single web app. The
interface is fully bilingual (**English / French**, toggled from the top bar). Scores and
level progress are saved locally in the browser (`localStorage`) **and**, when available, on a
self-hosted **online backend** — online is best-effort, with `localStorage` as the
always-working fallback.

## Available games

Games are grouped by family on the home page:

- **Action** — 🐍 Snake · 🟡 Pac-Man (levels) · 🧱 Tetris · 🧱 Breakout · 🏓 Pong
- **Puzzle** — 🔢 2048 · 💣 Minesweeper · 🔢 Sudoku · 🖼️ Nonogram (levels) · 📦 Sokoban
  (levels) · 🎯 Mastermind · 🔴 Simon · 🃏 Memory
- **Words** — ⌨️ Typing · 🟩 Motus · 🔤 Anagrams · 🎪 Hangman · 🔎 Word Search
- **Quiz** — ➗ Mental Math · 🌍 Geo Quiz · 🧠 Trivia · 📚 Conjugation
- **Board** — 🔴 Connect 4 · 🎲 Ludo · 🪿 Game of the Goose · 🚢 Battleship · ⚫ Checkers ·
  ⚪ Reversi

Several games play **against a bot or online** (1-v-1: Pong, Memory, Connect 4, Battleship,
Checkers, Reversi; up to 4 players: Ludo, Game of the Goose).

## Controls

Most games are played with the **keyboard** (arrow keys **or** WASD) or **by touch** (swipe /
drag on mobile); the paddle games (Breakout, Pong) also support the **mouse**, and the board,
quiz and grid games are played by **click / tap**. A help button "ⓘ" recalls each game's
controls (translated with the interface), and a **zen mode** button hides all the chrome to
focus on the board (with best-effort native fullscreen).

## Online features

- **Online leaderboards** — global high scores for the games that opt in (each declares a
  `leaderboardId`).
- **Levels & progression** — Pac-Man, Sokoban and Nonogram unlock levels as you clear them,
  synced across devices.
- **Google sign-in** — optional; players are anonymous by default and can sign in to carry
  their scores and progress across devices.
- **Online multiplayer** — relayed, host-authoritative sessions over a short session code,
  with a lobby where the host starts the game. Every game stays fully playable solo against
  bots if the backend is unreachable.

The backend is a self-hosted [Nakama](https://heroiclabs.com/nakama/) server; the frontend
talks to it only through a thin best-effort wrapper, so the app never breaks if it is
unreachable.

## Tech stack

- [Vite](https://vitejs.dev/) — multi-page app (one page per game)
- **TypeScript** (`strict` mode, plus `noUnusedLocals` / `noUnusedParameters`)
- [Handlebars](https://handlebarsjs.com/) — shared HTML partials (head, sidebar, game shell)
- Modular CSS (design tokens, mobile-first), no framework
- Dependency-free **EN/FR i18n** for all interface text
- [Nakama](https://heroiclabs.com/nakama/) — online leaderboards, auth, storage & realtime
  multiplayer (best-effort)
- [Vitest](https://vitest.dev/) — unit tests; **ESLint** + **Prettier** — quality and format
- Continuous integration (GitHub Actions): format, lint, build + tests on every push / pull
  request

## Getting started

Requirement: [Node.js](https://nodejs.org/).

```bash
npm install      # install dependencies
npm run dev      # dev server on http://localhost:3000
```

## Scripts

| Command              | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `npm run dev`        | Development server (hot reload)                          |
| `npm run build`      | Type-check then production build → `dist/`               |
| `npm run preview`    | Serve the production build locally                       |
| `npm run type-check` | Check types without building (`tsc --noEmit`)            |
| `npm test`           | Run unit tests (Vitest)                                  |
| `npm run lint`       | Analyze the code (ESLint); `lint:fix` auto-fixes         |
| `npm run format`     | Format the code (Prettier); `format:check` verifies      |
| `npm run data`       | Regenerate the `public/data/` datasets from free sources |
| `npm run verify`     | Run the full CI gate locally (format, lint, build, test) |

## Project structure

```
src/
  index.html            # home page
  games/<key>/          # one folder per game
    index.html          #   game page (served at the clean URL /<key>)
    <key>-main.ts       #   entry point (bootstrapGame)
    <Key>Game.ts        #   game controller (extends a shared base)
    <key>.ts            #   pure, unit-tested rules/logic (board/quiz/puzzle games)
  shared/               # all cross-game code, split by domain:
    engine/             #   GameEngine (RAF loop), bootstrap, input
    turn/               #   BoardGame base + TurnRules model (turn-based games)
    quiz/               #   QuizGame base + quiz helpers (educational games)
    words/              #   shared FR/EN word service
    score/              #   leaderboard manager + panel
    levels/             #   levels model + panel
    net/                #   online backend, auth, realtime match
    fx/                 #   particles, screen shake, procedural sound
    ui/                 #   generic DOM chrome (sidebar, overlays, popovers, HUD…)
    i18n/               #   EN/FR interface translation
    bot/                #   AI-opponent primitives (per-game bots live with their game)
    versus/             #   1-v-1 plumbing + multiplayer panel
  partials/             # Handlebars HTML partials (head, sidebar, game shell)
public/
  css/                  # stylesheets (design tokens, one entry per page)
  icons/                # per-game SVG icons
  data/                 # generated datasets (countries, words, verbs, trivia)
vite.config.ts          # Vite config + central game list (single source of truth)
```

Games extend one of three shared bases: **`GameEngine`** (real-time loop), **`BoardGame`**
(turn-based, with bot + online play) or **`QuizGame`** (question/answer educational games).
Each owns the game loop, the score/level plumbing and the game-over overlay, so a new game
only supplies what is genuinely its own.

### Adding a game

1. Add **one entry** to the `games` array in `vite.config.ts` (the single source of truth).
2. Create `src/games/<key>/index.html`, `src/games/<key>/<key>-main.ts`, the controller
   `src/games/<key>/<Key>Game.ts` and the icon `public/icons/<key>.svg`.

The game then appears automatically in the sidebar and on the home page. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the detailed walkthrough.

## Contributing

Contributions are welcome! The project works through **Pull Requests**.
See the [CONTRIBUTING.md](CONTRIBUTING.md) guide for the detailed steps
(fork, branch, checks, adding a game).
