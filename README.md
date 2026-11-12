<img src="public/icon.svg" width="64" height="64" alt="">

# fitness-dash

A small, mobile-first dashboard for a personal gym log. It reads the
`trainingsdaten.json` file that a Hermes agent keeps
up to date and shows:

- a calendar of training days for the last 12 months, with the details of each workout,
- workouts this month, weeks in a row with two workouts, and volume this week,
- the next workout (A/B alternate) with the last weights and notes per exercise,
- volume per week (weight × reps of all sets) for the last 12 weeks,
- progress per exercise: heaviest weight per workout (longest hold for timed
  exercises), new records, a hint when an exercise has not improved for four
  workouts, and a goal line when a note names a weight ("Nächstes Mal 20 kg").

The dashboard only reads. All numbers are computed in the browser from the
JSON file; there is no database and no backend code.

> [!NOTE]
> Personal project, built with AI coding agents under my supervision. Review the code carefully before you use it.

## Run it

Requires Docker with Compose.

```sh
cp .env.example .env    # set DATA_DIR to the directory that holds trainingsdaten.json
docker compose up -d --build
```

The dashboard listens on all interfaces on `PORT` (default 8090). The data
directory is mounted read-only, and only `trainingsdaten.json` is served from
it. There is no login: keep the port inside your LAN or tailnet.

### Install as an app

Browsers install web apps only over HTTPS. Inside a tailnet, Tailscale Serve
provides HTTPS with a valid certificate:

```sh
sudo tailscale serve --bg --https=8443 http://127.0.0.1:8090
```

Then open `https://<machine>.<tailnet>.ts.net:8443` on the phone (with
Tailscale running) and choose "Install app" in Chrome, or "Add to Home Screen"
in Safari. Switching back to the app reloads the data.

The app keeps the last loaded data on the device and, over HTTPS, caches
itself with a service worker, so it also opens without a connection and says
so. The colour scheme follows the device or can be set to light or dark. Remove the proxy with
`sudo tailscale serve --https=8443 off`.

## Develop

```sh
npm ci
npm run dev             # http://<host>:5173 with sample-data/trainingsdaten.json
DATA_DIR=/path/to/dir npm run dev   # with real data
npm test && npm run lint && npm run typecheck && npm run build
```

`sample-data/` holds fictional data in the same format.

## Data format

The app reads `schema_version` 1 of `trainingsdaten.json`:

- `performance_entries[]`: one entry per exercise and workout, with
  `entry_type` `reported_performance` or `reported_skip`, `workout_date`,
  `session_id`, `plan`, `exercise_id`, `exercise_name`, `plan_position` and
  `sets[]` (`reps`, `weight_kg`, `duration_seconds`, `side`).
- `sessions{}`: workout date, plan and status per session.
- `exercise_comments{}`: the current note per exercise.

Entries without a `workout_date` are ignored. Weights are used as reported.

## Status

Personal project, built with AI coding agents under my supervision. There is
no support and no stability guarantee; review the code carefully before you
rely on it. See [LICENSE](LICENSE) for the warranty terms.
