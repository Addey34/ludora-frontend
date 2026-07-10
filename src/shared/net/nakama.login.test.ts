import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests the Google sign-in orchestration in `nakama.ts` (the account link/switch
 * flow, display-name seeding, and the hiccup-tolerant identity read) against a
 * mocked Nakama client, so no network or real OAuth is involved.
 *
 * Each test re-imports the module after `vi.resetModules()` so the module-level
 * session/user caches start clean.
 */

/** Shared spies for the Nakama client methods the login flow calls. */
const mocks = vi.hoisted(() => ({
  authenticateDevice: vi.fn(),
  authenticateGoogle: vi.fn(),
  linkGoogle: vi.fn(),
  getAccount: vi.fn(),
  updateAccount: vi.fn(),
}));

vi.mock('@heroiclabs/nakama-js', () => {
  class Session {
    token: string;
    refresh_token: string;
    user_id = 'user-1';
    constructor(token = 'device-token', refresh = 'device-refresh') {
      this.token = token;
      this.refresh_token = refresh;
    }
    static restore(token: string, refresh: string): Session {
      return new Session(token, refresh);
    }
    isexpired(): boolean {
      return false;
    }
    isrefreshexpired(): boolean {
      return false;
    }
  }
  class Client {
    authenticateDevice = mocks.authenticateDevice;
    authenticateGoogle = mocks.authenticateGoogle;
    linkGoogle = mocks.linkGoogle;
    getAccount = mocks.getAccount;
    updateAccount = mocks.updateAccount;
  }
  return { Client, Session };
});

/** A minimal Nakama session stub good enough for the code paths under test. */
const deviceSession = {
  token: 'device-token',
  refresh_token: 'device-refresh',
  user_id: 'user-1',
  isexpired: () => false,
  isrefreshexpired: () => false,
};

/** Builds a UTF-8 base64url JWT the way Google does (payload is all that matters). */
function makeJwt(payload: object): string {
  const utf8 = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  for (const byte of utf8) binary += String.fromCharCode(byte);
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${b64}.signature`;
}

/** Fresh import of the module under test after resetting its cached state. */
async function loadNakama() {
  vi.resetModules();
  return import('./nakama.js');
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mocks.authenticateDevice.mockResolvedValue({ ...deviceSession });
  mocks.authenticateGoogle.mockResolvedValue({ ...deviceSession, user_id: 'google-user' });
  mocks.linkGoogle.mockResolvedValue(undefined);
  mocks.updateAccount.mockResolvedValue(undefined);
  mocks.getAccount.mockResolvedValue({
    user: { display_name: 'Alice', username: 'alice', google_id: 'g-1' },
  });
});

describe('loginWithGoogleToken', () => {
  it('links Google to the current anonymous account (does not switch)', async () => {
    // Account has no display name yet, so the token name should be seeded.
    mocks.getAccount.mockResolvedValue({ user: { username: 'alice', google_id: 'g-1' } });
    const { loginWithGoogleToken } = await loadNakama();

    const switched = await loginWithGoogleToken(makeJwt({ name: 'François' }));

    expect(switched).toBe(false);
    expect(mocks.linkGoogle).toHaveBeenCalledTimes(1);
    expect(mocks.authenticateGoogle).not.toHaveBeenCalled();
    expect(mocks.updateAccount).toHaveBeenCalledWith(expect.anything(), {
      display_name: 'François',
    });
  });

  it('switches to the existing Google account when linking fails', async () => {
    mocks.linkGoogle.mockRejectedValue(new Error('google id already in use'));
    mocks.getAccount.mockResolvedValue({ user: { display_name: 'Bob', google_id: 'g-2' } });
    const { loginWithGoogleToken } = await loadNakama();

    const switched = await loginWithGoogleToken(makeJwt({ name: 'Bob' }));

    expect(switched).toBe(true);
    expect(mocks.authenticateGoogle).toHaveBeenCalledWith(expect.any(String), true);
  });

  it('does not report a switch when re-login resolves to the same account', async () => {
    // Linking throws (already linked), but authenticateGoogle returns the SAME
    // account, so nothing switched — the caller must not wipe local progress.
    mocks.linkGoogle.mockRejectedValue(new Error('already linked'));
    mocks.authenticateGoogle.mockResolvedValue({ ...deviceSession, user_id: 'user-1' });
    const { loginWithGoogleToken } = await loadNakama();

    const switched = await loginWithGoogleToken(makeJwt({ name: 'Alice' }));

    expect(switched).toBe(false);
    expect(mocks.authenticateGoogle).toHaveBeenCalled();
  });

  it('never overwrites a display name the player already chose', async () => {
    mocks.getAccount.mockResolvedValue({
      user: { display_name: 'MyCustomName', google_id: 'g-1' },
    });
    const { loginWithGoogleToken } = await loadNakama();

    await loginWithGoogleToken(makeJwt({ name: 'François' }));

    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it('marks the player signed-in so a later reload trusts the persisted hint', async () => {
    const { loginWithGoogleToken } = await loadNakama();
    await loginWithGoogleToken(makeJwt({ name: 'Alice' }));
    expect(localStorage.getItem('gz-logged-in')).toBe('1');
  });
});

describe('getCurrentUser', () => {
  it('reports a signed-in user when the account has a google_id', async () => {
    mocks.getAccount.mockResolvedValue({ user: { display_name: 'Alice', google_id: 'g-1' } });
    const { getCurrentUser } = await loadNakama();
    expect(await getCurrentUser()).toEqual({ displayName: 'Alice', loggedIn: true });
  });

  it('reports an anonymous user when there is no google_id', async () => {
    mocks.getAccount.mockResolvedValue({ user: { username: 'anon-123' } });
    const { getCurrentUser } = await loadNakama();
    const user = await getCurrentUser();
    expect(user?.loggedIn).toBe(false);
    expect(user?.displayName).toBe('anon-123');
  });

  it('memoises: concurrent callers share a single account round-trip', async () => {
    const { getCurrentUser } = await loadNakama();
    await Promise.all([getCurrentUser(), getCurrentUser(), getCurrentUser()]);
    expect(mocks.getAccount).toHaveBeenCalledTimes(1);
  });

  it('keeps a signed-in player on a backend hiccup via the persisted hint', async () => {
    localStorage.setItem('gz-logged-in', '1');
    mocks.getAccount.mockRejectedValue(new Error('backend unreachable'));
    const { getCurrentUser } = await loadNakama();
    expect(await getCurrentUser()).toEqual({ displayName: 'Player', loggedIn: true });
  });

  it('returns null on a hiccup with no prior sign-in hint', async () => {
    mocks.getAccount.mockRejectedValue(new Error('backend unreachable'));
    const { getCurrentUser } = await loadNakama();
    expect(await getCurrentUser()).toBeNull();
  });
});

describe('logout', () => {
  it('clears the persisted session and sign-in hint', async () => {
    const { loginWithGoogleToken, logout } = await loadNakama();
    await loginWithGoogleToken(makeJwt({ name: 'Alice' }));
    expect(localStorage.getItem('gz-logged-in')).toBe('1');

    logout();

    expect(localStorage.getItem('gz-logged-in')).toBeNull();
    expect(localStorage.getItem('gz-nakama-session')).toBeNull();
    expect(localStorage.getItem('gz-nakama-device-id')).toBeNull();
  });
});
