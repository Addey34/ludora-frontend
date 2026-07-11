/**
 * Profile — the player's account: their display name (used on the leaderboards).
 * The current name is shown read-only with a pencil that reveals an inline
 * editor. Signed-in only; guests see a prompt to sign in. Personal scores live on
 * the Leaderboard's "Personal" tab.
 */
import { applyTranslations, t } from '../shared/i18n/i18n.js';
import { requireGoogleUser } from '../shared/net/authGuard.js';
import { updateDisplayName, type CurrentUser } from '../shared/net/nakama.js';
import { showToast } from '../shared/ui/toast.js';

function setupNameEditor(user: CurrentUser): void {
  const row = document.getElementById('profileNameRow');
  const guest = document.getElementById('profileGuest');
  const display = document.getElementById('nameDisplay');
  const value = document.getElementById('nameValue');
  const form = document.getElementById('displayNameForm') as HTMLFormElement | null;
  const input = document.getElementById('displayName') as HTMLInputElement | null;
  const editBtn = document.getElementById('editName');
  const cancelBtn = document.getElementById('cancelName');
  if (!row || !display || !value || !form || !input) return;

  if (guest) guest.hidden = true;
  value.textContent = user.displayName;
  row.hidden = false;

  const openEditor = (): void => {
    input.value = value.textContent ?? '';
    display.hidden = true;
    form.hidden = false;
    input.focus();
    input.select();
  };
  const closeEditor = (): void => {
    form.hidden = true;
    display.hidden = false;
  };

  editBtn?.addEventListener('click', openEditor);
  cancelBtn?.addEventListener('click', closeEditor);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const next = input.value.trim();
    if (!next) return;
    updateDisplayName(next)
      .then(() => {
        value.textContent = next;
        closeEditor();
        showToast(t('nameSaved'), 'success');
      })
      .catch(() => showToast(t('nameSaveError'), 'warning'));
  });
}

applyTranslations();
void (async () => {
  const user = await requireGoogleUser();
  if (!user) return;
  setupNameEditor(user);
})();
