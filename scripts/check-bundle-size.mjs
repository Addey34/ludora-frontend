// Performance budget guard — fails the build if a shipped bundle grows past its
// ceiling, so the perf work (Font Awesome subset, Nakama code-split, small
// per-page chunks) can't silently regress. Runs after `vite build` in `npm run
// verify`. Sizes are gzip (what the browser actually transfers), except the raw
// render-blocking CSS. Bump a ceiling deliberately (with a reason) if a real
// feature needs it — don't raise it to paper over an accidental heavy import.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'dist/assets');
const KB = 1024;

const gzipKB = (file) => gzipSync(readFileSync(file)).length / KB;
const rawKB = (file) => statSync(file).size / KB;

/** Find the single hashed asset whose name starts with `prefix` (e.g. `login-`). */
function asset(prefix) {
  const hit = readdirSync(ASSETS).find((f) => f.startsWith(prefix) && f.endsWith('.js'));
  return hit ? join(ASSETS, hit) : null;
}

const failures = [];
function check(label, file, actualKB, ceilingKB) {
  if (!file) {
    failures.push(`${label}: expected chunk not found (did the build run?)`);
    return;
  }
  const a = Math.round(actualKB * 10) / 10;
  const status = a <= ceilingKB ? 'ok ' : 'OVER';
  console.log(`  [${status}] ${label}: ${a} KB (budget ${ceilingKB} KB)`);
  if (a > ceilingKB) failures.push(`${label}: ${a} KB exceeds ${ceilingKB} KB budget`);
}

console.log('Bundle budgets:');

// Render-blocking Font Awesome CSS (raw — it's tiny and not always gzipped by the CDN edge).
check(
  'Font Awesome CSS (raw, render-blocking)',
  join(ROOT, 'dist/vendor/fontawesome/css/all.min.css'),
  rawKB(join(ROOT, 'dist/vendor/fontawesome/css/all.min.css')),
  6
);

// The login chunk loads on every page — keep it lean.
const login = asset('login-');
check('login chunk (gzip, every page)', login, login ? gzipKB(login) : 0, 30);

// The Nakama client is code-split off the critical path — keep it a separate chunk.
const nakama = asset('nakama-js.esm-');
check('nakama-js chunk (gzip, on-demand)', nakama, nakama ? gzipKB(nakama) : 0, 18);

// General ceiling: no single JS chunk should balloon. The Three.js renderer is an
// opt-in 3D view loaded only on demand, so it's exempt.
const GENERAL_CEILING = 60;
for (const f of readdirSync(ASSETS)) {
  if (!f.endsWith('.js') || /three/i.test(f)) continue;
  const gz = gzipKB(join(ASSETS, f));
  if (gz > GENERAL_CEILING) {
    failures.push(
      `${f}: ${Math.round(gz * 10) / 10} KB exceeds the ${GENERAL_CEILING} KB per-chunk ceiling`
    );
  }
}

if (failures.length) {
  console.error('\n✖ Bundle size budget exceeded:');
  for (const f of failures) console.error('  - ' + f);
  console.error('\nTrim the import or, if the growth is intended, raise the ceiling deliberately.');
  process.exit(1);
}
console.log('✓ All bundles within budget.');
