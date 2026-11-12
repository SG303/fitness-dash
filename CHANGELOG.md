# Changelog

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
