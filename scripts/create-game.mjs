#!/usr/bin/env node

import { parseCliArgs, scaffoldGame, usage } from './create-game-core.mjs';

try {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (parsed.help) {
    console.log(usage());
  } else {
    const { dryRun, ...options } = parsed;
    const result = scaffoldGame(options, { dryRun });
    console.log(dryRun ? 'Dry run — no files written.' : `Created ${result.options.label}.`);
    console.log('');
    console.log(dryRun ? 'Planned files:' : 'Created files:');
    for (const path of result.created) console.log(`  + ${path}`);
    console.log(dryRun ? 'Planned registry updates:' : 'Updated registries:');
    for (const path of result.updated) console.log(`  ~ ${path}`);
    if (!dryRun) {
      console.log('');
      console.log(
        'Next: replace the placeholder icon/rules, then run npm run format && npm run verify.'
      );
    }
  }
} catch (error) {
  console.error(`game:new failed: ${error instanceof Error ? error.message : String(error)}`);
  console.error('');
  console.error(usage());
  process.exitCode = 1;
}
