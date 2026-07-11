/**
 * Privacy-friendly product analytics — a thin, best-effort event beacon.
 *
 * Complements Cloudflare Web Analytics (which covers page views + Core Web
 * Vitals) with the *product funnel* it can't see: which games get opened, how
 * many players sign in, save a score, or share/open a challenge — plus a
 * client-error signal so prod failures (e.g. the auth path) aren't invisible.
 *
 * Design:
 *  - **No PII.** Only an allow-listed set of event names, and props are
 *    sanitised (short scalars only). No names, emails, ids, or free text.
 *  - **Opt-out honoured.** If the browser sends Do-Not-Track, nothing is sent.
 *  - **Best-effort.** Events are batched and flushed to the Nakama `log_event`
 *    RPC over the session login.ts already establishes; any failure (RPC not
 *    deployed, offline) is swallowed. Analytics never affects gameplay.
 *
 * The pure helpers (name allow-list, prop sanitising, DNT check, batching cap)
 * are unit-tested; the transport is fire-and-forget.
 */
import { getSession, getClient } from '../net/nakama.js';

/** The only event names accepted — a closed set keeps the funnel legible + safe. */
export const EVENT_NAMES = [
  'game_start',
  'sign_in',
  'score_saved',
  'challenge_shared',
  'challenge_opened',
  'client_error',
] as const;
type EventName = (typeof EVENT_NAMES)[number];

type PropValue = string | number | boolean;
interface AnalyticsEvent {
  name: EventName;
  props: Record<string, PropValue>;
  /** Client timestamp (ms since epoch). */
  ts: number;
}

const MAX_PROPS = 8;
const MAX_STRING = 64;
const MAX_QUEUE = 50;

/** True unless the browser explicitly asks not to be tracked. */
export function trackingAllowed(dnt: string | null | undefined): boolean {
  return dnt !== '1' && dnt !== 'yes';
}

/** Sanitises props to short scalars, dropping anything unexpected. Pure. */
export function sanitizeProps(
  props: Record<string, unknown> | undefined
): Record<string, PropValue> {
  const out: Record<string, PropValue> = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (Object.keys(out).length >= MAX_PROPS) break;
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'string') out[key] = value.slice(0, MAX_STRING);
  }
  return out;
}

/** Builds a sanitised event, or null if the name is not allow-listed. Pure. */
export function buildEvent(
  name: string,
  props?: Record<string, unknown>,
  now: number = Date.now()
): AnalyticsEvent | null {
  if (!(EVENT_NAMES as readonly string[]).includes(name)) return null;
  return { name: name as EventName, props: sanitizeProps(props), ts: now };
}

let queue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

/** Whether tracking is enabled for this environment (browser + not DNT). */
function enabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  return trackingAllowed(navigator.doNotTrack ?? null);
}

async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    const session = await getSession();
    await (await getClient()).rpc(session, 'log_event', { events: batch });
  } catch {
    // best-effort: drop the batch, never retry, never surface an error
  }
}

/**
 * Records a product event (best-effort). Unknown names and DNT browsers are
 * no-ops. Events are coalesced and flushed shortly after, and on page hide.
 */
export function track(name: EventName, props?: Record<string, unknown>): void {
  if (!enabled()) return;
  const event = buildEvent(name, props);
  if (!event) return;
  queue.push(event);
  if (queue.length > MAX_QUEUE) queue.shift();

  if (typeof document !== 'undefined' && !listenersBound) {
    listenersBound = true;
    // Flush what we have before the page goes away (bfcache / navigation).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush();
    });
  }
  if (!flushTimer) flushTimer = setTimeout(() => void flush(), 3000);
}

/**
 * Installs global client-error tracking once (window error +
 * unhandledrejection). Only the message/source are sent — no stack, no PII.
 */
export function initErrorTracking(): void {
  if (!enabled() || typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    track('client_error', { message: String(e.message ?? 'error'), source: e.filename ?? '' });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    track('client_error', { message: String(reason ?? 'rejection'), kind: 'promise' });
  });
}
