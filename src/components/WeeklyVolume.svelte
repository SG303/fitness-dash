<script lang="ts">
  import { addDays } from '../lib/dates';
  import { formatCompact, formatDayMonth, formatWhole, plural } from '../lib/format';
  import type { WeekVolume } from '../lib/model';
  import { linear, niceTicks } from '../lib/scale';

  let { weeks }: { weeks: WeekVolume[] } = $props();

  const HEIGHT = 200;
  const M = { top: 24, right: 4, bottom: 26, left: 40 };

  let width = $state(0);
  let active = $state<number | null>(null);

  const ticks = $derived(niceTicks(0, Math.max(...weeks.map((w) => w.volume), 1000)));
  const y = $derived(linear(0, ticks[ticks.length - 1], HEIGHT - M.bottom, M.top));
  const band = $derived((width - M.left - M.right) / weeks.length);
  const barWidth = $derived(Math.min(24, band * 0.62));
  const labelEvery = $derived(band < 38 ? 2 : 1);

  const cx = (i: number) => M.left + band * (i + 0.5);

  /** Column with a 4px rounded top and a square base. */
  function bar(i: number, volume: number): string {
    const top = y(volume);
    const base = y(0);
    const r = Math.min(4, base - top, barWidth / 2);
    const x0 = cx(i) - barWidth / 2;
    const x1 = x0 + barWidth;
    return `M${x0},${base}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x1 - r}Q${x1},${top} ${x1},${top + r}V${base}Z`;
  }

  const range = (w: WeekVolume) => `${formatDayMonth(w.start)} bis ${formatDayMonth(addDays(w.start, 6))}`;

  function pick(event: PointerEvent) {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const i = Math.floor((event.clientX - box.left - M.left) / band);
    active = i >= 0 && i < weeks.length ? i : null;
  }

  function step(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const from = active ?? weeks.length;
    active = Math.max(0, Math.min(weeks.length - 1, from + (event.key === 'ArrowLeft' ? -1 : 1)));
  }
</script>

<section class="volume" aria-labelledby="volume-title">
  <h2 id="volume-title" class="section-title">Volumen pro Woche</h2>
  <p class="section-note">Gewicht × Wiederholungen aller Sätze, letzte {weeks.length} Wochen. Grün ist die laufende Woche.</p>

  <div class="frame" bind:clientWidth={width}>
    {#if width > 0}
      <!-- The table below is the accessible equivalent; focus and arrow keys mirror the hover tooltip. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <svg
        class="chart-svg"
        {width}
        height={HEIGHT}
        role="img"
        aria-label="Säulendiagramm Volumen pro Woche. Mit Pfeiltasten durch die Wochen gehen."
        tabindex="0"
        onpointermove={pick}
        onpointerdown={pick}
        onpointerleave={() => (active = null)}
        onkeydown={step}
        onblur={() => (active = null)}
      >
        {#each ticks as t (t)}
          <line class="gridline" x1={M.left} x2={width - M.right} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
          <text class="axis-label" x={M.left - 8} y={y(t)} dy="0.32em" text-anchor="end">{formatCompact(t)}</text>
        {/each}

        {#each weeks as w, i (w.start)}
          {#if w.volume > 0}
            <path class="bar" class:current={i === weeks.length - 1} class:dim={active !== null && active !== i} d={bar(i, w.volume)} />
          {/if}
          {#if (weeks.length - 1 - i) % labelEvery === 0}
            <text class="axis-label" x={cx(i)} y={HEIGHT - 8} text-anchor="middle">KW {w.week}</text>
          {/if}
        {/each}

      </svg>

      {#if active !== null}
        {@const w = weeks[active]}
        <div class="tip" style:left="{Math.min(Math.max(cx(active) - 60, 0), width - 150)}px" style:top="-0.5rem" role="status">
          <strong>{formatWhole(w.volume)} kg</strong>
          <span>KW {w.week}, {range(w)}</span>
          <span>{plural(w.workouts, 'Training', 'Trainings')}</span>
        </div>
      {/if}
    {/if}
  </div>

  <details class="table-toggle">
    <summary>Werte als Tabelle</summary>
    <table class="data-table">
      <thead>
        <tr><th>Woche</th><th>Zeitraum</th><th class="num">Trainings</th><th class="num">Volumen</th></tr>
      </thead>
      <tbody>
        {#each [...weeks].reverse() as w (w.start)}
          <tr>
            <td>KW {w.week}</td>
            <td>{range(w)}</td>
            <td class="num">{w.workouts}</td>
            <td class="num">{formatWhole(w.volume)} kg</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </details>
</section>

<style>
  .volume {
    margin-top: 3.5rem;
  }

  .frame {
    position: relative;
    margin-top: 1.25rem;
    min-height: 200px;
  }

  .bar {
    fill: var(--bar);
    transition: opacity 0.15s;
  }

  .bar.current {
    fill: var(--green);
  }

  .bar.dim {
    opacity: 0.45;
  }
</style>
