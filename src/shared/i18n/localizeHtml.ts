/**
 * Build-time HTML localization. Turns an English page (the source of truth,
 * annotated with `data-i18n*`) into a translated variant by baking the catalog
 * value into the markup — so a non-English page ships already translated and
 * never flashes English first. Used in two places, sharing this one function so
 * dev and prod stay in parity:
 *  - the Vite build (emits `dist/fr/**` from the English `dist/**` pages),
 *  - the dev/preview middleware (translates `/fr/…` requests on the fly).
 *
 * It reuses the existing `data-i18n*` annotations and {@link CATALOG}; there is
 * no separate FR markup to maintain. Pure and unit-tested (localizeHtml.test.ts).
 */
import { HTMLElement, parse } from 'node-html-parser';
import type { Locale } from './i18n.js';

/**
 * The interface catalog shape ({@link CATALOG} in i18n.ts). Passed in rather than
 * imported so this module carries only a *type* dependency on i18n.ts — the Vite
 * config bundles it at build time, and a value import of i18n's `.js` specifier
 * wouldn't resolve there. Callers pass `CATALOG`.
 */
type Catalog = Record<Locale, Record<string, string>>;

/** Absolute paths that are assets, not navigable pages — never prefixed. */
const ASSET_PREFIXES = ['/css', '/assets', '/icons', '/data', '/vendor', '/js', '/shared'];

/** Open Graph locale code per interface locale. */
const OG_LOCALE: Record<Locale, string> = { en: 'en_US', fr: 'fr_FR' };

/** `data-i18n*` attribute → the DOM attribute it fills (mirrors applyTranslations). */
const ATTR_TARGETS: Record<string, string> = {
  'data-i18n-aria': 'aria-label',
  'data-i18n-label': 'data-label',
  'data-i18n-placeholder': 'placeholder',
};

function tr(catalog: Catalog, locale: Locale, key: string): string {
  return catalog[locale][key] ?? catalog.en[key] ?? key;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Rewrites an internal navigation path for `locale` (adds the `/fr` prefix for
 * French). Leaves external links, anchors, assets and any path with a file
 * extension untouched, so `/fr/css/…` (which doesn't exist) is never produced.
 */
export function rewriteNavPath(href: string, locale: Locale): string {
  if (locale === 'en') return href;
  if (!href.startsWith('/') || href.startsWith('//')) return href; // external / protocol-relative
  if (href.startsWith('/fr/') || href === '/fr') return href; // already localized
  if (ASSET_PREFIXES.some((p) => href === p || href.startsWith(`${p}/`))) return href;
  if (/\.[a-z0-9]+($|[?#])/i.test(href)) return href; // has a file extension (favicon.svg…)
  return href === '/' ? '/fr/' : `/fr${href}`;
}

/** Rewrites the path of an absolute same-site URL (canonical / og:url). */
function localizeAbsoluteUrl(url: string, locale: Locale): string {
  try {
    const parsed = new URL(url);
    parsed.pathname = rewriteNavPath(parsed.pathname, locale);
    return parsed.toString();
  } catch {
    return url;
  }
}

function localizeElement(el: HTMLElement, locale: Locale, catalog: Catalog): void {
  const textKey = el.getAttribute('data-i18n');
  if (textKey !== undefined) el.set_content(escapeHtml(tr(catalog, locale, textKey)));

  const htmlKey = el.getAttribute('data-i18n-html');
  if (htmlKey !== undefined) el.set_content(tr(catalog, locale, htmlKey));

  for (const [dataAttr, target] of Object.entries(ATTR_TARGETS)) {
    const key = el.getAttribute(dataAttr);
    if (key !== undefined) el.setAttribute(target, tr(catalog, locale, key));
  }

  if (el.rawTagName?.toLowerCase() === 'a') {
    const href = el.getAttribute('href');
    if (href) el.setAttribute('href', rewriteNavPath(href, locale));
  }

  if (el.rawTagName?.toLowerCase() === 'link' && el.getAttribute('rel') === 'canonical') {
    const href = el.getAttribute('href');
    if (href) el.setAttribute('href', localizeAbsoluteUrl(href, locale));
  }

  if (el.rawTagName?.toLowerCase() === 'meta' && el.getAttribute('property') === 'og:url') {
    const content = el.getAttribute('content');
    if (content) el.setAttribute('content', localizeAbsoluteUrl(content, locale));
  }

  if (el.rawTagName?.toLowerCase() === 'meta' && el.getAttribute('property') === 'og:locale') {
    el.setAttribute('content', OG_LOCALE[locale]);
  }
}

function walk(el: HTMLElement, visit: (el: HTMLElement) => void): void {
  visit(el);
  for (const child of el.childNodes) {
    if (child instanceof HTMLElement) walk(child, visit);
  }
}

/**
 * Returns `html` translated to `locale` using `catalog`. English is returned
 * unchanged (it is the shipped default). The doctype is preserved verbatim
 * (node-html-parser drops it).
 */
export function translateHtml(html: string, locale: Locale, catalog: Catalog): string {
  if (locale === 'en') return html;

  const doctype = html.match(/^\s*<!doctype[^>]*>/i)?.[0] ?? '';
  const root = parse(html.slice(doctype.length), {
    comment: true,
    blockTextElements: { script: true, style: true, noscript: true, pre: true },
  });

  const htmlEl = root.querySelector('html');
  if (htmlEl) htmlEl.setAttribute('lang', locale);

  walk(root, (el) => localizeElement(el, locale, catalog));

  return doctype + root.toString();
}
