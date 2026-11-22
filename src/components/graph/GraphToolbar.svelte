<script>
  import { state, update, settings, updateSettings } from '../../lib/state.js';
  import Icon from '../Icon.svelte';

  export let lt;
  export let hideHub;
  export let hideAll;
  export let showAllMesh;
  export let panTool;
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
  export let routeActive = false;
  export let onToggleRoute = () => {};
  export let onOpenAudit = () => {};

  let layoutMenu = false;
  let layoutName = '';
  let arrangeMenuOpen = false;
  let linkMenuOpen = false;
  let viewMenuOpen = false;

  $: activeViewCount =
    ($state.focus ? 1 : 0) +
    ($state.isolateSelection ? 1 : 0) +
    (hideHub ? 1 : 0) +
    (hideAll ? 1 : 0) +
    (showAllMesh ? 1 : 0) +
    ($settings.showAllPill ? 1 : 0) +
    ($settings.hideLinesUnlessFocused ? 1 : 0);

  function saveClick() {
    const name = layoutName;
    layoutName = '';
    onSaveLayout(name);
  }
</script>

<svelte:window on:pointerdown={() => { layoutMenu = false; arrangeMenuOpen = false; linkMenuOpen = false; viewMenuOpen = false; }} />

<div id="graphBar">
  <span class="drop-wrap">
    <button
      class="mini-btn link-mode-btn"
      title="Choose which link layer to display and edit on the map"
      on:pointerdown|stopPropagation
      on:click|stopPropagation={() => (linkMenuOpen = !linkMenuOpen)}
    >
      {#if lt === 'reachable'}<Icon name="link" /> Reachable
      {:else if lt === 'visible'}<Icon name="eye" /> Visible
      {:else if lt === 'scream'}<Icon name="megaphone" /> Scream
      {/if} ▾
    </button>
    {#if linkMenuOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="drop-menu link-mode-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
        <button class="link-opt {lt === 'reachable' ? 'active' : ''}" on:click={() => { onSetTab('reachable'); linkMenuOpen = false; }}>
          <span class="link-opt-icon"><Icon name="link" /></span>
          <div class="link-opt-text">
            <b>Reachable</b>
            <span class="link-opt-desc">Walkable connections (reachable_areas)</span>
          </div>
          {#if lt === 'reachable'}<span class="link-check">✓</span>{/if}
        </button>
        <button class="link-opt {lt === 'visible' ? 'active' : ''}" on:click={() => { onSetTab('visible'); linkMenuOpen = false; }}>
          <span class="link-opt-icon"><Icon name="eye" /></span>
          <div class="link-opt-text">
            <b>Visible</b>
            <span class="link-opt-desc">Visible passages even if unreachable (visible_areas)</span>
          </div>
          {#if lt === 'visible'}<span class="link-check">✓</span>{/if}
        </button>
        <button class="link-opt {lt === 'scream' ? 'active' : ''}" on:click={() => { onSetTab('scream'); linkMenuOpen = false; }}>
          <span class="link-opt-icon"><Icon name="megaphone" /></span>
          <div class="link-opt-text">
            <b>Scream</b>
            <span class="link-opt-desc">Areas that hear shouts (scream_range)</span>
          </div>
          {#if lt === 'scream'}<span class="link-check">✓</span>{/if}
        </button>
      </div>
    {/if}
  </span>

  <span class="drop-wrap">
    <button
      class="mini-btn {activeViewCount > 0 ? 'active-opt' : ''}"
      title="Map display and visibility filters (Focus, Isolate, Hub, Mesh)"
      on:pointerdown|stopPropagation
      on:click|stopPropagation={() => (viewMenuOpen = !viewMenuOpen)}
    >
      <Icon name="eye" /> View ▾
      {#if activeViewCount > 0}
        <span class="view-badge">{activeViewCount}</span>
      {/if}
    </button>
    {#if viewMenuOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="drop-menu view-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
        <div class="view-menu-title">Display & Visibility</div>

        <label class="view-check-row" title="Dim unrelated areas when selecting a node">
          <input
            type="checkbox"
            checked={$state.focus}
            on:change={(e) => update((s) => (s.focus = e.target.checked), { skipHistory: true })}
          />
          <div class="check-text">
            <b>Focus mode</b>
            <span class="check-desc">Dim unrelated areas when node selected</span>
          </div>
        </label>

        <label class="view-check-row" title="Hide everything except the selected area and its direct neighbours when an area is selected (Esc to exit)">
          <input type="checkbox" checked={$state.isolateSelection} on:change={onToggleFocus} />
          <div class="check-text">
            <b>Isolate selection</b>
            <span class="check-desc">Show only selected area and neighbours</span>
          </div>
        </label>

        <label class="view-check-row" title="Hide the hub node (Area 0) and lines touching it">
          <input type="checkbox" checked={hideHub} on:change={(e) => onToggleHideHub(e.target.checked)} />
          <div class="check-text">
            <b>Hide hub node</b>
            <span class="check-desc">Hide Area 0 and lines touching it</span>
          </div>
        </label>

        <label class="view-check-row" title="Hide areas whose Reachable mode is ALL AREAS (except the hub)">
          <input type="checkbox" checked={hideAll} on:change={(e) => onToggleHideAll(e.target.checked)} />
          <div class="check-text">
            <b>Hide &lt;ALL&gt; areas</b>
            <span class="check-desc">Hide areas connected to all rooms</span>
          </div>
        </label>

        <label class="view-check-row" title="Draw individual lines from <ALL> areas to every node (off by default to keep the board readable)">
          <input type="checkbox" checked={showAllMesh} on:change={(e) => onToggleAllMesh(e.target.checked)} />
          <div class="check-text">
            <b>&lt;ALL&gt; mesh connections</b>
            <span class="check-desc">Draw individual lines to every room</span>
          </div>
        </label>

        <label class="view-check-row" title="Show floating <ALL> summary target pill and dashed links on canvas (off by default)">
          <input
            type="checkbox"
            checked={$settings.showAllPill}
            on:change={(e) => updateSettings((s) => (s.showAllPill = e.target.checked))}
          />
          <div class="check-text">
            <b>&lt;ALL&gt; target pill</b>
            <span class="check-desc">Show floating ALL AREAS indicator</span>
          </div>
        </label>

        <label class="view-check-row" title="Only show connection lines for selected or focused nodes to optimize performance">
          <input
            type="checkbox"
            checked={$settings.hideLinesUnlessFocused}
            on:change={(e) => updateSettings((s) => (s.hideLinesUnlessFocused = e.target.checked))}
          />
          <div class="check-text">
            <b>Hide lines (focus only)</b>
            <span class="check-desc">Only draw lines touching selected nodes</span>
          </div>
        </label>
      </div>
    {/if}
  </span>

  <div class="sp"></div>

  <button class="mini-btn {panTool ? 'primary' : ''}" title="Toggle drag-to-pan tool (Space + drag or Middle-mouse also pans)" on:click={onTogglePanTool}>
    <Icon name="hand" /> Pan
  </button>
  <button class="mini-btn" title="Reset camera zoom & position to default 100% (Home or 0)" on:click={onResetCamera}>
    ⟲ Reset
  </button>
  <button class="mini-btn" title="Center camera on selected area without changing zoom (C)" on:click={onCenterSelected}>
    <Icon name="center" /> Center
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

  <span class="drop-wrap">
    <button
      class="mini-btn {$settings.sortInsideGroup || $settings.arrangeGroupsOnly ? 'active-opt' : ''}"
      title="Auto-arrange areas and groups (click ▾ for options)"
      on:pointerdown|stopPropagation
      on:click|stopPropagation={() => (arrangeMenuOpen = !arrangeMenuOpen)}
    >Auto-arrange ▾</button>

    {#if arrangeMenuOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="drop-menu arrange-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
        <button class="primary mini-btn" style="width:100%;margin-bottom:6px" on:click={() => { arrangeMenuOpen = false; onArrange(); }}>
          ▶ Run Auto-arrange
        </button>

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
  ><Icon name="route" /> Route</button>

  <button
    class="mini-btn"
    title="Audit map network for isolated island rooms, dead ends, and one-way traps"
    on:click={onOpenAudit}
  ><Icon name="clipboard-check" /> Audit</button>
</div>

<style>
  .link-mode-btn {
    font-weight: 600;
    color: var(--text-strong);
  }
  .link-mode-menu {
    left: 0;
    width: 260px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .link-opt {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border-radius: var(--radius);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s ease;
  }
  .link-opt:hover {
    background: var(--hover);
  }
  .link-opt.active {
    background: var(--sel);
    border-color: var(--accent);
  }
  .link-opt-icon {
    font-size: 14px;
    flex: none;
  }
  .link-opt-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    line-height: 1.2;
    min-width: 0;
  }
  .link-opt-text b {
    font-size: 12px;
    color: var(--text-strong);
  }
  .link-opt-desc {
    font-size: 10px;
    color: var(--dim);
    word-break: break-word;
  }
  .link-check {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
  }
  .view-badge {
    display: inline-block;
    padding: 1px 5px;
    font-size: 9px;
    font-weight: 700;
    border-radius: 9px;
    background: var(--accent);
    color: #fff;
    margin-left: 4px;
    line-height: 1.2;
  }
  .view-menu {
    left: 0;
    width: 270px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .view-menu-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--dim);
    border-bottom: 1px solid var(--line);
    padding-bottom: 4px;
    margin-bottom: 2px;
  }
  .view-check-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: var(--radius);
    transition: background 0.1s ease;
  }
  .view-check-row:hover {
    background: var(--hover);
  }
  .view-check-row input {
    margin-top: 2px;
    flex: none;
    cursor: pointer;
  }
  .view-check-row .check-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    line-height: 1.25;
    min-width: 0;
  }
  .view-check-row b {
    font-size: 11.5px;
    color: var(--text-strong);
  }
  .view-check-row .check-desc {
    font-size: 10px;
    color: var(--dim);
    word-break: break-word;
  }
  .toolbar-sep {
    color: var(--line2);
    user-select: none;
    font-size: 11px;
    margin: 0 2px;
  }
  .mini-btn.active-opt {
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
    min-width: 0;
  }
  .arrange-check-row b {
    font-size: 11.5px;
    color: var(--text-strong);
  }
  .arrange-check-row .check-desc {
    font-size: 10px;
    color: var(--dim);
    word-break: break-word;
  }
  .arrange-menu-action {
    border-top: 1px solid var(--line);
    padding-top: 6px;
    margin-top: 2px;
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
