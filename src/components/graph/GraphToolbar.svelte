<script>
  import { state, update, settings, updateSettings } from '../../lib/state.js';

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
  export let onExportScreenshot = () => {};
  export let onToggleFocus;
  export let onSaveLayout;
  export let onApplyLayout;
  export let onDeleteLayout;
  export let onSortByGroup;
  export let onArrange;
  export let routeActive = false;
  export let onToggleRoute = () => {};
  export let onOpenAudit = () => {};

  let layoutMenu = false;
  let layoutName = '';
  let arrangeMenuOpen = false;

  function saveClick() {
    const name = layoutName;
    layoutName = '';
    onSaveLayout(name);
  }
</script>

<svelte:window on:pointerdown={() => { layoutMenu = false; arrangeMenuOpen = false; }} />

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
  <button class="mini-btn" title="Export high-resolution screenshot of the visible map (PNG)" on:click={onExportScreenshot}>
    📷 Snapshot
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
    on:click={onSortByGroup}
    title="Reorder area IDs so group members hold consecutive IDs (useful for /zone_area)"
  >Sort IDs</button>

  <span class="drop-wrap arrange-wrap">
    <button
      class="mini-btn arrange-btn"
      title="Automatically arrange areas and groups (click ▾ for options)"
      on:click={onArrange}
    >Auto-arrange</button>
    <button
      class="mini-btn arrange-caret {$settings.sortInsideGroup || $settings.arrangeGroupsOnly ? 'active-opt' : ''}"
      title="Auto-arrange options (group sorting, camera fit)"
      on:pointerdown|stopPropagation
      on:click|stopPropagation={() => (arrangeMenuOpen = !arrangeMenuOpen)}
    >▾</button>

    {#if arrangeMenuOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="drop-menu arrange-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
        <div class="arrange-menu-title">Auto-arrange Options</div>

        <label class="arrange-check-row" title="Sort nodes inside groups into a grid. Off preserves custom internal layout & shape.">
          <input
            type="checkbox"
            checked={$settings.sortInsideGroup}
            on:change={(e) => updateSettings((s) => (s.sortInsideGroup = e.target.checked))}
          />
          <div class="check-text">
            <b>Sort inside group</b>
            <span class="check-desc">{$settings.sortInsideGroup ? 'Grids nodes inside group' : 'Preserves custom internal shape'}</span>
          </div>
        </label>

        <label class="arrange-check-row" title="Automatically zoom and center the camera after arranging">
          <input
            type="checkbox"
            checked={$settings.arrangeFitView}
            on:change={(e) => updateSettings((s) => (s.arrangeFitView = e.target.checked))}
          />
          <div class="check-text">
            <b>Fit view after arrange</b>
            <span class="check-desc">Smooth camera zoom to fit content</span>
          </div>
        </label>

        <label class="arrange-check-row" title="Only reposition group containers, leaving loose areas untouched">
          <input
            type="checkbox"
            checked={$settings.arrangeGroupsOnly}
            on:change={(e) => updateSettings((s) => (s.arrangeGroupsOnly = e.target.checked))}
          />
          <div class="check-text">
            <b>Arrange groups only</b>
            <span class="check-desc">Leaves ungrouped areas untouched</span>
          </div>
        </label>

        <div class="arrange-menu-action">
          <button class="primary mini-btn" style="width:100%" on:click={() => { arrangeMenuOpen = false; onArrange(); }}>
            Run Auto-arrange
          </button>
        </div>
      </div>
    {/if}
  </span>

  <span class="toolbar-sep">|</span>

  <button
    class="mini-btn {routeActive ? 'primary' : ''}"
    title="Trace shortest walkable route between areas (or right-click an area)"
    on:click={onToggleRoute}
  >🧭 Route</button>

  <button
    class="mini-btn"
    title="Audit map network for isolated island rooms, dead ends, and one-way traps"
    on:click={onOpenAudit}
  >🔍 Audit</button>
</div>

<style>
  .arrange-wrap {
    display: inline-flex;
    align-items: center;
  }
  .toolbar-sep {
    color: var(--line2);
    user-select: none;
    font-size: 11px;
    margin: 0 2px;
  }
  .arrange-btn {
    border-top-right-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
    border-right: none !important;
  }
  .arrange-caret {
    border-top-left-radius: 0 !important;
    border-bottom-left-radius: 0 !important;
    padding: 0 6px !important;
    font-size: 10px !important;
  }
  .arrange-caret.active-opt {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--sel);
    font-weight: 700;
  }
  .arrange-menu {
    right: 0;
    left: auto;
    width: 270px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .arrange-menu-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--dim);
    border-bottom: 1px solid var(--line);
    padding-bottom: 4px;
    margin-bottom: 2px;
  }
  .arrange-check-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: var(--radius);
    transition: background 0.1s ease;
  }
  .arrange-check-row:hover {
    background: var(--hover);
  }
  .arrange-check-row input {
    margin-top: 2px;
    flex: none;
    cursor: pointer;
  }
  .arrange-check-row .check-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    line-height: 1.25;
  }
  .arrange-check-row b {
    font-size: 11.5px;
    color: var(--text-strong);
  }
  .arrange-check-row .check-desc {
    font-size: 10px;
    color: var(--dim);
  }
  .arrange-menu-action {
    border-top: 1px solid var(--line);
    padding-top: 6px;
    margin-top: 2px;
  }
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
