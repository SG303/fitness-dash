# Changelog

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Optional Withings service (`docker compose --profile withings`): connect a
  Withings account once on `/withings/`, then your weight is fetched every
  15 minutes into `gewichtsdaten.json`. Measurements the scale could not
  surely assign to you are left out.

## [0.3.0] - 2026-11-15

### Added

- Muscle map: a page of its own ("Muskelkarte" at the top of the start page)
  with a front and back figure coloured by sets per week and muscle group over
  the last 4, 8 or 12 weeks, details per muscle with the exercises behind the
  number, and a list of all muscle groups from least to most trained.
  Exercises that are not assigned to any muscle yet are named.
- The start page names the three least trained muscle groups of the last four
  weeks and links to the muscle map.

## [0.2.0] - 2026-11-15

### Added

- Each workout shows its duration, and the key figures show the average
  duration of the last eight workouts with a known duration.

## [0.1.0] - 2026-11-15

### Added

- Mobile-first dashboard for the training log that Hermes writes to
  `trainingsdaten.json`: activity calendar of training days, key figures
  (workouts this month, weekly streak, volume this week), the next workout
  with last weights and notes, weekly volume chart, and progress per exercise
  with records, stall hints and goal lines from notes.
- Container setup (Caddy) that serves the app and exposes only
  `trainingsdaten.json` from the mounted data directory, read-only.
- Installable as an app (web app manifest and icons; needs HTTPS, for example
  through Tailscale Serve).
- Works offline: the last loaded data stays on the device and the app shell
  is cached by a service worker.
- Switch between automatic, light and dark colour scheme.

### Changed

- New order below the calendar: key figures, next workout, then the last
  workout.
- The app is now called "Fitness-Dash" (headline, browser tab and installed
  app).

[Unreleased]: https://github.com/SG303/fitness-dash/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/SG303/fitness-dash/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/SG303/fitness-dash/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/SG303/fitness-dash/releases/tag/v0.1.0
