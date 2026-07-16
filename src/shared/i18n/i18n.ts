import { GENERATED_GAME_CATALOG } from './generatedGames.js';

/**
 * Interface localisation — simple, modular, dependency-free.
 *
 * The pattern (reuse it everywhere, incl. future games):
 *   - a **static** HTML string → mark it `data-i18n="key"` (or `data-i18n-aria`);
 *     {@link applyTranslations} fills it in on load.
 *   - a **dynamic** string built in TS → wrap it in {@link t}: `t('key')`.
 *   - add the string to {@link CATALOG} (English is the source of truth; add the
 *     French value when ready — a missing key falls back to English, never breaks).
 *
 * The language toggle (next to the sound button) persists the choice and reloads,
 * so every string re-renders. This is interface language only; a game's *content*
 * language (e.g. Anagrams/Hangman word lists) stays a separate per-game setting.
 */

export type Locale = 'en' | 'fr';
export const LOCALES: Locale[] = ['en', 'fr'];

const STORAGE_KEY = 'gz-lang';

/**
 * Base translation catalog. Add a key to `en`, then its `fr` translation.
 * (The per-game "How to play" control lines are merged in below from
 * {@link CONTROLS_FR}; the whole thing is exported as {@link CATALOG}.)
 */
const BASE_CATALOG: Record<Locale, Record<string, string>> = {
  en: {
    play: 'Play',
    playAgain: 'Play again',
    nextLevel: 'Next level',
    viewLeaderboard: 'View leaderboard',
    leaderboard: 'Leaderboard',
    howToPlay: 'How to play',
    helpAria: 'Help: how to play',
    immersiveMode: 'Immersive mode',
    thPlayer: 'Player',
    thSpeed: 'Speed',
    // Game-over overlay + save prompt (GameEngine, shared by every game).
    gameOver: 'Game Over!',
    gameOverAria: 'Game over',
    youWin: 'You win! 🎉',
    youLose: 'You lose…',
    youWon: 'You won!',
    draw: 'Draw!',
    score: 'Score',
    scoreValue: 'Score: {score}',
    signInToSave: 'Sign in to save',
    scoreSaved: 'Score saved!',
    scoreNotSaved: 'Score not saved: server unreachable.',
    gzpEarned: '+{n} GamesZone Points',
    gzpEarnGuest: 'Sign in to earn +{n} GamesZone Points',
    gzpBonusSpotlight: 'featured game ×{mult}',
    gzpBonusDifficulty: 'difficulty ×{mult}',
    // Versus result overlay (BoardGame).
    rematch: 'Rematch',
    quit: 'Quit',
    waitingForRematch: 'Waiting for a rematch from the host…',
    scoreRaceOpponent: 'Opponent',
    scoreRaceWin: 'You win!',
    scoreRaceLose: 'Opponent wins',
    scoreRaceTie: 'Tie game',
    scoreRaceWaitingTitle: 'Run finished',
    scoreRaceWaitingBody: 'Waiting for your opponent to finish.',
    scoreRaceResult: 'Score: <strong>{score}</strong> — Opponent: <strong>{opponent}</strong>',
    completionRaceResult: 'You: <strong>{you}</strong> — Opponent: <strong>{opponent}</strong>',
    you: 'You',
    me: 'Me',
    opponent: 'Opponent',
    bot: 'Bot',
    cancel: 'Cancel',
    // Multiplayer lobby panel (shared by every multiplayer: true game).
    multiplayer: 'Multiplayer',
    mpCreate: 'Create a session',
    mpOr: 'or',
    mpCode: 'Code',
    mpJoin: 'Join',
    mpCodeAria: 'Session code to join',
    mpCopyCode: 'Copy code',
    mpStart: 'Start',
    mpWaitingPlayer: 'Waiting for another player to join.',
    mpInProgress: 'Game in progress',
    mpRoleHost: 'You are the host.',
    mpRoleGuest: 'You are the guest.',
    mpWaitingHost: 'Waiting for the host to start…',
    mpStillWaiting:
      'Still waiting — the host may have already started or stepped away. Leave and try again.',
    mpLeave: 'Leave session',
    mpBotsNote: 'Empty seats will be filled by bots.',
    mpCreating: 'Creating the session…',
    mpCannotConnect: 'Cannot connect to the server.',
    mpConnecting: 'Connecting…',
    mpInvalidCode: 'Invalid code or server unreachable.',
    mpEnded: 'The session has ended.',
    mpLeaveConfirm: 'Leave the session?',
    mpLeaveBody: 'You will return to a solo game.',
    // Quiz recap (QuizGame).
    flawless: 'Flawless! ✨',
    roundOver: 'Round over',
    correct: 'correct',
    bestStreak: 'Best streak',
    // Per-game game-over titles + recaps.
    victory: 'Victory! 🎉',
    defeat: 'Defeat…',
    hanged: 'Hanged!',
    cleared: 'Cleared! ✨',
    solved: 'Solved! ✨',
    hangmanStreakOne: '<p>You solved <strong>{n}</strong> word in a row.</p>',
    hangmanStreakMany: '<p>You solved <strong>{n}</strong> words in a row.</p>',
    hangmanWord: '<p>The word was <strong>{target}</strong> — {score} points.</p>',
    minesweeperRecap: '<p>Swept in <strong>{time}</strong> — {score} points.</p>',
    motusRecapOne: '<p>Found <strong>{target}</strong> in {n} try — {score} points.</p>',
    motusRecapMany: '<p>Found <strong>{target}</strong> in {n} tries — {score} points.</p>',
    sudokuRecap: '<p>Grid solved in <strong>{time}</strong> — {score} points.</p>',
    typingCorrectWords: 'Correct words: {n}',
    typingTypedLetters: 'Typed letters: {n}',
    typingWpm: 'Speed: {n} words/minute',
    typingLpm: 'Speed: {n} letters/minute',
    // Geo Quiz + Trivia content settings.
    quizType: 'Quiz',
    geoCapitals: 'Capitals',
    geoFlags: 'Flags',
    geoMixed: 'Mixed',
    category: 'Category',
    catAll: 'All',
    catScience: 'Science',
    catHistory: 'History',
    catCulture: 'Culture',
    catNature: 'Nature',
    battleshipWin: '<p>All enemy ships are sunk. Well done!</p>',
    battleshipLose: '<p>My entire fleet has been sunk.</p>',
    gooseWin: '<p>You reached square 63 first!</p>',
    gooseLose: '<p>{name} reached the finish square first.</p>',
    settings: 'Settings',
    difficulty: 'Difficulty',
    visualMode: 'Visual mode',
    visualMode2d: 'Classic 2D',
    visualMode3d: 'Immersive 3D',
    size: 'Size',
    players: 'Players',
    solDrawLabel: 'Draw',
    solDraw1: 'Draw 1',
    solDraw3: 'Draw 3',
    bjStartChips: 'Chips',
    bots: 'Bots',
    firstMove: 'First move',
    firstTo: 'First to',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    mode: 'Mode',
    classic: 'Classic',
    timed: 'Timed',
    survival: 'Survival',
    roundsSetting: 'Questions',
    timeSetting: 'Time',
    answerTimeSetting: 'Time / question',
    livesSetting: 'Lives',
    language: 'Language',
    muteSound: 'Mute sound',
    enableSound: 'Enable sound',
    allGames: 'All games',
    themeSwitcher: 'Visual theme',
    themeArcade: 'Neon arcade',
    themeMidnight: 'Midnight',
    themeDaylight: 'Daylight',
    themeAmber: 'Amber (low-blue)',
    // Cross-game profile ("My Scores").
    home: 'Home',
    profileTitle: 'Profile',
    profileAccountSubtitle: 'Your account and display name.',
    profileGuest: 'Sign in with Google to set your name and appear on the leaderboard.',
    profileNotPlayed: 'Not played yet',
    dangerZone: 'Danger zone',
    deleteAccount: 'Delete account',
    deleteAccountDesc:
      'Permanently delete your account and all your data — scores, friends and progress. This cannot be undone.',
    deleteAccountConfirm: 'This permanently erases everything. Are you sure?',
    deleteAccountYes: 'Yes, delete everything',
    deleteAccountDone: 'Account deleted.',
    deleteAccountError: 'Could not delete the account. Please try again.',
    // Per-game SEO blurbs (shown on-page + used as the meta description).
    seo_typing:
      'Boost your typing speed with this free browser typing game. Race the clock, raise your WPM and climb the leaderboard — no download.',
    seo_snake:
      'Play the classic Snake game free online. Eat, grow and beat your high score in this fast browser arcade game — no download, no sign-up.',
    seo_pacman:
      'Play Pac-Man free in your browser. Clear every maze, dodge the ghosts and chase a high score across increasingly tricky levels.',
    seo_simon:
      'Play Simon, the classic memory game. Repeat the growing colour-and-sound sequence as long as you can, free in your browser.',
    seo_motus:
      'Guess the hidden word in six tries — a free Wordle-style word game in your browser, in French and English. No download.',
    seo_tetris:
      'Play Tetris free online. Stack and clear lines, speed up and chase a high score in this timeless block-puzzle browser game.',
    seo_memory:
      'Play the Memory card-matching game free online. Flip the cards, find the pairs and test your recall against a bot or a friend.',
    seo_minesweeper:
      'Play Minesweeper free in your browser. Flag the mines and clear the grid on easy, medium or hard — the classic logic puzzle.',
    seo_breakout:
      'Play Breakout free online. Bounce the ball, smash every brick and beat your high score in this classic arcade browser game.',
    seo_pong:
      'Play Pong, the original arcade game, free in your browser. Face a bot or a friend in fast 1-v-1 table-tennis action.',
    seo_ludo:
      'Play Ludo (Petits Chevaux) free online. Roll the dice and race your tokens home — up to 4 players or against bots.',
    seo_connect4:
      'Play Connect 4 free in your browser. Drop your discs, line up four in a row and beat a friend or a smart bot.',
    seo_checkers:
      'Play Checkers (Draughts) free online. Capture your opponent’s pieces and king your way to victory against a bot or a friend.',
    seo_reversi:
      'Play Reversi (Othello) free in your browser. Flip discs to your colour and take control of the board against a bot or a friend.',
    seo_battleship:
      'Play Battleship free online. Place your fleet, hunt your opponent’s ships and sink them all — versus a bot or a friend.',
    seo_goose:
      'Play the Game of the Goose (Jeu de l’oie) free online. Roll, race across the board and dodge the traps — up to 4 players.',
    seo_math:
      'Sharpen your mental math free in your browser. Solve timed arithmetic drills, build streaks and climb the leaderboard.',
    seo_geoquiz:
      'Test your geography free online. Guess countries, capitals and flags in this fast multiple-choice quiz — no download.',
    seo_trivia:
      'Play free trivia quiz online. Answer questions across many categories, build streaks and challenge a friend — no download.',
    seo_conjugation:
      'Practise French verb conjugation free in your browser. Type the correct form, build streaks and master every tense.',
    seo_anagram:
      'Unscramble the letters to find the word — a free anagram word game in your browser, in French and English. No download.',
    seo_hangman:
      'Play Hangman free online. Guess the hidden word letter by letter before you run out of tries — French and English.',
    seo_mastermind:
      'Play Mastermind free in your browser. Crack the secret colour code with logic and deduction — the classic code-breaker.',
    seo_sokoban:
      'Play Sokoban free online. Push every crate onto its target in this classic warehouse puzzle across many handcrafted levels.',
    seo_nonogram:
      'Play Nonogram (Picross) free in your browser. Use the number clues to reveal the hidden picture — logic puzzles by level.',
    seo_wordsearch:
      'Play Word Search free online. Find every hidden word in the grid — a relaxing word puzzle in French and English.',
    seo_sudoku:
      'Play Sudoku free in your browser. Fill the 9×9 grid on easy, medium or hard — the classic number logic puzzle, no download.',
    seo_taquin:
      'Play the 15-puzzle (Taquin) free online. Slide the tiles back into order in this classic sliding puzzle — beat the clock.',
    seo_flappy:
      'Play Flappy Bird free in your browser. Tap to fly between the pipes and chase a high score — just one more try!',
    seo_solitaire:
      'Play Klondike Solitaire free online. Stack the cards and clear the tableau in the timeless patience card game — no download.',
    seo_mancala:
      'Play Mancala free in your browser. Sow the seeds, capture your opponent’s stones and outsmart the bot in this ancient board game.',
    seo_blackjack:
      'Play Blackjack (21) free online. Hit, stand and beat the dealer without going bust — the classic casino card game.',
    seo_invaders:
      'Play Space Invaders free in your browser. Blast the alien waves, dodge their fire and chase a high score — retro arcade action.',
    seo_bubbles:
      'Play Bubble Shooter free online. Match three bubbles to pop them and clear the board in this addictive arcade game.',
    seo_dotsboxes:
      'Play Dots and Boxes free in your browser. Draw lines, close boxes and outscore a friend or a bot in this pen-and-paper classic.',
    seo_yahtzee:
      'Play Yahtzee free online. Roll the dice, chase combos and score big in the classic dice game — versus a bot or a friend.',
    seo_binairo:
      'Play Binairo (Takuzu) free in your browser. Fill the grid with 0s and 1s by the rules — a binary logic puzzle by size.',
    seo_kakuro:
      'Play Kakuro free online. Fill the grid so every run adds up to its clue — a cross-sum number puzzle, no download.',
    tabPersonal: 'Personal',
    tabFriends: 'Friends',
    tabGlobal: 'Global',
    friendsSubtitle: 'Add friends by code and see who is online.',
    yourFriendCode: 'Your friend code',
    copy: 'Copy',
    addFriend: 'Add',
    friendCodePlaceholder: 'Enter a friend code',
    friendsHeading: 'Friends',
    friendsEmpty: 'No friends yet — share your code to add each other.',
    friendsGuest: 'Sign in with Google to add friends and see who is online.',
    friendRequests: 'Friend requests',
    friendWantsToAdd: 'wants to be your friend',
    friendAccept: 'Accept',
    friendDecline: 'Decline',
    friendRemove: 'Remove friend',
    friendAccepted: 'Friend added!',
    friendDeclined: 'Request declined.',
    friendRemoved: 'Friend removed.',
    friendAdded: 'Friend request sent!',
    friendAddError: 'Could not add that friend.',
    friendCodeCopied: 'Friend code copied!',
    friendPending: 'Pending',
    friendsRankEmpty: 'No ranked friends yet — add friends and play a game.',
    online: 'Online',
    offline: 'Offline',
    editName: 'Edit name',
    displayNameLabel: 'Display name',
    saveName: 'Save',
    nameSaved: 'Name updated!',
    nameSaveError: 'Could not update the name.',
    // Friend challenges (share-a-score links).
    challengeReceived: '{name} dares you to beat {score}!',
    challengeReceivedAnon: 'Beat {score} to win the challenge!',
    challengeAddFriend: 'Add {name}',
    challengeWon: 'Challenge beaten — you passed {score}! 🎉',
    challengeButton: 'Challenge a friend',
    challengeShareText: 'Can you beat my score of {score}?',
    challengeCopied: 'Challenge link copied!',
    // Global cross-game ranking (GamesZone Points).
    globalMyRank: 'You are #{rank} with {score} GZP.',
    globalUnranked: 'Play a game to enter the global ranking.',
    globalPoints: '{score} GZP',
    leaderboardSubtitle: 'The top GamesZone players across every game.',
    leaderboardEmpty: 'No ranking yet — play a game to get on the board.',
    leaderboardSearch: 'Search a game',
    leaderboardGameColumn: 'Game',
    leaderboardBestColumn: 'Best',
    leaderboardGameSummary: '{shown}/{total} games · {played} played',
    // Feedback popover.
    feedback: 'Feedback',
    feedbackHint: 'Rate this game',
    feedbackPlaceholder: 'Your comment (optional)…',
    send: 'Send',
    sending: 'Sending…',
    feedbackThanks: 'Thanks for your feedback!',
    feedbackError: 'Could not send — please try again later.',
    feedbackNeedRating: 'Pick a rating first.',
    // Home categories (keys match the category id: cat_<id>).
    cat_action: 'Action',
    cat_puzzle: 'Puzzle',
    cat_words: 'Words',
    cat_quiz: 'Quiz',
    cat_board: 'Board',
    // Game names (keys match the game key: game_<key>).
    game_typing: 'Typing',
    game_snake: 'Snake',
    game_pacman: 'Pacman',
    game_2048: '2048',
    game_simon: 'Simon',
    game_motus: 'Motus',
    game_tetris: 'Tetris',
    game_memory: 'Memory',
    game_minesweeper: 'Minesweeper',
    game_breakout: 'Breakout',
    game_pong: 'Pong',
    game_ludo: 'Ludo',
    game_connect4: 'Connect 4',
    game_battleship: 'Battleship',
    game_goose: 'Game of the Goose',
    game_math: 'Mental Math',
    game_geoquiz: 'Geo Quiz',
    game_trivia: 'Trivia',
    game_conjugation: 'Conjugation',
    game_anagram: 'Anagrams',
    game_hangman: 'Hangman',
    game_sudoku: 'Sudoku',
    game_checkers: 'Checkers',
    game_reversi: 'Reversi',
    game_wordsearch: 'Word Search',
    game_sokoban: 'Sokoban',
    game_mastermind: 'Mastermind',
    game_nonogram: 'Nonogram',
    game_taquin: 'Sliding Puzzle',
    game_flappy: 'Flappy Bird',
    game_mancala: 'Mancala',
    game_solitaire: 'Solitaire',
    // Levels panel (shared).
    levels: 'Levels',
    levelChoose: 'Level {n} — choose a level',
    levelN: 'Level {n}',
    levelLocked: 'Level {n} (locked)',
    // Battleship placement UI + ship names.
    reset: 'Reset',
    ready: 'Ready',
    bsRotate: 'Rotate (R)',
    bsAutoPlace: 'Auto-place',
    bsWaitingPlace: 'Waiting for the opponent to finish placing ships…',
    bsFireHint: 'Click a cell to fire!',
    bsMyShips: 'My ships',
    bsEnemyShips: 'Enemy ships',
    ship_carrier: 'Carrier',
    ship_battleship: 'Battleship',
    ship_cruiser: 'Cruiser',
    ship_submarine: 'Submarine',
    ship_destroyer: 'Destroyer',
    // Misc game strings.
    typingPlaceholder: 'Type the word here…',
    motusNotEnough: 'Not enough letters',
    startSquare: 'Start',
    msBoom: 'Boom! 💥',
    msHitMine: '<p>You hit a mine. Better luck next time!</p>',
    motusOutOfTries: 'Out of tries',
    motusWordWas: '<p>The word was <strong>{target}</strong>.</p>',
    erase: 'Erase',
    rollDie: 'Roll the die',
    signIn: 'Sign in',
    authRequired: 'Sign in with Google to access this page.',
    signOut: 'Sign out',
    card: 'Card',
    // HUD stat labels (screen-reader aria-labels; the HUD shows icons).
    hudTime: 'Time',
    hudBest: 'Best',
    hudTurn: 'Turn',
    hudLives: 'Lives',
    hudLevel: 'Level',
    bkWorld: 'World',
    hudStreak: 'Streak',
    dailyStreak: 'Daily streak: {n} 🔥',
    spotlightDaily: 'Game of the day — earn GamesZone Points here today.',
    spotlightWeekly: 'Game of the week — earn GamesZone Points here this week.',
    hudStatus: 'Status',
    hudRound: 'Round',
    hudQuestion: 'Question',
    hudLines: 'Lines',
    hudWordsSolved: 'Words solved',
    hudTries: 'Tries',
    hudMinesLeft: 'Mines left',
    hudGuessesLeft: 'Guesses left',
    hudDiscs: 'Discs',
    hudFound: 'Found',
    hudOpponent: 'Opp.',
    matchOver: 'Match over',
    hudMoves: 'Moves',
    hudPushes: 'Pushes',
    hudFilled: 'Filled',
    // Reversi: shown when the opponent has no legal move and must skip a turn.
    opponentPassed: 'Opponent had to pass',
    // Word Search recap on the game-over overlay.
    wordsearchRecap: 'You found all {count} words in {time}. Score: {score}.',
    // Sokoban.
    levelCleared: 'Level cleared!',
    sokobanRecap: 'Solved in {moves} moves ({pushes} pushes).',
    undoMove: 'Undo',
    restartLevel: 'Restart level',
    // Mastermind end-of-game recap.
    mastermindWin: 'Code cracked in {guesses} guesses! Score: {score}.',
    mastermindLose: 'Out of guesses — the code is revealed above.',
    // Feedback-peg hover tooltip (⚫ black = right spot, ⚪ white = right colour).
    mastermindPegs: '⚫ {black} right spot · ⚪ {white} right colour, wrong spot',
    // Nonogram tools + end-of-level recap.
    nonoToolFill: 'Fill tool (paint cells)',
    nonoToolCross: 'Cross tool (mark empty)',
    nonogramRecap: 'Picture revealed in {time}.',
    // Taquin (Sliding Puzzle) end-of-game recap.
    taquinRecap: '<p>Solved in <strong>{moves}</strong> moves — {score} points.</p>',
    flappyRecap: '<p>You passed <strong>{score}</strong> pipes.</p>',
    // Mancala end-of-game recap (win / lose / draw).
    mancalaWin: 'You won with {mine} seeds vs {theirs}.',
    mancalaLose: 'You lost — {theirs} seeds vs your {mine}.',
    mancalaDraw: "It's a draw — {mine} seeds each!",
    // Solitaire win recap.
    solitaireWin: 'Completed in {moves} moves and {time} — {score} points.',
    // Card games category.
    cat_cards: 'Cards',
    // Blackjack.
    game_blackjack: 'Blackjack',
    bjChips: 'Chips',
    bjBet: 'Bet',
    bjDealer: 'Dealer',
    bjYou: 'You',
    bjPlaceBet: 'Place your bet and deal.',
    bjYourTurn: 'Your turn — hit, stand or double?',
    bjDealerTurn: 'Dealer plays…',
    bjBlackjack: 'Blackjack! +150%',
    bjWin: 'You win!',
    bjPush: 'Push — bet returned.',
    bjLose: 'Dealer wins.',
    bjBust: 'Bust! Over 21.',
    bjHit: 'Hit',
    bjStand: 'Stand',
    bjDouble: 'Double',
    bjDeal: 'Deal',
    bjBankrupt: 'Bankrupt!',
    bjBankruptMsg: 'You are out of chips. Better luck next time!',
    // Space Invaders.
    game_invaders: 'Space Invaders',
    // Bubble Shooter.
    game_bubbles: 'Bubble Shooter',
    // Dots and Boxes.
    game_dotsboxes: 'Dots and Boxes',
    // Yahtzee.
    game_yahtzee: 'Yahtzee',
    yhRollsLeft: 'rolls left',
    yhMustScore: 'Choose a category to score',
    yhCategory: 'Category',
    yhScore: 'Score',
    yhUpperTotal: 'Upper total',
    yhBonus: 'Bonus (+35 if =63)',
    yhTotal: 'Grand total',
    // Binairo.
    game_binairo: 'Binairo',
    biErrors: 'Errors',
    binairoRecap: 'Solved in {time} — {score} points.',
    // Kakuro.
    game_kakuro: 'Kakuro',
    kakPuzzle: 'Puzzle',
    kakRecap: 'Solved in {time} — {score} points.',
    kakNextPuzzle: 'Next puzzle unlocked!',
    kakAllDone: 'All puzzles completed!',
  },
  fr: {
    play: 'Jouer',
    playAgain: 'Rejouer',
    nextLevel: 'Niveau suivant',
    viewLeaderboard: 'Voir le classement',
    leaderboard: 'Classement',
    howToPlay: 'Comment jouer',
    helpAria: 'Aide : comment jouer',
    immersiveMode: 'Mode immersif',
    thPlayer: 'Joueur',
    thSpeed: 'Vitesse',
    // Overlay de fin de partie + invite de sauvegarde (GameEngine, commun à tous les jeux).
    gameOver: 'Partie terminée !',
    gameOverAria: 'Partie terminée',
    youWin: 'Gagné ! 🎉',
    youLose: 'Perdu…',
    youWon: 'Gagné !',
    draw: 'Égalité !',
    score: 'Score',
    scoreValue: 'Score : {score}',
    signInToSave: 'Se connecter pour enregistrer',
    scoreSaved: 'Score enregistré !',
    scoreNotSaved: 'Score non sauvegardé : serveur injoignable.',
    gzpEarned: '+{n} points GamesZone',
    gzpEarnGuest: 'Connecte-toi pour gagner +{n} points GamesZone',
    gzpBonusSpotlight: 'jeu vedette ×{mult}',
    gzpBonusDifficulty: 'difficulté ×{mult}',
    // Overlay de résultat versus (BoardGame).
    rematch: 'Revanche',
    quit: 'Quitter',
    waitingForRematch: "En attente d'une revanche de l'hôte…",
    scoreRaceOpponent: 'Adversaire',
    scoreRaceWin: 'Vous gagnez !',
    scoreRaceLose: "L'adversaire gagne",
    scoreRaceTie: 'Egalite',
    scoreRaceWaitingTitle: 'Course terminee',
    scoreRaceWaitingBody: "En attente de la fin de course de l'adversaire.",
    scoreRaceResult: 'Score : <strong>{score}</strong> — Adversaire : <strong>{opponent}</strong>',
    completionRaceResult:
      'Vous : <strong>{you}</strong> — Adversaire : <strong>{opponent}</strong>',
    you: 'Vous',
    me: 'Moi',
    opponent: 'Adversaire',
    bot: 'Bot',
    cancel: 'Annuler',
    // Panneau de lobby multijoueur (commun à tous les jeux multiplayer: true).
    multiplayer: 'Multijoueur',
    mpCreate: 'Créer une session',
    mpOr: 'ou',
    mpCode: 'Code',
    mpJoin: 'Rejoindre',
    mpCodeAria: 'Code de session à rejoindre',
    mpCopyCode: 'Copier le code',
    mpStart: 'Démarrer',
    mpWaitingPlayer: "En attente d'un autre joueur.",
    mpInProgress: 'Partie en cours',
    mpRoleHost: "Vous êtes l'hôte.",
    mpRoleGuest: "Vous êtes l'invité.",
    mpWaitingHost: "En attente du lancement par l'hôte…",
    mpStillWaiting:
      "Toujours en attente — l'hôte a peut-être déjà lancé ou quitté. Quittez et réessayez.",
    mpLeave: 'Quitter la session',
    mpBotsNote: 'Les places vides seront occupées par des bots.',
    mpCreating: 'Création de la session…',
    mpCannotConnect: 'Impossible de se connecter au serveur.',
    mpConnecting: 'Connexion…',
    mpInvalidCode: 'Code invalide ou serveur injoignable.',
    mpEnded: 'La session est terminée.',
    mpLeaveConfirm: 'Quitter la session ?',
    mpLeaveBody: 'Vous reviendrez à une partie solo.',
    // Récap quiz (QuizGame).
    flawless: 'Sans faute ! ✨',
    roundOver: 'Manche terminée',
    correct: 'correct',
    bestStreak: 'Meilleure série',
    // Titres + récaps de fin de partie par jeu.
    victory: 'Victoire ! 🎉',
    defeat: 'Défaite…',
    hanged: 'Pendu !',
    cleared: 'Terminé ! ✨',
    solved: 'Résolu ! ✨',
    hangmanStreakOne: "<p>Vous avez trouvé <strong>{n}</strong> mot d'affilée.</p>",
    hangmanStreakMany: "<p>Vous avez trouvé <strong>{n}</strong> mots d'affilée.</p>",
    hangmanWord: '<p>Le mot était <strong>{target}</strong> — {score} points.</p>',
    minesweeperRecap: '<p>Déminé en <strong>{time}</strong> — {score} points.</p>',
    motusRecapOne: '<p>Trouvé <strong>{target}</strong> en {n} essai — {score} points.</p>',
    motusRecapMany: '<p>Trouvé <strong>{target}</strong> en {n} essais — {score} points.</p>',
    sudokuRecap: '<p>Grille résolue en <strong>{time}</strong> — {score} points.</p>',
    typingCorrectWords: 'Mots corrects : {n}',
    typingTypedLetters: 'Lettres tapées : {n}',
    typingWpm: 'Vitesse : {n} mots/minute',
    typingLpm: 'Vitesse : {n} lettres/minute',
    // Réglages de contenu Quiz Géo + Trivia.
    quizType: 'Quiz',
    geoCapitals: 'Capitales',
    geoFlags: 'Drapeaux',
    geoMixed: 'Mixte',
    category: 'Catégorie',
    catAll: 'Toutes',
    catScience: 'Science',
    catHistory: 'Histoire',
    catCulture: 'Culture',
    catNature: 'Nature',
    battleshipWin: '<p>Tous les navires ennemis sont coulés. Bravo !</p>',
    battleshipLose: '<p>Toute ma flotte a été coulée.</p>',
    gooseWin: '<p>Vous avez atteint la case 63 en premier !</p>',
    gooseLose: '<p>{name} a atteint la case finale en premier.</p>',
    settings: 'Paramètres',
    difficulty: 'Difficulté',
    visualMode: 'Mode visuel',
    visualMode2d: '2D classique',
    visualMode3d: '3D immersive',
    size: 'Taille',
    players: 'Joueurs',
    solDrawLabel: 'Pioche',
    solDraw1: 'Pioche 1',
    solDraw3: 'Pioche 3',
    bjStartChips: 'Jetons',
    bots: 'Bots',
    firstMove: 'Premier coup',
    firstTo: 'Premier à',
    easy: 'Facile',
    medium: 'Moyen',
    hard: 'Difficile',
    mode: 'Mode',
    classic: 'Classique',
    timed: 'Chrono',
    survival: 'Survie',
    roundsSetting: 'Questions',
    timeSetting: 'Temps',
    answerTimeSetting: 'Temps / question',
    livesSetting: 'Vies',
    language: 'Langue',
    muteSound: 'Couper le son',
    enableSound: 'Activer le son',
    allGames: 'Tous les jeux',
    themeSwitcher: 'Thème visuel',
    themeArcade: 'Arcade néon',
    themeMidnight: 'Minuit',
    themeDaylight: 'Clair',
    themeAmber: 'Anti-lumière bleue',
    home: 'Accueil',
    profileTitle: 'Profil',
    profileAccountSubtitle: 'Ton compte et ton nom affiché.',
    profileGuest: 'Connecte-toi avec Google pour choisir ton nom et apparaître au classement.',
    profileNotPlayed: 'Pas encore joué',
    dangerZone: 'Zone sensible',
    deleteAccount: 'Supprimer le compte',
    deleteAccountDesc:
      'Supprime définitivement ton compte et toutes tes données — scores, amis et progression. Cette action est irréversible.',
    deleteAccountConfirm: 'Tout sera effacé définitivement. Tu es sûr ?',
    deleteAccountYes: 'Oui, tout supprimer',
    deleteAccountDone: 'Compte supprimé.',
    deleteAccountError: 'Impossible de supprimer le compte. Réessaie.',
    // Per-game SEO blurbs (see EN).
    seo_typing:
      'Améliore ta vitesse de frappe avec ce jeu de dactylographie gratuit dans le navigateur. Cours contre la montre, augmente tes mots par minute et grimpe au classement — sans téléchargement.',
    seo_snake:
      'Joue au classique Snake gratuitement en ligne. Mange, grandis et bats ton meilleur score dans ce jeu d’arcade rapide — sans téléchargement, sans inscription.',
    seo_pacman:
      'Joue à Pac-Man gratuitement dans ton navigateur. Vide chaque labyrinthe, esquive les fantômes et vise le meilleur score sur des niveaux de plus en plus corsés.',
    seo_simon:
      'Joue à Simon, le classique jeu de mémoire. Répète la séquence de couleurs et de sons qui s’allonge aussi longtemps que possible, gratuitement dans ton navigateur.',
    seo_motus:
      'Devine le mot caché en six essais — un jeu de mots gratuit façon Wordle dans ton navigateur, en français et en anglais. Sans téléchargement.',
    seo_tetris:
      'Joue à Tetris gratuitement en ligne. Empile et complète des lignes, accélère et vise le meilleur score dans ce jeu de puzzle de blocs intemporel.',
    seo_memory:
      'Joue au Memory gratuitement en ligne. Retourne les cartes, trouve les paires et teste ta mémoire contre un bot ou un ami.',
    seo_minesweeper:
      'Joue au Démineur gratuitement dans ton navigateur. Marque les mines et nettoie la grille en facile, moyen ou difficile — le classique jeu de logique.',
    seo_breakout:
      'Joue à Breakout gratuitement en ligne. Fais rebondir la balle, casse chaque brique et bats ton meilleur score dans ce classique de l’arcade.',
    seo_pong:
      'Joue à Pong, le jeu d’arcade originel, gratuitement dans ton navigateur. Affronte un bot ou un ami dans un tennis de table 1 contre 1 rapide.',
    seo_ludo:
      'Joue aux Petits Chevaux (Ludo) gratuitement en ligne. Lance le dé et ramène tes pions à la maison — jusqu’à 4 joueurs ou contre des bots.',
    seo_connect4:
      'Joue au Puissance 4 gratuitement dans ton navigateur. Lâche tes jetons, aligne-en quatre et bats un ami ou un bot malin.',
    seo_checkers:
      'Joue aux Dames gratuitement en ligne. Capture les pièces de l’adversaire et va à dame pour l’emporter contre un bot ou un ami.',
    seo_reversi:
      'Joue à Reversi (Othello) gratuitement dans ton navigateur. Retourne les pions à ta couleur et prends le contrôle du plateau contre un bot ou un ami.',
    seo_battleship:
      'Joue à la Bataille navale gratuitement en ligne. Place ta flotte, traque les navires adverses et coule-les tous — contre un bot ou un ami.',
    seo_goose:
      'Joue au Jeu de l’oie gratuitement en ligne. Lance le dé, avance sur le plateau et évite les pièges — jusqu’à 4 joueurs.',
    seo_math:
      'Aiguise ton calcul mental gratuitement dans ton navigateur. Résous des opérations chronométrées, enchaîne les séries et grimpe au classement.',
    seo_geoquiz:
      'Teste ta géographie gratuitement en ligne. Devine pays, capitales et drapeaux dans ce quiz à choix multiples rapide — sans téléchargement.',
    seo_trivia:
      'Joue à un quiz de culture générale gratuit en ligne. Réponds à des questions de nombreuses catégories, enchaîne les séries et défie un ami — sans téléchargement.',
    seo_conjugation:
      'Entraîne-toi à la conjugaison française gratuitement dans ton navigateur. Tape la bonne forme, enchaîne les séries et maîtrise chaque temps.',
    seo_anagram:
      'Remets les lettres dans l’ordre pour trouver le mot — un jeu d’anagrammes gratuit dans ton navigateur, en français et en anglais. Sans téléchargement.',
    seo_hangman:
      'Joue au Pendu gratuitement en ligne. Devine le mot caché lettre par lettre avant d’épuiser tes essais — en français et en anglais.',
    seo_mastermind:
      'Joue au Mastermind gratuitement dans ton navigateur. Perce le code de couleurs secret par logique et déduction — le classique casse-code.',
    seo_sokoban:
      'Joue à Sokoban gratuitement en ligne. Pousse chaque caisse sur sa cible dans ce classique puzzle d’entrepôt, sur de nombreux niveaux faits main.',
    seo_nonogram:
      'Joue au Nonogram (Picross) gratuitement dans ton navigateur. Utilise les indices chiffrés pour révéler l’image cachée — des puzzles de logique par niveau.',
    seo_wordsearch:
      'Joue aux Mots mêlés gratuitement en ligne. Trouve chaque mot caché dans la grille — un puzzle de mots reposant, en français et en anglais.',
    seo_sudoku:
      'Joue au Sudoku gratuitement dans ton navigateur. Remplis la grille 9×9 en facile, moyen ou difficile — le classique puzzle de logique chiffré, sans téléchargement.',
    seo_taquin:
      'Joue au Taquin (jeu du 15) gratuitement en ligne. Fais glisser les tuiles pour les remettre en ordre dans ce classique puzzle coulissant — bats le chrono.',
    seo_flappy:
      'Joue à Flappy Bird gratuitement dans ton navigateur. Touche l’écran pour voler entre les tuyaux et vise le meilleur score — juste un essai de plus !',
    seo_solitaire:
      'Joue au Solitaire (Klondike) gratuitement en ligne. Empile les cartes et vide le tableau dans l’intemporel jeu de patience — sans téléchargement.',
    seo_mancala:
      'Joue au Mancala gratuitement dans ton navigateur. Sème les graines, capture les pierres de l’adversaire et déjoue le bot dans cet ancien jeu de plateau.',
    seo_blackjack:
      'Joue au Blackjack (21) gratuitement en ligne. Tire, reste et bats le croupier sans dépasser — le classique jeu de cartes de casino.',
    seo_invaders:
      'Joue à Space Invaders gratuitement dans ton navigateur. Pulvérise les vagues d’aliens, esquive leurs tirs et vise le meilleur score — action arcade rétro.',
    seo_bubbles:
      'Joue au Bubble Shooter gratuitement en ligne. Aligne trois bulles pour les éclater et vide le plateau dans ce jeu d’arcade addictif.',
    seo_dotsboxes:
      'Joue aux Petits Carrés (Dots and Boxes) gratuitement dans ton navigateur. Trace des lignes, ferme des cases et bats un ami ou un bot dans ce classique papier-crayon.',
    seo_yahtzee:
      'Joue au Yahtzee gratuitement en ligne. Lance les dés, cherche les combinaisons et marque gros dans le classique jeu de dés — contre un bot ou un ami.',
    seo_binairo:
      'Joue au Binairo (Takuzu) gratuitement dans ton navigateur. Remplis la grille de 0 et de 1 selon les règles — un puzzle de logique binaire par taille.',
    seo_kakuro:
      'Joue au Kakuro gratuitement en ligne. Remplis la grille pour que chaque série corresponde à son indice — un puzzle de sommes croisées, sans téléchargement.',
    tabPersonal: 'Perso',
    tabFriends: 'Amis',
    tabGlobal: 'Global',
    friendsSubtitle: 'Ajoute des amis par code et vois qui est connecté.',
    yourFriendCode: 'Ton code ami',
    copy: 'Copier',
    addFriend: 'Ajouter',
    friendCodePlaceholder: 'Entre un code ami',
    friendsHeading: 'Amis',
    friendsEmpty: 'Pas encore d’amis — partage ton code pour vous ajouter.',
    friendsGuest: 'Connecte-toi avec Google pour ajouter des amis et voir qui est connecté.',
    friendRequests: 'Demandes d’ami',
    friendWantsToAdd: 'veut devenir ton ami',
    friendAccept: 'Accepter',
    friendDecline: 'Refuser',
    friendRemove: 'Retirer l’ami',
    friendAccepted: 'Ami ajouté !',
    friendDeclined: 'Demande refusée.',
    friendRemoved: 'Ami retiré.',
    friendAdded: 'Demande d’ami envoyée !',
    friendAddError: 'Impossible d’ajouter cet ami.',
    friendCodeCopied: 'Code ami copié !',
    friendPending: 'En attente',
    friendsRankEmpty: 'Pas encore d’amis classés — ajoute des amis et joue une partie.',
    online: 'En ligne',
    offline: 'Hors ligne',
    editName: 'Modifier le nom',
    displayNameLabel: 'Nom affiché',
    saveName: 'Enregistrer',
    nameSaved: 'Nom mis à jour !',
    nameSaveError: 'Impossible de mettre à jour le nom.',
    challengeReceived: '{name} te défie de battre {score} !',
    challengeReceivedAnon: 'Bats {score} pour gagner le défi !',
    challengeAddFriend: 'Ajouter {name}',
    challengeWon: 'Défi relevé — tu as dépassé {score} ! 🎉',
    challengeButton: 'Défier un ami',
    challengeShareText: 'Peux-tu battre mon score de {score} ?',
    challengeCopied: 'Lien du défi copié !',
    globalMyRank: 'Tu es #{rank} avec {score} GZP.',
    globalUnranked: 'Joue une partie pour entrer au classement mondial.',
    globalPoints: '{score} GZP',
    leaderboardSubtitle: 'Les meilleurs joueurs GamesZone, tous jeux confondus.',
    leaderboardEmpty: 'Pas encore de classement — joue une partie pour y entrer.',
    leaderboardSearch: 'Chercher un jeu',
    leaderboardGameColumn: 'Jeu',
    leaderboardBestColumn: 'Meilleur',
    leaderboardGameSummary: '{shown}/{total} jeux · {played} joués',
    // Avis / feedback.
    feedback: 'Votre avis',
    feedbackHint: 'Notez ce jeu',
    feedbackPlaceholder: 'Votre commentaire (optionnel)…',
    send: 'Envoyer',
    sending: 'Envoi…',
    feedbackThanks: 'Merci pour votre retour !',
    feedbackError: 'Envoi impossible — réessayez plus tard.',
    feedbackNeedRating: "Choisissez d'abord une note.",
    // Catégories (clé = cat_<id>).
    cat_action: 'Action',
    cat_puzzle: 'Casse-tête',
    cat_words: 'Mots',
    cat_quiz: 'Quiz',
    cat_board: 'Plateau',
    // Noms des jeux (clé = game_<key>).
    game_typing: 'Dactylo',
    game_snake: 'Serpent',
    game_pacman: 'Pac-Man',
    game_2048: '2048',
    game_simon: 'Simon',
    game_motus: 'Motus',
    game_tetris: 'Tetris',
    game_memory: 'Mémoire',
    game_minesweeper: 'Démineur',
    game_breakout: 'Casse-briques',
    game_pong: 'Pong',
    game_ludo: 'Petits chevaux',
    game_connect4: 'Puissance 4',
    game_battleship: 'Bataille navale',
    game_goose: "Jeu de l'oie",
    game_math: 'Calcul mental',
    game_geoquiz: 'Quiz Géo',
    game_trivia: 'Quiz culture',
    game_conjugation: 'Conjugaison',
    game_anagram: 'Anagrammes',
    game_hangman: 'Le Pendu',
    game_sudoku: 'Sudoku',
    game_checkers: 'Dames',
    game_reversi: 'Reversi',
    game_wordsearch: 'Mots mêlés',
    game_sokoban: 'Sokoban',
    game_mastermind: 'Mastermind',
    game_nonogram: 'Nonogramme',
    // Panneau des niveaux (partagé).
    levels: 'Niveaux',
    levelChoose: 'Niveau {n} — choisir un niveau',
    levelN: 'Niveau {n}',
    levelLocked: 'Niveau {n} (verrouillé)',
    // UI de placement Bataille navale + noms de navires.
    reset: 'Réinitialiser',
    ready: 'Prêt',
    bsRotate: 'Pivoter (R)',
    bsAutoPlace: 'Placement auto',
    bsWaitingPlace: "En attente que l'adversaire finisse de placer ses navires…",
    bsFireHint: 'Cliquez une case pour tirer !',
    bsMyShips: 'Mes navires',
    bsEnemyShips: 'Navires ennemis',
    ship_carrier: 'Porte-avions',
    ship_battleship: 'Cuirassé',
    ship_cruiser: 'Croiseur',
    ship_submarine: 'Sous-marin',
    ship_destroyer: 'Destroyer',
    // Chaînes de jeu diverses.
    typingPlaceholder: 'Tapez le mot ici…',
    motusNotEnough: 'Pas assez de lettres',
    startSquare: 'Départ',
    msBoom: 'Boum ! 💥',
    msHitMine: '<p>Vous avez touché une mine. Plus de chance la prochaine fois !</p>',
    motusOutOfTries: "Plus d'essais",
    motusWordWas: '<p>Le mot était <strong>{target}</strong>.</p>',
    erase: 'Effacer',
    rollDie: 'Lancer le dé',
    signIn: 'Se connecter',
    authRequired: 'Connecte-toi avec Google pour accéder à cette page.',
    signOut: 'Se déconnecter',
    card: 'Carte',
    // Labels de stats du HUD (aria-labels lecteur d'écran ; le HUD affiche des icônes).
    hudTime: 'Temps',
    hudBest: 'Meilleur',
    hudTurn: 'Tour',
    hudLives: 'Vies',
    hudLevel: 'Niveau',
    bkWorld: 'Monde',
    hudStreak: 'Série',
    dailyStreak: 'Série quotidienne : {n} 🔥',
    spotlightDaily: 'Jeu du jour — gagne des points GamesZone ici aujourd’hui.',
    spotlightWeekly: 'Jeu de la semaine — gagne des points GamesZone ici cette semaine.',
    hudStatus: 'État',
    hudRound: 'Manche',
    hudQuestion: 'Question',
    hudLines: 'Lignes',
    hudWordsSolved: 'Mots trouvés',
    hudTries: 'Essais',
    hudMinesLeft: 'Mines restantes',
    hudGuessesLeft: 'Essais restants',
    hudDiscs: 'Pions',
    hudFound: 'Trouvés',
    hudOpponent: 'Adv.',
    matchOver: 'Match terminé',
    hudMoves: 'Coups',
    hudPushes: 'Poussées',
    hudFilled: 'Remplies',
    // Reversi : affiché quand l'adversaire n'a aucun coup légal et saute son tour.
    opponentPassed: 'Adversaire contraint de passer',
    // Récapitulatif Mots mêlés sur l'écran de fin.
    wordsearchRecap: 'Vous avez trouvé les {count} mots en {time}. Score : {score}.',
    // Sokoban.
    levelCleared: 'Niveau réussi !',
    sokobanRecap: 'Résolu en {moves} coups ({pushes} poussées).',
    undoMove: 'Annuler',
    restartLevel: 'Recommencer le niveau',
    // Récapitulatif de fin Mastermind.
    mastermindWin: 'Code trouvé en {guesses} essais ! Score : {score}.',
    mastermindLose: 'Plus d’essais — le code est révélé au-dessus.',
    // Infobulle au survol des pions (⚫ noir = bien placé, ⚪ blanc = mal placé).
    mastermindPegs: '⚫ {black} bien placés · ⚪ {white} bonne couleur, mal placés',
    // Outils Nonogramme + récapitulatif de fin de niveau.
    nonoToolFill: 'Outil Remplir (peindre les cases)',
    nonoToolCross: 'Outil Croix (marquer vide)',
    nonogramRecap: 'Image révélée en {time}.',
    // Taquin (Puzzle coulissant) récapitulatif de fin.
    game_taquin: 'Puzzle coulissant',
    game_flappy: 'Flappy Bird',
    game_mancala: 'Mancala',
    game_solitaire: 'Solitaire',
    taquinRecap: '<p>Résolu en <strong>{moves}</strong> coups — {score} points.</p>',
    flappyRecap: '<p>Vous avez passé <strong>{score}</strong> tuyaux.</p>',
    // Mancala récapitulatif de fin.
    mancalaWin: 'Vous gagnez avec {mine} graines contre {theirs}.',
    mancalaLose: 'Vous perdez — {theirs} graines contre vos {mine}.',
    mancalaDraw: 'Égalité — {mine} graines chacun !',
    // Solitaire récapitulatif de fin.
    solitaireWin: 'Terminé en {moves} coups et {time} — {score} points.',
    // Blackjack.
    game_blackjack: 'Blackjack',
    bjChips: 'Jetons',
    bjBet: 'Mise',
    bjDealer: 'Croupier',
    bjYou: 'Vous',
    bjPlaceBet: 'Placez votre mise et donnez.',
    bjYourTurn: 'Votre tour — tirer, rester ou doubler ?',
    bjDealerTurn: 'Le croupier joue…',
    bjBlackjack: 'Blackjack ! +150 %',
    bjWin: 'Vous gagnez !',
    bjPush: '$([char]0xC9)galité — mise rendue.',
    bjLose: 'Le croupier gagne.',
    bjBust: 'Dépassé ! Plus de 21.',
    bjHit: 'Tirer',
    bjStand: 'Rester',
    bjDouble: 'Doubler',
    bjDeal: 'Donner',
    bjBankrupt: 'En faillite !',
    bjBankruptMsg: 'Vous n’avez plus de jetons. Bonne chance la prochaine fois !',
    // Space Invaders.
    game_invaders: 'Space Invaders',
    // Bubble Shooter.
    game_bubbles: 'Bubble Shooter',
    // Dots and Boxes.
    game_dotsboxes: 'Pointillés',
    // Yahtzee.
    game_yahtzee: 'Yahtzee',
    yhRollsLeft: 'lancés restants',
    yhMustScore: 'Choisissez une catégorie',
    yhCategory: 'Catégorie',
    yhScore: 'Score',
    yhUpperTotal: 'Total section haute',
    yhBonus: 'Bonus (+35 si =63)',
    yhTotal: 'Total général',
    // Binairo.
    game_binairo: 'Binairo',
    biErrors: 'Erreurs',
    binairoRecap: 'Résolu en {time} — {score} points.',
    // Kakuro.
    game_kakuro: 'Kakuro',
    kakPuzzle: 'Puzzle',
    kakRecap: 'Résolu en {time} — {score} points.',
    kakNextPuzzle: 'Puzzle suivant déverrouillé !',
    kakAllDone: 'Tous les puzzles complétés !', // Catégorie jeux de cartes.
    cat_cards: 'Cartes',
  },
};

/**
 * French translations for the per-game "How to play" control lines (the `keys`
 * and `action` strings authored in `vite.config.ts`, rendered by shell-open.hbs
 * with `data-i18n-html` / `data-i18n`). The **English text doubles as the lookup
 * key**, so only the French side is stored here — the English side is generated
 * below (identity), and any line without an entry falls back to its English text
 * verbatim. This keeps `vite.config.ts` self-documenting (real English sentences)
 * while giving every line a French rendering, with no duplicated English.
 */
const CONTROLS_FR: Record<string, string> = {
  // --- keys column (shared across many games) ---
  '<kbd>↑ ↓ ← →</kbd> or <kbd>W A S D</kbd>': '<kbd>↑ ↓ ← →</kbd> ou <kbd>W A S D</kbd>',
  '<kbd>← →</kbd> or <kbd>A D</kbd>': '<kbd>← →</kbd> ou <kbd>A D</kbd>',
  '<kbd>← →</kbd> or <kbd>A/Q D</kbd>': '<kbd>← →</kbd> ou <kbd>A/Q D</kbd>',
  '<kbd>Space</kbd> / <kbd>↑</kbd> / <kbd>W/Z</kbd> / click':
    '<kbd>Space</kbd> / <kbd>↑</kbd> / <kbd>W/Z</kbd> / clic',
  '<kbd>↑ ↓</kbd> or <kbd>W S</kbd>': '<kbd>↑ ↓</kbd> ou <kbd>W S</kbd>',
  '<kbd>↑</kbd> or <kbd>W</kbd> (or tap)': '<kbd>↑</kbd> ou <kbd>W</kbd> (ou tap)',
  '<kbd>↓</kbd> or <kbd>S</kbd>': '<kbd>↓</kbd> ou <kbd>S</kbd>',
  Type: 'Tapez',
  Settings: 'Réglages',
  Timer: 'Chrono',
  Goal: 'But',
  'Swipe (mobile)': 'Glisser (mobile)',
  'Click / tap': 'Clic / tap',
  'Drag / mouse': 'Glisser / souris',
  Drag: 'Glisser',
  Watch: 'Observe',
  Pair: 'Paire',
  'Right-click': 'Clic droit',
  '🚩 button': 'Bouton 🚩',
  'Green / Yellow / Grey': 'Vert / Jaune / Gris',
  Die: 'Dé',
  Captures: 'Prises',
  King: 'Dame',
  Flip: 'Retournement',
  Pass: 'Passe',
  'Auto-place': 'Placement auto',
  Feedback: 'Avis',
  'Fill / Cross': 'Remplir / Croix',
  Clues: 'Indices',
  Directions: 'Directions',
  'Palette / <kbd>1–8</kbd>': 'Palette / <kbd>1–8</kbd>',
  '🦢 Goose': '🦢 Oie',
  '🌉 Bridge (6→12)': '🌉 Pont (6→12)',
  '⚓ Inn (19)': '⚓ Auberge (19)',
  '🌀 Well (31) / Prison (52)': '🌀 Puits (31) / Prison (52)',
  '💀 Death (58)': '💀 Mort (58)',
  'Finish (63)': 'Arrivée (63)',
  'Move the blank tile': 'Déplacer la case vide',
  'Slide a tile toward the blank': 'Glisser une tuile vers la case vide',
  'Grid size (3×3 → 5×5)': 'Taille de grille (3×3 → 5×5)',
  'Sort the tiles in numerical order': 'Classer les tuiles par ordre numérique',
  '<kbd>Space</kbd> / click': '<kbd>Space</kbd> / clic',
  'Jump (flap your wings)': 'Sauter (battre des ailes)',
  'Fly through as many pipes as possible': 'Passer le plus de tuyaux possible',
  'Land in own store': 'Atterrir dans son propre store',
  'Land in empty own pit': 'Atterrir dans une fosse vide de son côté',
  'Click a pit': 'Cliquer une fosse pour semer ses graines',
  'Sow its seeds counter-clockwise': 'Semer dans le sens anti-horaire',
  'Extra turn': 'Tour supplémentaire si la dernière graine tombe dans votre store',
  'Capture seeds from opposite pit': 'Capturer les graines de la fosse opposée si vide',
  'Most seeds in your store wins': 'Le plus de graines dans votre store gagne',
  'Click a card': 'Cliquer sur une carte',
  'Click stock': 'Cliquer sur la pioche',
  'Click empty stock': 'Cliquer sur la pioche vide',
  'Select it (and its sequence)': 'Sélectionner la carte (et sa séquence)',
  'Draw one card to the waste': 'Piocher une carte vers la défausse',
  'Recycle waste back to stock': 'Remettre la défausse dans la pioche',
  'Move all 52 cards to the four foundations (A→K)':
    'Placer les 52 cartes sur les fondations (A→R)',
  // --- action column ---
  'Retype the displayed words': 'Retape les mots affichés',
  'Language (EN/FR) and difficulty (harder = accents, longer words)':
    'Langue (EN/FR) et difficulté (plus dur = accents, mots plus longs)',
  'Starts on the first letter': 'Démarre à la première lettre',
  '2D: steer on the board. 3D: left/right turn relative to the snake':
    '2D : dirige sur le plateau. 3D : gauche/droite tourne par rapport au serpent',
  '2D: swipe a direction. 3D: swipe left/right to turn':
    '2D : glisse dans une direction. 3D : glisse gauche/droite pour tourner',
  'Eat the mice, avoid your tail': 'Mange les souris, évite ta queue',
  'Move Pac-Man': 'Déplace Pac-Man',
  'Move Pac-Man with your finger': 'Déplace Pac-Man avec ton doigt',
  'Eat all the pellets': 'Mange toutes les pastilles',
  'Slide the tiles': 'Fais glisser les tuiles',
  'Slide the tiles with your finger': 'Fais glisser les tuiles avec ton doigt',
  'Merge tiles to reach 2048': 'Fusionne les tuiles pour atteindre 2048',
  'Memorise the flashing colour sequence': 'Mémorise la séquence de couleurs clignotantes',
  'Repeat the sequence in order': 'Répète la séquence dans l’ordre',
  'Trigger the pads with the keyboard': 'Active les touches au clavier',
  'Reproduce the longest sequence you can': 'Reproduis la plus longue séquence possible',
  'Enter a 5-letter word, then Enter': 'Saisis un mot de 5 lettres, puis Entrée',
  'Submit / delete a letter': 'Valider / supprimer une lettre',
  'Right spot / wrong spot / not in word': 'Bien placé / mal placé / absent du mot',
  'Find the hidden word in 6 tries': 'Trouve le mot caché en 6 essais',
  'Move the piece': 'Déplace la pièce',
  'Place your mark': 'Place ton symbole',
  'Line up three to win': 'Aligne-en trois pour gagner',
  'Place a stone': 'Pose une pierre',
  'Line up five stones to win': 'Aligne cinq pierres pour gagner',
  Rotate: 'Tourner',
  'Soft drop': 'Descente lente',
  'Hard drop': 'Descente rapide',
  '← → to move, ↓ to drop': '← → pour déplacer, ↓ pour descendre',
  'Flip two cards': 'Retourne deux cartes',
  'Found → you play again (+1)': 'Trouvée → tu rejoues (+1)',
  '15 s per turn, otherwise an auto move': '15 s par tour, sinon un coup auto',
  'More pairs than your opponent': 'Plus de paires que ton adversaire',
  'Reveal a cell (the first click is always safe)':
    'Révèle une case (le premier clic est toujours sûr)',
  'Flag a suspected mine': 'Marque une mine suspectée',
  'Toggle flag mode (tap to flag on touch)':
    'Bascule le mode drapeau (tap pour marquer au toucher)',
  'Reveal every safe cell without hitting a mine':
    'Révèle toutes les cases sûres sans toucher de mine',
  'Move the paddle': 'Déplace la raquette',
  'Move your paddle': 'Déplace ta raquette',
  'Score past the opponent paddle': 'Marque au-delà de la raquette adverse',
  'Rolled automatically on your turn': 'Lancé automatiquement à ton tour',
  'Choose which horse to move': 'Choisis quel cheval déplacer',
  'Brings a horse out of the stable and rolls again': 'Sort un cheval de l’écurie et relance',
  'Bring your 4 horses home to the center': 'Ramène tes 4 chevaux au centre',
  'Drop a disc in a column': 'Lâche un jeton dans une colonne',
  'Aim a column': 'Vise une colonne',
  'Drop the disc': 'Lâche le jeton',
  'Line up four of your discs in a row': 'Aligne quatre de tes jetons',
  'Select a piece, then a highlighted square': 'Sélectionne un pion, puis une case surlignée',
  'Jumping is mandatory; chained multi-jumps continue':
    'La prise est obligatoire ; les rafles s’enchaînent',
  'Reach the far row to crown a piece (moves both ways)':
    'Atteins la dernière rangée pour damer un pion (va dans les deux sens)',
  "Capture or block all the opponent's pieces": 'Capture ou bloque tous les pions adverses',
  'Place a disc on a highlighted square': 'Pose un pion sur une case surlignée',
  'Bracket a line of enemy discs to flip them all':
    'Encadre une ligne de pions ennemis pour les retourner',
  'No legal move? Your turn is skipped automatically':
    'Aucun coup légal ? Ton tour est passé automatiquement',
  'Own the most discs when the board fills up':
    'Possède le plus de pions quand le plateau est plein',
  'Place a ship or fire a shot': 'Place un navire ou tire un coup',
  'Rotate the ship during placement': 'Pivote le navire pendant le placement',
  'Place the remaining ships randomly': 'Place les navires restants au hasard',
  'Sink all 5 enemy ships first': 'Coule les 5 navires ennemis en premier',
  'Roll the dice': 'Lance les dés',
  'Roll again, moving forward by the same number': 'Relance et avance du même nombre',
  'Jump straight to square 12': 'Saute directement à la case 12',
  'Skip 1 turn': 'Passe 1 tour',
  'Skip 3 turns': 'Passe 3 tours',
  'Back to square 1': 'Retour à la case 1',
  'Exact count required — first to arrive wins': 'Compte exact requis — le premier arrivé gagne',
  'Answer the sum and press Enter': 'Réponds au calcul et appuie sur Entrée',
  'Pick a difficulty and Classic / Timed mode':
    'Choisis une difficulté et le mode Classique / Chrono',
  'Chain correct answers — a streak boosts the score':
    'Enchaîne les bonnes réponses — une série booste le score',
  'Pick the right answer': 'Choisis la bonne réponse',
  'Choose an option with the keyboard': 'Choisis une option au clavier',
  'Match countries and capitals; keep your streak alive':
    'Associe pays et capitales ; garde ta série',
  'Choose a category, difficulty and mode': 'Choisis une catégorie, une difficulté et un mode',
  'Answer general-knowledge questions; build a streak':
    'Réponds à des questions de culture générale ; enchaîne les séries',
  'Write the conjugated form and press Enter': 'Écris la forme conjuguée et appuie sur Entrée',
  'Difficulty unlocks more tenses; Classic / Timed':
    'La difficulté débloque plus de temps ; Classique / Chrono',
  'Conjugate French verbs; accents are forgiven':
    'Conjugue des verbes français ; les accents sont tolérés',
  'Unscramble the letters and press Enter': 'Remets les lettres dans l’ordre et appuie sur Entrée',
  'Language (FR/EN), difficulty and mode': 'Langue (FR/EN), difficulté et mode',
  'Find the hidden word from its shuffled letters':
    'Trouve le mot caché à partir de ses lettres mélangées',
  'Guess a letter on the keyboard': 'Devine une lettre au clavier',
  'Guess a letter with the keyboard': 'Devine une lettre avec le clavier',
  'Language (FR/EN) and difficulty (word length)': 'Langue (FR/EN) et difficulté (longueur du mot)',
  'Find the word before the figure is complete (6 misses)':
    'Trouve le mot avant que le dessin soit complet (6 erreurs)',
  'Add a colour to your guess': 'Ajoute une couleur à ta proposition',
  'Delete a peg / submit the guess': 'Supprime un pion / valide la proposition',
  'Black peg = right colour & spot, white = right colour only':
    'Pion noir = bonne couleur et place, blanc = bonne couleur seulement',
  'Difficulty scales code length, colours and duplicates':
    'La difficulté ajuste la longueur du code, les couleurs et les doublons',
  'Crack the hidden code before you run out of guesses':
    'Perce le code caché avant d’épuiser tes essais',
  'Paint a run of cells (the first cell sets the stroke)':
    'Peins une série de cases (la première case fixe le tracé)',
  'Toggle the tool (or right-click to cross a cell out)':
    'Bascule l’outil (ou clic droit pour croiser une case)',
  'Numbers give the run-lengths in each row and column':
    'Les chiffres donnent les longueurs de séries de chaque ligne et colonne',
  'Switch tool / restart the level': 'Changer d’outil / recommencer le niveau',
  'Reveal the hidden picture the clues describe': 'Révèle l’image cachée décrite par les indices',
  'Trace a straight line of letters over a word': 'Trace une ligne droite de lettres sur un mot',
  'Words run any way — including diagonally and backwards':
    'Les mots vont dans tous les sens — dont en diagonale et à l’envers',
  'Language (FR/EN) and difficulty (grid + word count)':
    'Langue (FR/EN) et difficulté (grille + nombre de mots)',
  'Find every word in the list before the clock climbs':
    'Trouve tous les mots de la liste avant que le chrono monte',
  'Select a cell': 'Sélectionne une case',
  'Fill the selected cell (0 / Backspace clears)':
    'Remplis la case sélectionnée (0 / Retour arrière efface)',
  'Move the selection': 'Déplace la sélection',
  'Fill every row, column and box with 1–9': 'Remplis chaque ligne, colonne et bloc avec 1–9',
  'Move / push a crate': 'Déplace / pousse une caisse',
  // --- Blackjack ---
  'Click Deal': 'Cliquer sur Donner',
  'Deal a new hand with your current bet': 'Distribuer une nouvelle main avec votre mise actuelle',
  Hit: 'Tirer',
  'Draw another card': 'Piocher une carte supplémentaire',
  Stand: 'Rester',
  'End your turn, dealer plays': 'Terminer votre tour, le croupier joue',
  Double: 'Doubler',
  'Double bet, draw exactly one card, then stand':
    'Doubler la mise, piocher exactement une carte, puis rester',
  'Get closer to 21 than the dealer without going over':
    'Approcher 21 de plus près que le croupier sans dépasser',
  // --- Space Invaders ---
  'Move your ship': 'Déplacer votre vaisseau',
  Shoot: 'Tirer',
  'Destroy all aliens before they reach you':
    'Détruire tous les extraterrestres avant qu’ils vous atteignent',
  // --- Bubble Shooter ---
  'Move mouse / <kbd>← →</kbd>': 'Bouger la souris / <kbd>← →</kbd>',
  'Aim the shooter': 'Viser le lanceur',
  'Click / <kbd>Space</kbd>': 'Clic / <kbd>Space</kbd>',
  'Shoot a bubble': 'Lancer une bulle',
  'Match 3+ same-color bubbles to pop them': 'Aligner 3+ bulles de même couleur pour les éclater',
  // --- Dots and Boxes ---
  'Click an edge': 'Cliquer une arête',
  'Draw a line between two adjacent dots': 'Tracer une ligne entre deux points adjacents',
  'Complete a box': 'Compléter un carré',
  'Score a point and take another turn': 'Marquer un point et rejouer',
  'Claim more boxes than your opponents': 'Capturer plus de carrés que vos adversaires',
  'Players (2–4 offline; empty seats are bots)':
    'Joueurs (2–4 hors-ligne ; les sièges vides sont des bots)',
  'Beat your opponents over 13 categories': 'Battez vos adversaires sur 13 catégories',
  // --- Yahtzee ---
  'Click the dice area': 'Cliquer la zone des dés',
  'Roll all non-held dice (up to 3 times per turn)':
    'Lancer tous les dés non conservés (jusqu’à 3 fois par tour)',
  'Click a die': 'Cliquer sur un dé',
  'Hold it (keep between rolls)': 'Le conserver entre les lancers',
  'Click a category': 'Cliquer une catégorie',
  'Score the current dice in that category': 'Marquer les dés actuels dans cette catégorie',
  // --- Binairo ---
  'Click a cell': 'Cliquer une case',
  'Cycle empty → 0 → 1 → empty': 'Alterner vide → 0 → 1 → vide',
  'Fill the grid: no 3 consecutive same, equal 0s and 1s per line':
    'Remplir la grille : pas 3 identiques consécutifs, autant de 0 que de 1 par ligne',
  // --- Kakuro ---
  'Click a white cell': 'Cliquer une case blanche',
  'Select it, then type 1–9': 'La sélectionner, puis taper 1–9',
  '<kbd>1–9</kbd>': '<kbd>1–9</kbd>',
  'Enter a digit in the selected cell': 'Saisir un chiffre dans la case sélectionnée',
  '<kbd>Delete</kbd>': '<kbd>Delete</kbd>',
  'Clear the selected cell': 'Effacer la case sélectionnée',
  'Fill each run with unique digits that sum to the clue':
    'Remplir chaque série avec des chiffres uniques dont la somme correspond à l’indice',
  'Move with your finger': 'Déplace avec ton doigt',
  'Undo a move / restart the level': 'Annule un coup / recommence le niveau',
  'Push every crate onto a target': 'Pousse chaque caisse sur une cible',
  'Difficulty (gap width, pipe speed)': 'Difficulté (largeur du trou, vitesse des tuyaux)',
  'Difficulty (starting lives, bomb rate)': 'Difficulté (vies de départ, fréquence des bombes)',
  'Difficulty (number of bubble colours)': 'Difficulté (nombre de couleurs de bulles)',
  'Difficulty (starting lives, ball speed)': 'Difficulté (vies de départ, vitesse de la balle)',
  'Grid size (6×6 or 8×8)': 'Taille de la grille (6×6 ou 8×8)',
  'Difficulty and 2D / 3D visual mode': 'Difficulté et mode visuel 2D / 3D',
  'Difficulty (playback speed)': 'Difficulté (vitesse de lecture)',
  'Difficulty (puzzle set)': 'Difficulté (jeu de grilles)',
  'Grid size (3×3, 4×4 or 5×5)': 'Taille de la grille (3×3, 4×4 ou 5×5)',
  'Difficulty (starting level / speed)': 'Difficulté (niveau de départ / vitesse)',
  'Draw mode (1 card, or 3 for a harder game)':
    'Mode pioche (1 carte, ou 3 pour un jeu plus difficile)',
  'Starting chips (100 / 200 / 500)': 'Jetons de départ (100 / 200 / 500)',
  'Clear all bricks': 'Casse toutes les briques',
  'Complete the level': 'Termine le niveau',
  'Reinforced bricks': 'Briques renforcées',
  'Take several hits before they break': 'Encaissent plusieurs coups avant de casser',
  'Clear every level': 'Termine tous les niveaux',
};

/**
 * The full catalog: the base strings plus the control lines. The English control
 * entries are the keys themselves (identity), so the two locales keep exactly the
 * same key set (asserted by the i18n parity test) with the English text living in
 * a single place — the `vite.config.ts` control definitions.
 */
const controlsEn: Record<string, string> = {};
for (const key of Object.keys(CONTROLS_FR)) controlsEn[key] = key;

/** Exported for the parity test (every `en` key must have an `fr` counterpart). */
export const CATALOG: Record<Locale, Record<string, string>> = {
  en: { ...BASE_CATALOG.en, ...controlsEn, ...GENERATED_GAME_CATALOG.en },
  fr: { ...BASE_CATALOG.fr, ...CONTROLS_FR, ...GENERATED_GAME_CATALOG.fr },
};

/**
 * The current interface locale. The page is built for a locale (English pages are
 * unprefixed, French pages live under `/fr/…`), so `<html lang>` — baked at build
 * time — is the source of truth: dynamic `t()` strings then match the page with no
 * flash. Falls back to the stored preference, then English.
 */
export function getLocale(): Locale {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : '';
  if (lang === 'fr' || lang === 'en') return lang;
  return localStorage.getItem(STORAGE_KEY) === 'fr' ? 'fr' : 'en';
}

/**
 * The path of the current page in the other `locale` (adds/removes the `/fr`
 * prefix). Pure — the single place the locale URL scheme is encoded. Home is `/`
 * (EN) / `/fr/` (FR); every other page is `/x` / `/fr/x`.
 */
export function mirrorPath(pathname: string, locale: Locale): string {
  const base = pathname.replace(/^\/fr(?=\/|$)/, '') || '/';
  if (locale === 'en') return base;
  return base === '/' ? '/fr/' : `/fr${base}`;
}

/**
 * Switches the interface locale by navigating to the same page in that locale.
 * The target page is pre-translated (build-time), so there is no re-render flash.
 * The choice is also stored as the entry preference.
 */
export function setLocale(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale);
  location.assign(mirrorPath(location.pathname, locale) + location.search + location.hash);
}

/**
 * Translates a key for the current locale, falling back to English then the key.
 * Optional `params` interpolate `{name}` placeholders, e.g.
 * `t('scoreValue', { score })` → `Score: 42`.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const locale = getLocale();
  const template = CATALOG[locale]?.[key] ?? CATALOG.en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`
  );
}

/**
 * Translates static markup under `root`: `data-i18n` → textContent,
 * `data-i18n-html` → innerHTML (for values that carry markup, e.g. the help
 * panel's `<kbd>` keys), `data-i18n-aria` → aria-label, `data-i18n-placeholder`
 * → placeholder (inputs). Also sets `<html lang>`.
 * Call once on load (the sidebar does this on every page); dynamic strings use
 * {@link t} at build time.
 */
export function applyTranslations(root: ParentNode = document): void {
  document.documentElement.lang = getLocale();
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    const key = el.dataset.i18nHtml;
    if (key) el.innerHTML = t(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset.i18nAria;
    if (key) el.setAttribute('aria-label', t(key));
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.setAttribute('placeholder', t(key));
  });
  // `data-label` drives a CSS tooltip (e.g. the home tiles): translate it too.
  root.querySelectorAll<HTMLElement>('[data-i18n-label]').forEach((el) => {
    const key = el.dataset.i18nLabel;
    if (key) el.setAttribute('data-label', t(key));
  });
}
