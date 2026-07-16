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
    // game-generator:catalog-en
  },
  fr: {
    game_tictactoe: 'Morpion',
    seo_tictactoe:
      'Joue à Morpion gratuitement dans ton navigateur — sans téléchargement ni inscription.',
    // game-generator:catalog-fr
  },
} satisfies Record<'en' | 'fr', Record<string, string>>;
