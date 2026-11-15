<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { todayIn } from './lib/dates';
  import { formatTimestamp } from './lib/format';
  import { DataError, buildModel, parseData, type Model } from './lib/model';
  import Activity from './components/Activity.svelte';
  import Stats from './components/Stats.svelte';
  import NextWorkout from './components/NextWorkout.svelte';
  import WeeklyVolume from './components/WeeklyVolume.svelte';
  import ExerciseList from './components/ExerciseList.svelte';
  import ThemeSwitch from './components/ThemeSwitch.svelte';
  import MuscleMap from './components/MuscleMap.svelte';
  import MuscleTeaser from './components/MuscleTeaser.svelte';

  const DATA_URL = '/data/trainingsdaten.json';
  const CACHE_KEY = 'fitness-dash:data';
  const TIMEOUT_MS = 8000;
  /** The muscle map is a page of its own at this hash, so back gestures, bookmarks and reloads work. */
  const MAP_HASH = '#muskelkarte';

  let model = $state<Model | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(true);
  let lastBody = '';
  let lastToday = '';

  let page = $state<'home' | 'map'>(location.hash === MAP_HASH ? 'map' : 'home');
  /** Opened from the start page in this session: "Zurück" can then go back in the history. */
  let openedFromHome = false;
  let homeScroll = 0;

  async function route() {
    const next = location.hash === MAP_HASH ? 'map' : 'home';
    if (next === page) return;
    if (next === 'map') {
      homeScroll = window.scrollY;
      openedFromHome = true;
    }
    page = next;
    await tick();
    window.scrollTo(0, next === 'home' ? homeScroll : 0);
    document.querySelector<HTMLElement>(next === 'map' ? '#map-title' : '.nav')?.focus({ preventScroll: true });
  }

  function back(event: MouseEvent) {
    event.preventDefault();
    if (openedFromHome) {
      history.back();
    } else {
      // Opened directly (bookmark or reload): replace the entry instead of leaving the app.
      history.replaceState(null, '', location.pathname + location.search);
      route();
    }
  }

  $effect(() => {
    document.title = page === 'map' ? 'Muskelkarte – Fitness-Dash' : 'Fitness-Dash';
  });

  /** Builds the view from a JSON body; skips the work when nothing changed. */
  function show(body: string) {
    const data = parseData(JSON.parse(body));
    const today = todayIn(data.timezone);
    if (body !== lastBody || today !== lastToday) {
      model = buildModel(data, today);
      lastBody = body;
      lastToday = today;
    }
  }

  // The last good file stays on the device, so the app opens instantly and works offline.
  function readCache(): string | null {
    try {
      return localStorage.getItem(CACHE_KEY);
    } catch {
      return null;
    }
  }

  function writeCache(body: string) {
    try {
      localStorage.setItem(CACHE_KEY, body);
    } catch {
      // Storage full or disabled: the app still works, just not offline.
    }
  }

  async function load() {
    loading = true;
    try {
      const response = await fetch(DATA_URL, { cache: 'no-cache', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.status === 404) {
        throw new DataError('trainingsdaten.json wurde nicht gefunden (HTTP 404). Prüfe DATA_DIR in der .env-Datei.');
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      show(body);
      writeCache(body);
      error = null;
    } catch (e) {
      if (e instanceof DataError) error = e.message;
      else if (e instanceof SyntaxError) error = 'trainingsdaten.json ist kein gültiges JSON. Hermes schreibt die Datei vielleicht gerade; lade in ein paar Sekunden neu.';
      else error = 'Keine Verbindung zum Server. Prüfe Internet und Tailscale.';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    const cached = readCache();
    if (cached) {
      try {
        show(cached);
      } catch {
        // A broken cache entry is replaced by the next successful load.
      }
    }
    load();
    window.addEventListener('hashchange', route);
    // Opening the app from the home screen or switching back to the tab fetches fresh data.
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('hashchange', route);
    };
  });
</script>

<div class="page" class:stale={loading && model}>
  <div class="topbar">
    {#if page === 'map'}
      <a class="nav" href="./" onclick={back}>
        <svg class="chevron" viewBox="0 0 8 12" aria-hidden="true"><path d="M6 1L1 6l5 5" /></svg>
        Zurück
      </a>
    {:else}
      <a class="nav" href={MAP_HASH}>Muskelkarte</a>
    {/if}
    <ThemeSwitch />
  </div>
  {#if model}
    {#if error}
      <p class="banner" role="status">{error} Angezeigt wird der zuletzt geladene Stand.</p>
    {/if}

    {#if page === 'map'}
      <MuscleMap {model} />
    {:else}
      <Activity {model}>
        {#if model.workouts.length > 0}
          <Stats {model} />
          <MuscleTeaser {model} href={MAP_HASH} />
          {#if model.next}
            <NextWorkout next={model.next} />
          {/if}
        {/if}
      </Activity>

      {#if model.workouts.length > 0}
        <WeeklyVolume weeks={model.weeks} />
        <ExerciseList exercises={model.exercises} />
      {:else}
        <p class="empty">Sobald Hermes das erste Training speichert, erscheinen hier Kennzahlen, Gewichte und Verlauf.</p>
      {/if}
    {/if}

    <footer class="footer">
      <p>Daten von Hermes, Stand {formatTimestamp(model.updatedAt, model.timeZone)}</p>
      <button type="button" class="reload" onclick={load} disabled={loading}>
        {loading ? 'Lädt …' : 'Neu laden'}
      </button>
    </footer>
  {:else if error}
    <section class="failure" role="alert">
      <h1 class="failure-title">Keine Trainingsdaten</h1>
      <p>{error}</p>
      <button type="button" class="reload" onclick={load} disabled={loading}>Erneut versuchen</button>
    </section>
  {/if}
</div>

<style>
  .page {
    max-width: calc(var(--measure) + 2 * var(--gutter));
    margin: 0 auto;
    padding: max(env(safe-area-inset-top), 1.25rem) var(--gutter) max(env(safe-area-inset-bottom), 2rem);
    transition: opacity 0.2s;
  }

  .topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .nav {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: calc(2rem + 6px);
    padding: 0 0.9rem;
    border: 1px solid var(--rule);
    border-radius: 999px;
    color: var(--ink);
    font-size: var(--step--1);
    font-weight: 600;
    text-decoration: none;
  }

  .nav:hover {
    border-color: var(--ink-3);
  }

  .chevron {
    width: 0.5rem;
    height: 0.75rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }

  .stale {
    opacity: 0.6;
  }

  .banner,
  .empty {
    margin: 2rem 0;
    padding: 0.75rem 1rem;
    border-left: 3px solid var(--warn);
    background: var(--raised);
    color: var(--ink-2);
    font-size: var(--step--1);
  }

  .empty {
    border-left-color: var(--green);
  }

  .footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    align-items: center;
    justify-content: space-between;
    margin-top: 3.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--rule);
    color: var(--ink-3);
    font-size: var(--step--1);
  }

  .reload {
    min-height: 2.5rem;
    padding: 0 1rem;
    border: 1px solid var(--rule);
    border-radius: 999px;
    background: transparent;
    font-size: var(--step--1);
    font-weight: 600;
    cursor: pointer;
  }

  .reload:hover:not(:disabled) {
    border-color: var(--ink-3);
  }

  .failure {
    margin-top: 20vh;
    display: grid;
    gap: 1rem;
    justify-items: start;
    color: var(--ink-2);
  }

  .failure-title {
    color: var(--ink);
    font-size: var(--step-3);
    font-stretch: 125%;
    font-weight: 800;
    line-height: 1.05;
  }
</style>
