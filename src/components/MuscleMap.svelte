<script lang="ts">
  import { tick } from 'svelte';
  import { FIGURES, KEYBOARD_ORDER, type View } from '../lib/body-art';
  import { daysBetween } from '../lib/dates';
  import { formatDayMonth, formatLongDate, formatNumber } from '../lib/format';
  import { LOAD_STEPS, MUSCLE_PERIODS, SECONDARY_WEIGHT, buildMuscleMap, type Model, type MuscleId } from '../lib/model';
  import BodyFigure from './BodyFigure.svelte';

  let { model }: { model: Model } = $props();

  let weeks = $state(MUSCLE_PERIODS[0]);
  /** Chosen muscle; until the first choice the least trained one is shown. */
  let picked = $state<MuscleId | null>(null);
  let ring = $state(false);
  let stage: HTMLElement;
  let figures: HTMLElement;

  const map = $derived(buildMuscleMap(model, weeks));
  const loads = $derived(new Map(map.muscles.map((m) => [m.id, m])));
  const selected = $derived(loads.get(picked ?? map.muscles[0].id)!);
  const max = $derived(Math.max(...map.muscles.map((m) => m.perWeek), 1));

  const VIEWS: View[] = ['front', 'back'];
  const keyboard = (view: View) => new Set(KEYBOARD_ORDER.filter((k) => k.view === view).map((k) => k.muscle));
  const KEYBOARD = { front: keyboard('front'), back: keyboard('back') };
  const STEP_KEYS = Array.from({ length: LOAD_STEPS.length + 1 }, (_, i) => i + 1);

  const sets = (n: number) => `${formatNumber(n)} ${n === 1 ? 'Satz' : 'Sätze'}`;

  function stepLabel(step: number): string {
    const low = [0, ...LOAD_STEPS][step - 1];
    const high = LOAD_STEPS[step - 1];
    if (step === 1) return `unter ${high}`;
    return high === undefined ? `${low}+` : `${low}–${high}`;
  }

  function ago(date: string): string {
    const days = daysBetween(date, model.today);
    if (days === 0) return 'heute';
    if (days === 1) return 'gestern';
    return `vor ${days} Tagen`;
  }

  function choose(id: MuscleId) {
    picked = id;
  }

  /** Choosing in the list brings the figure and the details into view when they are off-screen. */
  function chooseFromList(id: MuscleId) {
    choose(id);
    const box = figures.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      stage.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  function clickFigure(event: MouseEvent) {
    const target = (event.target as Element).closest<SVGElement>('[data-muscle]');
    if (target) choose(target.dataset.muscle as MuscleId);
  }

  // One tab stop for both figures; arrow keys walk the muscles and select them, like radio buttons.
  async function walk(event: KeyboardEvent) {
    const last = KEYBOARD_ORDER.length - 1;
    const current = KEYBOARD_ORDER.findIndex((k) => k.muscle === selected.id);
    const next: Record<string, number> = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowDown: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      ArrowUp: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    choose(KEYBOARD_ORDER[next[event.key]].muscle);
    await tick();
    figures.querySelector<SVGElement>(`[data-key="${selected.id}"]`)?.focus();
  }
</script>

<section class="muscles" aria-labelledby="map-title">
  <h1 id="map-title" class="headline" tabindex="-1">Muskelkarte</h1>
  <p class="subline">Sätze pro Woche je Muskelgruppe, {formatDayMonth(map.start)} bis {formatDayMonth(map.end)}</p>

  {#if map.unmapped.length > 0}
    <p class="unmapped">
      Noch keinem Muskel zugeordnet und darum nicht mitgezählt: {map.unmapped.map((e) => e.name).join(', ')}.
    </p>
  {/if}

  <div class="period" role="group" aria-label="Zeitraum">
    {#each MUSCLE_PERIODS as w (w)}
      <button type="button" aria-pressed={weeks === w} onclick={() => (weeks = w)}>{w} Wochen</button>
    {/each}
  </div>

  <div class="stage" bind:this={stage}>
    <div class="map">
      <!-- Clicks are delegated, so a muscle's copy in the other view and its widened touch area pick it too.
           The group itself takes no focus: the selected muscle is its single tab stop (roving tabindex). -->
      <!-- svelte-ignore a11y_interactive_supports_focus -->
      <div
        class="figures"
        role="radiogroup"
        aria-label="Muskelgruppen auf der Figur. Mit Pfeiltasten wechseln."
        bind:this={figures}
        onclick={clickFigure}
        onkeydown={walk}
        onfocusin={(event) => (ring = (event.target as Element).matches(':focus-visible'))}
        onfocusout={() => (ring = false)}
      >
        {#each VIEWS as view (view)}
          <BodyFigure {view} figure={FIGURES[view]} {loads} selected={selected.id} keyboard={KEYBOARD[view]} {ring} />
        {/each}
      </div>

      <div class="legend">
        <span class="key"><span class="swatch none" aria-hidden="true"></span>0, nicht trainiert</span>
        <span class="ramp">
          {#each STEP_KEYS as step (step)}
            <span class="ramp-step">
              <span class="swatch" style:background="var(--load-{step})" aria-hidden="true"></span>
              {stepLabel(step)}
            </span>
          {/each}
        </span>
        <span>Sätze pro Woche</span>
      </div>
    </div>

    <div class="detail" aria-live="polite">
      <h2 class="name">{selected.name}</h2>
      {#if selected.aka}
        <p class="aka">{selected.aka}</p>
      {/if}
      <p class="big">
        <strong class="figure">{formatNumber(selected.perWeek)}</strong>
        <span>Sätze pro Woche</span>
      </p>
      {#if selected.step === 0}
        <p class="flag"><span class="swatch none" aria-hidden="true"></span>In {weeks} Wochen nicht trainiert</p>
      {:else}
        <p class="fact">{sets(selected.sets)} in {weeks} Wochen, Hilfsmuskel zählt {formatNumber(SECONDARY_WEIGHT)}</p>
      {/if}
      <p class="fact">
        {selected.last ? `Zuletzt trainiert: ${formatLongDate(selected.last)} (${ago(selected.last)})` : 'Noch nie trainiert'}
      </p>

      {#if selected.exercises.length > 0}
        <ul class="exercises" aria-label="Übungen im Zeitraum">
          {#each selected.exercises as e (e.id)}
            <li>
              <span class="ex-name">{e.name}</span>
              <span class="role">{e.main ? 'Hauptmuskel' : 'Hilfsmuskel'}</span>
              <span class="ex-sets">
                {sets(e.sets)}
                {#if !e.main}<small>zählt {formatNumber(e.sets * SECONDARY_WEIGHT)}</small>{/if}
              </span>
            </li>
          {/each}
        </ul>
      {:else if selected.others.length > 0}
        <p class="fact other">Trainiert von {selected.others.join(', ')}, im Zeitraum aber nicht gemacht.</p>
      {:else}
        <p class="fact other">Keine deiner Übungen trainiert diesen Muskel.</p>
      {/if}
    </div>
  </div>

  <section class="all" aria-labelledby="all-title">
    <h2 id="all-title" class="section-title">Alle Muskelgruppen</h2>
    <p class="section-note">Wenig Trainiertes steht oben. Tippe auf eine Gruppe, um sie auf der Figur zu sehen.</p>
    <table class="data-table">
      <thead>
        <tr>
          <th scope="col">Muskelgruppe</th>
          <th scope="col" class="bar-cell"><span class="visually-hidden">Anteil</span></th>
          <th scope="col" class="num">Sätze pro Woche</th>
        </tr>
      </thead>
      <tbody>
        {#each map.muscles as m (m.id)}
          <tr class:on={m.id === selected.id}>
            <td>
              <button type="button" class="row-button" aria-pressed={m.id === selected.id} onclick={() => chooseFromList(m.id)}>
                <span class="swatch" class:none={m.step === 0} style:background={m.step ? `var(--load-${m.step})` : undefined} aria-hidden="true"></span>
                {m.name}
              </button>
            </td>
            <td class="bar-cell" aria-hidden="true">
              {#if m.perWeek > 0}<span class="bar" style:width="{(m.perWeek / max) * 100}%"></span>{/if}
            </td>
            <td class="num">
              {#if m.step === 0}0<span class="zero">nicht trainiert</span>{:else}{formatNumber(m.perWeek)}{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
</section>

<style>
  .unmapped {
    margin-top: 1.25rem;
    padding: 0.75rem 1rem;
    border-left: 3px solid var(--warn);
    background: var(--raised);
    color: var(--ink-2);
    font-size: var(--step--1);
  }

  .stage {
    display: grid;
    gap: 2rem;
    margin-top: 1.75rem;
    scroll-margin-top: 1rem;
  }

  @media (min-width: 40rem) {
    .stage {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      align-items: start;
    }
  }

  .figures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    margin-top: 1.25rem;
    color: var(--ink-2);
    font-size: var(--step--1);
  }

  .key,
  .ramp-step {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .ramp {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    font-variant-numeric: tabular-nums;
  }

  .swatch {
    flex: none;
    display: inline-block;
    width: 0.875rem;
    height: 0.875rem;
    border-radius: 3px;
  }

  .swatch.none {
    background: repeating-linear-gradient(135deg, var(--warn) 0 2px, var(--none-fill) 2px 5px);
    box-shadow: inset 0 0 0 1px var(--warn);
  }

  .detail {
    padding-top: 1rem;
    border-top: 1px solid var(--rule);
  }

  .name {
    font-size: var(--step-1);
    font-weight: 700;
    font-stretch: 112%;
    line-height: 1.2;
  }

  .aka {
    color: var(--ink-2);
    font-size: var(--step--1);
  }

  .big {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-top: 0.75rem;
    color: var(--ink-2);
    font-size: var(--step--1);
  }

  .big strong {
    color: var(--ink);
    font-size: clamp(2.5rem, 12vw, 3.25rem);
    line-height: 1;
  }

  .flag {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.6rem;
    padding: 0.2rem 0.6rem 0.2rem 0.4rem;
    border-radius: 999px;
    background: var(--none-fill);
    color: var(--ink);
    font-size: var(--step--1);
    font-weight: 600;
  }

  .fact {
    margin-top: 0.4rem;
    color: var(--ink-2);
    font-size: var(--step--1);
  }

  .other {
    margin-top: 1rem;
  }

  .exercises {
    margin-top: 1rem;
    border-top: 1px solid var(--rule);
    font-size: var(--step--1);
  }

  .exercises li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--rule);
  }

  .ex-name {
    font-weight: 600;
  }

  .role {
    color: var(--ink-2);
  }

  .ex-sets {
    grid-row: 1 / span 2;
    grid-column: 2;
    align-self: center;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .ex-sets small {
    display: block;
    color: var(--ink-2);
    font-size: inherit;
  }

  .all {
    margin-top: 3.5rem;
  }

  .data-table {
    margin-top: 1rem;
  }

  .data-table td {
    padding: 0;
  }

  .data-table th {
    font-size: var(--step--1);
  }

  .data-table .num {
    padding-right: 0.5rem;
    white-space: nowrap;
  }

  tr.on td {
    background: var(--raised);
  }

  .row-button {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    min-height: 2.75rem;
    padding: 0.25rem 0.5rem;
    border: 0;
    background: none;
    font-weight: 600;
    line-height: 1.25;
    text-align: left;
    cursor: pointer;
  }

  tr.on .row-button {
    box-shadow: inset 3px 0 0 var(--ink);
  }

  .bar-cell {
    width: 30%;
    padding-inline: 0.5rem;
  }

  .bar {
    display: block;
    height: 6px;
    border-radius: 0 3px 3px 0;
    background: var(--bar);
  }

  .zero {
    display: block;
    color: var(--warn);
    font-size: var(--step--1);
    font-weight: 600;
    white-space: nowrap;
  }

  @media (max-width: 26rem) {
    .bar-cell {
      width: 16%;
    }
  }
</style>
