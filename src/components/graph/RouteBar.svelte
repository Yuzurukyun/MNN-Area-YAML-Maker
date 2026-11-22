<script>
  import { createEventDispatcher } from 'svelte';
  import { findShortestPath } from '../../lib/pathAudit.js';
  import { copyText, notify } from '../../lib/state.js';
  import Icon from '../Icon.svelte';

  export let project;
  export let fromId = null;
  export let toId = null;
  export let onStepClick;
  export let onFrameRoute;

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

  function closeWindow() {
    dispatch('close');
  }

  async function copyRoute() {
    if (!result || !result.found || !result.path) return;
    const names = result.path.map((id) => {
      const a = byId.get(id);
      const idx = areas.indexOf(a);
      return `#${idx} ${a?.area || id}`;
    });
    const text = names.join(' → ');
    const ok = await copyText(text);
    if (ok) {
      notify('Copied route steps to clipboard.', 'ok');
    } else {
      notify('Failed to copy to clipboard.', 'error');
    }
  }

  function frameAll() {
    if (onFrameRoute && result?.path) {
      onFrameRoute(result.path);
    }
  }
</script>

<div class="route-window">
  <!-- Top Header Bar -->
  <div class="route-header">
    <div class="route-title-group">
      <span class="compass-icon"><Icon name="route" /></span>
      <b>ROUTE FINDER</b>
      <span class="rule-badge">Explicit paths only · Excludes &lt;ALL&gt;</span>
    </div>
    <button class="route-close" title="Close Route Finder (Esc)" on:click={closeWindow}>✕</button>
  </div>

  <!-- Selection Deck (Two Cards) -->
  <div class="deck-row">
    <!-- Start Area -->
    <div class="deck-card">
      <div class="deck-lbl">
        <span>START AREA</span>
        {#if fromId}
          {@const a = byId.get(fromId)}
          {@const idx = areas.indexOf(a)}
          <span class="area-id-pill">#{idx}</span>
        {/if}
      </div>
      <select class="deck-select" bind:value={fromId}>
        {#each areas as a, idx}
          <option value={a.id}>
            #{idx} {a.area}{idx === 0 ? ' [HUB]' : ''}{a.private_area ? ' [PRIVATE]' : ''}{a.lobby_area ? ' [LOBBY]' : ''}
          </option>
        {/each}
      </select>
    </div>

    <!-- Swap Button -->
    <button class="swap-action-btn" title="Swap Start and Destination" on:click={swap}>
      ⇄
    </button>

    <!-- Destination Area -->
    <div class="deck-card">
      <div class="deck-lbl">
        <span>DESTINATION</span>
        {#if toId}
          {@const a = byId.get(toId)}
          {@const idx = areas.indexOf(a)}
          <span class="area-id-pill">#{idx}</span>
        {/if}
      </div>
      <select class="deck-select" bind:value={toId}>
        {#each areas as a, idx}
          <option value={a.id}>
            #{idx} {a.area}{idx === 0 ? ' [HUB]' : ''}{a.private_area ? ' [PRIVATE]' : ''}{a.lobby_area ? ' [LOBBY]' : ''}
          </option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Route Results Section -->
  <div class="route-result-section">
    {#if result}
      {#if result.found}
        <div class="result-banner ok">
          <div class="banner-status">
            <span class="check-circle">✓</span>
            <b>Walkable Path Found:</b>
            <span class="hops-count">{result.stepCount} {result.stepCount === 1 ? 'exit' : 'exits'} ({result.path.length} rooms)</span>
          </div>
          <div class="banner-actions">
            <button class="mini-btn route-act-btn" title="Frame all path areas on canvas" on:click={frameAll}><Icon name="crosshair" /> Frame route</button>
            <button class="mini-btn route-act-btn" title="Copy room sequence to clipboard" on:click={copyRoute}>Copy path</button>
          </div>
        </div>

        <!-- Step-by-Step Sequence -->
        <div class="steps-flow">
          {#each result.path as id, i}
            {@const a = byId.get(id)}
            {@const idx = areas.indexOf(a)}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div
              class="step-card {i === 0 ? 'start' : i === result.path.length - 1 ? 'goal' : ''}"
              title="Click to center camera on {a?.area || '#' + idx}"
              on:click={() => onStepClick && onStepClick(id)}
            >
              <div class="step-num">Step {i}</div>
              <div class="step-name-row">
                <span class="step-id">#{idx}</span>
                <span class="step-name">{a?.area || 'Area ' + idx}</span>
              </div>
            </div>

            {#if i < result.path.length - 1}
              <div class="step-arrow">→</div>
            {/if}
          {/each}
        </div>
      {:else}
        <div class="result-banner warn">
          <div class="warn-icon"><Icon name="alert-triangle" /></div>
          <div class="warn-text">
            <b>No walkable path found.</b>
            <div class="warn-hint">
              Route Finder only traverses explicit list exits. Areas connected only via &lt;ALL&gt;, one-way walls, or blocked private areas cannot be walked through.
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <div class="route-footer-hint">
    <span>Tip: Right-click any node on the map to set as <b>Start</b> or <b>Destination</b>.</span>
  </div>
</div>

<style>
  .route-window {
    position: absolute;
    top: 54px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 17;
    width: 620px;
    max-width: 95vw;
    background: color-mix(in srgb, var(--panel2) 94%, transparent);
    border: 1px solid var(--line2);
    border-radius: var(--radius-lg);
    box-shadow: 0 16px 44px -8px var(--shadow), 0 0 0 1px rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(14px);
    padding: 12px 16px;
    user-select: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .route-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--line);
    padding-bottom: 8px;
  }

  .route-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-strong);
    font-size: 12px;
    letter-spacing: 0.05em;
  }

  .compass-icon {
    font-size: 15px;
  }

  .rule-badge {
    font-size: 10px;
    font-weight: 500;
    color: var(--dim);
    background: var(--hover);
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid var(--line);
  }

  .route-close {
    background: transparent;
    border: none;
    color: var(--dim);
    font-size: 14px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .route-close:hover {
    color: var(--text-strong);
    background: var(--hover);
  }

  .deck-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .deck-card {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 6px 10px;
    box-sizing: border-box;
  }

  .deck-lbl {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 700;
    color: var(--dim);
    letter-spacing: 0.05em;
  }

  .area-id-pill {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    color: var(--accent);
  }

  .deck-select {
    width: 100%;
    padding: 5px 8px;
    font-size: 12px;
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--text-strong);
    cursor: pointer;
  }

  .swap-action-btn {
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--dim);
    font-size: 16px;
    font-weight: 700;
    padding: 8px 10px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .swap-action-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--hover);
  }

  .route-result-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .result-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-radius: var(--radius);
    font-size: 12px;
  }

  .result-banner.ok {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: var(--text-strong);
  }

  .banner-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .check-circle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #10b981;
    color: #fff;
    font-size: 11px;
    font-weight: 900;
  }

  .hops-count {
    color: #10b981;
    font-weight: 700;
  }

  .banner-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .route-act-btn {
    font-size: 11px;
    padding: 3px 8px;
  }

  .result-banner.warn {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
  }

  .warn-icon {
    font-size: 16px;
    color: #ef4444;
  }

  .warn-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    color: var(--text-strong);
  }

  .warn-hint {
    font-size: 11px;
    color: var(--dim);
    line-height: 1.4;
  }

  .steps-flow {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    padding: 6px 2px;
  }

  .step-card {
    flex: none;
    background: var(--input-bg);
    border: 1.5px solid var(--line);
    border-radius: var(--radius);
    padding: 6px 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 90px;
  }

  .step-card:hover {
    border-color: #10b981;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
  }

  .step-card.start {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--input-bg));
  }

  .step-card.goal {
    border-color: #10b981;
    background: color-mix(in srgb, #10b981 12%, var(--input-bg));
  }

  .step-num {
    font-size: 9px;
    font-weight: 700;
    color: var(--dim);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .step-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .step-id {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
  }

  .step-name {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-strong);
    white-space: nowrap;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .step-arrow {
    color: var(--dim);
    font-size: 12px;
    flex: none;
    padding: 0 2px;
  }

  .route-footer-hint {
    font-size: 10.5px;
    color: var(--dim);
    border-top: 1px dashed var(--line);
    padding-top: 6px;
    text-align: right;
  }
</style>
