import { getCurrentUser, type CurrentUser } from './nakama.js';

const AUTH_RETURN_KEY = 'ludora-auth-return';
const AUTH_REQUIRED_KEY = 'ludora-auth-required';

export function consumeAuthRequired(): boolean {
  const required = sessionStorage.getItem(AUTH_REQUIRED_KEY) === '1';
  sessionStorage.removeItem(AUTH_REQUIRED_KEY);
  return required;
}

export function consumeAuthReturnPath(): string | null {
  const path = sessionStorage.getItem(AUTH_RETURN_KEY);
  sessionStorage.removeItem(AUTH_RETURN_KEY);
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

export async function requireGoogleUser(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (user?.loggedIn) return user;

  sessionStorage.setItem(AUTH_RETURN_KEY, `${location.pathname}${location.search}${location.hash}`);
  sessionStorage.setItem(AUTH_REQUIRED_KEY, '1');
  location.replace('/');
  return null;
}
