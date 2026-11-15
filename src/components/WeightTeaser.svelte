<script lang="ts">
  import { formatKg, formatKgChange } from '../lib/format';
  import { WEIGHT_TEASER_WEEKS, weightPeriod, type WeightModel } from '../lib/model';
  import Sparkline from './Sparkline.svelte';

  let { weight, href }: { weight: WeightModel; href: string } = $props();

  const latest = $derived(weight.days[weight.days.length - 1]);
  const period = $derived(weightPeriod(weight, WEIGHT_TEASER_WEEKS, null));
  const change = $derived.by(() => {
    const c = period.change;
    if (c === null) return `zu wenige Messungen in ${WEIGHT_TEASER_WEEKS} Wochen für einen Verlauf`;
    return `${formatKgChange(c)} kg in ${WEIGHT_TEASER_WEEKS} Wochen`;
  });
</script>

<a class="teaser" {href}>
  <span class="label">Gewicht (Trend):</span>
  <span class="value">{formatKg(latest.trend)} kg</span>
  <span class="change">{change}</span>
  {#if period.days.length > 1}
    <span class="spark"><Sparkline points={period.days.map((d) => ({ value: d.trend }))} /></span>
  {/if}
  <svg class="chevron" viewBox="0 0 8 12" aria-hidden="true"><path d="M2 1l5 5-5 5" /></svg>
</a>

<style>
  .teaser {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 0.35rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--rule);
    color: var(--ink-2);
    font-size: var(--step--1);
    text-decoration: none;
  }

  .value {
    color: var(--ink);
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: var(--rule);
    text-underline-offset: 3px;
  }

  .teaser:hover .value {
    text-decoration-color: var(--ink-3);
  }

  .spark {
    align-self: center;
    margin-left: auto;
  }

  .chevron {
    align-self: center;
    width: 0.5rem;
    height: 0.75rem;
    margin-left: auto;
    fill: none;
    stroke: var(--ink-3);
    stroke-width: 1.5;
  }

  .spark + .chevron {
    margin-left: 0.5rem;
  }
</style>
