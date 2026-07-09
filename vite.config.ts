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
    settings: true,
    controls: [
      { keys: 'Type', action: 'Retype the displayed words' },
      {
        keys: 'Settings',
        action: 'Language (EN/FR) and difficulty (harder = accents, longer words)',
      },
      { keys: 'Timer', action: 'Starts on the first letter' },
    ],
  },
  {
    key: 'snake',
    label: 'Snake',
    color: '--color-snake',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      {
        keys: '<kbd>↑ ↓ ← →</kbd> or <kbd>W A S D</kbd>',
        action: '2D: steer on the board. 3D: left/right turn relative to the snake',
      },
      { keys: 'Swipe (mobile)', action: '2D: swipe a direction. 3D: swipe left/right to turn' },
      { keys: 'Settings', action: 'Difficulty and 2D / 3D visual mode' },
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
    settings: true,
    controls: [
      { keys: '<kbd>↑ ↓ ← →</kbd> or <kbd>W A S D</kbd>', action: 'Slide the tiles' },
      { keys: 'Swipe (mobile)', action: 'Slide the tiles with your finger' },
      { keys: 'Settings', action: 'Grid size (3×3, 4×4 or 5×5)' },
      { keys: 'Goal', action: 'Merge tiles to reach 2048' },
    ],
  },
  {
    key: 'simon',
    label: 'Simon',
    color: '--color-simon',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Watch', action: 'Memorise the flashing colour sequence' },
      { keys: 'Click / tap', action: 'Repeat the sequence in order' },
      { keys: '<kbd>1 2 3 4</kbd>', action: 'Trigger the pads with the keyboard' },
      { keys: 'Settings', action: 'Difficulty (playback speed)' },
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
    settings: true,
    controls: [
      { keys: '<kbd>← →</kbd> or <kbd>A D</kbd>', action: 'Move the piece' },
      { keys: '<kbd>↑</kbd> or <kbd>W</kbd> (or tap)', action: 'Rotate' },
      { keys: '<kbd>↓</kbd> or <kbd>S</kbd>', action: 'Soft drop' },
      { keys: '<kbd>Space</kbd>', action: 'Hard drop' },
      { keys: 'Settings', action: 'Difficulty (starting level / speed)' },
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
    leaderboard: true,
    settings: true,
    controls: [
      { keys: '<kbd>← →</kbd> or <kbd>A D</kbd>', action: 'Move the paddle' },
      { keys: 'Drag / mouse', action: 'Move the paddle' },
      { keys: 'Clear a level', action: 'Advance to the next — endless procedural worlds' },
      { keys: 'Reinforced bricks', action: 'Take several hits before they break' },
      { keys: 'Settings', action: 'Difficulty (starting lives, ball speed)' },
      { keys: 'Goal', action: 'Reach the highest level you can' },
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
    key: 'checkers',
    label: 'Checkers',
    color: '--color-checkers',
    mode: 'duo',
    // Turn-based 2-player: "Settings" popover (bot difficulty + first move) +
    // "Multiplayer" panel (1-v-1 over the relay); both driven by the game.
    settings: true,
    multiplayer: true,
    controls: [
      { keys: 'Click / tap', action: 'Select a piece, then a highlighted square' },
      { keys: 'Captures', action: 'Jumping is mandatory; chained multi-jumps continue' },
      { keys: 'King', action: 'Reach the far row to crown a piece (moves both ways)' },
      { keys: 'Goal', action: "Capture or block all the opponent's pieces" },
    ],
  },
  {
    key: 'reversi',
    label: 'Reversi',
    color: '--color-reversi',
    mode: 'duo',
    // Turn-based 2-player: "Settings" popover (bot difficulty + first move) +
    // "Multiplayer" panel (1-v-1 over the relay); both driven by the game.
    settings: true,
    multiplayer: true,
    controls: [
      { keys: 'Click / tap', action: 'Place a disc on a highlighted square' },
      { keys: 'Flip', action: 'Bracket a line of enemy discs to flip them all' },
      { keys: 'Pass', action: 'No legal move? Your turn is skipped automatically' },
      { keys: 'Goal', action: 'Own the most discs when the board fills up' },
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
    mode: 'duo',
    leaderboard: true,
    settings: true,
    multiplayer: true,
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
    mode: 'duo',
    leaderboard: true,
    settings: true,
    multiplayer: true,
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
    mode: 'duo',
    leaderboard: true,
    settings: true,
    multiplayer: true,
    controls: [
      { keys: 'Click / tap', action: 'Pick the right answer' },
      { keys: '<kbd>1 2 3 4</kbd>', action: 'Choose an option with the keyboard' },
      { keys: 'Settings', action: 'Choose a category, difficulty and mode' },
      { keys: 'Goal', action: 'Answer general-knowledge questions; build a streak' },
    ],
  },
  {
    key: 'conjugation',
    label: 'Conjugation',
    color: '--color-conjugation',
    mode: 'duo',
    leaderboard: true,
    settings: true,
    multiplayer: true,
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
    mode: 'duo',
    leaderboard: true,
    settings: true,
    multiplayer: true,
    controls: [
      { keys: 'Type', action: 'Unscramble the letters and press Enter' },
      { keys: 'Settings', action: 'Language (FR/EN), difficulty and mode' },
      { keys: 'Goal', action: 'Find the hidden word from its shuffled letters' },
    ],
  },
  {
    key: 'hangman',
    label: 'Hangman',
    color: '--color-hangman',
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
    key: 'mastermind',
    label: 'Mastermind',
    color: '--color-mastermind',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Palette / <kbd>1–8</kbd>', action: 'Add a colour to your guess' },
      { keys: '<kbd>⌫</kbd> / <kbd>Enter</kbd>', action: 'Delete a peg / submit the guess' },
      { keys: 'Feedback', action: 'Black peg = right colour & spot, white = right colour only' },
      { keys: 'Settings', action: 'Difficulty scales code length, colours and duplicates' },
      { keys: 'Goal', action: 'Crack the hidden code before you run out of guesses' },
    ],
  },
  {
    key: 'sokoban',
    label: 'Sokoban',
    color: '--color-sokoban',
    mode: 'solo',
    // Level-based puzzle (like Pac-Man): the shell's "Levels" panel drives
    // progression; no leaderboard (clearing levels, not scoring).
    levels: true,
    controls: [
      { keys: '<kbd>↑ ↓ ← →</kbd> or <kbd>W A S D</kbd>', action: 'Move / push a crate' },
      { keys: 'Swipe (mobile)', action: 'Move with your finger' },
      { keys: '<kbd>U</kbd> / <kbd>R</kbd>', action: 'Undo a move / restart the level' },
      { keys: 'Goal', action: 'Push every crate onto a target' },
    ],
  },
  {
    key: 'nonogram',
    label: 'Nonogram',
    color: '--color-nonogram',
    mode: 'solo',
    // Level-based picture logic puzzle (like Sokoban / Pac-Man): the shell's
    // "Levels" panel drives progression; no leaderboard (clearing pictures).
    levels: true,
    controls: [
      { keys: 'Drag', action: 'Paint a run of cells (the first cell sets the stroke)' },
      { keys: 'Fill / Cross', action: 'Toggle the tool (or right-click to cross a cell out)' },
      { keys: 'Clues', action: 'Numbers give the run-lengths in each row and column' },
      { keys: '<kbd>X</kbd> / <kbd>R</kbd>', action: 'Switch tool / restart the level' },
      { keys: 'Goal', action: 'Reveal the hidden picture the clues describe' },
    ],
  },
  {
    key: 'wordsearch',
    label: 'Word Search',
    color: '--color-wordsearch',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Drag', action: 'Trace a straight line of letters over a word' },
      { keys: 'Directions', action: 'Words run any way — including diagonally and backwards' },
      { keys: 'Settings', action: 'Language (FR/EN) and difficulty (grid + word count)' },
      { keys: 'Goal', action: 'Find every word in the list before the clock climbs' },
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
  {
    key: 'taquin',
    label: 'Sliding Puzzle',
    color: '--color-taquin',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: '<kbd>↑ ↓ ← →</kbd>', action: 'Move the blank tile' },
      { keys: 'Click / tap', action: 'Slide a tile toward the blank' },
      { keys: 'Settings', action: 'Grid size (3×3 → 5×5)' },
      { keys: 'Goal', action: 'Sort the tiles in numerical order' },
    ],
  },
  {
    key: 'flappy',
    label: 'Flappy Bird',
    color: '--color-flappy',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: '<kbd>Space</kbd> / click', action: 'Jump (flap your wings)' },
      { keys: 'Settings', action: 'Difficulty (gap width, pipe speed)' },
      { keys: 'Goal', action: 'Fly through as many pipes as possible' },
    ],
  },
  {
    key: 'solitaire',
    label: 'Solitaire',
    color: '--color-solitaire',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Click a card', action: 'Select it (and its sequence)' },
      { keys: 'Click stock', action: 'Draw one card to the waste' },
      { keys: 'Click empty stock', action: 'Recycle waste back to stock' },
      { keys: 'Settings', action: 'Draw mode (1 card, or 3 for a harder game)' },
      { keys: 'Goal', action: 'Move all 52 cards to the four foundations (A→K)' },
    ],
  },
  {
    key: 'mancala',
    label: 'Mancala',
    color: '--color-mancala',
    mode: 'duo',
    settings: true,
    multiplayer: true,
    controls: [
      { keys: 'Click a pit', action: 'Sow its seeds counter-clockwise' },
      { keys: 'Land in own store', action: 'Extra turn' },
      { keys: 'Land in empty own pit', action: 'Capture seeds from opposite pit' },
      { keys: 'Goal', action: 'Most seeds in your store wins' },
    ],
  },
  {
    key: 'blackjack',
    label: 'Blackjack',
    color: '--color-blackjack',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Click Deal', action: 'Deal a new hand with your current bet' },
      { keys: 'Hit', action: 'Draw another card' },
      { keys: 'Stand', action: 'End your turn, dealer plays' },
      { keys: 'Double', action: 'Double bet, draw exactly one card, then stand' },
      { keys: 'Settings', action: 'Starting chips (100 / 200 / 500)' },
      { keys: 'Goal', action: 'Get closer to 21 than the dealer without going over' },
    ],
  },
  {
    key: 'invaders',
    label: 'Space Invaders',
    color: '--color-invaders',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: '<kbd>← →</kbd> or <kbd>A/Q D</kbd>', action: 'Move your ship' },
      { keys: '<kbd>Space</kbd> / <kbd>↑</kbd> / <kbd>W/Z</kbd> / click', action: 'Shoot' },
      { keys: 'Settings', action: 'Difficulty (starting lives, bomb rate)' },
      { keys: 'Goal', action: 'Destroy all aliens before they reach you' },
    ],
  },
  {
    key: 'bubbles',
    label: 'Bubble Shooter',
    color: '--color-bubbles',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Move mouse / <kbd>← →</kbd>', action: 'Aim the shooter' },
      { keys: 'Click / <kbd>Space</kbd>', action: 'Shoot a bubble' },
      { keys: 'Settings', action: 'Difficulty (number of bubble colours)' },
      { keys: 'Goal', action: 'Match 3+ same-color bubbles to pop them' },
    ],
  },
  {
    key: 'dotsboxes',
    label: 'Dots and Boxes',
    color: '--color-dotsboxes',
    mode: 'multi',
    settings: true,
    multiplayer: true,
    controls: [
      { keys: 'Click an edge', action: 'Draw a line between two adjacent dots' },
      { keys: 'Complete a box', action: 'Score a point and take another turn' },
      { keys: 'Settings', action: 'Players (2–4 offline; empty seats are bots)' },
      { keys: 'Goal', action: 'Claim more boxes than your opponents' },
    ],
  },
  {
    key: 'yahtzee',
    label: 'Yahtzee',
    color: '--color-yahtzee',
    mode: 'multi',
    settings: true,
    multiplayer: true,
    controls: [
      { keys: 'Click the dice area', action: 'Roll all non-held dice (up to 3 times per turn)' },
      { keys: 'Click a die', action: 'Hold it (keep between rolls)' },
      { keys: 'Click a category', action: 'Score the current dice in that category' },
      { keys: 'Settings', action: 'Players (2–4 offline; empty seats are bots)' },
      { keys: 'Goal', action: 'Beat your opponents over 13 categories' },
    ],
  },
  {
    key: 'binairo',
    label: 'Binairo',
    color: '--color-binairo',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Click a cell', action: 'Cycle empty → 0 → 1 → empty' },
      { keys: 'Settings', action: 'Grid size (6×6 or 8×8)' },
      { keys: 'Goal', action: 'Fill the grid: no 3 consecutive same, equal 0s and 1s per line' },
    ],
  },
  {
    key: 'kakuro',
    label: 'Kakuro',
    color: '--color-kakuro',
    mode: 'solo',
    leaderboard: true,
    settings: true,
    controls: [
      { keys: 'Click a white cell', action: 'Select it, then type 1–9' },
      { keys: '<kbd>1–9</kbd>', action: 'Enter a digit in the selected cell' },
      { keys: '<kbd>Delete</kbd>', action: 'Clear the selected cell' },
      { keys: 'Settings', action: 'Difficulty (puzzle set)' },
      { keys: 'Goal', action: 'Fill each run with unique digits that sum to the clue' },
    ],
  },
];

// Home-page grouping: each game key is listed under one section, in display
// order. A new game = add its key to a section here (the home renders sections
// from `categories`, see the Handlebars context below).
// `icon` is a Font Awesome glyph name, `color` a token from variables.css; both
// give the sidebar's category tile its identity (icon + accent flyout).
const categoryDefs = [
  {
    id: 'action',
    label: 'Action',
    icon: 'fa-bolt',
    color: '--cat-action',
    keys: ['snake', 'pacman', 'tetris', 'breakout', 'pong', 'flappy', 'invaders', 'bubbles'],
  },
  {
    id: 'puzzle',
    label: 'Puzzle',
    icon: 'fa-puzzle-piece',
    color: '--cat-puzzle',
    keys: [
      '2048',
      'minesweeper',
      'sudoku',
      'nonogram',
      'sokoban',
      'mastermind',
      'taquin',
      'simon',
      'memory',
      'binairo',
      'kakuro',
    ],
  },
  {
    id: 'words',
    label: 'Words',
    icon: 'fa-font',
    color: '--cat-words',
    keys: ['typing', 'motus', 'anagram', 'hangman', 'wordsearch'],
  },
  {
    id: 'quiz',
    label: 'Quiz',
    icon: 'fa-brain',
    color: '--cat-quiz',
    keys: ['math', 'geoquiz', 'trivia', 'conjugation'],
  },
  {
    id: 'board',
    label: 'Board',
    icon: 'fa-chess',
    color: '--cat-board',
    keys: [
      'connect4',
      'ludo',
      'goose',
      'battleship',
      'checkers',
      'reversi',
      'mancala',
      'dotsboxes',
      'yahtzee',
    ],
  },
  {
    id: 'cards',
    label: 'Cards',
    icon: 'fa-clone',
    color: '--cat-cards',
    keys: ['solitaire', 'blackjack'],
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
        // Home-page sections: each category with its games (in listed order).
        const categories = categoryDefs.map((c) => ({
          id: c.id,
          label: c.label,
          icon: c.icon,
          color: c.color,
          games: c.keys.map((k) => games.find((g) => g.key === k)).filter(Boolean),
        }));
        return { games, game, categories };
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
