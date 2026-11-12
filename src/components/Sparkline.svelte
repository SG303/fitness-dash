<script lang="ts">
  import type { ExercisePoint } from '../lib/model';
  import { linear } from '../lib/scale';

  let { points }: { points: ExercisePoint[] } = $props();

  const W = 72;
  const H = 28;
  const P = 3;

  const coords = $derived.by(() => {
    const values = points.map((p) => p.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const x = linear(0, Math.max(points.length - 1, 1), P, W - P);
    const y = hi > lo ? linear(lo, hi, H - P, P) : () => H / 2;
    return points.map((p, i) => [points.length === 1 ? W - P : x(i), y(p.value)] as const);
  });
  const last = $derived(coords[coords.length - 1]);
</script>

<svg class="spark" viewBox="0 0 {W} {H}" width={W} height={H} aria-hidden="true">
  {#if coords.length > 1}
    <polyline points={coords.map(([x, y]) => `${x},${y}`).join(' ')} />
  {/if}
  <circle cx={last[0]} cy={last[1]} r="2.75" />
</svg>

<style>
  .spark {
    display: block;
    overflow: visible;
  }

  polyline {
    fill: none;
    stroke: var(--ink-3);
    stroke-width: 1.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  circle {
    fill: var(--green);
  }
</style>
