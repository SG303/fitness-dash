<script lang="ts">
  import { formatMonth, formatWhole } from '../lib/format';
  import { WEEKLY_TARGET, type Model } from '../lib/model';

  let { model }: { model: Model } = $props();
</script>

<section aria-label="Kennzahlen">
  <dl class="stats">
    <div class="stat">
      <dt>Trainings im {formatMonth(model.today)}</dt>
      <dd class="figure">{formatWhole(model.monthWorkouts)}</dd>
    </div>
    <div class="stat">
      <dt>Wochen in Folge mit {WEEKLY_TARGET} Trainings</dt>
      <dd class="figure">{formatWhole(model.weekStreak)}</dd>
    </div>
    <div class="stat">
      <dt>Volumen diese Woche</dt>
      <dd class="figure">{formatWhole(model.weekVolume)}<span class="unit">kg</span></dd>
    </div>
  </dl>
</section>

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin-top: 2.5rem;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
  }

  .stat {
    display: flex;
    flex-direction: column-reverse;
    justify-content: flex-end;
    gap: 0.25rem;
    padding: 0.875rem 0.75rem 1rem;
  }

  .stat:first-child {
    padding-left: 0;
  }

  .stat + .stat {
    border-left: 1px solid var(--rule);
  }

  dt {
    color: var(--ink-2);
    font-size: var(--step--1);
    line-height: 1.3;
  }

  dd {
    font-size: clamp(1.75rem, 8vw, 2.5rem);
    line-height: 1;
  }

  .unit {
    margin-left: 0.15em;
    font-size: 0.5em;
    font-stretch: 100%;
    font-weight: 600;
    color: var(--ink-2);
  }
</style>
