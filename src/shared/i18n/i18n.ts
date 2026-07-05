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

/** The translation catalog. Add a key to `en`, then its `fr` translation. */
const CATALOG: Record<Locale, Record<string, string>> = {
  en: {
    play: 'Play',
    playAgain: 'Play again',
    viewLeaderboard: 'View leaderboard',
    leaderboard: 'Leaderboard',
    howToPlay: 'How to play',
    settings: 'Settings',
    difficulty: 'Difficulty',
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
  },
  fr: {
    play: 'Jouer',
    playAgain: 'Rejouer',
    viewLeaderboard: 'Voir le classement',
    leaderboard: 'Classement',
    howToPlay: 'Comment jouer',
    settings: 'Paramètres',
    difficulty: 'Difficulté',
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

/** Translates a key for the current locale, falling back to English then the key. */
export function t(key: string): string {
  const locale = getLocale();
  return CATALOG[locale]?.[key] ?? CATALOG.en[key] ?? key;
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
