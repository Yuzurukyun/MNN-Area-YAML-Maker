<script>
  import { state, update } from '../../lib/state.js';

  export let lt;
  export let hideHub;
  export let hideAll;
  export let showAllMesh;
  export let panTool;
  export let inFocus;
  export let layouts;
  export let onSetTab;
  export let onToggleHideHub;
  export let onToggleHideAll;
  export let onToggleAllMesh;
  export let onTogglePanTool;
  export let onResetCamera = () => {};
  export let onCenterSelected = () => {};
  export let onToggleFocus;
  export let onSaveLayout;
  export let onApplyLayout;
  export let onDeleteLayout;
  export let onSortByGroup;
  export let onArrange;

  let layoutMenu = false;
  let layoutName = '';
  let armSort = false;

  function sortClick() {
    if (!armSort) {
      armSort = true;
      return;
    }
    armSort = false;
    onSortByGroup();
  }

  function saveClick() {
    const name = layoutName;
    layoutName = '';
    onSaveLayout(name);
  }
</script>

<svelte:window on:pointerdown={() => (layoutMenu = false)} />

<div id="graphBar">
  <div class="tab-group" title="Choose which link type to display and edit on the map">
    {#each [
      ['reachable', 'Reachable', 'Walkable connections (reachable_areas)'],
      ['visible', 'Visible', 'Visible passages even if unreachable (visible_areas)'],
      ['scream', 'Scream', 'Areas that can hear /scream (scream_range)'],
    ] as [t, l, tip]}
      <button class="tab {lt === t ? 'on' : ''}" title={tip} on:click={() => onSetTab(t)}>{l}</button>
    {/each}
  </div>

  <span class="sep"></span>

  <label class="tgl" style="padding:0" title="Dim unrelated areas when selecting a node">
    <input type="checkbox" checked={$state.focus} on:change={(e) => update((s) => (s.focus = e.target.checked), { skipHistory: true })} />
    <span>Focus</span>
  </label>
  <label class="tgl" style="padding:0" title="Hide everything except the selected area and its direct neighbours (Esc to exit)">
    <input type="checkbox" checked={inFocus} on:change={onToggleFocus} />
    <span>Isolate</span>
  </label>
  <label class="tgl" style="padding:0" title="Hide the hub node (Area 0) and lines touching it">
    <input type="checkbox" checked={hideHub} on:change={(e) => onToggleHideHub(e.target.checked)} />
    <span>Hide hub</span>
  </label>
  <label class="tgl" style="padding:0" title="Hide areas whose Reachable mode is ALL AREAS (except the hub)">
    <input type="checkbox" checked={hideAll} on:change={(e) => onToggleHideAll(e.target.checked)} />
    <span>Hide &lt;ALL&gt;</span>
  </label>
  <label class="tgl" style="padding:0" title="Draw individual lines from <ALL> areas to every node (off by default to keep the board readable)">
    <input type="checkbox" checked={showAllMesh} on:change={(e) => onToggleAllMesh(e.target.checked)} />
    <span>&lt;ALL&gt; mesh</span>
  </label>

  <div class="sp"></div>

  <button class="mini-btn {panTool ? 'primary' : ''}" title="Toggle drag-to-pan tool (Space + drag or Middle-mouse also pans)" on:click={onTogglePanTool}>
    ✋ Pan
  </button>
  <button class="mini-btn" title="Reset camera zoom & position to default 100% (Home or 0)" on:click={onResetCamera}>
    ⟲ Reset
  </button>
  <button class="mini-btn" title="Center camera on selected area without changing zoom (C)" on:click={onCenterSelected}>
    ⌖ Center
  </button>

  <span class="drop-wrap">
    <button class="mini-btn" title="Save or restore named board layouts (node positions, groups, and images)" on:pointerdown|stopPropagation on:click|stopPropagation={() => (layoutMenu = !layoutMenu)}>Layouts ▾</button>
    {#if layoutMenu}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="drop-menu layout-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
        {#each layouts as l}
          <div class="layout-row">
            <button class="layout-apply" title="Restore saved layout '{l.name}'" on:click={() => { layoutMenu = false; onApplyLayout(l); }}>{l.name}</button>
            <button class="layout-x" title="Delete saved layout '{l.name}'" on:click={() => onDeleteLayout(l.id)}>✕</button>
          </div>
        {:else}
          <div class="drop-hint">No saved layouts yet. Save board positions, groups and images to restore anytime.</div>
        {/each}
        <div class="layout-save">
          <input type="text" placeholder="Layout name" title="Enter a name for the current board layout" bind:value={layoutName} />
          <button class="primary" title="Save current positions, groups, and images" on:click={saveClick}>Save</button>
        </div>
      </div>
    {/if}
  </span>

  <button
    class="mini-btn"
    on:click={sortClick}
    title="Reorder area IDs so group members hold consecutive IDs (useful for /zone_area)"
  >{armSort ? 'Confirm sort IDs?' : 'Sort IDs'}</button>
  <button class="mini-btn" title="Automatically arrange areas into clusters and fit the view" on:click={onArrange}>Auto-arrange</button>
</div>

<style>
  .sep {
    width: 1px;
    height: 18px;
    background: var(--line);
    margin: 0 2px;
  }
  .layout-menu {
    right: 0;
    left: auto;
    width: 310px;
  }
  .layout-row {
    display: flex;
    gap: 4px;
  }
  .layout-row button {
    width: auto;
  }
  .layout-apply {
    flex: 1;
    text-align: left;
  }
  .layout-x {
    flex: none;
    width: 30px;
    text-align: center;
  }
  .layout-save {
    display: flex;
    gap: 5px;
    margin-top: 6px;
    border-top: 1px solid var(--line);
    padding-top: 8px;
  }
  .layout-save input {
    flex: 1;
    min-width: 120px;
  }
</style>
