import { afterEach, describe, expect, it } from 'vitest';
import { consumeAuthRequired, consumeAuthReturnPath } from './authGuard.js';

const AUTH_RETURN_KEY = 'gz-auth-return';
const AUTH_REQUIRED_KEY = 'gz-auth-required';

afterEach(() => {
  sessionStorage.clear();
});

describe('consumeAuthRequired', () => {
  it('returns true and clears the flag when set', () => {
    sessionStorage.setItem(AUTH_REQUIRED_KEY, '1');
    expect(consumeAuthRequired()).toBe(true);
    // One-shot: a second read no longer reports it.
    expect(sessionStorage.getItem(AUTH_REQUIRED_KEY)).toBeNull();
    expect(consumeAuthRequired()).toBe(false);
  });

  it('returns false when the flag is absent or not exactly "1"', () => {
    expect(consumeAuthRequired()).toBe(false);
    sessionStorage.setItem(AUTH_REQUIRED_KEY, 'yes');
    expect(consumeAuthRequired()).toBe(false);
  });
});

describe('consumeAuthReturnPath', () => {
  it('returns a stored same-origin path and clears it', () => {
    sessionStorage.setItem(AUTH_RETURN_KEY, '/profile?tab=world');
    expect(consumeAuthReturnPath()).toBe('/profile?tab=world');
    expect(sessionStorage.getItem(AUTH_RETURN_KEY)).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(consumeAuthReturnPath()).toBeNull();
  });

  it('rejects protocol-relative paths (open-redirect guard)', () => {
    sessionStorage.setItem(AUTH_RETURN_KEY, '//evil.example.com/phish');
    expect(consumeAuthReturnPath()).toBeNull();
  });

  it('rejects absolute URLs and non-rooted paths', () => {
    sessionStorage.setItem(AUTH_RETURN_KEY, 'https://evil.example.com');
    expect(consumeAuthReturnPath()).toBeNull();
    sessionStorage.setItem(AUTH_RETURN_KEY, 'friends');
    expect(consumeAuthReturnPath()).toBeNull();
  });

  it('still clears the stored value even when it is rejected', () => {
    sessionStorage.setItem(AUTH_RETURN_KEY, '//evil.example.com');
    consumeAuthReturnPath();
    expect(sessionStorage.getItem(AUTH_RETURN_KEY)).toBeNull();
  });
});
