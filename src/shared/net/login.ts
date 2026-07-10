import { GOOGLE_CLIENT_ID, loginWithGoogleToken, getCurrentUser, logout } from './nakama.js';
import { clearLocalProgress } from '../levels/levels.js';
import { flushPendingScore } from '../score/pendingScore.js';
import { showToast } from '../ui/toast.js';
import { t } from '../i18n/i18n.js';

/**
 * Drives the "Sign in with Google" widget in the sidebar (`#authArea`), loaded
 * globally like `sidebar.ts`. It loads Google Identity Services, shows the
 * Google button when anonymous, and the player's name + a logout button once
 * signed in. All Nakama work is delegated to `nakama.ts`.
 */

/** Minimal typing for the bits of Google Identity Services we use. */
interface GoogleCredentialResponse {
  credential: string;
}
interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string>): void;
  prompt(): void;
}
declare const google: { accounts: { id: GoogleIdApi } };

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** Escapes a user-controlled value before HTML injection. */
function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

/** Loads the Google Identity Services script once. */
function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${GIS_SRC}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity Services failed to load'));
    document.head.appendChild(script);
  });
}

/** Renders the auth area depending on the current sign-in state. */
async function renderAuthArea(area: HTMLElement): Promise<void> {
  const user = await getCurrentUser();
  if (user?.loggedIn) {
    // Signed in: one compact account button opening a dropdown (profile,
    // leaderboard, friends, sign out) — keeps the rail's middle for categories.
    area.innerHTML = `
      <div class="sidebar-account" id="sidebarAccount">
        <button
          class="sidebar-auth-item sidebar-account-toggle"
          type="button"
          id="accountToggle"
          aria-haspopup="true"
          aria-expanded="false"
          aria-label="${escapeHtml(user.displayName)}"
        >
          <span class="sidebar-icon"><i class="fas fa-circle-user" aria-hidden="true"></i></span>
          <span class="sidebar-label">${escapeHtml(user.displayName)}</span>
        </button>
        <div class="sidebar-account-menu" id="accountMenu" role="menu">
          <a class="sidebar-account-link" role="menuitem" href="/profile">
            <i class="fas fa-user" aria-hidden="true"></i><span>${escapeHtml(t('profileTitle'))}</span>
          </a>
          <a class="sidebar-account-link" role="menuitem" href="/leaderboard">
            <i class="fas fa-trophy" aria-hidden="true"></i><span>${escapeHtml(t('leaderboard'))}</span>
          </a>
          <a class="sidebar-account-link" role="menuitem" href="/leaderboard?tab=friends">
            <i class="fas fa-user-group" aria-hidden="true"></i><span>${escapeHtml(t('tabFriends'))}</span>
          </a>
          <button class="sidebar-account-link" role="menuitem" type="button" id="logoutBtn">
            <i class="fas fa-right-from-bracket" aria-hidden="true"></i><span>${escapeHtml(t('signOut'))}</span>
          </button>
        </div>
      </div>`;
    const account = area.querySelector<HTMLElement>('#sidebarAccount');
    const toggle = area.querySelector<HTMLButtonElement>('#accountToggle');
    toggle?.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = account?.classList.toggle('is-open') ?? false;
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (event) => {
      if (account && !account.contains(event.target as Node)) {
        account.classList.remove('is-open');
        toggle?.setAttribute('aria-expanded', 'false');
      }
    });
    area.querySelector('#logoutBtn')?.addEventListener('click', () => {
      clearLocalProgress();
      logout();
      location.reload();
    });
  } else {
    area.innerHTML = `
      <div class="sidebar-auth-item" id="loginItem">
        <span class="sidebar-icon" id="gsiButton"></span>
        <span class="sidebar-label">${t('signIn')}</span>
      </div>`;
    const target = area.querySelector<HTMLElement>('#gsiButton');
    if (target) {
      google.accounts.id.renderButton(target, {
        type: 'icon',
        theme: 'filled_blue',
        size: 'medium',
        shape: 'circle',
      });
    }
    area.querySelector('#loginItem')?.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('#gsiButton')) return;
      google.accounts.id.prompt();
    });
  }
}

async function init(): Promise<void> {
  const area = document.getElementById('authArea');
  if (!area) return;
  try {
    await loadGoogleScript();
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        loginWithGoogleToken(response.credential)
          .then((switched) => {
            if (switched) clearLocalProgress();
            location.reload();
          })
          .catch((err) => console.warn('[login] Google sign-in failed:', err));
      },
    });
    await renderAuthArea(area);
    // A guest who signed in to save a run: record it now, under their new name.
    if (await flushPendingScore()) showToast(t('scoreSaved'), 'success');
    // Let any "Sign in to save" button (game-over overlay) open the Google prompt.
    window.addEventListener('gz-request-login', () => {
      try {
        google.accounts.id.prompt();
      } catch {
        // GIS not ready — ignore
      }
    });
  } catch (err) {
    console.warn('[login] indisponible:', err);
  }
}

init();
