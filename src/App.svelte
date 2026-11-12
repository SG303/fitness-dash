<script lang="ts">
  import { onMount } from 'svelte';
  import { todayIn } from './lib/dates';
  import { formatTimestamp } from './lib/format';
  import { DataError, buildModel, parseData, type Model } from './lib/model';
  import Activity from './components/Activity.svelte';
  import Stats from './components/Stats.svelte';
  import NextWorkout from './components/NextWorkout.svelte';
  import WeeklyVolume from './components/WeeklyVolume.svelte';
  import ExerciseList from './components/ExerciseList.svelte';
  import ThemeSwitch from './components/ThemeSwitch.svelte';

  const DATA_URL = '/data/trainingsdaten.json';
  const CACHE_KEY = 'fitness-dash:data';
  const TIMEOUT_MS = 8000;

  let model = $state<Model | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(true);
  let lastBody = '';
  let lastToday = '';

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
    // Opening the app from the home screen or switching back to the tab fetches fresh data.
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });
</script>

<div class="page" class:stale={loading && model}>
  <ThemeSwitch />
  {#if model}
    {#if error}
      <p class="banner" role="status">{error} Angezeigt wird der zuletzt geladene Stand.</p>
    {/if}

    <Activity {model}>
      {#if model.workouts.length > 0}
        <Stats {model} />
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
