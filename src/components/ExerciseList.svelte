<script lang="ts">
  import type { Exercise } from '../lib/model';
  import ExerciseRow from './ExerciseRow.svelte';

  let { exercises }: { exercises: Exercise[] } = $props();

  const title = (e: Exercise) => (e.plan ? `Training ${e.plan}` : 'Ohne Plan');
  const groups = $derived(
    [...new Set(exercises.map(title))].map((t) => [t, exercises.filter((e) => title(e) === t)] as const),
  );
</script>

<section class="exercises" aria-labelledby="exercises-title">
  <h2 id="exercises-title" class="section-title">Übungen</h2>
  <p class="section-note">Bestwert im letzten Training: schwerstes Gewicht, bei Halteübungen die längste Zeit. Tippe auf eine Übung für den Verlauf.</p>

  {#each groups as [title, list] (title)}
    <h3 class="group">{title}</h3>
    <ul>
      {#each list as exercise (exercise.id)}
        <ExerciseRow {exercise} />
      {/each}
    </ul>
  {/each}
</section>

<style>
  .exercises {
    margin-top: 3.5rem;
  }

  .group {
    margin: 1.75rem 0 0.25rem;
    color: var(--ink-2);
    font-size: var(--step--1);
    font-weight: 600;
  }
</style>
