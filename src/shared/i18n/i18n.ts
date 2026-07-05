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
 * The translation catalog. Add a key to `en`, then its `fr` translation.
 * Exported for the parity test (every `en` key must have an `fr` counterpart).
 */
export const CATALOG: Record<Locale, Record<string, string>> = {
  en: {
    play: 'Play',
    playAgain: 'Play again',
    viewLeaderboard: 'View leaderboard',
    leaderboard: 'Leaderboard',
    howToPlay: 'How to play',
    // Game-over overlay + save prompt (GameEngine, shared by every game).
    gameOver: 'Game Over!',
    gameOverAria: 'Game over',
    youWin: 'You win! 🏆',
    youLose: 'You lose…',
    youWon: 'You won!',
    draw: 'Draw!',
    score: 'Score',
    scoreValue: 'Score: {score}',
    scoreSavedAs: 'Score saved as {name}.',
    saveScorePrompt: 'Save your score to the leaderboard',
    nickname: 'Nickname',
    save: 'Save',
    // Versus result overlay (BoardGame).
    rematch: 'Rematch',
    quit: 'Quit',
    waitingForRematch: 'Waiting for a rematch from the host…',
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
    flawless: 'Flawless! 🎉',
    roundOver: 'Round over',
    correct: 'correct',
    bestStreak: 'Best streak',
    // Per-game game-over titles + recaps.
    victory: 'Victory! 🏆',
    defeat: 'Defeat…',
    hanged: 'Hanged! 💀',
    cleared: 'Cleared! 🎉',
    solved: 'Solved! 🎉',
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
    language: 'Language',
    muteSound: 'Mute sound',
    enableSound: 'Enable sound',
    tagline: 'Browser games — play instantly, no download',
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
    signOut: 'Sign out',
    signOutOf: 'Sign out ({name})',
    card: 'Card',
    // HUD stat labels (screen-reader aria-labels; the HUD shows icons).
    hudTime: 'Time',
    hudBest: 'Best',
    hudTurn: 'Turn',
    hudLives: 'Lives',
    hudStreak: 'Streak',
    hudStatus: 'Status',
    hudRound: 'Round',
    hudQuestion: 'Question',
    hudLines: 'Lines',
    hudWordsSolved: 'Words solved',
    hudTries: 'Tries',
    hudMinesLeft: 'Mines left',
    hudGuessesLeft: 'Guesses left',
  },
  fr: {
    play: 'Jouer',
    playAgain: 'Rejouer',
    viewLeaderboard: 'Voir le classement',
    leaderboard: 'Classement',
    howToPlay: 'Comment jouer',
    // Overlay de fin de partie + invite de sauvegarde (GameEngine, commun à tous les jeux).
    gameOver: 'Partie terminée !',
    gameOverAria: 'Partie terminée',
    youWin: 'Gagné ! 🏆',
    youLose: 'Perdu…',
    youWon: 'Gagné !',
    draw: 'Égalité !',
    score: 'Score',
    scoreValue: 'Score : {score}',
    scoreSavedAs: 'Score enregistré au nom de {name}.',
    saveScorePrompt: 'Enregistrez votre score au classement',
    nickname: 'Pseudo',
    save: 'Enregistrer',
    // Overlay de résultat versus (BoardGame).
    rematch: 'Revanche',
    quit: 'Quitter',
    waitingForRematch: "En attente d'une revanche de l'hôte…",
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
    flawless: 'Sans faute ! 🎉',
    roundOver: 'Manche terminée',
    correct: 'correct',
    bestStreak: 'Meilleure série',
    // Titres + récaps de fin de partie par jeu.
    victory: 'Victoire ! 🏆',
    defeat: 'Défaite…',
    hanged: 'Pendu ! 💀',
    cleared: 'Terminé ! 🎉',
    solved: 'Résolu ! 🎉',
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
    language: 'Langue',
    muteSound: 'Couper le son',
    enableSound: 'Activer le son',
    tagline: 'Jeux en ligne — jouez tout de suite, sans téléchargement',
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
    signOut: 'Se déconnecter',
    signOutOf: 'Se déconnecter ({name})',
    card: 'Carte',
    // Labels de stats du HUD (aria-labels lecteur d'écran ; le HUD affiche des icônes).
    hudTime: 'Temps',
    hudBest: 'Meilleur',
    hudTurn: 'Tour',
    hudLives: 'Vies',
    hudStreak: 'Série',
    hudStatus: 'État',
    hudRound: 'Manche',
    hudQuestion: 'Question',
    hudLines: 'Lignes',
    hudWordsSolved: 'Mots trouvés',
    hudTries: 'Essais',
    hudMinesLeft: 'Mines restantes',
    hudGuessesLeft: 'Essais restants',
  },
};

/** The current interface locale (persisted; defaults to English). */
export function getLocale(): Locale {
  return localStorage.getItem(STORAGE_KEY) === 'fr' ? 'fr' : 'en';
}

/** Switches the interface locale and reloads so every string re-renders. */
export function setLocale(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale);
  location.reload();
}

/**
 * Translates a key for the current locale, falling back to English then the key.
 * Optional `params` interpolate `{name}` placeholders, e.g.
 * `t('scoreSavedAs', { name })` → `Score saved as Bob.`.
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
 * `data-i18n-aria` → aria-label. Also sets `<html lang>`. Call once on load (the
 * sidebar does this on every page); dynamic strings use {@link t} at build time.
 */
export function applyTranslations(root: ParentNode = document): void {
  document.documentElement.lang = getLocale();
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset.i18nAria;
    if (key) el.setAttribute('aria-label', t(key));
  });
  // `data-label` drives a CSS tooltip (e.g. the home tiles): translate it too.
  root.querySelectorAll<HTMLElement>('[data-i18n-label]').forEach((el) => {
    const key = el.dataset.i18nLabel;
    if (key) el.setAttribute('data-label', t(key));
  });
}
