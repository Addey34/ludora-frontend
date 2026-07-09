import { describe, expect, it } from 'vitest';
import { hasRemotePresence, scopedMatchName } from './match.js';

describe('scopedMatchName', () => {
  it('keeps the visible code but namespaces the actual match by game', () => {
    expect(scopedMatchName('trivia', 'ABCD')).toBe('trivia:ABCD');
    expect(scopedMatchName('geoquiz', 'ABCD')).toBe('geoquiz:ABCD');
  });

  it('normalizes unsafe scope characters', () => {
    expect(scopedMatchName('Geo Quiz!', 'ABCD')).toBe('geo-quiz-:ABCD');
  });

  it('falls back to the app scope when no scope is available', () => {
    expect(scopedMatchName(undefined, 'ABCD')).toBe('gameszone:ABCD');
  });
});

describe('hasRemotePresence', () => {
  it('rejects an empty named match created by a guest join attempt', () => {
    expect(hasRemotePresence(undefined, 'guest')).toBe(false);
    expect(hasRemotePresence([], 'guest')).toBe(false);
  });

  it('rejects a match that only contains the joining client', () => {
    expect(hasRemotePresence([{ session_id: 'guest' }], 'guest')).toBe(false);
  });

  it('accepts a match that already has a remote host presence', () => {
    expect(hasRemotePresence([{ session_id: 'host' }], 'guest')).toBe(true);
  });
});
