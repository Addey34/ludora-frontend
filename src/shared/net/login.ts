import { GOOGLE_CLIENT_ID, loginWithGoogleToken, getCurrentUser, logout } from './nakama.js';
import { clearLocalProgress } from '../levels/levels.js';
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
    area.innerHTML = `
      <button
        class="sidebar-auth-item"
        type="button"
        id="logoutBtn"
        title="${escapeHtml(t('signOutOf', { name: user.displayName }))}"
        aria-label="${t('signOut')}"
      >
        <span class="sidebar-icon"><i class="fas fa-right-from-bracket" aria-hidden="true"></i></span>
        <span class="sidebar-label">${escapeHtml(user.displayName)}</span>
      </button>`;
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
  } catch (err) {
    console.warn('[login] indisponible:', err);
  }
}

init();
