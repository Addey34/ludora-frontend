/**
 * Friends — a Steam-like friend manager: your shareable friend code, an
 * add-by-code field, incoming friend requests (accept / decline) and your
 * friends grouped by presence (online first, then offline), plus any outgoing
 * request still pending. Signed-in only; guests get a prompt to sign in. Backed
 * by Nakama's friend graph; best-effort.
 */
import { applyTranslations, t } from '../shared/i18n/i18n.js';
import { requireGoogleUser } from '../shared/net/authGuard.js';
import {
  acceptFriend,
  addFriendByCode,
  FRIEND_STATE,
  getFriendCode,
  getFriendScores,
  listMyFriends,
  removeFriend,
  type Friend,
} from '../shared/net/nakama.js';
import { showToast } from '../shared/ui/toast.js';

/** Builds a small pill button used for the per-row friend actions. */
function actionButton(label: string, variant: 'accept' | 'decline'): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `friend-action friend-action--${variant}`;
  btn.textContent = label;
  return btn;
}

/** Renders one friend/request row; `actions` are appended on the trailing edge. */
function friendRow(friend: Friend, statusText: string, ...actions: HTMLElement[]): HTMLLIElement {
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
  status.textContent = statusText;

  li.append(dot, name, status, ...actions);
  return li;
}

/** A small "1,234 GZP" badge showing a friend's Ludora Points. */
function gzpBadge(points: number): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'friend-gzp';
  span.textContent = t('globalPoints', { score: points });
  return span;
}

/** A "Online — 3" style group header inside the friends list. */
function groupHeader(label: string, count: number): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'friends-group';
  li.setAttribute('role', 'presentation');
  li.textContent = `${label} — ${count}`;
  return li;
}

async function refreshFriends(): Promise<void> {
  const requestsSection = document.getElementById('requestsSection');
  const requestsList = document.getElementById('requestsList');
  const list = document.getElementById('friendsList');
  const empty = document.getElementById('friendsEmpty');
  if (!list) return;

  const friends = await listMyFriends();
  const received = friends.filter((f) => f.state === FRIEND_STATE.inviteReceived);
  const pending = friends.filter((f) => f.state === FRIEND_STATE.invitePending);
  const mutual = friends.filter((f) => f.state === FRIEND_STATE.mutual);
  const online = mutual.filter((f) => f.online);
  const offline = mutual.filter((f) => !f.online);

  // Each mutual friend's Ludora Points, shown inline (best-effort).
  const scores = await getFriendScores(mutual.map((f) => f.userId));
  const mutualActions = (f: Friend): HTMLElement[] => {
    const gzp = scores.get(f.userId);
    return gzp === undefined ? [removeAction(f)] : [gzpBadge(gzp), removeAction(f)];
  };

  // Incoming requests: accept / decline.
  if (requestsSection && requestsList) {
    requestsList.replaceChildren(
      ...received.map((friend) => {
        const accept = actionButton(t('friendAccept'), 'accept');
        accept.addEventListener('click', () => {
          void handleAction(acceptFriend(friend.code), t('friendAccepted'));
        });
        const decline = actionButton(t('friendDecline'), 'decline');
        decline.addEventListener('click', () => {
          void handleAction(removeFriend(friend.code), t('friendDeclined'));
        });
        return friendRow(friend, t('friendWantsToAdd'), accept, decline);
      })
    );
    requestsSection.hidden = received.length === 0;
  }

  // Friends list: online group, offline group, then still-pending outgoing.
  const rows: HTMLLIElement[] = [];
  if (online.length > 0) {
    rows.push(groupHeader(t('online'), online.length));
    rows.push(...online.map((f) => friendRow(f, t('online'), ...mutualActions(f))));
  }
  if (offline.length > 0) {
    rows.push(groupHeader(t('offline'), offline.length));
    rows.push(...offline.map((f) => friendRow(f, t('offline'), ...mutualActions(f))));
  }
  if (pending.length > 0) {
    rows.push(groupHeader(t('friendPending'), pending.length));
    rows.push(
      ...pending.map((f) => {
        const cancel = actionButton(t('cancel'), 'decline');
        cancel.addEventListener('click', () => {
          void handleAction(removeFriend(f.code), t('friendRemoved'));
        });
        return friendRow(f, t('friendPending'), cancel);
      })
    );
  }
  list.replaceChildren(...rows);
  if (empty) empty.hidden = mutual.length + pending.length > 0;
}

/** The "✕" remove button shown on a mutual-friend row. */
function removeAction(friend: Friend): HTMLButtonElement {
  const btn = actionButton('✕', 'decline');
  btn.setAttribute('aria-label', t('friendRemove'));
  btn.title = t('friendRemove');
  btn.addEventListener('click', () => {
    void handleAction(removeFriend(friend.code), 'friendRemoved');
  });
  return btn;
}

/** Runs a friend-graph mutation, toasts the result, and refreshes the list. */
async function handleAction(action: Promise<void>, successMessage: string): Promise<void> {
  try {
    await action;
    showToast(successMessage, 'success');
    await refreshFriends();
  } catch {
    showToast(t('friendAddError'), 'warning');
  }
}

async function init(): Promise<void> {
  const signedIn = document.getElementById('friendsSignedIn');
  const guest = document.getElementById('friendsGuest');

  if (guest) guest.hidden = true;
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
void (async () => {
  const user = await requireGoogleUser();
  if (!user) return;
  await init();
})();
