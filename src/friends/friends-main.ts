/**
 * Friends — add friends by code and see who is online. Signed-in only; guests
 * get a prompt to sign in. Backed by Nakama's friend graph; best-effort.
 */
import { applyTranslations, t } from '../shared/i18n/i18n.js';
import {
  addFriendByCode,
  getCurrentUser,
  getFriendCode,
  listMyFriends,
  type Friend,
} from '../shared/net/nakama.js';
import { showToast } from '../shared/ui/toast.js';

function friendRow(friend: Friend): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'friend-row';

  const dot = document.createElement('span');
  dot.className = `friend-dot${friend.online ? ' is-online' : ''}`;
  dot.setAttribute('aria-hidden', 'true');

  const name = document.createElement('span');
  name.className = 'friend-name';
  name.textContent = friend.displayName;

  const status = document.createElement('span');
  status.className = 'friend-status';
  status.textContent =
    friend.state === 1 ? t('friendPending') : t(friend.online ? 'online' : 'offline');

  li.append(dot, name, status);
  return li;
}

async function refreshFriends(): Promise<void> {
  const list = document.getElementById('friendsList');
  const empty = document.getElementById('friendsEmpty');
  if (!list) return;
  const friends = await listMyFriends();
  list.replaceChildren(...friends.map(friendRow));
  if (empty) empty.hidden = friends.length > 0;
}

async function init(): Promise<void> {
  const signedIn = document.getElementById('friendsSignedIn');
  const guest = document.getElementById('friendsGuest');

  const user = await getCurrentUser();
  if (!user?.loggedIn) {
    if (guest) guest.hidden = false;
    return;
  }
  if (signedIn) signedIn.hidden = false;

  const codeEl = document.getElementById('friendCode');
  const code = await getFriendCode();
  if (codeEl && code) codeEl.textContent = code;

  document.getElementById('copyCode')?.addEventListener('click', () => {
    if (!code) return;
    navigator.clipboard
      ?.writeText(code)
      .then(() => showToast(t('friendCodeCopied'), 'success'))
      .catch(() => showToast(code, 'info'));
  });

  const form = document.getElementById('addFriendForm') as HTMLFormElement | null;
  const input = document.getElementById('friendCodeInput') as HTMLInputElement | null;
  if (input) input.placeholder = t('friendCodePlaceholder');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input?.value.trim();
    if (!value) return;
    addFriendByCode(value)
      .then(() => {
        showToast(t('friendAdded'), 'success');
        if (input) input.value = '';
        void refreshFriends();
      })
      .catch(() => showToast(t('friendAddError'), 'warning'));
  });

  void refreshFriends();
}

applyTranslations();
void init();
