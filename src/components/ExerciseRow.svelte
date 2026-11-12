<script lang="ts">
  import { slide } from 'svelte/transition';
  import { formatChange, formatDayMonth, formatFullDate, formatNumber, formatValue, unitLabel } from '../lib/format';
  import { STALL_SESSIONS, type Exercise } from '../lib/model';
  import ExerciseChart from './ExerciseChart.svelte';
  import Sparkline from './Sparkline.svelte';

  let { exercise }: { exercise: Exercise } = $props();
  let open = $state(false);

  const first = $derived(exercise.points[0]);
  const progress = $derived(
    exercise.points.length > 1
      ? `${formatChange(exercise.change, exercise.unit)} seit ${formatDayMonth(first.date)}`
      : `Erstes Training am ${formatDayMonth(first.date)}`,
  );
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<li class="row" class:open>
  <button type="button" class="summary" aria-expanded={open} aria-controls="detail-{exercise.id}" onclick={() => (open = !open)}>
    <span class="text">
      <span class="name">{exercise.name}</span>
      <span class="meta">{exercise.latest.sets}, {progress}</span>
      {#if exercise.latest.record || exercise.stalled}
        <span class="tags">
          {#if exercise.latest.record}
            <span class="tag"><span class="icon up" aria-hidden="true">▲</span>Neuer Rekord</span>
          {/if}
          {#if exercise.stalled}
            <span class="tag"><span class="icon flat" aria-hidden="true">=</span>Keine Steigerung seit {STALL_SESSIONS} Trainings</span>
          {/if}
        </span>
      {/if}
    </span>
    <Sparkline points={exercise.points} />
    <span class="value figure">{formatNumber(exercise.latest.value)}<span class="unit">{unitLabel(exercise.unit)}</span></span>
  </button>

  {#if open}
    <div id="detail-{exercise.id}" class="detail" transition:slide={{ duration: reduceMotion ? 0 : 220 }}>
      {#if exercise.comment}
        <p class="note">{exercise.comment}</p>
      {/if}
      {#if exercise.points.length > 1}
        <ExerciseChart {exercise} />
        <p class="hint">Dunkle Punkte markieren einen neuen Rekord.</p>
      {:else}
        <p class="hint">Ab dem zweiten Training siehst du hier den Verlauf.</p>
      {/if}
      <details class="table-toggle">
        <summary>Alle {exercise.points.length} Trainings als Tabelle</summary>
        <table class="data-table">
          <thead>
            <tr><th>Datum</th><th>Sätze</th><th class="num">Bestwert</th></tr>
          </thead>
          <tbody>
            {#each [...exercise.points].reverse() as p (p.workoutId)}
              <tr>
                <td>{formatFullDate(p.date)}</td>
                <td>{p.sets}</td>
                <td class="num">{p.record ? '▲ ' : ''}{formatValue(p.value, exercise.unit)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </details>
    </div>
  {/if}
</li>

<style>
  .row {
    border-top: 1px solid var(--rule);
  }

  .row:last-child {
    border-bottom: 1px solid var(--rule);
  }

  .summary {
    display: grid;
    grid-template-columns: 1fr auto 4.75rem;
    gap: 0.875rem;
    align-items: center;
    width: 100%;
    padding: 0.875rem 0;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .text {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .name {
    font-weight: 600;
    line-height: 1.3;
  }

  .meta {
    color: var(--ink-2);
    font-size: var(--step--1);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    margin-top: 0.2rem;
    font-size: var(--step--1);
  }

  .tag {
    display: inline-flex;
    align-items: baseline;
    gap: 0.3rem;
    color: var(--ink-2);
  }

  .icon {
    font-weight: 800;
    font-size: 0.85em;
  }

  .icon.up {
    color: var(--green);
  }

  .icon.flat {
    color: var(--warn);
  }

  .value {
    font-size: var(--step-3);
    line-height: 1;
    text-align: right;
    white-space: nowrap;
  }

  .unit {
    margin-left: 0.12em;
    font-size: 0.45em;
    font-stretch: 100%;
    font-weight: 600;
    color: var(--ink-2);
  }

  .open .summary {
    padding-bottom: 0.5rem;
  }

  .detail {
    margin: 0 calc(-1 * min(var(--gutter), 1rem)) 1rem;
    padding: 1rem min(var(--gutter), 1rem) 0.75rem;
    border-radius: 10px;
    background: var(--raised);
  }

  .note {
    margin-bottom: 1rem;
    padding: 0.35rem 0.6rem;
    border-left: 2px solid var(--green);
    background: var(--raised);
    font-size: var(--step--1);
  }

  .hint {
    margin-top: 0.25rem;
    color: var(--ink-3);
    font-size: var(--step--1);
  }
</style>
