/**
 * Friend challenges by link — a viral, backend-free way to dare a friend to beat
 * a score. A share URL carries the score (and optional sender name) in query
 * params; opening it shows "beat this score", and passing it wins the challenge.
 * Pure helpers (no DOM) so they're unit-tested; the wiring lives in GameEngine.
 */
export interface Challenge {
  score: number;
  /** Sender's display name, or null when they shared anonymously. */
  by: string | null;
  /** Sender's friend code, so the opener can add them back. Null when absent. */
  code: string | null;
}

const MAX_NAME = 20;
const MAX_CODE = 128;

/** Sanitises a friend code from the URL: trimmed, length-capped, non-empty or null. */
function cleanCode(raw: string | null): string | null {
  const code = raw?.trim().slice(0, MAX_CODE);
  return code ? code : null;
}

/** Reads a challenge from a URL query string (e.g. `location.search`), or null. */
export function parseChallenge(search: string): Challenge | null {
  const params = new URLSearchParams(search);
  const raw = params.get('challenge');
  if (raw === null) return null;
  const score = Number(raw);
  if (!Number.isFinite(score) || score < 0) return null;
  const by = params.get('by');
  const name = by && by.trim() ? by.trim().slice(0, MAX_NAME) : null;
  return { score: Math.floor(score), by: name, code: cleanCode(params.get('code')) };
}

/**
 * Builds a shareable challenge URL from the current page URL: sets `challenge`
 * (and `by`/`code` when given), replacing any existing challenge params so a
 * re-share never stacks them. `code` lets the opener add the sender as a friend.
 */
export function buildChallengeUrl(
  pageUrl: string,
  score: number,
  by: string | null,
  code: string | null = null
): string {
  const url = new URL(pageUrl);
  url.searchParams.set('challenge', String(Math.max(0, Math.floor(score))));
  if (by && by.trim()) url.searchParams.set('by', by.trim().slice(0, MAX_NAME));
  else url.searchParams.delete('by');
  if (code && code.trim()) url.searchParams.set('code', code.trim().slice(0, MAX_CODE));
  else url.searchParams.delete('code');
  return url.toString();
}

/** A score beats a challenge only by strictly exceeding its target. */
export function challengeBeaten(score: number, target: number): boolean {
  return score > target;
}
