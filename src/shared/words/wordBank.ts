/**
 * Word loading for the FR/EN vocabulary games. Fetches `/data/words-<lang>.json`
 * (uppercase A–Z words), with an offline fallback so a game never stalls. Kept
 * separate from the pure {@link ./words.ts} logic (no DOM/network there).
 */

import { Lang } from './words.js';

const FALLBACK: Record<Lang, string[]> = {
  fr: ['CHAT', 'CHIEN', 'MAISON', 'ARBRE', 'FLEUR', 'SOLEIL', 'MONTAGNE', 'RIVIERE'],
  en: ['CAT', 'HOUSE', 'RIVER', 'FLOWER', 'MOUNTAIN', 'ORANGE', 'GARDEN', 'ELEPHANT'],
};

/** Loads the word list for a language (best-effort; falls back offline). */
export async function loadWords(lang: Lang): Promise<string[]> {
  try {
    const res = await fetch(`/data/words-${lang}.json`);
    const data = (await res.json()) as string[];
    if (Array.isArray(data) && data.length > 0) return data;
  } catch {
    /* fall through to the offline list */
  }
  return FALLBACK[lang];
}
