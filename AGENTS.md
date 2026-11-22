# fitness-dash

Personal, mobile-first dashboard for a gym log: a static Svelte app served by
Caddy in a container, reading `trainingsdaten.json` written by a Hermes agent
on the same host. Public repository.

Follows the SG303 baseline v2 (`sgstack/global/AGENTS.md`,
`sgstack/baseline/tools.md`). If you cannot read those: work on a branch,
open a PR, merge only with green checks (squash); never commit secrets or
personal data; English for everything in the repo; talk to me in German.

## Commands

- Setup: `npm ci`
- Test: `npm test`
- Lint and types: `npm run lint && npm run typecheck`
- Run locally: `npm run dev` (binds 0.0.0.0, port 5173, sample data;
  `DATA_DIR=<dir>` for real data)
- Run as a service: `docker compose up -d --build` (port from `.env`, default 8090)
- With the Withings sync: `docker compose --profile withings up -d --build`

## Release

The container is built locally with `docker compose`; releases are
versioned GitHub releases without build artifacts.

1. In a PR: set `version` in `package.json` (run `npm install
   --package-lock-only` to sync the lockfile) and move `## [Unreleased]` in
   CHANGELOG.md to `## [X.Y.Z] - YYYY-MM-DD`, with compare links at the bottom.
2. After the merge, tag the merge commit on `main` with `vX.Y.Z` and push the
   tag. `release.yml` runs the checks and creates the GitHub release with the CHANGELOG
   section as notes. It fails if the tag, `package.json` and CHANGELOG
   disagree. Never move or reuse a tag.

## Conventions

- All data logic lives in `src/lib/model.ts` as pure functions with tests in
  `src/lib/model.test.ts`. Components in `src/components/` only render.
- Dates are `YYYY-MM-DD` strings; arithmetic uses UTC day numbers
  (`src/lib/dates.ts`). "Today" comes from the `timezone` field of the data.
- Hermes owns `trainingsdaten.json`; the dashboard never writes it. Its rules
  live in `README.md` next to the data file (corrections, comments, skips).
  A correction is a new entry with `corrects_entry_id` set to the entry it
  replaces; the dashboard drops the replaced entry.
- Rules with tuning knobs are constants at the top of `model.ts`
  (`PLAN_ROTATION`, `WEEKLY_TARGET`, `STALL_SESSIONS`, `VOLUME_WEEKS`,
  `DURATION_WORKOUTS`, `MUSCLE_PERIODS`, `SECONDARY_WEIGHT`, `LOAD_STEPS`,
  `WEIGHT_PERIODS`, `WEIGHT_DEFAULT_PERIOD`, `WEIGHT_TEASER_WEEKS`,
  `TREND_HALF_LIFE`, `TREND_GAP_DAYS`).
- The exercise → muscle mapping is `EXERCISE_MUSCLES` in `model.ts`, keyed by
  `exercise_id`; muscle groups and their German names are `MUSCLES`. When
  Hermes logs a new exercise, add it there (the muscle map names unmapped
  exercises). Short display names for exercises whose Hermes name is too
  long go in `EXERCISE_NAMES`. Hermes and `trainingsdaten.json` know
  nothing about muscles.
- Navigation has no router: the muscle map is the page at `#muskelkarte`,
  the weight the page at `#gewicht` (`App.svelte` switches on the hash). Keep
  them in the main bundle, no lazy chunk, so the service worker caches them
  for offline use.
- The weight is independent of the training data: `App.svelte` loads
  `gewichtsdaten.json` on its own, caches it on its own and hides everything
  about weight when the file is missing (404). Errors of one file never
  affect the other.
- The body figure in `src/lib/body-art.ts` is path data from
  react-native-body-highlighter (MIT); keep its licence header. The step
  colours `--load-1` … `--load-5` and the figure colours `--fig-*` in
  `app.css` were checked for clear steps against the body in both themes.
- Mount the data directory, not the file: Hermes replaces the file, and a
  single-file bind mount would keep the old inode. `Caddyfile` exposes only
  `/data/trainingsdaten.json`; the directory also holds private photos.
- The optional Withings service lives in `withings/` (compose profile
  `withings`): `withings.ts` holds the API calls and the conversion as
  testable functions, `server.ts` the OAuth pages and the 15-minute sync.
  Node runs the TypeScript directly, so it uses only erasable syntax and no
  dependencies. It writes `gewichtsdaten.json` to its own volume and never
  touches the Hermes data. Keep only measurements whose `attrib` surely
  belongs to the user (scale used by several people).
- Never commit real training data; `sample-data/` is fictional. The same goes
  for weight data, client IDs, secrets and the real callback URL.
- UI copy is German (de-CH, "ss" instead of "ß"); code and docs are English.
- Charts are hand-written SVG (no chart library). Every chart has a table view.
- Offline: `App.svelte` keeps the last good data file in localStorage;
  `public/sw.js` caches the app shell (network first, hashed `/assets/` cache
  first) and never touches `/data/` or `/withings/`. Bump `CACHE` in `sw.js` when its caching
  rules change.
- Colours are `light-dark()` pairs in `src/app.css`; `data-theme` on `<html>`
  (set by `src/lib/theme.ts`) forces light or dark.

## Deviations from baseline

none
