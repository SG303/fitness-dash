<script lang="ts">
  import { MUSCLE_PERIODS, leastTrained, type Model } from '../lib/model';

  let { model, href }: { model: Model; href: string } = $props();

  const names = $derived(leastTrained(model).map((m) => m.name).join(', '));
</script>

<a class="teaser" {href}>
  <span class="label">Am wenigsten trainiert ({MUSCLE_PERIODS[0]} Wochen):</span>
  <span class="names">{names}</span>
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

  .names {
    color: var(--ink);
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: var(--rule);
    text-underline-offset: 3px;
  }

  .teaser:hover .names {
    text-decoration-color: var(--ink-3);
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
</style>
