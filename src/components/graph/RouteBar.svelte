<script>
  import { createEventDispatcher } from 'svelte';
  import { findShortestPath } from '../../lib/pathAudit.js';

  export let project;
  export let fromId = null;
  export let toId = null;
  export let onStepClick;

  const dispatch = createEventDispatcher();

  $: areas = project?.areas || [];
  $: byId = new Map(areas.map((a) => [a.id, a]));

  // Auto-default fromId to Hub if unset
  $: if (!fromId && areas.length > 0) {
    fromId = areas[0].id;
  }
  // Auto-default toId to Area 1 if unset and available
  $: if (!toId && areas.length > 1) {
    toId = areas[1].id;
  }

  $: result = (() => {
    if (!fromId || !toId) return null;
    return findShortestPath(project, fromId, toId);
  })();

  // Emit the active path to parent whenever result changes
  $: if (result) {
    dispatch('routeChange', {
      found: result.found,
      path: result.path || [],
    });
  }

  function swap() {
    const tmp = fromId;
    fromId = toId;
    toId = tmp;
  }

  function closeBar() {
    dispatch('close');
  }
</script>

<div class="route-bar">
  <div class="route-title">
    <span class="compass-icon">🧭</span>
    <b>ROUTE FINDER</b>
  </div>

  <div class="route-controls">
    <div class="select-col">
      <span class="route-lbl">From:</span>
      <select class="route-select" bind:value={fromId}>
        {#each areas as a, idx}
          <option value={a.id}>#{idx} {a.area}</option>
        {/each}
      </select>
    </div>

    <button class="swap-btn" title="Swap start and target areas" on:click={swap}>⇄</button>

    <div class="select-col">
      <span class="route-lbl">To:</span>
      <select class="route-select" bind:value={toId}>
        {#each areas as a, idx}
          <option value={a.id}>#{idx} {a.area}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="route-status">
    {#if result}
      {#if result.found}
        <span class="route-tag ok">✓ {result.stepCount} {result.stepCount === 1 ? 'exit' : 'exits'}</span>
        <div class="route-steps">
          {#each result.path as id, i}
            {@const a = byId.get(id)}
            {@const idx = areas.indexOf(a)}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <span
              class="step-pill"
              title="Click to view {a?.area || '#' + idx}"
              on:click={() => onStepClick && onStepClick(id)}
            >
              #{idx}
            </span>
            {#if i < result.path.length - 1}
              <span class="step-arr">→</span>
            {/if}
          {/each}
        </div>
      {:else}
        <span class="route-tag warn">⚠ No path found</span>
        <span class="hint" style="font-size:10.5px">Areas are not reachable via outgoing exits</span>
      {/if}
    {/if}
  </div>

  <button class="route-close" title="Close Route Finder (Esc)" on:click={closeBar}>✕</button>
</div>

<style>
  .route-bar {
    position: absolute;
    top: 48px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 17;
    display: flex;
    align-items: center;
    gap: 12px;
    background: color-mix(in srgb, var(--panel2) 92%, transparent);
    border: 1px solid var(--line2);
    border-radius: var(--radius-lg);
    box-shadow: 0 12px 36px -8px var(--shadow);
    backdrop-filter: blur(12px);
    padding: 6px 12px;
    font-size: 11.5px;
    user-select: none;
    max-width: 90vw;
  }

  .route-title {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-dim);
    font-size: 11px;
    letter-spacing: 0.05em;
  }

  .compass-icon {
    font-size: 14px;
  }

  .route-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .select-col {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .route-lbl {
    font-size: 11px;
    color: var(--dim);
  }

  .route-select {
    padding: 3px 6px;
    font-size: 11.5px;
    max-width: 150px;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--text-strong);
  }

  .swap-btn {
    background: var(--hover);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--dim);
    padding: 2px 6px;
    cursor: pointer;
    font-size: 12px;
  }

  .swap-btn:hover {
    color: var(--text-strong);
    border-color: var(--accent);
  }

  .route-status {
    display: flex;
    align-items: center;
    gap: 8px;
    border-left: 1px solid var(--line);
    padding-left: 10px;
  }

  .route-tag {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 999px;
  }

  .route-tag.ok {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .route-tag.warn {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .route-steps {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow-x: auto;
    max-width: 320px;
  }

  .step-pill {
    font-size: 10px;
    font-family: var(--font-mono);
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    background: color-mix(in srgb, #10b981 18%, var(--panel2));
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #10b981;
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  .step-pill:hover {
    transform: scale(1.1);
    background: #10b981;
    color: #fff;
  }

  .step-arr {
    font-size: 9px;
    color: var(--dim);
  }

  .route-close {
    background: transparent;
    border: none;
    color: var(--dim);
    font-size: 13px;
    padding: 2px 4px;
    cursor: pointer;
    margin-left: 4px;
  }

  .route-close:hover {
    color: var(--text-strong);
  }
</style>
