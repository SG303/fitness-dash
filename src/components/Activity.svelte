<script lang="ts">
  import { addDays, weekStart } from '../lib/dates';
  import { formatLongDate, formatMonthShort, formatWhole, plural } from '../lib/format';
  import type { Snippet } from 'svelte';
  import type { Model } from '../lib/model';
  import DayDetail from './DayDetail.svelte';

  const MAX_WEEKS = 53;
  const MIN_PITCH = 12;
  const LABEL_WIDTH = 28;
  const WEEKDAYS = ['Mo', '', 'Mi', '', 'Fr', '', ''];

  let { model, children }: { model: Model; children?: Snippet } = $props();

  let picked = $state<string | null>(null);
  const selected = $derived(picked && model.workoutsByDate.has(picked) ? picked : (model.lastWorkout?.date ?? null));

  // As many weeks as fit the width (a year on wide screens, about six months on a phone).
  let width = $state(0);
  const weeks = $derived(Math.max(8, Math.min(MAX_WEEKS, Math.floor((width - LABEL_WIDTH) / MIN_PITCH))));
  const pitch = $derived(Math.min(18, (width - LABEL_WIDTH) / weeks));
  const first = $derived(addDays(weekStart(model.today), -7 * (weeks - 1)));

  const columns = $derived(
    Array.from({ length: weeks }, (_, c) => {
      const days = Array.from({ length: 7 }, (_, d) => addDays(first, c * 7 + d));
      const firstOfMonth = days.find((day) => day.endsWith('-01'));
      return { days, month: c > 0 && firstOfMonth ? formatMonthShort(firstOfMonth) : null };
    }),
  );

  const shownCount = $derived(model.workouts.filter((w) => w.date >= first).length);
  const months = $derived(weeks >= 52 ? 12 : Math.round(weeks / 4.35));

  const status = $derived.by(() => {
    const last = model.lastWorkout;
    const days = model.daysSinceLast;
    if (!last || days === null) return 'Noch kein Training erfasst. Hier erscheint jeder Tag, an dem du im Gym warst.';
    const plan = last.plan ? `Training ${last.plan}` : 'Training';
    if (days === 0) return `Heute: ${plan}.`;
    if (days === 1) return `Gestern: ${plan}.`;
    return `Letztes Training vor ${formatWhole(days)} Tagen: ${plan} am ${formatLongDate(last.date)}.`;
  });

  function dayLabel(date: string): string {
    const workouts = model.workoutsByDate.get(date) ?? [];
    const plans = workouts.map((w) => (w.plan ? `Training ${w.plan}` : 'Training')).join(' und ');
    return `${formatLongDate(date)}: ${plans}`;
  }
</script>

<section class="activity" aria-labelledby="title">
  <h1 id="title" class="headline">Fitness-Dash</h1>
  <p class="subline">{status}</p>

  <div class="calendar" bind:clientWidth={width}>
    {#if width > 0}
    <div
      class="grid"
      role="group"
      aria-label="Trainingstage der letzten {months} Monate"
      style:--pitch="{pitch}px"
      style:--weeks={weeks}
    >
      {#each WEEKDAYS as label, d (d)}
        <span class="weekday" style:grid-row={d + 2} aria-hidden="true">{label}</span>
      {/each}
      {#each columns as column, c (c)}
        {#if column.month}
          <span class="month" style:grid-column={c + 2} aria-hidden="true">{column.month}</span>
        {/if}
        {#each column.days as day, d (day)}
          {#if day > model.today}
            <span class="cell" style:grid-column={c + 2} style:grid-row={d + 2} aria-hidden="true"></span>
          {:else if model.workoutsByDate.has(day)}
            <button
              type="button"
              class="cell trained"
              class:today={day === model.today}
              class:selected={day === selected}
              style:grid-column={c + 2}
              style:grid-row={d + 2}
              aria-label={dayLabel(day)}
              aria-pressed={day === selected}
              onclick={() => (picked = day)}
            ></button>
          {:else}
            <span
              class="cell rest"
              class:today={day === model.today}
              style:grid-column={c + 2}
              style:grid-row={d + 2}
              aria-hidden="true"
            ></span>
          {/if}
        {/each}
      {/each}
    </div>
    {/if}
  </div>

  <div class="legend">
    <span class="key"><span class="swatch trained" aria-hidden="true"></span>Training</span>
    <span class="key"><span class="swatch rest" aria-hidden="true"></span>Ruhetag</span>
    <span class="key"><span class="swatch now" aria-hidden="true"></span>Heute</span>
    <span class="count">{plural(shownCount, 'Training', 'Trainings')} in {months} Monaten</span>
  </div>

  {@render children?.()}

  {#if selected}
    <DayDetail {model} date={selected} onpick={(date: string) => (picked = date)} />
  {/if}
</section>

<style>
  .headline {
    font-size: clamp(2.25rem, 10vw, 3.75rem);
    font-stretch: 125%;
    font-weight: 820;
    line-height: 0.98;
    letter-spacing: -0.035em;
    text-wrap: balance;
  }

  .subline {
    margin-top: 0.75rem;
    color: var(--ink-2);
    font-size: var(--step-0);
  }

  .calendar {
    margin-top: 2rem;
    min-height: calc(1.25rem + 7 * 12px);
  }

  .grid {
    display: grid;
    grid-template-columns: 28px repeat(var(--weeks), var(--pitch));
    grid-template-rows: 1.25rem repeat(7, var(--pitch));
  }

  .weekday,
  .month {
    color: var(--ink-3);
    font-size: 0.6875rem;
    line-height: var(--pitch);
  }

  .weekday {
    grid-column: 1;
  }

  .month {
    grid-row: 1;
    line-height: 1rem;
    white-space: nowrap;
  }

  .cell {
    position: relative;
    width: var(--pitch);
    height: var(--pitch);
    padding: 0;
    border: 0;
    background: none;
  }

  /* Every day is a plate: a dot inside its cell, so the whole cell is the hit target. */
  .cell::before {
    content: '';
    position: absolute;
    inset: 12%;
    border-radius: 50%;
  }

  .rest::before {
    background: var(--dot);
  }

  .trained {
    cursor: pointer;
  }

  .trained::before {
    background: var(--green);
  }

  .trained:hover::before {
    inset: 4%;
  }

  .today::after,
  .selected::after {
    content: '';
    position: absolute;
    inset: -4%;
    border-radius: 50%;
    border: 2px dotted var(--ink-3);
  }

  .selected::after {
    border: 2px solid var(--ink);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1.25rem;
    margin-top: 0.5rem;
    color: var(--ink-2);
    font-size: var(--step--1);
  }

  .key {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .swatch {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
  }

  .swatch.trained {
    background: var(--green);
  }

  .swatch.rest {
    background: var(--dot);
  }

  .swatch.now {
    border: 2px dotted var(--ink-3);
  }
</style>
