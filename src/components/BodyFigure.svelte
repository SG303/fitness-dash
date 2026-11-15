<script lang="ts">
  import { formatNumber } from '../lib/format';
  import type { Figure, View } from '../lib/body-art';
  import type { MuscleId, MuscleLoad } from '../lib/model';

  let {
    view,
    figure,
    loads,
    selected,
    keyboard,
    ring,
  }: {
    view: View;
    figure: Figure;
    loads: Map<MuscleId, MuscleLoad>;
    selected: MuscleId;
    /** Muscles that take keyboard focus in this view. */
    keyboard: Set<MuscleId>;
    /** Draw the focus ring around the selected muscle. */
    ring: boolean;
  } = $props();

  const caption = $derived(view === 'front' ? 'Vorne' : 'Hinten');
  const clipId = (m: number, p: number) => `clip-${view}-${m}-${p}`;
  const fill = (step: number) => (step === 0 ? `url(#hatch-${view})` : `var(--load-${step})`);
  const label = (load: MuscleLoad) =>
    `${load.name}: ${load.step === 0 ? 'nicht trainiert' : `${formatNumber(load.perWeek)} Sätze pro Woche`}`;

  // The split lines between the deltoid heads stay inside the deltoid shape.
  const deltoids = $derived(figure.muscles.find((part) => part.muscle === 'side_delts')?.paths ?? []);
  const chosen = $derived(figure.muscles.findIndex((part) => part.muscle === selected));
</script>

{#snippet shapes(m: number)}
  {#each figure.muscles[m].paths as p, i (i)}
    <path d={p.d} clip-path={p.clip ? `url(#${clipId(m, i)})` : undefined} />
  {/each}
{/snippet}

<figure class="view">
  <svg class="body" viewBox={figure.viewBox} role="group" aria-label="Körper {caption.toLowerCase()}">
    <defs>
      <pattern id="hatch-{view}" patternUnits="userSpaceOnUse" width="22" height="22" patternTransform="rotate(45)">
        <rect class="hatch-ground" width="22" height="22" />
        <rect class="hatch-stripe" width="8" height="22" />
      </pattern>
      {#each figure.muscles as part, m (part.muscle)}
        {#each part.paths as p, i (i)}
          {#if p.clip}
            <clipPath id={clipId(m, i)}><polygon points={p.clip} /></clipPath>
          {/if}
        {/each}
      {/each}
      {#each deltoids as p, k (k)}
        <clipPath id="split-{view}-{k}"><path d={p.d} /></clipPath>
      {/each}
    </defs>

    <path class="silhouette" d={figure.outline} />
    <g class="inert" aria-hidden="true">
      {#each figure.inert as d, i (i)}
        <path {d} />
      {/each}
      <path class="hair" d={figure.hair} />
    </g>

    <!-- Wider, invisible copies under the muscles: a tap next to a small muscle still hits it. -->
    <g class="hit" aria-hidden="true">
      {#each figure.muscles as part, m (part.muscle)}
        <g data-muscle={part.muscle}>{@render shapes(m)}</g>
      {/each}
    </g>

    <!-- Each muscle takes keyboard focus in one view only (KEYBOARD_ORDER); its copy in the other view is for pointers. -->
    {#each figure.muscles as part, m (part.muscle)}
      {@const load = loads.get(part.muscle)!}
      {#if keyboard.has(part.muscle)}
        <g
          class="muscle"
          data-muscle={part.muscle}
          data-key={part.muscle}
          role="radio"
          aria-checked={part.muscle === selected}
          aria-label={label(load)}
          tabindex={part.muscle === selected ? 0 : -1}
          style:fill={fill(load.step)}
        >
          {@render shapes(m)}
        </g>
      {:else}
        <g class="muscle" data-muscle={part.muscle} aria-hidden="true" style:fill={fill(load.step)}>
          {@render shapes(m)}
        </g>
      {/if}
    {/each}

    {#each figure.splits as [x1, y1, x2, y2], k (k)}
      <line class="split" {x1} {y1} {x2} {y2} clip-path="url(#split-{view}-{k})" />
    {/each}

    <!-- Selection and focus are drawn on top, so neighbouring shapes never cover the outline. -->
    {#if chosen !== -1}
      <g class="halo" aria-hidden="true">
        {#each ring ? ['ring', 'outline'] : ['outline'] as kind (kind)}
          {#each figure.muscles[chosen].paths as p, i (i)}
            <path class={kind} d={p.d} clip-path={p.clip ? `url(#${clipId(chosen, i)})` : undefined} />
          {/each}
        {/each}
      </g>
    {/if}
  </svg>
  <figcaption aria-hidden="true">{caption}</figcaption>
</figure>

<style>
  .view {
    display: grid;
    justify-items: center;
    gap: 0.25rem;
  }

  figcaption {
    color: var(--ink-2);
    font-size: var(--step--1);
  }

  .body {
    display: block;
    width: 100%;
    max-width: 15rem;
    height: auto;
    aspect-ratio: 646 / 1271;
    overflow: visible;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .silhouette {
    fill: var(--fig-body);
    stroke: var(--fig-line);
    stroke-width: 1.25;
    vector-effect: non-scaling-stroke;
  }

  .inert path {
    fill: var(--fig-inert);
  }

  .inert .hair {
    fill: var(--fig-hair);
  }

  .hatch-ground {
    fill: var(--none-fill);
  }

  .hatch-stripe {
    fill: var(--warn);
    fill-opacity: 0.7;
  }

  .hit path {
    fill: none;
    stroke: transparent;
    stroke-width: 20px;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
    pointer-events: stroke;
  }

  .hit g,
  .muscle {
    cursor: pointer;
  }

  .muscle {
    outline: none;
  }

  /* A fine line in the body colour separates neighbouring muscles. */
  .muscle path {
    stroke: var(--fig-body);
    stroke-width: 1.5px;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
    transition: fill 0.25s;
  }

  @media (hover: hover) {
    .muscle:hover path {
      stroke: var(--ink-2);
    }
  }

  .split {
    stroke: var(--fig-body);
    stroke-width: 2.5px;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }

  .halo {
    pointer-events: none;
  }

  .halo path {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2.25px;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  /* Keyboard focus: the app's green focus ring under the selection outline. */
  .halo .ring {
    stroke: var(--green);
    stroke-width: 7px;
  }
</style>
