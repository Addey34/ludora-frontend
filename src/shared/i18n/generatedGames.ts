/**
 * Machine-managed catalog entries created by `npm run game:new`.
 *
 * Keep hand-authored shared UI strings in `i18n.ts`. The generator inserts only
 * per-game names/descriptions and any generic control line introduced by a
 * scaffold. Explicit markers make updates deterministic and reviewable.
 */
export const GENERATED_GAME_CATALOG = {
  en: {
    game_tictactoe: 'Tic-Tac-Toe',
    seo_tictactoe: 'Play Tic-Tac-Toe free in your browser — no download, no sign-up.',
    game_gomoku: 'Gomoku',
    seo_gomoku: 'Play Gomoku free in your browser — no download, no sign-up.',
    game_mill: "Nine Men's Morris",
    seo_mill: "Play Nine Men's Morris free in your browser — no download, no sign-up.",
    game_backgammon: 'Backgammon',
    seo_backgammon: 'Play Backgammon free in your browser — no download, no sign-up.',
    game_dominoes: 'Dominoes',
    seo_dominoes:
      'Play classic dominoes online against the computer. Match tiles, block your opponent and empty your hand first.',
    game_asteroids: 'Asteroids',
    seo_asteroids: 'Pilot your ship through an asteroid field and survive as long as possible.',
    game_quoridor: 'Quoridor',
    seo_quoridor:
      'Race across the board, place walls and outsmart the computer in classic Quoridor.',
    game_sciencequiz: 'Science Quiz',
    seo_sciencequiz:
      'Test your knowledge of physics, biology, chemistry, astronomy and Earth science.',
    // game-generator:catalog-en
  },
  fr: {
    game_tictactoe: 'Morpion',
    seo_tictactoe:
      'Joue à Morpion gratuitement dans ton navigateur — sans téléchargement ni inscription.',
    game_gomoku: 'Gomoku',
    seo_gomoku:
      'Joue à Gomoku gratuitement dans ton navigateur — sans téléchargement ni inscription.',
    game_mill: 'Jeu du moulin',
    seo_mill:
      'Joue à Jeu du moulin gratuitement dans ton navigateur — sans téléchargement ni inscription.',
    game_backgammon: 'Backgammon',
    seo_backgammon:
      'Joue à Backgammon gratuitement dans ton navigateur — sans téléchargement ni inscription.',
    game_dominoes: 'Dominos',
    seo_dominoes:
      "Jouez aux dominos classiques en ligne contre l'ordinateur. Posez vos tuiles, bloquez l'adversaire et videz votre main.",
    game_asteroids: 'Astéroïdes',
    seo_asteroids:
      'Pilote ton vaisseau dans un champ d’astéroïdes et survis le plus longtemps possible.',
    game_quoridor: 'Quoridor',
    seo_quoridor:
      'Traverse le plateau, pose des barrières et déjoue l’ordinateur dans le classique Quoridor.',
    game_sciencequiz: 'Quiz Sciences',
    seo_sciencequiz:
      'Teste tes connaissances en physique, biologie, chimie, astronomie et sciences de la Terre.',
    // game-generator:catalog-fr
  },
} satisfies Record<'en' | 'fr', Record<string, string>>;
