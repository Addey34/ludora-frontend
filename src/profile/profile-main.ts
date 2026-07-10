/**
 * Profile — the player's account: their display name (used on the leaderboards).
 * Signed-in only; guests see a prompt to sign in. Personal scores live on the
 * Leaderboard's "Personal" tab.
 */
import { applyTranslations, t } from '../shared/i18n/i18n.js';
import { getCurrentUser, updateDisplayName } from '../shared/net/nakama.js';
import { showToast } from '../shared/ui/toast.js';

async function setupNameEditor(): Promise<void> {
  const row = document.getElementById('profileNameRow');
  const guest = document.getElementById('profileGuest');
  const form = document.getElementById('displayNameForm') as HTMLFormElement | null;
  const input = document.getElementById('displayName') as HTMLInputElement | null;
  if (!row || !form || !input) return;

  const user = await getCurrentUser();
  if (!user?.loggedIn) {
    if (guest) guest.hidden = false;
    return;
  }

  input.value = user.displayName;
  row.hidden = false;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    updateDisplayName(value)
      .then(() => showToast(t('nameSaved'), 'success'))
      .catch(() => showToast(t('nameSaveError'), 'warning'));
  });
}

applyTranslations();
void setupNameEditor();
