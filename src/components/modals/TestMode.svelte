<script>
  import * as M from '../../lib/core.js';

  export let P;
  export let onClose;

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
    <h3>Test mode — walking the map</h3>
    {#if current}
      <div class="test-panes">
        <div class="test-left">
          <div class="test-here">You are in</div>
          <div class="test-name">
            {idxOf(P, current)} — {current.area}
            {#if idxOf(P, current) === 0}<span class="tag hub">HUB</span>{/if}
            {#if current.links.reachable.mode === 'all'}<span class="badge all">&lt;ALL&gt;</span>{/if}
          </div>
          <div class="test-bg">{current.background || 'No background set'}</div>
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
    width: 780px;
    max-width: 92%;
    height: 540px;
    max-height: 92%;
    display: flex;
    flex-direction: column;
  }
  .test-modal h3,
  .test-modal .row {
    flex: none;
  }
  .test-panes {
    display: flex;
    gap: 18px;
    margin-bottom: 14px;
    flex: 1;
    min-height: 0;
  }
  .test-left {
    flex: 1.2;
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
  .test-here {
    flex: none;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin-bottom: 4px;
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
    margin-bottom: 10px;
    word-break: break-all;
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
