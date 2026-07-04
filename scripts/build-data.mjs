/**
 * Data pipeline — regenerates the educational games' datasets into public/data/
 * from free sources, so the content isn't hand-written. Run with `npm run data`.
 *
 * Language-driven: for each locale in LOCALES it pulls that language's content
 * from reusable multilingual sources, so adding a language is just adding it to
 * the list (no per-game hand-writing).
 *
 * Sources:
 *   - countries-<lang>.json → Wikidata SPARQL (country + capital labels in the
 *     target language) + flagcdn SVG flags
 *   - words-<lang>.json → OpenSubtitles frequency lists (+ npm dictionaries for
 *     fr/en), uppercased and accent-stripped for the games
 *   - verbs.json → french-verbs + lefff lexicon (French only for now; other
 *     languages would use verbecc, which needs its own service)
 *   - trivia-en.json → English questions from OpenTDB (no free multilingual
 *     trivia source; other languages fall back to English until curated)
 *
 * Defensive: each generator only overwrites its file when it obtained non-empty
 * data; on any failure it logs and leaves the committed JSON untouched, so a run
 * without network (or a down API) never breaks the build.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = resolve(ROOT, 'public', 'data');

/** Languages to generate content for. Add a locale here to cover a new language. */
const LOCALES = ['en', 'fr'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function readJsonSafe(name) {
  const path = resolve(DATA_DIR, name);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Writes `data` to public/data/<name> only when it is a non-empty array. */
function writeJson(name, data) {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn(`  ! ${name}: empty result, keeping the existing file`);
    return;
  }
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, name), JSON.stringify(data, null, 2) + '\n');
  console.log(`  ✓ ${name}: ${data.length} entries`);
}

// --- Countries (Wikidata, per language) -------------------------------------

/** Sovereign states with a capital + ISO code, labelled in `lang` (Wikidata SPARQL). */
async function fetchCountries(lang) {
  const query = `SELECT ?c ?cLabel ?capLabel ?iso WHERE {
    ?c wdt:P31 wd:Q3624078 .
    FILTER NOT EXISTS { ?c wdt:P31 wd:Q3024240 }
    ?c wdt:P36 ?cap . ?c wdt:P297 ?iso .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". }
  }`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GamesZone-data/1.0', Accept: 'application/sparql-results+json' },
  });
  const json = await res.json();

  const seen = new Set();
  const out = [];
  for (const b of json.results.bindings) {
    const iso = b.iso?.value;
    const name = b.cLabel?.value;
    const capital = b.capLabel?.value;
    // Skip missing labels (Wikidata returns the raw "Q123" id when a label is absent).
    if (!iso || !name || !capital || seen.has(iso) || /^Q\d+$/.test(name)) continue;
    seen.add(iso);
    out.push({ name, capital, flag: `https://flagcdn.com/${iso.toLowerCase()}.svg` });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, lang));
  return out;
}

async function buildCountries() {
  for (const lang of LOCALES) {
    writeJson(`countries-${lang}.json`, await fetchCountries(lang));
    await sleep(1500); // be gentle with the Wikidata endpoint
  }
}

// --- Words (dictionary ∩ frequency) -----------------------------------------

async function frequencyList(lang) {
  const url = `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${lang}/${lang}_50k.txt`;
  const text = await (await fetch(url)).text();
  return text
    .split('\n')
    .map((line) => line.split(' ')[0])
    .filter(Boolean);
}

/**
 * Difficulty of a word for the language games: short & plain = easy; long, or
 * accented, or with rarer letters = harder. Drives the typing/word difficulty.
 */
function classify(word) {
  const bare = stripAccents(word);
  const accented = bare.toLowerCase() !== word.toLowerCase();
  const rare = /[kwxyzq]/i.test(bare);
  const len = word.length;
  if (len >= 9 || (accented && len >= 7)) return 'hard';
  if (len <= 5 && !accented && !rare) return 'easy';
  return 'medium';
}

/** A word entry: the real spelling (accents kept) + its difficulty tier. */
function toEntry(word) {
  const w = word.trim().toLowerCase();
  // Letters only once accents are stripped (drop hyphens, apostrophes, digits).
  if (!/^[a-z]{3,12}$/.test(stripAccents(w))) return null;
  return { w, d: classify(w) };
}

/** Dictionaries to validate against (only where an npm list exists). */
function dictionaryFor(lang) {
  if (lang === 'fr') return new Set(require('an-array-of-french-words'));
  if (lang === 'en') return new Set(require('an-array-of-english-words'));
  return null; // no dictionary → frequency list only
}

async function buildWords() {
  for (const lang of LOCALES) {
    const dict = dictionaryFor(lang);
    const freq = await frequencyList(lang);
    const seen = new Set();
    const out = [];
    for (const word of freq) {
      if (dict && !dict.has(word)) continue; // keep only real dictionary words (where we can check)
      const entry = toEntry(word);
      if (!entry || seen.has(entry.w)) continue;
      seen.add(entry.w);
      out.push(entry);
      if (out.length >= 600) break;
    }
    writeJson(`words-${lang}.json`, out);
  }
}

// --- French verbs (french-verbs + lefff) ------------------------------------

const VERB_LIST = [
  'être',
  'avoir',
  'aller',
  'faire',
  'dire',
  'pouvoir',
  'voir',
  'prendre',
  'vouloir',
  'venir',
  'devoir',
  'savoir',
  'parler',
  'aimer',
  'manger',
  'finir',
  'partir',
  'mettre',
  'donner',
  'trouver',
  'penser',
  'regarder',
  'passer',
  'demander',
  'rester',
  'sortir',
  'entendre',
  'répondre',
  'écrire',
  'lire',
  'boire',
  'courir',
  'ouvrir',
  'tenir',
  'connaître',
  'attendre',
];

function buildVerbs() {
  const fv = require('french-verbs');
  const lefff = require('french-verbs-lefff/dist/conjugations.json');
  const tenses = { present: 'PRESENT', imperfect: 'IMPARFAIT', future: 'FUTUR' };
  const out = [];
  for (const verb of VERB_LIST) {
    try {
      const entry = { verb };
      for (const [key, tense] of Object.entries(tenses)) {
        entry[key] = [];
        for (let person = 0; person < 6; person++) {
          const form = fv.getConjugation(lefff, verb, tense, person, {});
          if (!form || typeof form !== 'string') throw new Error('missing form');
          entry[key].push(form);
        }
      }
      out.push(entry);
    } catch {
      console.warn(`  ~ verb skipped (not fully conjugable): ${verb}`);
    }
  }
  writeJson('verbs.json', out);
}

// --- Trivia (OpenTDB, English) ----------------------------------------------

/** Maps an OpenTDB category onto the game's four buckets. */
function mapCategory(category) {
  const c = category.toLowerCase();
  if (c.includes('history')) return 'history';
  if (c.includes('animals') || c.includes('nature')) return 'nature';
  if (c.startsWith('science')) return 'science';
  return 'culture';
}

async function fetchOpenTDB(amount) {
  const url = `https://opentdb.com/api.php?amount=${amount}&type=multiple&encode=url3986`;
  const json = await (await fetch(url)).json();
  if (json.response_code !== 0) return [];
  return json.results.map((r) => ({
    category: mapCategory(decodeURIComponent(r.category)),
    question: decodeURIComponent(r.question),
    answer: decodeURIComponent(r.correct_answer),
  }));
}

async function buildTrivia() {
  let questions = [];
  try {
    questions = await fetchOpenTDB(50);
    await sleep(5500); // OpenTDB rate-limits to ~1 request / 5 s
    questions = questions.concat(await fetchOpenTDB(50));
  } catch (err) {
    console.warn(`  ! OpenTDB unavailable (${err.message})`);
  }
  const seen = new Set();
  const unique = questions.filter((q) => !seen.has(q.question) && seen.add(q.question));
  writeJson('trivia-en.json', unique);
}

// --- Runner -----------------------------------------------------------------

/** Runs a generator, isolating failures so one bad source can't abort the rest. */
async function run(label, fn) {
  console.log(`• ${label}…`);
  try {
    await fn();
  } catch (err) {
    console.warn(`  ! ${label} failed: ${err.message} — existing file kept`);
  }
}

await run('countries', buildCountries);
await run('words', buildWords);
await run('verbs', buildVerbs);
await run('trivia', buildTrivia);
console.log('Done.');
