<script>
  import { onMount } from 'svelte';
  import * as M from '../../lib/core.js';
  import { bgStore, getAreaBgUrl } from '../../lib/bgStore.js';

  export let P;
  export let onClose;

  const LS_TEST_PREVIEW_KEY = 'areamaker_test_show_preview';
  let showPreview = true;
  try {
    const saved = localStorage.getItem(LS_TEST_PREVIEW_KEY);
    if (saved !== null) showPreview = saved === 'true';
  } catch {}

  function togglePreview() {
    showPreview = !showPreview;
    try {
      localStorage.setItem(LS_TEST_PREVIEW_KEY, String(showPreview));
    } catch {}
  }

  let bgStoreState = bgStore.get();
  onMount(() => {
    return bgStore.subscribe((s) => {
      bgStoreState = s;
    });
  });

  let currentId = P.areas.length ? P.areas[0].id : null;
  let trail = [];
  let query = '';

  const idxOf = (proj, a) => proj.areas.indexOf(a);
  const filterExits = (proj, list, q) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (a) => a.area.toLowerCase().includes(needle) || String(idxOf(proj, a)).startsWith(needle),
    );
  };

  $: current = P.areas.find((a) => a.id === currentId) || P.areas[0];
  $: exits = current
    ? M.effectiveIds(P, current, 'reachable')
        .map((id) => P.areas.find((a) => a.id === id))
        .filter(Boolean)
    : [];
  $: shownExits = filterExits(P, exits, query);
  $: if (currentId) query = '';

  $: currentBgUrl = current ? (getAreaBgUrl(current.background, bgStoreState) || current.image || '') : '';

  function go(a) {
    trail = [...trail, current.id];
    currentId = a.id;
  }
  function back() {
    if (!trail.length) return;
    currentId = trail[trail.length - 1];
    trail = trail.slice(0, -1);
  }
  function restart() {
    trail = [];
    currentId = P.areas[0].id;
  }
  function onFilterKey(e) {
    if (e.key === 'Enter' && shownExits.length) go(shownExits[0]);
  }

  let scrimMouseDownTarget = null;
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && onClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="modal-bg"
  on:mousedown={(e) => (scrimMouseDownTarget = e.target)}
  on:click={(e) => {
    if (scrimMouseDownTarget === e.currentTarget && e.target === e.currentTarget) onClose();
    scrimMouseDownTarget = null;
  }}
>
  <div class="modal test-modal" on:mousedown|stopPropagation on:click|stopPropagation>
    <button class="modal-x" title="Close" on:click={onClose}>✕</button>
    <div class="test-header">
      <h3>Test mode — walking the map</h3>
      <button
        type="button"
        class="test-toggle-btn {showPreview ? 'active' : ''}"
        on:click={togglePreview}
        title="Toggle live background scene preview while walking the map"
      >
        {showPreview ? 'Hide Preview' : 'Show Preview'}
      </button>
    </div>
    {#if current}
      <div class="test-panes">
        <div class="test-left">
          <div class="test-here-row">
            <div class="test-here">You are in</div>
            {#if currentBgUrl}
              <button
                type="button"
                class="test-inline-toggle"
                on:click={togglePreview}
                title="Toggle live background preview"
              >
                {showPreview ? 'Hide visual' : 'Show visual'}
              </button>
            {/if}
          </div>
          <div class="test-name">
            {idxOf(P, current)} — {current.area}
            {#if idxOf(P, current) === 0}<span class="tag hub">HUB</span>{/if}
            {#if current.links.reachable.mode === 'all'}<span class="badge all">&lt;ALL&gt;</span>{/if}
          </div>
          <div class="test-bg">{current.background || 'No background set'}</div>

          {#if showPreview && currentBgUrl}
            <div class="test-visual-wrap" title="Live background scene preview">
              <img src={currentBgUrl} alt="Background scene" class="test-visual-img" />
              {#if current.background}
                <div class="test-visual-badge">{current.background}</div>
              {/if}
            </div>
          {/if}

          <p class="test-desc">{current.default_description || 'No description — /look would show the server default here.'}</p>
        </div>
        <div class="test-right">
          <div class="test-here">Go to{#if exits.length} — {exits.length} exit{exits.length === 1 ? '' : 's'}{/if}</div>
          {#if exits.length}
            <input
              class="test-filter"
              type="text"
              title="Filter available exits by area name or ID"
              placeholder="Filter by name or ID (Enter travels)…"
              bind:value={query}
              on:keydown={onFilterKey}
            />
            {#if shownExits.length}
              <div class="test-list">
                {#each shownExits as a}
                  <button class="test-row" title="Walk to {a.area}" on:click={() => go(a)}>
                    <span class="test-idx">{idxOf(P, a)}-</span>{a.area}
                  </button>
                {/each}
              </div>
            {:else}
              <div class="hint">No exits match that filter.</div>
            {/if}
          {:else}
            <div class="warn-box">Nowhere to walk from here — this area has 0 reachable exits.</div>
          {/if}
        </div>
      </div>
    {/if}
    <div class="row">
      <button title="Return to the previous area in your trail" on:click={back} disabled={!trail.length}>← Back</button>
      <button title="Jump back to Area 0 (Hub)" on:click={restart}>Restart at hub</button>
      <button class="primary" title="Close Test mode" on:click={onClose}>Done</button>
    </div>
  </div>
</div>

<style>
  .test-modal {
    width: 820px;
    max-width: 94%;
    height: 560px;
    max-height: 92%;
    display: flex;
    flex-direction: column;
  }
  .test-modal .test-header,
  .test-modal .row {
    flex: none;
  }
  .test-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 32px 12px 0;
    gap: 12px;
  }
  .test-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
  }
  .test-toggle-btn {
    font-size: 11px;
    padding: 3px 9px;
    border: 1px solid var(--line2);
    background: var(--btn-bg);
    color: var(--muted);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .test-toggle-btn:hover {
    color: var(--text-strong);
    border-color: var(--accent);
  }
  .test-toggle-btn.active {
    color: var(--accent);
    border-color: var(--accent);
    background: rgba(235, 94, 60, 0.08);
  }
  .test-panes {
    display: flex;
    gap: 18px;
    margin-bottom: 14px;
    flex: 1;
    min-height: 0;
  }
  .test-left {
    flex: 1.25;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .test-right {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .test-here-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
    flex: none;
  }
  .test-here {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
  .test-inline-toggle {
    font-size: 10px;
    background: none;
    border: none;
    padding: 0;
    color: var(--dim);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .test-inline-toggle:hover {
    color: var(--accent);
  }
  .test-name {
    flex: none;
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .test-bg {
    flex: none;
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 8px;
    word-break: break-all;
  }
  .test-visual-wrap {
    flex: none;
    max-height: 185px;
    margin-bottom: 10px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--line2);
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
  }
  .test-visual-img {
    max-width: 100%;
    max-height: 185px;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
  }
  .test-visual-badge {
    position: absolute;
    bottom: 5px;
    right: 6px;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 9.5px;
    color: #fff;
    max-width: 85%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
  }
  .test-desc {
    margin: 0;
    line-height: 1.55;
    white-space: pre-wrap;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .test-filter {
    flex: none;
    width: 100%;
    margin-bottom: 6px;
  }
  .test-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .test-row {
    flex: none;
    text-align: left;
    padding: 6px 10px;
    font-size: 13px;
  }
  .test-idx {
    color: var(--dim);
    margin-right: 4px;
  }
</style>
