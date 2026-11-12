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

## Release

No releases yet; the container is built locally with `docker compose`.

## Conventions

- All data logic lives in `src/lib/model.ts` as pure functions with tests in
  `src/lib/model.test.ts`. Components in `src/components/` only render.
- Dates are `YYYY-MM-DD` strings; arithmetic uses UTC day numbers
  (`src/lib/dates.ts`). "Today" comes from the `timezone` field of the data.
- Hermes owns `trainingsdaten.json`; the dashboard never writes it. Its rules
  live in `README.md` next to the data file (corrections, comments, skips).
  Corrections of entries have no fixed field yet; handle them once Hermes
  writes the first one.
- Rules with tuning knobs are constants at the top of `model.ts`
  (`PLAN_ROTATION`, `WEEKLY_TARGET`, `STALL_SESSIONS`, `VOLUME_WEEKS`).
- Mount the data directory, not the file: Hermes replaces the file, and a
  single-file bind mount would keep the old inode. `Caddyfile` exposes only
  `/data/trainingsdaten.json`; the directory also holds private photos.
- Never commit real training data; `sample-data/` is fictional.
- UI copy is German (de-CH, "ss" instead of "ß"); code and docs are English.
- Charts are hand-written SVG (no chart library). Every chart has a table view.
- Offline: `App.svelte` keeps the last good data file in localStorage;
  `public/sw.js` caches the app shell (network first, hashed `/assets/` cache
  first) and never touches `/data/`. Bump `CACHE` in `sw.js` when its caching
  rules change.
- Colours are `light-dark()` pairs in `src/app.css`; `data-theme` on `<html>`
  (set by `src/lib/theme.ts`) forces light or dark.

## Deviations from baseline

none
