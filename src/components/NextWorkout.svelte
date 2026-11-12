<script lang="ts">
  import { formatLongDate, formatValue } from '../lib/format';
  import type { NextWorkout } from '../lib/model';

  let { next }: { next: NextWorkout } = $props();
</script>

<section class="next" aria-labelledby="next-title">
  <h2 id="next-title" class="section-title">Nächstes Mal: Training {next.plan}</h2>
  {#if next.basedOn}
    <p class="section-note">Deine letzten Werte, Stand {formatLongDate(next.basedOn)}.</p>
  {:else}
    <p class="section-note">
      Training {next.plan} ist noch nicht erfasst. Nach dem ersten Training {next.plan} stehen hier deine letzten Gewichte.
    </p>
  {/if}

  {#if next.items.length > 0}
    <ol class="items">
      {#each next.items as item, i (item.id)}
        <li class="item">
          <span class="index figure" aria-hidden="true">{i + 1}</span>
          <div class="body">
            <p class="line">
              <span class="name">{item.name}</span>
              {#if item.exercise}
                <span class="value figure">{formatValue(item.exercise.latest.value, item.exercise.unit)}</span>
              {/if}
            </p>
            {#if item.exercise}
              <p class="sets">{item.exercise.latest.sets}</p>
            {/if}
            {#if item.skippedLastTime}
              <p class="sets">Letztes Mal ausgelassen</p>
            {/if}
            {#if item.comment}
              <p class="note">{item.comment}</p>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  {/if}

  {#if next.openComments.length > 0}
    <h3 class="sub">Notizen zu Übungen ohne erfasstes Training</h3>
    <ul class="items">
      {#each next.openComments as c (c.id)}
        <li class="item plain">
          <div class="body">
            <p class="name">{c.name}</p>
            <p class="note">{c.text}</p>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .next {
    margin-top: 3.5rem;
  }

  .items {
    margin-top: 1rem;
  }

  .item {
    display: grid;
    grid-template-columns: 1.75rem 1fr;
    gap: 0.5rem;
    padding: 0.75rem 0;
    border-top: 1px solid var(--rule);
  }

  .item:last-child {
    border-bottom: 1px solid var(--rule);
  }

  .item.plain {
    grid-template-columns: 1fr;
  }

  .index {
    color: var(--ink-3);
    font-size: var(--step-1);
    line-height: 1.2;
  }

  .line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .name {
    font-weight: 600;
    line-height: 1.35;
  }

  .value {
    font-size: var(--step-2);
    line-height: 1;
    white-space: nowrap;
  }

  .sets {
    color: var(--ink-2);
    font-size: var(--step--1);
  }

  .note {
    margin-top: 0.4rem;
    padding: 0.35rem 0.6rem;
    border-left: 2px solid var(--green);
    background: var(--raised);
    font-size: var(--step--1);
    line-height: 1.4;
  }

  .sub {
    margin-top: 1.75rem;
    font-size: var(--step-0);
    font-weight: 700;
  }
</style>
