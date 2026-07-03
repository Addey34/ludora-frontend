import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import prettier from 'eslint-config-prettier';

// Flat config (ESLint 10). Targets the TS source code; HTML/CSS rendering and
// the build are out of scope. `prettier` is placed last to disable the style
// rules that would conflict with the formatter.
export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: { 'import-x': importX },
    rules: {
      // TypeScript (DOM lib) already knows document/window/etc.: no-undef would
      // be redundant and raise false positives on the browser globals.
      'no-undef': 'off',
      // Project convention: imports between src/ modules carry the .js extension
      // even though the file is .ts (Vite/ESM resolution). We make it mandatory.
      'import-x/extensions': ['error', 'always', { ignorePackages: true }],
      // Parameters/variables prefixed with _ are intentionally unused
      // (engine hooks), as tsconfig already enforces (noUnusedParameters).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettier
);
