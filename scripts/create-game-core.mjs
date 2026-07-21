import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GAME_TYPES = ['realtime', 'board', 'quiz'];
export const GAME_CATEGORIES = ['action', 'puzzle', 'words', 'quiz', 'board', 'cards'];

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE_ROOT = resolve(SCRIPT_DIR, 'game-templates');
const GENERATED_CATALOG_PATH = 'src/shared/i18n/generatedGames.ts';

const TEMPLATE_OUTPUTS = {
  realtime: [
    ['index.html.tpl', 'src/games/{{key}}/index.html'],
    ['main.ts.tpl', 'src/games/{{key}}/{{key}}-main.ts'],
    ['Game.ts.tpl', 'src/games/{{key}}/{{Class}}Game.ts'],
    ['state.ts.tpl', 'src/games/{{key}}/{{key}}State.ts'],
    ['logic.ts.tpl', 'src/games/{{key}}/{{key}}Logic.ts'],
    ['logic.test.ts.tpl', 'src/games/{{key}}/{{key}}Logic.test.ts'],
    ['DOMRenderer.ts.tpl', 'src/games/{{key}}/{{Class}}DOMRenderer.ts'],
    ['game.css.tpl', 'public/css/games/{{key}}.css'],
    ['icon.svg.tpl', 'public/icons/{{key}}.svg'],
  ],
  board: [
    ['index.html.tpl', 'src/games/{{key}}/index.html'],
    ['main.ts.tpl', 'src/games/{{key}}/{{key}}-main.ts'],
    ['Game.ts.tpl', 'src/games/{{key}}/{{Class}}Game.ts'],
    ['rules.ts.tpl', 'src/games/{{key}}/{{key}}.ts'],
    ['rules.test.ts.tpl', 'src/games/{{key}}/{{key}}.test.ts'],
    ['game.css.tpl', 'public/css/games/{{key}}.css'],
    ['icon.svg.tpl', 'public/icons/{{key}}.svg'],
  ],
  quiz: [
    ['index.html.tpl', 'src/games/{{key}}/index.html'],
    ['main.ts.tpl', 'src/games/{{key}}/{{key}}-main.ts'],
    ['Game.ts.tpl', 'src/games/{{key}}/{{Class}}Game.ts'],
    ['logic.ts.tpl', 'src/games/{{key}}/{{key}}.ts'],
    ['logic.test.ts.tpl', 'src/games/{{key}}/{{key}}.test.ts'],
    ['game.css.tpl', 'public/css/games/{{key}}.css'],
    ['icon.svg.tpl', 'public/icons/{{key}}.svg'],
  ],
};

const OPTION_NAMES = new Map([
  ['key', 'key'],
  ['label', 'label'],
  ['label-fr', 'labelFr'],
  ['type', 'type'],
  ['category', 'category'],
  ['color', 'color'],
  ['description-en', 'descriptionEn'],
  ['description-fr', 'descriptionFr'],
]);

export function usage() {
  return [
    'Create a complete Ludora game scaffold.',
    '',
    'Usage:',
    '  npm run game:new -- --key <key> --label <label> --type <type> --category <category> --color <hex>',
    '',
    'Required:',
    '  --key             Lowercase route/folder key (letters, digits, hyphens)',
    '  --label           English display name',
    '  --type            realtime | board | quiz',
    '  --category        action | puzzle | words | quiz | board | cards',
    '  --color           Six-digit CSS hex colour, e.g. #2563eb',
    '',
    'Optional:',
    '  --label-fr        French display name (defaults to --label)',
    '  --description-en  English SEO description',
    '  --description-fr  French SEO description',
    '  --dry-run         Validate and print the file plan without writing',
    '  --help            Show this help',
  ].join('\n');
}

export function parseCliArgs(argv) {
  const parsed = { dryRun: false, help: false };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);

    const [rawName, inlineValue] = argument.slice(2).split(/=(.*)/s, 2);
    const property = OPTION_NAMES.get(rawName);
    if (!property) throw new Error(`Unknown option: --${rawName}`);
    const value = inlineValue ?? argv[++index];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${rawName}`);
    }
    parsed[property] = value;
  }
  return parsed;
}

export function normalizeGameOptions(raw) {
  const key = String(raw.key ?? '').trim();
  const label = String(raw.label ?? '').trim();
  const labelFr = String(raw.labelFr ?? label).trim();
  const type = String(raw.type ?? '').trim();
  const category = String(raw.category ?? '').trim();
  const color = String(raw.color ?? '')
    .trim()
    .toLowerCase();

  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(key)) {
    throw new Error('Game key must use lowercase letters, digits and single hyphens');
  }
  if (!label) throw new Error('English label is required');
  if (!labelFr) throw new Error('French label is required');
  if (!GAME_TYPES.includes(type)) {
    throw new Error(`Game type must be one of: ${GAME_TYPES.join(', ')}`);
  }
  if (!GAME_CATEGORIES.includes(category)) {
    throw new Error(`Category must be one of: ${GAME_CATEGORIES.join(', ')}`);
  }
  if (!/^#[0-9a-f]{6}$/.test(color)) {
    throw new Error('Colour must be a six-digit CSS hex value, e.g. #2563eb');
  }

  const className = toPascalCase(key);
  const camelName = className[0].toLowerCase() + className.slice(1);
  return {
    key,
    label,
    labelFr,
    type,
    category,
    color,
    className,
    camelName,
    descriptionEn:
      String(raw.descriptionEn ?? '').trim() ||
      `Play ${label} free in your browser — no download, no sign-up.`,
    descriptionFr:
      String(raw.descriptionFr ?? '').trim() ||
      `Joue à ${labelFr} gratuitement dans ton navigateur — sans téléchargement ni inscription.`,
  };
}

export function buildGameFiles(rawOptions, { templateRoot = DEFAULT_TEMPLATE_ROOT } = {}) {
  const options = normalizeGameOptions(rawOptions);
  return TEMPLATE_OUTPUTS[options.type].map(([templateName, outputPattern]) => {
    const templatePath = resolve(templateRoot, options.type, templateName);
    if (!existsSync(templatePath)) throw new Error(`Missing template: ${templatePath}`);
    return {
      path: renderTokens(outputPattern, options, false),
      content: ensureFinalNewline(
        renderTokens(
          readFileSync(templatePath, 'utf8'),
          options,
          templateName.endsWith('.html.tpl')
        )
      ),
    };
  });
}

export function scaffoldGame(
  rawOptions,
  { root = process.cwd(), dryRun = false, templateRoot = DEFAULT_TEMPLATE_ROOT } = {}
) {
  const options = normalizeGameOptions(rawOptions);
  const projectRoot = resolve(root);
  const files = buildGameFiles(options, { templateRoot });
  const absoluteFiles = files.map((file) => ({
    ...file,
    absolutePath: resolve(projectRoot, file.path),
  }));
  const gameDirectory = resolve(projectRoot, 'src', 'games', options.key);
  if (existsSync(gameDirectory)) {
    throw new Error('Refusing to reuse an existing game directory: src/games/' + options.key);
  }

  const collisions = absoluteFiles.filter((file) => existsSync(file.absolutePath));
  if (collisions.length) {
    throw new Error(
      `Refusing to overwrite existing files:\n${collisions.map((f) => f.path).join('\n')}`
    );
  }

  const mutations = buildRegistryMutations(projectRoot, options);
  const result = {
    options,
    created: files.map((file) => file.path),
    updated: mutations.map((mutation) => mutation.path),
    dryRun,
  };
  if (dryRun) return result;

  const written = [];
  try {
    for (const file of absoluteFiles) {
      mkdirSync(dirname(file.absolutePath), { recursive: true });
      writeFileSync(file.absolutePath, file.content, 'utf8');
      written.push(file.absolutePath);
    }
    for (const mutation of mutations) {
      writeFileSync(mutation.absolutePath, mutation.after, 'utf8');
    }
  } catch (error) {
    for (const mutation of mutations) {
      writeFileSync(mutation.absolutePath, mutation.before, 'utf8');
    }
    for (const path of written.reverse()) rmSync(path, { force: true });
    const gameDir = resolve(projectRoot, 'src', 'games', options.key);
    const gamesRoot = resolve(projectRoot, 'src', 'games');
    if (gameDir.startsWith(gamesRoot + '\\') || gameDir.startsWith(gamesRoot + '/')) {
      rmSync(gameDir, { recursive: true, force: true });
    }
    throw error;
  }
  return result;
}

function buildRegistryMutations(root, options) {
  return [
    mutation(root, 'vite.config.ts', (source) =>
      appendCategoryKey(appendGameEntry(source, options), options.category, options.key)
    ),
    mutation(root, GENERATED_CATALOG_PATH, (source) => appendCatalogEntries(source, options)),
    mutation(root, 'public/css/base/variables.css', (source) => appendColorToken(source, options)),
    mutation(root, 'firebase.json', (source) => appendFirebaseRoutes(source, options.key)),
    mutation(root, 'public/sitemap.xml', (source) => appendSitemapUrls(source, options.key)),
  ];
}

function mutation(root, path, transform) {
  const absolutePath = resolve(root, path);
  if (!existsSync(absolutePath)) throw new Error(`Required registry file is missing: ${path}`);
  const before = readFileSync(absolutePath, 'utf8');
  const after = ensureFinalNewline(transform(before));
  if (before === after) throw new Error(`Registry update produced no change: ${path}`);
  return { path, absolutePath, before, after };
}

function appendGameEntry(source, rawOptions) {
  const options = normalizeGameOptions(rawOptions);
  if (new RegExp(`\\bkey:\\s*['"]${escapeRegExp(options.key)}['"]`).test(source)) {
    throw new Error(`Game key already exists in vite.config.ts: ${options.key}`);
  }
  const { close } = arraySpan(source, 'const games =');
  return source.slice(0, close) + renderGameEntry(options) + source.slice(close);
}

function appendCategoryKey(source, category, key) {
  const categorySpan = arraySpan(source, 'const categoryDefs =');
  const categorySource = source.slice(categorySpan.open + 1, categorySpan.close);
  if (new RegExp(`['"]${escapeRegExp(key)}['"]`).test(categorySource)) {
    throw new Error(`Game key already exists in categoryDefs: ${key}`);
  }

  const idPattern = new RegExp(`\\bid:\\s*['"]${escapeRegExp(category)}['"]`);
  const relativeId = categorySource.search(idPattern);
  if (relativeId < 0) throw new Error(`Category not found in vite.config.ts: ${category}`);
  const idIndex = categorySpan.open + 1 + relativeId;
  const keysIndex = source.indexOf('keys:', idIndex);
  if (keysIndex < 0 || keysIndex > categorySpan.close) {
    throw new Error(`Category keys array not found: ${category}`);
  }
  const open = source.indexOf('[', keysIndex);
  const close = findMatchingBracket(source, open);
  const keys = [...source.slice(open + 1, close).matchAll(/['"]([a-z0-9-]+)['"]/g)].map(
    (match) => match[1]
  );
  keys.push(key);
  const rendered = `[\n${keys.map((value) => `      ${jsString(value)},`).join('\n')}\n    ]`;
  return source.slice(0, open) + rendered + source.slice(close + 1);
}

function appendCatalogEntries(source, rawOptions) {
  const options = normalizeGameOptions(rawOptions);
  const gameKey = `game_${options.key}`;
  const seoKey = `seo_${options.key}`;
  if (source.includes(`${jsString(gameKey)}:`) || source.includes(`${jsString(seoKey)}:`)) {
    throw new Error(`Generated catalog already contains ${options.key}`);
  }

  let next = insertBeforeMarker(
    source,
    '    // game-generator:catalog-en',
    `    ${jsString(gameKey)}: ${jsString(options.label)},\n` +
      `    ${jsString(seoKey)}: ${jsString(options.descriptionEn)},\n`
  );
  next = insertBeforeMarker(
    next,
    '    // game-generator:catalog-fr',
    `    ${jsString(gameKey)}: ${jsString(options.labelFr)},\n` +
      `    ${jsString(seoKey)}: ${jsString(options.descriptionFr)},\n`
  );
  if (options.type === 'quiz' && !next.includes(`${jsString('Answer each question')}:`)) {
    next = insertBeforeMarker(
      next,
      '    // game-generator:catalog-en',
      `    ${jsString('Answer each question')}: ${jsString('Answer each question')},\n`
    );
    next = insertBeforeMarker(
      next,
      '    // game-generator:catalog-fr',
      `    ${jsString('Answer each question')}: ${jsString('Réponds à chaque question')},\n`
    );
  }
  return next;
}

function appendColorToken(source, rawOptions) {
  const options = normalizeGameOptions(rawOptions);
  const token = `--color-${options.key}`;
  if (source.includes(token)) throw new Error(`Colour token already exists: ${token}`);
  return insertBeforeMarker(
    source,
    '  /* Sidebar super-category accents',
    `  ${token}: ${options.color}; /* generated: ${options.label} */\n`
  );
}

function appendFirebaseRoutes(source, key) {
  const routePattern = new RegExp('"source":\\s*"/(?:fr/)?' + escapeRegExp(key) + '"');
  if (routePattern.test(source)) {
    throw new Error('Firebase route already exists: ' + key);
  }
  let next = insertBeforeMarker(
    source,
    '      {\n        "source": "/privacy",\n        "destination": "/privacy/index.html"\n      },',
    `      {\n        "source": "/${key}",\n        "destination": "/games/${key}/index.html"\n      },\n`
  );
  next = insertBeforeMarker(
    next,
    '      {\n        "source": "/fr/privacy",\n        "destination": "/fr/privacy/index.html"\n      },',
    `      {\n        "source": "/fr/${key}",\n        "destination": "/fr/${key}/index.html"\n      },\n`
  );
  return next;
}

function appendSitemapUrls(source, key) {
  const englishUrl = '/' + key + '</loc>';
  const frenchUrl = '/fr/' + key + '</loc>';
  if (source.includes(englishUrl) || source.includes(frenchUrl)) {
    throw new Error('Sitemap URL already exists: ' + key);
  }
  let next = insertBeforeMarker(
    source,
    '  <!-- French pages (/fr/…). hreflang alternates are emitted in each page head. -->',
    `  <url><loc>https://ludora.adrianguichard.dev/${key}</loc></url>\n`
  );
  next = insertBeforeMarker(
    next,
    '</urlset>',
    `  <url><loc>https://ludora.adrianguichard.dev/fr/${key}</loc></url>\n`
  );
  return next;
}

function findMatchingBracket(source, open) {
  if (source[open] !== '[') throw new Error('Expected an opening bracket');
  let depth = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  let escaped = false;

  for (let index = open; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index++;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index++;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index++;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '[') depth++;
    if (char === ']' && --depth === 0) return index;
  }
  throw new Error('Unclosed array in registry source');
}

function arraySpan(source, anchor) {
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) throw new Error(`Registry anchor not found: ${anchor}`);
  const open = source.indexOf('[', anchorIndex);
  if (open < 0) throw new Error(`Array not found after: ${anchor}`);
  return { open, close: findMatchingBracket(source, open) };
}

function renderGameEntry(options) {
  const control =
    options.type === 'realtime'
      ? {
          keys: '<kbd>↑ ↓ ← →</kbd> or <kbd>W A S D</kbd>',
          action: 'Move the piece',
        }
      : options.type === 'board'
        ? { keys: 'Click / tap', action: 'Move the piece' }
        : { keys: 'Click / tap', action: 'Answer each question' };
  const settings = options.type === 'quiz' ? '    settings: true,\n' : '';
  return (
    '  {\n' +
    `    key: ${jsString(options.key)},\n` +
    `    label: ${jsString(options.label)},\n` +
    `    color: ${jsString(`--color-${options.key}`)},\n` +
    "    mode: 'solo',\n" +
    settings +
    '    controls: [\n' +
    `      { keys: ${jsString(control.keys)}, action: ${jsString(control.action)} },\n` +
    '    ],\n' +
    '  },\n'
  );
}

function insertBeforeMarker(source, marker, addition) {
  const first = source.indexOf(marker);
  if (first < 0) throw new Error(`Registry marker not found: ${marker}`);
  if (source.indexOf(marker, first + marker.length) >= 0) {
    throw new Error(`Registry marker is not unique: ${marker}`);
  }
  return source.slice(0, first) + addition + source.slice(first);
}

function renderTokens(value, options, html) {
  const label = html ? escapeHtml(options.label) : options.label;
  return value
    .replaceAll('{{key}}', options.key)
    .replaceAll('{{Class}}', options.className)
    .replaceAll('{{camel}}', options.camelName)
    .replaceAll('{{color}}', options.color)
    .replaceAll('{{label}}', label);
}

function toPascalCase(key) {
  return key
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

function jsString(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^{}$()|[\]\\]/g, '\\$&');
}

function ensureFinalNewline(value) {
  return value.endsWith('\n') ? value : value + '\n';
}
