/**
 * Word loading for the language games. Fetches `/data/words-<lang>.json` (real
 * spelling + difficulty tier, from the data pipeline), with an offline fallback
 * so a game never stalls. Kept separate from the pure {@link ./words.ts} logic.
 */

import { Lang, WordEntry } from './words.js';

const FALLBACK: Record<Lang, WordEntry[]> = {
  fr: [
    { w: 'chat', d: 'easy' },
    { w: 'arbre', d: 'easy' },
    { w: 'maison', d: 'medium' },
    { w: 'fleur', d: 'easy' },
    { w: 'montagne', d: 'hard' },
    { w: 'rivière', d: 'medium' },
    { w: 'école', d: 'medium' },
    { w: 'château', d: 'hard' },
  ],
  en: [
    { w: 'cat', d: 'easy' },
    { w: 'house', d: 'easy' },
    { w: 'river', d: 'easy' },
    { w: 'flower', d: 'medium' },
    { w: 'mountain', d: 'hard' },
    { w: 'garden', d: 'medium' },
    { w: 'orange', d: 'medium' },
    { w: 'elephant', d: 'hard' },
  ],
};

/** Loads the word list for a language (best-effort; falls back offline). */
export async function loadWords(lang: Lang): Promise<WordEntry[]> {
  try {
    const res = await fetch(`/data/words-${lang}.json`);
    const data = (await res.json()) as WordEntry[];
    if (Array.isArray(data) && data.length > 0) return data;
  } catch {
    /* fall through to the offline list */
  }
  return FALLBACK[lang];
}
