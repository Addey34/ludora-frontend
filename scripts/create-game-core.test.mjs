import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import {
  GAME_CATEGORIES,
  GAME_TYPES,
  buildGameFiles,
  normalizeGameOptions,
  parseCliArgs,
  scaffoldGame,
} from './create-game-core.mjs';

const OPTIONS = {
  key: 'star-runner',
  label: 'Star Runner',
  labelFr: 'Course etoilee',
  type: 'realtime',
  category: 'action',
  color: '#2563eb',
};

test('parses and normalizes CLI options', () => {
  const parsed = parseCliArgs([
    '--key',
    'star-runner',
    '--label=Star Runner',
    '--type',
    'realtime',
    '--category',
    'action',
    '--color',
    '#2563EB',
    '--dry-run',
  ]);
  const normalized = normalizeGameOptions(parsed);
  assert.equal(normalized.key, 'star-runner');
  assert.equal(normalized.className, 'StarRunner');
  assert.equal(normalized.camelName, 'starRunner');
  assert.equal(normalized.color, '#2563eb');
  assert.equal(parsed.dryRun, true);
});

test('rejects invalid keys, types, categories and colours', () => {
  assert.throws(() => normalizeGameOptions({ ...OPTIONS, key: 'Star Runner' }), /key/);
  assert.throws(() => normalizeGameOptions({ ...OPTIONS, type: '3d' }), /type/);
  assert.throws(() => normalizeGameOptions({ ...OPTIONS, category: 'other' }), /Category/);
  assert.throws(() => normalizeGameOptions({ ...OPTIONS, color: 'blue' }), /Colour/);
});

test('renders syntax-valid TypeScript for every game family', () => {
  for (const type of GAME_TYPES) {
    const files = buildGameFiles({ ...OPTIONS, type });
    for (const file of files) {
      assert.doesNotMatch(file.content, /\{\{(?:key|Class|camel|label|color)\}\}/);
    }
    const diagnostics = files
      .filter((file) => file.path.endsWith('.ts'))
      .flatMap((file) => {
        const result = ts.transpileModule(file.content, {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
          fileName: file.path,
          reportDiagnostics: true,
        });
        return (result.diagnostics ?? []).filter(
          (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
        );
      });
    assert.equal(
      diagnostics.length,
      0,
      diagnostics
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
        .join('\n')
    );
  }
});

test('type-checks every generated game family against the shared framework', () => {
  for (const type of GAME_TYPES) {
    const diagnostics = typeCheckGenerated(buildGameFiles({ ...OPTIONS, type }));
    assert.equal(
      diagnostics.length,
      0,
      type +
        ':\n' +
        diagnostics
          .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
          .join('\n')
    );
  }
});

test('keeps the realtime scaffold two-dimensional by default', () => {
  const files = buildGameFiles(OPTIONS);
  assert.equal(
    files.some((file) => file.path.includes('Three')),
    false
  );
  assert.equal(
    files.some((file) => file.path.endsWith('Logic.test.ts')),
    true
  );
});

test('creates a complete game and updates every registry', () => {
  const root = makeFixture();
  try {
    const result = scaffoldGame(OPTIONS, { root });
    assert.equal(result.created.length, 9);
    assert.deepEqual(result.updated, [
      'vite.config.ts',
      'src/shared/i18n/generatedGames.ts',
      'public/css/base/variables.css',
      'render.yaml',
      'public/sitemap.xml',
    ]);
    assert.equal(existsSync(join(root, 'src/games/star-runner/StarRunnerGame.ts')), true);
    assert.match(read(root, 'vite.config.ts'), /key: 'star-runner'/);
    assert.match(read(root, 'vite.config.ts'), /'star-runner'/);
    assert.match(read(root, 'src/shared/i18n/generatedGames.ts'), /game_star-runner/);
    assert.match(read(root, 'public/css/base/variables.css'), /--color-star-runner: #2563eb/);
    assert.match(read(root, 'render.yaml'), /source: \/star-runner/);
    assert.match(read(root, 'public/sitemap.xml'), /\/fr\/star-runner/);
    assert.match(read(root, 'public/icons/star-runner.svg'), /#2563eb/);
    assert.throws(() => scaffoldGame(OPTIONS, { root }), /existing game directory/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validates the whole transaction before a dry run or write', () => {
  const root = makeFixture();
  try {
    const dryOptions = { ...OPTIONS, key: 'dry-runner', label: 'Dry Runner' };
    const result = scaffoldGame(dryOptions, { root, dryRun: true });
    assert.equal(result.dryRun, true);
    assert.equal(existsSync(join(root, 'src/games/dry-runner')), false);
    assert.doesNotMatch(read(root, 'vite.config.ts'), /dry-runner/);

    rmSync(join(root, 'public/sitemap.xml'));
    const brokenOptions = { ...OPTIONS, key: 'safe-runner', label: 'Safe Runner' };
    assert.throws(() => scaffoldGame(brokenOptions, { root }), /Required registry file/);
    assert.equal(existsSync(join(root, 'src/games/safe-runner')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('refuses duplicate Render routes and sitemap URLs before writing', () => {
  const residues = [
    {
      path: 'render.yaml',
      content:
        '      - { type: rewrite, source: /star-runner, destination: /games/star-runner/index.html }\n',
      error: /Render route already exists/,
    },
    {
      path: 'public/sitemap.xml',
      content: '  <url><loc>https://ludora.adrianguichard.dev/star-runner</loc></url>\n',
      error: /Sitemap URL already exists/,
    },
  ];

  for (const residue of residues) {
    const root = makeFixture();
    try {
      write(root, residue.path, read(root, residue.path) + residue.content);
      assert.throws(() => scaffoldGame(OPTIONS, { root }), residue.error);
      assert.equal(existsSync(join(root, 'src/games/star-runner')), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('refuses to remove or reuse a pre-existing game directory', () => {
  const root = makeFixture();
  try {
    const gameDirectory = join(root, 'src/games/star-runner');
    mkdirSync(gameDirectory, { recursive: true });
    writeFileSync(join(gameDirectory, 'notes.txt'), 'keep\n');
    assert.throws(() => scaffoldGame(OPTIONS, { root }), /existing game directory/);
    assert.equal(readFileSync(join(gameDirectory, 'notes.txt'), 'utf8'), 'keep\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeFixture() {
  const root = join(
    tmpdir(),
    'gameszone-create-game-' + process.pid + '-' + Math.random().toString(16).slice(2)
  );
  const categoryEntries = GAME_CATEGORIES.map(
    (category) => "  { id: '" + category + "', keys: [] },"
  ).join('\n');

  write(
    root,
    'vite.config.ts',
    'const games = [\n];\nconst categoryDefs = [\n' + categoryEntries + '\n];\n'
  );
  write(
    root,
    'src/shared/i18n/generatedGames.ts',
    'export const GENERATED_GAME_CATALOG = {\n' +
      '  en: {\n' +
      '    // game-generator:catalog-en\n' +
      '  },\n' +
      '  fr: {\n' +
      '    // game-generator:catalog-fr\n' +
      '  },\n' +
      '};\n'
  );
  write(
    root,
    'public/css/base/variables.css',
    ':root {\n  /* Sidebar super-category accents */\n}\n'
  );
  write(
    root,
    'render.yaml',
    'routes:\n' +
      '      - { type: rewrite, source: /privacy, destination: /privacy/index.html }\n' +
      '      - { type: rewrite, source: /fr/privacy, destination: /fr/privacy/index.html }\n'
  );
  write(
    root,
    'public/sitemap.xml',
    '<urlset>\n' +
      '  <!-- French pages (/fr/\u2026). hreflang alternates are emitted in each page head. -->\n' +
      '</urlset>\n'
  );
  return root;
}

function typeCheckGenerated(files) {
  const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  if (config.error) return [config.error];
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  const virtualFiles = new Map(
    files
      .filter((file) => file.path.endsWith('.ts'))
      .map((file) => {
        const path = resolve(file.path);
        return [normalizedPath(path), { path, content: file.content }];
      })
  );
  const virtualDirectories = new Set(
    [...virtualFiles.values()].map((file) => normalizedPath(dirname(file.path)))
  );
  const host = ts.createCompilerHost(parsed.options);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalDirectoryExists = host.directoryExists?.bind(host);

  host.fileExists = (fileName) =>
    virtualFiles.has(normalizedPath(fileName)) || originalFileExists(fileName);
  host.directoryExists = (directoryName) =>
    virtualDirectories.has(normalizedPath(directoryName)) ||
    (originalDirectoryExists?.(directoryName) ?? false);
  host.readFile = (fileName) =>
    virtualFiles.get(normalizedPath(fileName))?.content ?? originalReadFile(fileName);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const virtual = virtualFiles.get(normalizedPath(fileName));
    return virtual
      ? ts.createSourceFile(virtual.path, virtual.content, languageVersion, true)
      : originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };

  const program = ts.createProgram(
    [
      ...virtualFiles.values().map((file) => file.path),
      ...parsed.fileNames.filter((file) => file.endsWith('.d.ts')),
    ],
    parsed.options,
    host
  );
  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
}

function normalizedPath(path) {
  return resolve(path).toLowerCase();
}

function write(root, path, content) {
  const absolutePath = join(root, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, 'utf8');
}

function read(root, path) {
  return readFileSync(join(root, path), 'utf8');
}
