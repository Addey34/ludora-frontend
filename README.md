# 🎮 GamesZone

A collection of browser arcade & educational games gathered into a single web app. The
interface is fully bilingual (**English / French**, toggled from the shared sidebar). Ranked
scores are recorded through a self-hosted **online backend** for signed-in players; guests can
play every game and are offered sign-in when they want to save a result. Network features are
best-effort, so an unavailable backend never prevents local play.

## Available games

Games are grouped by family on the home page:

- **Action** — Snake · Pac-Man · Tetris · Breakout · Pong · Flappy Bird · Space Invaders ·
  Bubble Shooter
- **Puzzle** — 2048 · Minesweeper · Sudoku · Nonogram · Sokoban · Mastermind · Sliding Puzzle ·
  Simon · Memory · Binairo · Kakuro
- **Words** — Typing · Motus · Anagrams · Hangman · Word Search
- **Quiz** — Mental Math · Geo Quiz · Trivia · Conjugation
- **Board** — Connect 4 · Ludo · Game of the Goose · Battleship · Checkers · Reversi · Mancala ·
  Dots and Boxes · Yahtzee
- **Cards** — Solitaire · Blackjack

Online play reuses four shared families: turn-based board matches, quiz races, independent
score races and identical-challenge completion races. Pong and Memory keep their specialised
realtime/turn implementations. Every online-capable game remains playable offline.

## Controls

Most games are played with the **keyboard** (arrow keys **or** WASD) or **by touch** (swipe /
drag on mobile); the paddle games (Breakout, Pong) also support the **mouse**, and the board,
quiz and grid games are played by **click / tap**. A help button "ⓘ" recalls each game's
controls (translated with the interface), and a **zen mode** button hides all the chrome to
focus on the board (with best-effort native fullscreen).

## Online features

- **Leaderboards** — per-game best scores plus a cross-game GamesZone Points ranking.
- **Levels & progression** — Pac-Man, Sokoban and Nonogram unlock levels as you clear them,
  synced across devices.
- **Google sign-in** — optional; players are anonymous by default and can sign in to carry
  their scores and progress across devices.
- **Profile and friends** — account management, friend presence, friend scores and shareable
  score challenges.
- **Online multiplayer** — shared lobbies over a short session code; authority follows each
  contract (host-owned boards/questions or independent score runs). Every game stays fully
  playable solo if the backend is unreachable.

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

| Command                      | Description                                               |
| ---------------------------- | --------------------------------------------------------- |
| `npm run dev`                | Development server (hot reload)                           |
| `npm run build`              | Type-check then production build → `dist/`                |
| `npm run preview`            | Serve the production build locally                        |
| `npm run type-check`         | Check types without building (`tsc --noEmit`)             |
| `npm test`                   | Run Vitest and generator tool tests                       |
| `npm run lint`               | Analyze the code (ESLint); `lint:fix` auto-fixes          |
| `npm run format`             | Format the code (Prettier); `format:check` verifies       |
| `npm run data`               | Regenerate the `public/data/` datasets from free sources  |
| `npm run game:new -- --help` | Show the transactional new-game generator                 |
| `npm run verify`             | Full CI gate: format, lint, dead code, build, size, tests |

## Project structure

```
src/
  index.html            # home page
  games/<key>/          # one folder per game
    index.html          #   game page (served at the clean URL /<key>)
    <key>-main.ts       #   entry point (bootstrapGame)
    <Key>Game.ts        #   game controller (extends a shared base)
    <key>.ts            #   pure rules for a board/puzzle game (when applicable)
    <key>Logic.ts       #   extracted pure logic for an animated/legacy controller
    *.test.ts           #   co-located Vitest coverage for pure logic
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
