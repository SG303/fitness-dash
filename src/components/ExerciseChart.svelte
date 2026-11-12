<script lang="ts">
  import { nextMonthStart, toDayNumber } from '../lib/dates';
  import { formatDayMonth, formatMonthShort, formatNumber, formatValue, unitLabel } from '../lib/format';
  import type { Exercise } from '../lib/model';
  import { linear, niceTicks } from '../lib/scale';

  let { exercise }: { exercise: Exercise } = $props();

  const HEIGHT = 200;
  const M = { top: 18, right: 52, bottom: 26, left: 36 };

  let width = $state(0);
  let active = $state<number | null>(null);

  const points = $derived(exercise.points);
  const days = $derived(points.map((p) => toDayNumber(p.date)));
  const x = $derived.by(() => {
    const d0 = days[0];
    const d1 = days[days.length - 1];
    const pad = d1 === d0 ? 14 : 0;
    return linear(d0 - pad, d1 + pad, M.left, width - M.right);
  });

  const ticks = $derived.by(() => {
    const values = points.map((p) => p.value);
    if (exercise.target !== null) values.push(exercise.target);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = (hi - lo) * 0.15 || hi * 0.1 || 1;
    return niceTicks(Math.max(0, lo - pad), hi + pad, 3);
  });
  const y = $derived(linear(ticks[0], ticks[ticks.length - 1], HEIGHT - M.bottom, M.top));

  /** First of each month inside the range; with fewer than two, the first and last date. */
  const xTicks = $derived.by(() => {
    const first = points[0].date;
    const last = points[points.length - 1].date;
    const months: { day: number; label: string }[] = [];
    let cursor = `${first.slice(0, 7)}-01`;
    while (cursor <= last) {
      if (cursor >= first) months.push({ day: toDayNumber(cursor), label: formatMonthShort(cursor) });
      cursor = nextMonthStart(cursor);
    }
    if (months.length >= 2) {
      const room = Math.max(1, Math.floor((width - M.left - M.right) / 48));
      const every = Math.ceil(months.length / room);
      return months.filter((_, i) => i % every === 0);
    }
    const ends = [...new Set([first, last])];
    return ends.map((d) => ({ day: toDayNumber(d), label: formatDayMonth(d) }));
  });

  const path = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(days[i])},${y(p.value)}`).join(''));
  const last = $derived(points.length - 1);

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
    const from = active ?? points.length;
    active = Math.max(0, Math.min(last, from + (event.key === 'ArrowLeft' ? -1 : 1)));
  }
</script>

<div class="frame" bind:clientWidth={width}>
  {#if width > 0}
    <!-- The table below is the accessible equivalent; focus and arrow keys mirror the hover tooltip. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <svg
      class="chart-svg"
      {width}
      height={HEIGHT}
      role="img"
      aria-label="Verlauf {exercise.name}. Mit Pfeiltasten durch die Trainings gehen."
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
      {#each xTicks as t (t.day)}
        <text class="axis-label" x={x(t.day)} y={HEIGHT - 8} text-anchor="middle">{t.label}</text>
      {/each}

      {#if exercise.target !== null}
        <line class="target" x1={M.left} x2={width - M.right} y1={y(exercise.target)} y2={y(exercise.target)} />
        <text class="target-label" x={M.left + 4} y={y(exercise.target) - 6}>Ziel {formatValue(exercise.target, 'kg')}</text>
      {/if}

      {#if active !== null}
        <line class="crosshair" x1={x(days[active])} x2={x(days[active])} y1={M.top} y2={HEIGHT - M.bottom} />
      {/if}

      <path class="line" d={path} />
      <!-- Dots only where they say something: records, the latest value, the hovered session. -->
      {#each points as p, i (p.workoutId)}
        {#if p.record || i === last || i === active}
          <circle class="dot" class:record={p.record} cx={x(days[i])} cy={y(p.value)} r={i === active ? 6 : 4.5} />
        {/if}
      {/each}

      <text class="end-label" x={x(days[last]) + 10} y={y(points[last].value)} dy="0.32em">
        {formatNumber(points[last].value)} {unitLabel(exercise.unit)}
      </text>
    </svg>

    {#if active !== null}
      {@const p = points[active]}
      <div class="tip" style:left="{Math.min(Math.max(x(days[active]) - 60, 0), width - 150)}px" style:top="{y(p.value) < HEIGHT / 2 ? HEIGHT - M.bottom - 72 : 0}px" role="status">
        <strong>{formatValue(p.value, exercise.unit)}</strong>
        <span>{formatDayMonth(p.date)}, {p.sets}</span>
        {#if p.record}<span>Neuer Rekord</span>{/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .frame {
    position: relative;
    min-height: 200px;
  }

  .line {
    fill: none;
    stroke: var(--green);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .dot {
    fill: var(--green);
    stroke: var(--raised);
    stroke-width: 2;
  }

  .dot.record {
    fill: var(--ink);
  }

  .target {
    stroke: var(--ink-3);
    stroke-width: 1.5;
    stroke-dasharray: 5 4;
  }

  .target-label {
    fill: var(--ink-2);
    font-size: 11px;
    font-weight: 600;
  }

  .crosshair {
    stroke: var(--ink-3);
    stroke-width: 1;
  }

  .end-label {
    fill: var(--ink);
    font-size: 12px;
    font-weight: 700;
  }
</style>
