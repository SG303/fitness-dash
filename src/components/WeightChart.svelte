<script lang="ts">
  import { nextMonthStart, nextYearStart, toDayNumber } from '../lib/dates';
  import { formatDayMonth, formatKg, formatLongDate, formatMonthShort, formatNumber, plural } from '../lib/format';
  import { WEEKLY_TARGET, type WeightPeriod } from '../lib/model';
  import { linear, niceTicks } from '../lib/scale';

  let { period }: { period: WeightPeriod } = $props();

  const WEIGHT_H = 210;
  const GAP = 34;
  const STRIP_H = 52;
  const M = { top: 14, right: 58, bottom: 26, left: 36 };

  let width = $state(0);
  let active = $state<number | null>(null);

  /** First week with a known workout count; the strip starts there. */
  const logStart = $derived(period.rows.find((r) => r.workouts !== null)?.start ?? null);
  const strip = $derived(logStart !== null);
  const height = $derived(M.top + WEIGHT_H + (strip ? GAP + STRIP_H : 0) + M.bottom);
  const weightBottom = M.top + WEIGHT_H;
  const stripTop = weightBottom + GAP;
  const stripBottom = stripTop + STRIP_H;

  // Up to the end of today, so the running week is visibly not over yet.
  const d0 = $derived(toDayNumber(period.start));
  const d1 = $derived(toDayNumber(period.end) + 1);
  const x = $derived(linear(d0, d1, M.left, width - M.right));

  const ticks = $derived.by(() => {
    const values = [...period.measurements.map((m) => m.weight), ...period.days.map((d) => d.trend)];
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = Math.max((hi - lo) * 0.12, 0.5);
    return niceTicks(lo - pad, hi + pad, 3);
  });
  const y = $derived(linear(ticks[0], ticks[ticks.length - 1], weightBottom, M.top));

  const maxWorkouts = $derived(Math.max(WEEKLY_TARGET + 1, ...period.rows.map((r) => r.workouts ?? 0)));
  const yw = $derived(linear(0, maxWorkouts, stripBottom, stripTop));

  /** Years over long ranges, months over a few months, Mondays over a few weeks. */
  const xTicks = $derived.by(() => {
    const room = Math.max(1, Math.floor((width - M.left - M.right) / 52));
    const span = d1 - d0;
    const all: { day: number; label: string }[] = [];
    if (span > 400) {
      for (let c = nextYearStart(period.start); c <= period.end; c = nextYearStart(c)) {
        all.push({ day: toDayNumber(c), label: c.slice(0, 4) });
      }
    } else if (span > 62) {
      for (let c = `${period.start.slice(0, 7)}-01`; c <= period.end; c = nextMonthStart(c)) {
        if (c >= period.start) all.push({ day: toDayNumber(c), label: formatMonthShort(c) });
      }
    } else {
      for (const r of period.rows) all.push({ day: toDayNumber(r.start), label: formatDayMonth(r.start) });
    }
    const every = Math.ceil(all.length / room);
    return all.filter((_, i) => i % every === 0);
  });

  /** Centre of each measured day. */
  const days = $derived(period.days.map((d) => toDayNumber(d.date) + 0.5));

  /** The trend as one path that breaks where it starts anew after a long pause. */
  const trendPath = $derived(
    period.days.map((d, i) => `${i === 0 || d.restart ? 'M' : 'L'}${x(days[i])},${y(d.trend)}`).join(''),
  );
  const last = $derived(period.days.length - 1);

  /** Column with a 2px rounded top, clipped to the end of today; 2px gap between weeks. */
  function bar(start: string, count: number): string {
    const left = x(toDayNumber(start)) + 1;
    const right = Math.min(x(toDayNumber(start) + 7), x(d1)) - 1;
    const w = Math.max(1, right - left);
    const top = yw(count);
    const r = Math.min(2, w / 2, stripBottom - top);
    return `M${left},${stripBottom}V${top + r}Q${left},${top} ${left + r},${top}H${left + w - r}Q${left + w},${top} ${left + w},${top + r}V${stripBottom}Z`;
  }

  const activeRow = $derived(
    active === null ? null : period.rows.findLast((r) => r.start <= period.days[active!].date) ?? null,
  );

  function pick(event: PointerEvent) {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const px = event.clientX - box.left;
    let best = 0;
    days.forEach((d, i) => {
      if (Math.abs(x(d) - px) < Math.abs(x(days[best]) - px)) best = i;
    });
    active = best;
  }

  function step(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const from = active ?? period.days.length;
    active = Math.max(0, Math.min(last, from + (event.key === 'ArrowLeft' ? -1 : 1)));
  }

  $effect(() => {
    // A new period has other days: drop the selection.
    void period;
    active = null;
  });
</script>

<div class="frame" bind:clientWidth={width} style:min-height="{height}px">
  {#if width > 0}
    <!-- The table below is the accessible equivalent; focus and arrow keys mirror the hover tooltip. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <svg
      class="chart-svg"
      {width}
      {height}
      role="img"
      aria-label="Gewichtsverlauf{strip ? ' mit Trainings pro Woche' : ''}. Mit Pfeiltasten durch die Messtage gehen."
      tabindex="0"
      onpointermove={pick}
      onpointerdown={pick}
      onpointerleave={() => (active = null)}
      onkeydown={step}
      onblur={() => (active = null)}
    >
      {#each ticks as t (t)}
        <line class="gridline" x1={M.left} x2={width - M.right} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
        <text class="axis-label" x={M.left - 8} y={y(t)} dy="0.32em" text-anchor="end">{formatNumber(t)}</text>
      {/each}

      {#if active !== null}
        <line class="crosshair" x1={x(days[active])} x2={x(days[active])} y1={M.top} y2={strip ? stripBottom : weightBottom} />
      {/if}

      {#each period.measurements as m (m.measuredAt)}
        <circle class="measurement" cx={x(toDayNumber(m.date) + 0.5)} cy={y(m.weight)} r="3" />
      {/each}
      <path class="trend" d={trendPath} />
      <circle class="end" cx={x(days[last])} cy={y(period.days[last].trend)} r="4.5" />
      <text class="end-label" x={x(days[last]) + 10} y={y(period.days[last].trend)} dy="0.32em">
        {formatKg(period.days[last].trend)} kg
      </text>
      {#if active !== null}
        <circle class="pick" cx={x(days[active])} cy={y(period.days[active].weight)} r="5.5" />
      {/if}

      {#if strip}
        <text class="strip-title" x={M.left} y={stripTop - 12}>Trainings pro Woche</text>
        <line class="gridline" x1={x(toDayNumber(logStart!))} x2={width - M.right} y1={stripBottom + 0.5} y2={stripBottom + 0.5} />
        {#each period.rows as r (r.start)}
          {#if r.workouts}
            <path class="bar" class:dim={activeRow !== null && activeRow !== r} d={bar(r.start, r.workouts)} />
          {/if}
        {/each}
        <line class="target" x1={x(toDayNumber(logStart!))} x2={width - M.right} y1={yw(WEEKLY_TARGET)} y2={yw(WEEKLY_TARGET)} />
        <text class="axis-label" x={width - M.right + 6} y={yw(WEEKLY_TARGET)} dy="0.32em">Ziel {WEEKLY_TARGET}</text>
      {/if}

      {#each xTicks as t (t.day)}
        <text class="axis-label" x={x(t.day)} y={height - 8} text-anchor="middle">{t.label}</text>
      {/each}
    </svg>

    {#if active !== null}
      {@const d = period.days[active]}
      <div class="tip" style:left="{Math.min(Math.max(x(days[active]) - 70, 0), width - 170)}px" style:top="{y(d.weight) < M.top + WEIGHT_H / 2 ? weightBottom - 92 : 0}px" role="status">
        <strong>{formatKg(d.weight)} kg</strong>
        <span>Trend {formatKg(d.trend)} kg</span>
        <span>{formatLongDate(d.date)}</span>
        {#if activeRow && activeRow.workouts !== null}
          <span>{plural(activeRow.workouts, 'Training', 'Trainings')} in KW {activeRow.week}</span>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .frame {
    position: relative;
    margin-top: 1.75rem;
  }

  .measurement {
    fill: var(--bar);
    opacity: 0.55;
  }

  .trend {
    fill: none;
    stroke: var(--green);
    stroke-width: 2.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .end,
  .pick {
    fill: var(--green);
    stroke: var(--bg);
    stroke-width: 2;
  }

  .pick {
    fill: var(--ink);
  }

  .end-label {
    fill: var(--ink);
    font-size: 12px;
    font-weight: 700;
  }

  .crosshair {
    stroke: var(--ink-3);
    stroke-width: 1;
  }

  .strip-title {
    fill: var(--ink-2);
    font-size: 12px;
    font-weight: 600;
  }

  .bar {
    fill: var(--bar);
    transition: opacity 0.15s;
  }

  .bar.dim {
    opacity: 0.45;
  }

  .target {
    stroke: var(--ink-3);
    stroke-width: 1.5;
    stroke-dasharray: 5 4;
  }
</style>
