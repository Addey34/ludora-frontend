/**
 * Data pipeline — regenerates the educational games' datasets into public/data/
 * from free sources, so the content isn't hand-written. Run with `npm run data`.
 *
 * Sources:
 *   - countries.json → mledoze/countries dataset (English names, capitals,
 *     region) + flagcdn SVG flag URLs
 *   - words-fr/en.json → npm dictionaries filtered by OpenSubtitles frequency
 *     (common words only), uppercased and accent-stripped for the games
 *   - verbs.json → french-verbs + lefff lexicon (présent / imparfait / futur)
 *   - trivia.json → English questions from OpenTDB (mapped to 4 categories)
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

// --- Countries (mledoze static dataset + flagcdn flags) ---------------------

async function buildCountries() {
  // REST Countries' bulk endpoint is deprecated; this static dataset is stable.
  // English names/capitals (the app is English-only for now).
  const url = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
  const data = await (await fetch(url)).json();
  const out = data
    .filter((c) => c?.independent && c?.capital?.[0] && c?.name?.common)
    .map((c) => ({
      name: c.name.common,
      capital: c.capital[0],
      flag: c.cca2 ? `https://flagcdn.com/${c.cca2.toLowerCase()}.svg` : '',
      region: c.region ?? '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  writeJson('countries.json', out);
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

/** Uppercased, accent-free A–Z form of length 4–9, or null if unusable. */
function toGameWord(word) {
  const up = stripAccents(word).toUpperCase();
  return /^[A-Z]{4,9}$/.test(up) ? up : null;
}

async function buildWords() {
  const dicts = {
    fr: new Set(require('an-array-of-french-words')),
    en: new Set(require('an-array-of-english-words')),
  };
  for (const lang of ['fr', 'en']) {
    const freq = await frequencyList(lang);
    const seen = new Set();
    const out = [];
    for (const word of freq) {
      if (!dicts[lang].has(word)) continue; // keep only real dictionary words
      const game = toGameWord(word);
      if (!game || seen.has(game)) continue;
      seen.add(game);
      out.push(game);
      if (out.length >= 300) break;
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
  const tenses = { présent: 'PRESENT', imparfait: 'IMPARFAIT', futur: 'FUTUR' };
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
  writeJson('trivia.json', unique);
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
