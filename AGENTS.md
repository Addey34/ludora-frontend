# AGENTS.md — rules for AI agents working on Ludora

Short, stable **principles**. For the _how_, defer to the detailed docs instead of
repeating them here (so there's one source of truth per topic):

- **Mechanics** (add a game, base classes, translations, PR flow) → `CONTRIBUTING.md`.
  A new game starts with the transactional generator `npm run game:new` (try `--dry-run`
  first), never a hand copy — it scaffolds the files and updates every registry in one
  reversible transaction.
- **Architecture** (engine lifecycle, networking, FX, CSS) → `CLAUDE.md`

This file only holds what those don't: the philosophy and the non-negotiables.

## Philosophy

- **A game is a plugin.** It should contain only what is genuinely specific to it
  (its rules, its board rendering, its bot). Everything else comes from the framework.
- **The framework matters more than any single game.** `shared/` is the asset; the
  games are thin. Improving a shared module beats patching one game.
- **Every duplication must be justified.** Copy-pasting logic between games is the
  default smell — reach for (or create) a shared module first.

## When to create shared code

- Used **once** → leave it in the game.
- Used **twice** → stop and think; extract if it's non-trivial.
- Used **three times** → a shared module is mandatory (`shared/…`), pure and tested.

Shared, game-agnostic primitives live in `src/shared/`. Game-specific pieces (bots,
rules) live **with their game**, even when several games have one each.

## Non-negotiables (a change is not done until all hold)

1. **`npm run verify` is green** — format, lint (`strict` TS), build, tests. No exceptions.
2. **Nothing else breaks.** A change to a shared module must keep every other game
   working. The integrity tests in `src/shared/i18n/*.test.ts` are the safety net —
   run them, and add one when you add a cross-game contract.
3. **Pure logic is unit-tested.** Rules, generators, scoring, parsers — anything with
   no DOM/time — gets a co-located `*.test.ts`. (Real-time render loops don't.) Two
   corollaries: a game whose logic already lives in a shared, tested module (quiz games →
   `quiz.ts`/`words.ts`) needs no duplicate per-game test; and when a game's logic is
   tangled with the DOM (state mutated for animation, e.g. 2048), **extract a pure
   `<key>Logic.ts` first, have the game delegate to it, then test that** — don't test through
   the DOM.
4. **All visible text is bilingual.** Every new string is added to **both** `en` and
   `fr` in `CATALOG` (`i18n.ts`) and used via `t('key')` or `data-i18n`. A parity test
   and a dead-key test enforce this.
5. **No magic constants.** Colours/sizes/timings go through design tokens
   (`variables.css`) or named constants — never a bare literal buried in logic.
6. **`.js` extension on every intra-`src/` import** (TypeScript files imported as `.js`).

## Declaring a capability = wiring it

If a game's `vite.config.ts` entry declares a flag, the code must honour it — and a
test checks it (`gameFeatures.test.ts`):

- `settings: true` → wire `setupSettingsPanel` (or extend `QuizGame`).
- `settings` **and** `leaderboard` on a `GameEngine` game → scope the board per setting
  with `setLeaderboardVariant` (else every difficulty shares one table).
- `multiplayer: true` → `setupVersus` / `setupMultiplayerPanel`.
- `levels: true` → `setupLevels`.

## Scope discipline (avoid the infinite refactor)

The framework is mature. The main risk now is not missing abstraction — it's endless
churn. These rules keep a task from growing into a rewrite:

1. **One concern per working tree / commit.** Never mix work from different roadmap
   phases in one uncommitted change. An architecture migration, a new multiplayer
   contract, a game template and a premium (3D) renderer are **four commits, not one**.
   If `git status` spans more than one concern, split it before continuing.
2. **A pattern is proven on a reference, not propagated on sight.** Migrating the
   remaining N games to a new pattern (State/Logic/Renderer split, Three.js, …) is
   **not a task**. One or two reference games are enough. Migrate one more game **only
   when you're already reopening it for another reason** — never for consistency alone.
   (Same logic as the "don't split big game files" decision.)
3. **Respect phase order.** Don't pull Phase 3/5 work (template, 3D, premium) forward
   while the current phase isn't **committed and browser-validated**. 3D is a Phase 5
   bet, gated by traffic proven in Phase 4 — not a Phase 1/2 activity.
4. **"Finished" is measurable.** A working tree is finished when every changed file
   belongs to the **same concern** and both `verify` **and** that concern's manual
   validation pass. Don't commit a bundle you can't describe in one sentence.

## What NOT to do

- Don't restructure the repo into "packages" for the aesthetics of it — the `shared/`
  layout already separates the framework from the games. Churn without payoff is a cost.
- Don't add contract flags/tests for features that don't exist yet (stats, achievements,
  analytics…). Add the flag **when** you build the feature, not before.
- Don't migrate a game to State/Logic/Renderer or add a Three.js view "to be consistent."
  See Scope discipline #2.
- Don't commit unless asked. Don't skip hooks or bypass `verify`.
