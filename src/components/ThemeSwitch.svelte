<script lang="ts">
  import { onMount } from 'svelte';
  import { applyTheme, loadTheme, onSystemChange, saveTheme, type Theme } from '../lib/theme';

  const OPTIONS: { value: Theme; label: string }[] = [
    { value: 'system', label: 'Auto' },
    { value: 'light', label: 'Hell' },
    { value: 'dark', label: 'Dunkel' },
  ];

  let theme = $state<Theme>(loadTheme());

  function choose(value: Theme) {
    theme = value;
    saveTheme(value);
    applyTheme(value);
  }

  onMount(() => onSystemChange(() => applyTheme(theme)));
</script>

<div class="switch" role="group" aria-label="Darstellung">
  {#each OPTIONS as option (option.value)}
    <button type="button" aria-pressed={theme === option.value} onclick={() => choose(option.value)}>
      {option.label}
    </button>
  {/each}
</div>

<style>
  .switch {
    display: flex;
    width: max-content;
    margin: 0 0 1.25rem auto;
    padding: 2px;
    border: 1px solid var(--rule);
    border-radius: 999px;
  }

  button {
    min-height: 2rem;
    padding: 0 0.8rem;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--ink-2);
    font-size: var(--step--1);
    font-weight: 600;
    cursor: pointer;
  }

  button:hover {
    color: var(--ink);
  }

  button[aria-pressed='true'] {
    background: var(--ink);
    color: var(--bg);
  }
</style>
