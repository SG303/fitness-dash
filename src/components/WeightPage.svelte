<script lang="ts">
  import { addDays } from '../lib/dates';
  import { formatDayMonth, formatFullDate, formatKg, formatKgChange, formatLongDate, formatTimestamp, plural } from '../lib/format';
  import {
    WEEKLY_TARGET,
    WEIGHT_DEFAULT_PERIOD,
    WEIGHT_PERIODS,
    weightPeriod,
    type WeightModel,
  } from '../lib/model';
  import WeightChart from './WeightChart.svelte';

  let { weight, workoutDates }: { weight: WeightModel; workoutDates: string[] | null } = $props();

  let weeks = $state<number | null>(WEIGHT_DEFAULT_PERIOD);

  const period = $derived(weightPeriod(weight, weeks, workoutDates));
  const latest = $derived(weight.days[weight.days.length - 1] ?? null);
  const lastMeasurement = $derived(weight.measurements[weight.measurements.length - 1] ?? null);
  const rows = $derived([...period.rows].reverse().filter((r) => r.measurements > 0 || r.workouts));

  /** Day and month; dates of another year also name the year. */
  const day = (date: string) => (date.slice(0, 4) === weight.today.slice(0, 4) ? formatDayMonth(date) : formatFullDate(date));
  const label = (w: number | null) => (w === null ? 'Alles' : w === 52 ? '1 Jahr' : `${w} Wochen`);
  const range = (start: string) => `${day(start)} bis ${day(addDays(start, 6))}`;
</script>

<section aria-labelledby="weight-title">
  <h1 id="weight-title" class="headline" tabindex="-1">Gewicht</h1>
  {#if latest && lastMeasurement}
    <p class="subline">
      {plural(weight.measurements.length, 'Messung', 'Messungen')} von deiner Withings-Waage, die letzte am
      {formatLongDate(lastMeasurement.date)}.
    </p>

    <div class="period" role="group" aria-label="Zeitraum">
      {#each WEIGHT_PERIODS as w (w)}
        <button type="button" aria-pressed={weeks === w} onclick={() => (weeks = w)}>{label(w)}</button>
      {/each}
    </div>

    <dl class="numbers">
      <div class="number">
        <dt>Trend</dt>
        <dd><span class="figure">{formatKg(latest.trend)}</span><span class="unit">kg</span></dd>
      </div>
      <div class="number">
        <dt>{period.change === null ? 'Veränderung' : `Seit ${day(period.days[0].date)}`}</dt>
        <dd>
          {#if period.change === null}
            <span class="figure">–</span>
          {:else}
            <span class="figure">{formatKgChange(period.change)}</span><span class="unit">kg</span>
          {/if}
        </dd>
      </div>
      <div class="number">
        <dt>Letzte Messung</dt>
        <dd><span class="figure">{formatKg(lastMeasurement.weight)}</span><span class="unit">kg</span></dd>
      </div>
    </dl>

    {#if period.days.length > 0}
      <WeightChart {period} />
      <p class="section-note legend">
        Punkte sind einzelne Messungen, die Linie ist der geglättete Trend.
        {#if workoutDates}Balken zeigen deine Trainings pro Woche, gestrichelt dein Ziel von {WEEKLY_TARGET}.{/if}
      </p>
    {:else}
      <p class="empty">In diesem Zeitraum hast du dich nicht gewogen. Wähle einen längeren Zeitraum.</p>
    {/if}

    {#if rows.length > 0}
      <section class="weeks" aria-labelledby="weeks-title">
        <h2 id="weeks-title" class="section-title">Werte pro Woche</h2>
        <table class="data-table">
          <thead>
            <tr>
              <th>Woche</th>
              <th class="num">Ø Gewicht</th>
              <th class="num">Messungen</th>
              {#if workoutDates}<th class="num">Trainings</th>{/if}
            </tr>
          </thead>
          <tbody>
            {#each rows as r (r.start)}
              <tr>
                <td>KW {r.week}<span class="range">{range(r.start)}</span></td>
                <td class="num">{r.average === null ? '–' : `${formatKg(r.average)} kg`}</td>
                <td class="num">{r.measurements}</td>
                {#if workoutDates}<td class="num">{r.workouts ?? '–'}</td>{/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}
  {:else}
    <p class="subline">Withings hat noch keine Messung geliefert. Sobald du dich wiegst, erscheint sie hier.</p>
  {/if}

  <p class="source">
    Withings-Abgleich {weight.updatedAt ? formatTimestamp(weight.updatedAt, weight.timeZone) : 'unbekannt'}.
    <a href="/withings/">Verbindung prüfen</a>
  </p>
</section>

<style>
  .numbers {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin-top: 1.75rem;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
  }

  .number {
    display: flex;
    flex-direction: column-reverse;
    justify-content: flex-end;
    gap: 0.25rem;
    padding: 0.875rem 0.75rem 1rem;
  }

  .number:first-child {
    padding-left: 0;
  }

  .number + .number {
    border-left: 1px solid var(--rule);
  }

  dt {
    color: var(--ink-2);
    font-size: var(--step--1);
    line-height: 1.3;
  }

  dd .figure {
    font-size: var(--step-3);
    line-height: 1;
  }

  /* The trend is the number to read; the others support it. */
  .number:first-child .figure {
    color: var(--green);
  }

  .unit {
    margin-left: 0.2em;
    color: var(--ink-2);
    font-size: var(--step--1);
    font-weight: 600;
  }

  .weeks {
    margin-top: 2.5rem;
  }

  .legend {
    margin-top: 0.75rem;
  }

  .empty {
    margin-top: 1.5rem;
    padding: 0.75rem 1rem;
    border-left: 3px solid var(--rule);
    background: var(--raised);
    color: var(--ink-2);
    font-size: var(--step--1);
  }

  .range {
    display: block;
    color: var(--ink-3);
    font-size: 0.75rem;
  }

  .source {
    margin-top: 2rem;
    color: var(--ink-3);
    font-size: var(--step--1);
  }

  .source a {
    color: var(--ink-2);
    text-decoration-color: var(--rule);
    text-underline-offset: 3px;
  }
</style>
