<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { todayIn } from './lib/dates';
  import { formatTimestamp } from './lib/format';
  import { DataError, buildModel, buildWeight, parseData, parseWeightData, type Model, type WeightModel } from './lib/model';
  import Activity from './components/Activity.svelte';
  import Stats from './components/Stats.svelte';
  import NextWorkout from './components/NextWorkout.svelte';
  import WeeklyVolume from './components/WeeklyVolume.svelte';
  import ExerciseList from './components/ExerciseList.svelte';
  import ThemeSwitch from './components/ThemeSwitch.svelte';
  import MuscleMap from './components/MuscleMap.svelte';
  import MuscleTeaser from './components/MuscleTeaser.svelte';
  import WeightPage from './components/WeightPage.svelte';
  import WeightTeaser from './components/WeightTeaser.svelte';

  const DATA_URL = '/data/trainingsdaten.json';
  const CACHE_KEY = 'fitness-dash:data';
  const TIMEOUT_MS = 8000;
  /** Weight from the optional Withings service; 404 when it is not set up. */
  const WEIGHT_URL = '/data/gewichtsdaten.json';
  const WEIGHT_CACHE_KEY = 'fitness-dash:weight';
  /** The muscle map and the weight are pages of their own at these hashes, so back gestures, bookmarks and reloads work. */
  const MAP_HASH = '#muskelkarte';
  const WEIGHT_HASH = '#gewicht';
  type Page = 'home' | 'map' | 'weight';
  const pageFor = (hash: string): Page => (hash === MAP_HASH ? 'map' : hash === WEIGHT_HASH ? 'weight' : 'home');
  const TITLES: Record<Page, string> = { home: 'Fitness-Dash', map: 'Muskelkarte – Fitness-Dash', weight: 'Gewicht – Fitness-Dash' };

  let model = $state<Model | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(true);
  let lastBody = '';
  let lastToday = '';
  let weight = $state<WeightModel | null>(null);
  let lastWeightBody = '';
  let lastWeightToday = '';

  let page = $state<Page>(pageFor(location.hash));
  /** Opened from the start page in this session: "Zurück" can then go back in the history. */
  let openedFromHome = false;
  let homeScroll = 0;

  async function route() {
    const next = pageFor(location.hash);
    if (next === page) return;
    if (page === 'home') {
      homeScroll = window.scrollY;
      openedFromHome = true;
    }
    page = next;
    await tick();
    window.scrollTo(0, next === 'home' ? homeScroll : 0);
    const focus = { home: '.nav', map: '#map-title', weight: '#weight-title' }[next];
    document.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
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

  const hasWeight = $derived((weight?.days.length ?? 0) > 0);

  $effect(() => {
    document.title = TITLES[page];
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

  function showWeight(body: string) {
    const data = parseWeightData(JSON.parse(body));
    const today = todayIn(data.timezone);
    if (body !== lastWeightBody || today !== lastWeightToday) {
      weight = buildWeight(data, today);
      lastWeightBody = body;
      lastWeightToday = today;
    }
  }

  // The last good files stay on the device, so the app opens instantly and works offline.
  function readCache(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeCache(key: string, body: string | null) {
    try {
      if (body === null) localStorage.removeItem(key);
      else localStorage.setItem(key, body);
    } catch {
      // Storage full or disabled: the app still works, just not offline.
    }
  }

  /** The weight is optional and independent: its errors never touch the training view. */
  async function loadWeight() {
    try {
      const response = await fetch(WEIGHT_URL, { cache: 'no-cache', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.status === 404) {
        // The Withings service is not set up (or no longer): hide the weight.
        weight = null;
        lastWeightBody = '';
        writeCache(WEIGHT_CACHE_KEY, null);
        return;
      }
      if (!response.ok) return;
      const body = await response.text();
      showWeight(body);
      writeCache(WEIGHT_CACHE_KEY, body);
    } catch {
      // Offline or a broken file: keep showing the last good weight.
    }
  }

  async function load() {
    loading = true;
    void loadWeight();
    try {
      const response = await fetch(DATA_URL, { cache: 'no-cache', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.status === 404) {
        throw new DataError('trainingsdaten.json wurde nicht gefunden (HTTP 404). Prüfe DATA_DIR in der .env-Datei.');
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      show(body);
      writeCache(CACHE_KEY, body);
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
    const cached = readCache(CACHE_KEY);
    if (cached) {
      try {
        show(cached);
      } catch {
        // A broken cache entry is replaced by the next successful load.
      }
    }
    const cachedWeight = readCache(WEIGHT_CACHE_KEY);
    if (cachedWeight) {
      try {
        showWeight(cachedWeight);
      } catch {
        // Replaced by the next successful load.
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
    {#if page !== 'home'}
      <a class="nav" href="./" onclick={back}>
        <svg class="chevron" viewBox="0 0 8 12" aria-hidden="true"><path d="M6 1L1 6l5 5" /></svg>
        Zurück
      </a>
    {:else}
      <a class="nav" href={MAP_HASH}>Muskelkarte</a>
    {/if}
    <ThemeSwitch />
  </div>
  {#if page === 'weight' && weight}
    <WeightPage {weight} workoutDates={model ? model.workouts.map((w) => w.date) : null} />
  {:else if model}
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
          {#if hasWeight && weight}
            <WeightTeaser {weight} href={WEIGHT_HASH} />
          {/if}
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
        {#if hasWeight && weight}
          <WeightTeaser {weight} href={WEIGHT_HASH} />
        {/if}
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
      {#if hasWeight}
        <a class="nav" href={WEIGHT_HASH}>Gewicht ansehen</a>
      {/if}
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
