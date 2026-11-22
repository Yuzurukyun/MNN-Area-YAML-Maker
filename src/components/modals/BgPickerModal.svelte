<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { bgStore } from '../../lib/bgStore.js';
  import { normalizeBgPath, resolveActiveVisual } from '../../lib/bgSchema.js';
  import Icon from '../Icon.svelte';

  export let currentBg = '';
  export let onClose = () => {};
  export let onSelect = (folder) => {};

  const dispatch = createEventDispatcher();

  $: backgrounds = $bgStore.backgrounds || [];

  let searchQuery = '';
  let selectedFolder = '';
  let previewTod = 'day';

  // Initialize selected folder with current area background or first available
  onMount(() => {
    const norm = normalizeBgPath(currentBg).toLowerCase();
    const found = backgrounds.find((b) => normalizeBgPath(b.folder).toLowerCase() === norm);
    if (found) {
      selectedFolder = found.folder;
    } else if (backgrounds.length > 0) {
      selectedFolder = backgrounds[0].folder;
    }
  });

  $: filteredBackgrounds = searchQuery.trim()
    ? backgrounds.filter((b) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          b.folder.toLowerCase().includes(q) ||
          b.name?.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q)
        );
      })
    : backgrounds;

  $: activeBg = backgrounds.find((b) => b.folder === selectedFolder) || filteredBackgrounds[0] || null;

  $: activeVisual = activeBg
    ? resolveActiveVisual(activeBg, { tod: previewTod })
    : { background: '', foreground: '', ambience: '' };

  $: activeBgUrl = activeBg ? bgStore.getAssetUrl(activeVisual.background, 'image', activeBg) : '';

  $: todKeys = activeBg ? (() => {
    const set = new Set();
    for (const st of Object.values(activeBg.states || {})) {
      if (st.time_variants) {
        for (const k of Object.keys(st.time_variants)) set.add(k);
      }
      if (st.positions) {
        for (const pos of Object.values(st.positions)) {
          if (pos.time_variants) {
            for (const k of Object.keys(pos.time_variants)) set.add(k);
          }
        }
      }
    }
    return Array.from(set);
  })() : [];

  function choose(b) {
    selectedFolder = b.folder;
    previewTod = 'day';
  }

  function confirmSelection() {
    if (activeBg) {
      onSelect(activeBg.folder);
      dispatch('select', activeBg.folder);
    }
    close();
  }

  function close() {
    onClose();
    dispatch('close');
  }

  function openInMaker() {
    if (activeBg) {
      bgStore.openMaker(activeBg.folder);
    } else {
      bgStore.openMaker();
    }
    close();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      confirmSelection();
    }
  }
</script>

<svelte:window on:keydown={onKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal-bg" on:mousedown={close}>
  <div class="modal bg-picker-modal" on:mousedown|stopPropagation on:click|stopPropagation>
    <!-- Header -->
    <div class="picker-header">
      <div class="picker-title-group">
        <span class="picker-prefix">//</span>
        <h3>CHOOSE BACKGROUND</h3>
        <span class="picker-count">({backgrounds.length} in library)</span>
      </div>
      <button class="modal-x" title="Close (Esc)" on:click={close}>✕</button>
    </div>

    <!-- 2-Column Body -->
    <div class="picker-body">
      <!-- Left Column: Background List -->
      <aside class="picker-list-col">
        <div class="picker-search-box">
          <input
            type="text"
            class="picker-search-input"
            placeholder="Filter library backgrounds..."
            bind:value={searchQuery}
          />
          {#if searchQuery}
            <button class="picker-search-clear" on:click={() => (searchQuery = '')}>✕</button>
          {/if}
        </div>

        <div class="picker-items-list">
          {#if filteredBackgrounds.length === 0}
            <div class="picker-empty-list">
              <span>No backgrounds match "{searchQuery}".</span>
              <button class="mini-btn" on:click={() => (searchQuery = '')}>Clear filter</button>
            </div>
          {:else}
            {#each filteredBackgrounds as bg (bg.id)}
              {@const isSelected = activeBg?.id === bg.id}
              {@const isCurrentAreaBg = normalizeBgPath(currentBg).toLowerCase() === normalizeBgPath(bg.folder).toLowerCase()}
              <div
                class="picker-item {isSelected ? 'selected' : ''}"
                role="button"
                tabindex="0"
                on:click={() => choose(bg)}
                on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && choose(bg)}
                on:dblclick={confirmSelection}
              >
                <div class="picker-item-main">
                  <div class="picker-item-title-row">
                    <span class="picker-item-name">{bg.folder}</span>
                    {#if isCurrentAreaBg}
                      <span class="picker-current-tag">CURRENT</span>
                    {/if}
                  </div>
                  <div class="picker-item-badges">
                    <span class="badge">{Object.keys(bg.states || {}).length} state{Object.keys(bg.states || {}).length === 1 ? '' : 's'}</span>
                    {#if bg.states?.default?.usePositions}
                      <span class="badge pos-badge">Positions</span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>

        <div class="picker-list-footer">
          <button class="mini-btn" on:click={openInMaker} title="Open Background.json Maker to create new backgrounds or import folders">
            <Icon name="image-plus" /> Create in Maker…
          </button>
        </div>
      </aside>

      <!-- Right Column: Basic Information & Visual Preview -->
      <main class="picker-detail-col">
        {#if activeBg}
          <!-- Preview Card -->
          <div class="detail-preview-card">
            <div class="preview-stage">
              {#if activeBgUrl}
                <img src={activeBgUrl} alt={activeBg.folder} class="preview-img" />
              {:else}
                <div class="preview-placeholder">
                  <Icon name="image" />
                  <span>No media asset loaded</span>
                  <code>{activeVisual.background || 'None assigned'}</code>
                </div>
              {/if}

              <!-- TOD Switcher Pills -->
              {#if todKeys.length > 0}
                <div class="stage-tod-bar">
                  <span class="tod-label">Time:</span>
                  <button class="tod-pill {previewTod === 'day' ? 'active' : ''}" on:click={() => (previewTod = 'day')}>Day</button>
                  {#each todKeys as k}
                    {#if k !== 'day'}
                      <button class="tod-pill {previewTod === k ? 'active' : ''}" on:click={() => (previewTod = k)}>{k}</button>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          </div>

          <!-- Basic Information Card -->
          <div class="detail-info-card">
            <div class="info-row">
              <span class="info-label">SERVER PATH:</span>
              <code class="info-val">base/background/{normalizeBgPath(activeBg.folder)}/background.json</code>
            </div>
            <div class="info-grid">
              <div class="info-cell">
                <span class="cell-label">FOLDER</span>
                <span class="cell-val">{activeBg.folder}</span>
              </div>
              <div class="info-cell">
                <span class="cell-label">STATE VARIANTS</span>
                <span class="cell-val">{Object.keys(activeBg.states || {}).join(', ') || 'default'}</span>
              </div>
              <div class="info-cell">
                <span class="cell-label">POSITIONS</span>
                <span class="cell-val">
                  {activeBg.states?.default?.usePositions ? Object.keys(activeBg.states?.default?.positions || {}).join(', ') || 'Enabled' : 'Disabled (Single scene)'}
                </span>
              </div>
              <div class="info-cell">
                <span class="cell-label">TIME VARIANTS</span>
                <span class="cell-val">
                  {todKeys.length > 0 ? `${todKeys.length} (${todKeys.join(', ')})` : 'None (Base scene)'}
                </span>
              </div>
              {#if activeVisual.ambience}
                <div class="info-cell full-width">
                  <span class="cell-label">AMBIENCE TRACK</span>
                  <span class="cell-val font-mono">{activeVisual.ambience}</span>
                </div>
              {/if}
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="picker-action-row">
            <button class="mini-btn" on:click={openInMaker} title="Open in Background.json Maker for full editing">
              <Icon name="image-plus" /> Edit in Maker…
            </button>
            <div class="sp"></div>
            <button class="btn btn-secondary" on:click={close}>Cancel</button>
            <button class="export-btn-tier1" on:click={confirmSelection} title="Apply this background to the current area">
              <Icon name="check" /> Select this Background
            </button>
          </div>
        {:else}
          <div class="picker-no-selection">
            <Icon name="image" />
            <span>Select a background from the list or open the Background Maker to add one.</span>
            <button class="mini-btn primary" on:click={openInMaker}>Open Background Maker</button>
          </div>
        {/if}
      </main>
    </div>
  </div>
</div>

<style>
  .bg-picker-modal {
    width: min(860px, 94vw);
    max-height: 86vh;
    height: 560px;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
    flex-shrink: 0;
  }

  .picker-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .picker-prefix {
    color: var(--accent);
    font-weight: 800;
  }

  .picker-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 800;
    color: var(--text-strong);
    letter-spacing: 0.06em;
  }

  .picker-count {
    font-size: 11px;
    color: var(--dim);
  }

  .picker-body {
    display: flex;
    gap: 16px;
    flex: 1;
    min-height: 0;
  }

  /* Left Column */
  .picker-list-col {
    width: 310px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-right: 1px solid var(--line);
    padding-right: 14px;
    flex-shrink: 0;
    min-height: 0;
  }

  .picker-search-box {
    position: relative;
    width: 100%;
  }

  .picker-search-input {
    width: 100%;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 6px 26px 6px 9px;
    font-size: 11.5px;
    color: var(--text);
    outline: none;
    transition: border-color 0.12s ease;
  }

  .picker-search-input:focus {
    border-color: var(--accent);
  }

  .picker-search-clear {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--dim);
    font-size: 11px;
    padding: 2px 4px;
    cursor: pointer;
  }

  .picker-items-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
    padding-right: 2px;
  }

  .picker-empty-list {
    padding: 24px 10px;
    text-align: center;
    font-size: 11px;
    color: var(--dim);
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }

  .picker-item {
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 8px 10px;
    cursor: pointer;
    transition: background 0.1s ease, border-color 0.1s ease;
    display: flex;
    align-items: center;
    user-select: none;
  }

  .picker-item:hover {
    background: var(--hover);
    border-color: var(--line2);
  }

  .picker-item.selected {
    border-color: var(--accent);
    background: var(--sel);
  }

  .picker-item-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .picker-item-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .picker-item-name {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-strong);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .picker-current-tag {
    font-size: 9px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(236, 74, 50, 0.2);
    color: var(--accent);
    border: 1px solid rgba(236, 74, 50, 0.4);
    flex-shrink: 0;
  }

  .picker-item-badges {
    display: flex;
    gap: 4px;
  }

  .badge {
    font-size: 9.5px;
    color: var(--dim);
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 0 4px;
  }

  .badge.pos-badge {
    color: var(--warn);
    border-color: color-mix(in srgb, var(--warn) 40%, transparent);
  }

  .picker-list-footer {
    padding-top: 6px;
    border-top: 1px solid var(--line);
  }

  .picker-list-footer button {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  /* Right Column */
  .picker-detail-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    min-height: 0;
  }

  .detail-preview-card {
    background: #000;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    height: 220px;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .preview-stage {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .preview-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: var(--dim);
    font-size: 11px;
  }

  .preview-placeholder code {
    font-size: 10px;
    color: var(--faint);
  }

  .stage-tod-bar {
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: rgba(14, 14, 18, 0.85);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 2px 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    backdrop-filter: blur(4px);
  }

  .tod-label {
    font-size: 9.5px;
    color: var(--dim);
    text-transform: uppercase;
    margin-right: 2px;
  }

  .tod-pill {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 3px;
    font-size: 10px;
    padding: 1px 6px;
    color: var(--dim);
    cursor: pointer;
  }

  .tod-pill:hover {
    color: var(--text);
  }

  .tod-pill.active {
    background: var(--sel);
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 700;
  }

  .detail-info-card {
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    overflow-y: auto;
  }

  .info-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line);
    font-size: 11px;
  }

  .info-label {
    font-size: 10px;
    font-weight: 800;
    color: var(--dim);
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .info-val {
    color: var(--text-strong);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
  }

  .info-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .info-cell.full-width {
    grid-column: 1 / -1;
  }

  .cell-label {
    font-size: 9.5px;
    font-weight: 800;
    color: var(--dim);
    letter-spacing: 0.06em;
  }

  .cell-val {
    font-size: 11.5px;
    color: var(--text);
    word-break: break-all;
  }

  .picker-action-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 6px;
    flex-shrink: 0;
  }

  .picker-action-row .sp {
    flex: 1;
  }

  .export-btn-tier1 {
    background: var(--accent) !important;
    color: #0e0e12 !important;
    font-weight: 700 !important;
    border: 1px solid var(--accent) !important;
    border-radius: var(--radius);
    padding: 5px 14px;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    box-shadow: 0 0 12px -2px var(--glow);
    white-space: nowrap;
    transition: background 0.12s ease, transform 0.06s ease;
  }

  .export-btn-tier1:hover {
    background: var(--accent2) !important;
    border-color: var(--accent2) !important;
  }

  .export-btn-tier1:active {
    transform: scale(0.98);
  }

  .picker-no-selection {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--dim);
    font-size: 12px;
    text-align: center;
  }
</style>
