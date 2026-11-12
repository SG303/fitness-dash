<script lang="ts">
  import { formatLongDate, formatValue, formatWhole } from '../lib/format';
  import type { Model } from '../lib/model';

  let { model, date, onpick }: { model: Model; date: string; onpick: (date: string) => void } = $props();

  const dates = $derived([...model.workoutsByDate.keys()]);
  const index = $derived(dates.indexOf(date));
  const previous = $derived(dates[index - 1] ?? null);
  const next = $derived(dates[index + 1] ?? null);
  const workouts = $derived(model.workoutsByDate.get(date) ?? []);
  const exercises = $derived(new Map(model.exercises.map((e) => [e.id, e])));

  function pointFor(exerciseId: string, workoutId: string) {
    const exercise = exercises.get(exerciseId);
    const point = exercise?.points.find((p) => p.workoutId === workoutId);
    return exercise && point ? { unit: exercise.unit, point } : null;
  }
</script>

<div class="day">
  <div class="head">
    <button type="button" class="step" disabled={!previous} onclick={() => previous && onpick(previous)} aria-label="Früheres Training">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
    </button>
    <h2 class="date" aria-live="polite">
      {formatLongDate(date)}
      <span class="plans">{workouts.map((w) => (w.plan ? `Training ${w.plan}` : 'Training')).join(', ')}</span>
    </h2>
    <button type="button" class="step" disabled={!next} onclick={() => next && onpick(next)} aria-label="Späteres Training">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
    </button>
  </div>

  {#each workouts as workout (workout.id)}
    <ul class="entries">
      {#each workout.entries as entry (entry.entry_id)}
        {@const info = pointFor(entry.exercise_id, workout.id)}
        <li>
          <span class="name">{entry.exercise_name ?? entry.exercise_id}</span>
          <span class="sets">{info?.point.sets}</span>
          <span class="value figure">
            {#if info?.point.record}<span class="record" aria-hidden="true">▲</span><span class="visually-hidden">Neuer Rekord:</span>{/if}
            {info ? formatValue(info.point.value, info.unit) : ''}
          </span>
        </li>
      {/each}
      {#each workout.skipped as entry (entry.entry_id)}
        <li class="skipped">
          <span class="name">{entry.exercise_name ?? entry.exercise_id}</span>
          <span class="sets">ausgelassen</span>
        </li>
      {/each}
    </ul>
    {#if workout.volume > 0}
      <p class="total">Volumen {formatWhole(workout.volume)} kg</p>
    {/if}
  {/each}
</div>

<style>
  .day {
    margin-top: 1.5rem;
    padding: 1rem 1rem 1.125rem;
    border-radius: 10px;
    background: var(--raised);
  }

  .head {
    display: grid;
    grid-template-columns: 2.5rem 1fr 2.5rem;
    align-items: center;
    gap: 0.5rem;
    margin: -0.25rem -0.25rem 0.75rem;
  }

  .date {
    font-size: var(--step-0);
    font-weight: 700;
    line-height: 1.3;
    text-align: center;
  }

  .plans {
    display: block;
    color: var(--ink-2);
    font-size: var(--step--1);
    font-weight: 400;
  }

  .step {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 0;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
  }

  .step:hover:not(:disabled) {
    background: var(--bg);
  }

  .step:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .step svg {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .entries li {
    display: grid;
    grid-template-columns: 1fr auto 5.5rem;
    gap: 0.75rem;
    align-items: baseline;
    padding: 0.45rem 0;
    border-top: 1px solid var(--rule);
    font-size: var(--step--1);
  }

  .name {
    font-weight: 600;
    font-size: var(--step-0);
  }

  .sets {
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }

  .value {
    font-size: var(--step-1);
    text-align: right;
    white-space: nowrap;
  }

  .record {
    color: var(--green);
    font-size: 0.75em;
  }

  .skipped .name {
    color: var(--ink-3);
    font-weight: 400;
    text-decoration: line-through;
    text-decoration-color: var(--rule);
  }

  .total {
    margin-top: 0.5rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--rule);
    color: var(--ink-2);
    font-size: var(--step--1);
    text-align: right;
  }
</style>
