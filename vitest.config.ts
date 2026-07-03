import { defineConfig } from 'vitest/config';

// Dedicated config for unit tests (Vitest prefers it over vite.config.ts).
// We do NOT load the Handlebars plugin or `root: src`: the tests target the
// pure (TS) logic, not the HTML/DOM rendering of the pages.
export default defineConfig({
  test: {
    // happy-dom provides localStorage, KeyboardEvent, etc. to the tests.
    environment: 'happy-dom',
    // Tests co-located with the code, under src/.
    include: ['src/**/*.{test,spec}.ts'],
  },
});
