<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { state, update, notify, copyText } from '../../lib/state.js';
  import {
    createBackground,
    createStateVariant,
    createPosition,
    createTimeVariant,
    serializeBackgroundJson,
    parseBackgroundJson,
    resolveActiveVisual,
    normalizeBgPath,
    normalizeAmbiencePath,
  } from '../../lib/bgSchema.js';
  import { bgStore } from '../../lib/bgStore.js';

  const dispatch = createEventDispatcher();

  let storeState = bgStore.get();
  const unsub = bgStore.subscribe((s) => {
    storeState = s;
  });

  onMount(() => {
    return () => unsub();
  });

  $: backgrounds = storeState.backgrounds;
  $: activeBg = storeState.activeBg || backgrounds[0];
  $: assetPool = storeState.assetPool;

  // View modes
  let activeTab = 'builder'; // 'builder' | 'json'
  let assetFilter = 'all'; // 'all' | 'image' | 'audio'
  let assetSearch = '';

  // Local drag-over indicator
  let isDraggingOverPool = false;

  // Drag-and-drop asset assignment
  let draggedAsset = null;

  // Inspector area selection
  $: selectedArea = $state.project.areas.find((a) => a.id === $state.selectedId);

  // Active state & position inside the currently selected background
  $: activeStateKey = activeBg?.activeState || 'default';
  $: activeState = activeBg?.states?.[activeStateKey] || activeBg?.states?.default || createStateVariant('default');
  $: usePositions = Boolean(activeState?.usePositions);
  $: activePosKey = activeBg?.activePosition || 'Normal';
  $: activePos = activeState?.positions?.[activePosKey] || Object.values(activeState?.positions || {})[0] || null;

  // Test stage state
  let stageTod = 'day';

  // Audio preview element
  let audioEl;
  let isPlayingAudio = false;

  // JSON string & Indent configuration
  let jsonIndent = 4;
  $: bgJsonString = activeBg ? serializeBackgroundJson(activeBg, jsonIndent) : '{}';

  // Resolved visuals for Stage preview
  $: resolvedVisual = activeBg
    ? resolveActiveVisual(activeBg, {
        state: activeStateKey,
        position: activePosKey,
        tod: stageTod,
      })
    : { background: '', foreground: '', ambience: '' };

  $: resolvedBgUrl = bgStore.getAssetUrl(resolvedVisual.background, 'image');
  $: resolvedFgUrl = bgStore.getAssetUrl(resolvedVisual.foreground, 'image');
  $: resolvedAmbienceUrl = bgStore.getAssetUrl(resolvedVisual.ambience, 'audio');

  // Slot values for active context
  $: activeBgVal = usePositions ? activePos?.background : activeState?.background;
  $: activeBgThumb = bgStore.getAssetUrl(activeBgVal, 'image');
  $: activeFgVal = usePositions ? activePos?.foreground : activeState?.foreground;
  $: activeFgThumb = bgStore.getAssetUrl(activeFgVal, 'image');
  $: activeAmbienceVal = usePositions ? activePos?.ambience : activeState?.ambience;
  $: activeTimeVariants = usePositions ? (activePos?.time_variants || {}) : (activeState?.time_variants || {});

  // Folder splitting & smart prefix management
  function splitFolderPath(folder) {
    const norm = normalizeBgPath(folder) || '';
    const lastSlash = norm.lastIndexOf('/');
    if (lastSlash === -1) {
      return { subfolder: '', name: norm };
    }
    return {
      subfolder: norm.slice(0, lastSlash),
      name: norm.slice(lastSlash + 1),
    };
  }

  $: currentFolderParts = splitFolderPath(activeBg?.folder || '');
  $: activeSubfolder = currentFolderParts.subfolder;
  $: activeBgName = currentFolderParts.name;

  // View mode for path bar: 'auto' (default: combined unless long), 'combined', or 'split'
  let pathViewMode = 'auto';
  $: isVeryLongPath = (activeBg?.folder || '').length > 32 || (activeBg?.folder || '').split('/').length > 3;
  $: showSplitView = pathViewMode === 'split' || (pathViewMode === 'auto' && isVeryLongPath);

  function onSubfolderChange(newSub) {
    const cleanSub = normalizeBgPath(newSub);
    const newFull = cleanSub
      ? `${cleanSub}/${activeBgName || 'Background'}`
      : (activeBgName || 'Background');
    updateBg((bg) => (bg.folder = newFull));
  }

  function onBgNameChange(newName) {
    const cleanName = newName.replace(/^\/+/, '').replace(/\/+$/, '');
    const newFull = activeSubfolder
      ? `${activeSubfolder}/${cleanName || 'Untitled'}`
      : (cleanName || 'Untitled');
    updateBg((bg) => (bg.folder = newFull));
  }

  function createNewBackgroundInCurrentFolder() {
    const prefix = activeSubfolder ? `${activeSubfolder}/` : '';
    bgStore.addBackground(`${prefix}NewBackground`);
  }

  // Known subfolder prefixes gathered across library, project areas & asset pool
  $: knownSubfolders = (() => {
    const set = new Set();
    for (const b of backgrounds) {
      const p = splitFolderPath(b.folder);
      if (p.subfolder) set.add(p.subfolder);
    }
    for (const a of $state.project.areas) {
      if (a.background) {
        const p = splitFolderPath(a.background);
        if (p.subfolder) set.add(p.subfolder);
      }
    }
    for (const ast of assetPool) {
      if (ast.fullRelPath && ast.fullRelPath.includes('/')) {
        const p = splitFolderPath(normalizeBgPath(ast.fullRelPath));
        if (p.subfolder) set.add(p.subfolder);
      }
    }
    return Array.from(set).sort();
  })();

  function updateBg(mutator) {
    bgStore.updateActiveBg((bg) => {
      mutator(bg);
      return bg;
    });
  }

  // State variant actions
  function addStateVariant() {
    const name = prompt('Enter state variant name (e.g. crowded, festive, rainy):');
    if (!name) return;
    const clean = name.trim();
    if (!clean || clean === 'default') return;
    updateBg((bg) => {
      if (!bg.states) bg.states = {};
      bg.states[clean] = createStateVariant(clean, {
        background: activeState.background || '',
        usePositions: activeState.usePositions,
      });
      bg.activeState = clean;
    });
  }

  function removeStateVariant(stKey) {
    if (stKey === 'default') return;
    if (!confirm(`Delete state variant "${stKey}"?`)) return;
    updateBg((bg) => {
      delete bg.states[stKey];
      bg.activeState = 'default';
    });
  }

  // Positions actions
  function togglePositions(enable) {
    updateBg((bg) => {
      const st = bg.states[bg.activeState || 'default'];
      if (!st) return;
      st.usePositions = enable;
      if (enable && (!st.positions || Object.keys(st.positions).length === 0)) {
        st.positions = {
          Normal: createPosition('Normal', { background: st.background }),
        };
        bg.activePosition = 'Normal';
      }
    });
  }

  function addPosition(name) {
    const posName = name || prompt('Enter position name (e.g. Witness, Prosecution, Defense):');
    if (!posName) return;
    const clean = posName.trim();
    if (!clean) return;
    updateBg((bg) => {
      const st = bg.states[bg.activeState || 'default'];
      if (!st) return;
      if (!st.positions) st.positions = {};
      st.positions[clean] = createPosition(clean, { background: st.background || '' });
      bg.activePosition = clean;
    });
  }

  function removePosition(posKey) {
    if (!confirm(`Delete position "${posKey}"?`)) return;
    updateBg((bg) => {
      const st = bg.states[bg.activeState || 'default'];
      if (!st || !st.positions) return;
      delete st.positions[posKey];
      const remaining = Object.keys(st.positions);
      if (remaining.length > 0) {
        bg.activePosition = remaining[0];
      } else {
        st.usePositions = false;
      }
    });
  }

  // Time variant actions
  function addTimeVariant(todName) {
    const name = todName || prompt('Enter time of day name (e.g. day, evening, night):');
    if (!name) return;
    const clean = name.trim().toLowerCase();
    if (!clean) return;

    updateBg((bg) => {
      const st = bg.states[bg.activeState || 'default'];
      if (!st) return;

      if (st.usePositions && bg.activePosition && st.positions?.[bg.activePosition]) {
        const pos = st.positions[bg.activePosition];
        if (!pos.time_variants) pos.time_variants = {};
        pos.time_variants[clean] = createTimeVariant({ background: pos.background || st.background || '' });
      } else {
        if (!st.time_variants) st.time_variants = {};
        st.time_variants[clean] = createTimeVariant({ background: st.background || '' });
      }
    });
  }

  function removeTimeVariant(todKey) {
    updateBg((bg) => {
      const st = bg.states[bg.activeState || 'default'];
      if (!st) return;
      if (st.usePositions && bg.activePosition && st.positions?.[bg.activePosition]) {
        delete st.positions[bg.activePosition].time_variants[todKey];
      } else if (st.time_variants) {
        delete st.time_variants[todKey];
      }
    });
  }

  // Slot asset assignments
  function assignSlotAsset(targetType, filename, targetTod = null) {
    updateBg((bg) => {
      const st = bg.states[bg.activeState || 'default'];
      if (!st) return;

      const dest = targetTod
        ? (st.usePositions && bg.activePosition && st.positions?.[bg.activePosition]
            ? st.positions[bg.activePosition].time_variants?.[targetTod]
            : st.time_variants?.[targetTod])
        : (st.usePositions && bg.activePosition && st.positions?.[bg.activePosition]
            ? st.positions[bg.activePosition]
            : st);

      if (dest) {
        dest[targetType] = filename;
      }
    });
  }

  // File upload handlers
  let fileInputGeneral;
  let fileInputFolder;

  function handleFiles(files) {
    bgStore.registerFiles(files);
    notify('Loaded files into Asset Pool');
  }

  // Drag over pool
  function onPoolDragOver(e) {
    e.preventDefault();
    isDraggingOverPool = true;
  }
  function onPoolDragLeave() {
    isDraggingOverPool = false;
  }
  function onPoolDrop(e) {
    e.preventDefault();
    isDraggingOverPool = false;
    if (e.dataTransfer?.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  }

  // Drag asset onto slot
  function onAssetDragStart(e, asset) {
    draggedAsset = asset;
    e.dataTransfer.setData('text/plain', asset.relPath);
  }

  function onSlotDrop(e, slotType, tod = null) {
    e.preventDefault();
    if (draggedAsset) {
      assignSlotAsset(slotType, draggedAsset.relPath, tod);
      draggedAsset = null;
    } else if (e.dataTransfer?.files?.length) {
      const f = e.dataTransfer.files[0];
      handleFiles([f]);
      const isAudio = f.type.startsWith('audio/') || /\.(opus|mp3|ogg|wav)$/i.test(f.name);
      assignSlotAsset(slotType, isAudio ? normalizeAmbiencePath(f.name) : f.name, tod);
    }
  }

  // Audio Playback
  function toggleAudio() {
    if (!audioEl) return;
    if (isPlayingAudio) {
      audioEl.pause();
      isPlayingAudio = false;
    } else {
      audioEl.play().then(() => {
        isPlayingAudio = true;
      }).catch((err) => {
        console.warn('Audio play error:', err);
      });
    }
  }

  // Apply to current area in inspector
  function applyToCurrentArea() {
    if (!selectedArea || !activeBg) return;
    const cleanFolder = normalizeBgPath(activeBg.folder);
    update((s) => {
      const a = s.project.areas.find((ar) => ar.id === s.selectedId);
      if (a) {
        a.background = cleanFolder;
      }
    });
    notify(`Applied "${cleanFolder}" to Area #${$state.project.areas.indexOf(selectedArea)}`);
  }

  // Filtered assets in pool
  $: filteredAssets = assetPool.filter((a) => {
    if (assetFilter !== 'all' && a.type !== assetFilter) return false;
    if (assetSearch && !a.name.toLowerCase().includes(assetSearch.toLowerCase())) return false;
    return true;
  });
</script>

<div class="modal-bg" role="presentation" on:click|self={() => dispatch('close')}>
  <div class="modal bg-maker-modal" role="dialog" aria-modal="true" aria-label="Background.json Maker">
    <!-- Top Notch & Header -->
    <button class="modal-x" title="Close Background Maker (Esc)" on:click={() => dispatch('close')}>✕</button>

    <div class="maker-head">
      <div class="head-left">
        <span class="maker-tag">// BACKGROUND.JSON MAKER</span>
        {#if !showSplitView}
          <!-- Unified / Combined path bar (default) -->
          <div class="path-bar" title="Full relative folder path inside base/background/">
            <span class="prefix">base/background/</span>
            <input
              type="text"
              class="folder-input"
              placeholder="Subfolder/BackgroundName"
              value={activeBg?.folder || ''}
              list="known-bg-maker-folders"
              on:input={(e) => updateBg((bg) => (bg.folder = normalizeBgPath(e.target.value)))}
            />
            {#if knownSubfolders.length > 0}
              <select
                class="subfolder-dropdown"
                title="Shortcut: Prefix with an existing series folder"
                on:change={(e) => {
                  if (e.target.value) {
                    const parts = splitFolderPath(activeBg?.folder || '');
                    const baseName = parts.name || 'Background';
                    updateBg((bg) => (bg.folder = `${e.target.value}/${baseName}`));
                  }
                  e.target.value = '';
                }}
              >
                <option value="">▾ Folders ({knownSubfolders.length})</option>
                {#each knownSubfolders as sub}
                  <option value={sub}>{sub}/</option>
                {/each}
              </select>
            {/if}
            {#if isVeryLongPath}
              <button
                class="view-toggle-btn"
                title="Path is long: switch to split view"
                on:click={() => (pathViewMode = 'split')}
              >⇄ Split</button>
            {/if}
          </div>
        {:else}
          <!-- Split path bar (for long nested paths or manual split) -->
          <div class="split-path-bar">
            <span class="prefix">base/background/</span>
            <div class="subfolder-box" title="Series / Parent folder prefix (e.g. Umamusume/School)">
              <input
                type="text"
                class="subfolder-input"
                placeholder="Series / Subfolder"
                value={activeSubfolder}
                on:input={(e) => onSubfolderChange(e.target.value)}
              />
              {#if knownSubfolders.length > 0}
                <select
                  class="subfolder-dropdown"
                  title="Pick an existing series folder prefix"
                  on:change={(e) => {
                    if (e.target.value !== '') onSubfolderChange(e.target.value);
                    e.target.value = '';
                  }}
                >
                  <option value="">▾ Folders ({knownSubfolders.length})</option>
                  {#each knownSubfolders as sub}
                    <option value={sub}>{sub}/</option>
                  {/each}
                </select>
              {/if}
            </div>
            <span class="path-divider">/</span>
            <input
              type="text"
              class="bgname-input"
              title="Room or scene folder name (e.g. Cafeteria)"
              placeholder="RoomName"
              value={activeBgName}
              on:input={(e) => onBgNameChange(e.target.value)}
            />
            <button
              class="view-toggle-btn"
              title="Switch back to single combined input"
              on:click={() => (pathViewMode = 'combined')}
            >⇄ Combined</button>
          </div>
        {/if}
        <datalist id="known-bg-maker-folders">
          {#each knownSubfolders as sub}
            <option value="{sub}/">{sub}/</option>
          {/each}
        </datalist>
      </div>

      <div class="head-actions">
        {#if selectedArea}
          <button
            class="primary-btn mini-btn"
            title="Set background: '{activeBg?.folder}' on the currently inspected area"
            on:click={applyToCurrentArea}
          >
            ✓ Apply to Area #{Math.max(0, $state.project.areas.indexOf(selectedArea))}
          </button>
        {/if}
        <button
          class="mini-btn"
          title="Copy formatted background.json to clipboard"
          on:click={() => { copyText(bgJsonString); notify('Copied background.json to clipboard'); }}
        >
          📋 Copy JSON
        </button>
        <button
          class="mini-btn"
          title="Download background.json file"
          on:click={() => {
            const blob = new Blob([bgJsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'background.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          💾 Download JSON
        </button>
        <button
          class="mini-btn accent-btn"
          title="Export complete package ZIP containing background.json, images and sounds"
          on:click={() => bgStore.exportZip(activeBg.id)}
        >
          📦 Export Folder ZIP
        </button>
      </div>
    </div>

    <!-- Main 3-Column Workspace -->
    <div class="maker-body">
      <!-- Left Column: Backgrounds Navigator -->
      <aside class="bg-nav">
        <div class="nav-head">
          <span class="nav-title">BACKGROUNDS ({backgrounds.length})</span>
          <button
            class="mini-btn"
            title="Create a new background in the current folder ({activeSubfolder || 'root'})"
            on:click={createNewBackgroundInCurrentFolder}
          >+ New</button>
        </div>

        <div class="bg-list">
          {#each backgrounds as bg (bg.id)}
            {@const parts = splitFolderPath(bg.folder)}
            <div
              class="bg-item {bg.id === activeBg?.id ? 'active' : ''}"
              role="button"
              tabindex="0"
              on:click={() => bgStore.selectBg(bg.id)}
              on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && bgStore.selectBg(bg.id)}
            >
              <div class="bg-item-row">
                <div class="bg-item-titles" title={bg.folder}>
                  {#if parts.subfolder}
                    <span class="bg-subfolder-tag">{parts.subfolder}/</span>
                  {/if}
                  <span class="bg-folder">{parts.name || bg.folder || 'Untitled'}</span>
                </div>
                <div class="item-actions">
                  <button
                    class="icon-btn"
                    title="Duplicate background"
                    on:click|stopPropagation={() => bgStore.duplicateBackground(bg.id)}
                  >⧉</button>
                  <button
                    class="icon-btn danger"
                    title="Delete background"
                    on:click|stopPropagation={() => bgStore.removeBackground(bg.id)}
                  >✕</button>
                </div>
              </div>
              <div class="bg-item-meta">
                <span>{Object.keys(bg.states || {}).length} state{Object.keys(bg.states || {}).length === 1 ? '' : 's'}</span>
                {#if bg.states?.default?.usePositions}
                  <span class="chip-pos">Positions</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </aside>

      <!-- Center Column: Visual Builder & Inspector -->
      <main class="builder-col">
        <!-- View Mode Switcher -->
        <div class="view-tabs">
          <button class="vtab {activeTab === 'builder' ? 'active' : ''}" on:click={() => (activeTab = 'builder')}>
            🛠 Visual Builder
          </button>
          <button class="vtab {activeTab === 'json' ? 'active' : ''}" on:click={() => (activeTab = 'json')}>
            &lt;/&gt; Live background.json
          </button>
        </div>

        {#if activeTab === 'builder'}
          <!-- State Variants Strip -->
          <div class="section-card">
            <div class="card-bar">
              <span class="bar-title">STATE VARIANTS</span>
              <div class="tabs-wrap">
                {#each Object.keys(activeBg?.states || {}) as stKey}
                  <button
                    class="state-tab {activeStateKey === stKey ? 'active' : ''}"
                    on:click={() => updateBg((bg) => (bg.activeState = stKey))}
                  >
                    {stKey}{stKey === 'default' ? ' ★' : ''}
                  </button>
                {/each}
                <button class="mini-btn add-btn" title="Add alternative state variant (e.g. crowded, festive)" on:click={addStateVariant}>+ State</button>
              </div>
            </div>

            {#if activeStateKey !== 'default'}
              <div class="state-manage-row">
                <span class="hint">Active variant: <code>{activeStateKey}</code></span>
                <button class="mini-btn danger" on:click={() => removeStateVariant(activeStateKey)}>Delete this state</button>
              </div>
            {/if}
          </div>

          <!-- Camera / Court Positions Mode -->
          <div class="section-card">
            <div class="card-bar">
              <label class="toggle-label" title="Enable courtroom/camera positions (Normal, Witness, Prosecution, etc.)">
                <input
                  type="checkbox"
                  checked={usePositions}
                  on:change={(e) => togglePositions(e.target.checked)}
                />
                <span class="toggle-text">Courtroom / Camera Positions</span>
              </label>

              {#if usePositions}
                <div class="pos-tabs">
                  {#each Object.keys(activeState?.positions || {}) as posKey}
                    <button
                      class="pos-tab {activePosKey === posKey ? 'active' : ''}"
                      on:click={() => updateBg((bg) => (bg.activePosition = posKey))}
                    >
                      {posKey}
                    </button>
                  {/each}
                  <button class="mini-btn add-btn" title="Add camera position" on:click={() => addPosition()}>+ Pos</button>
                </div>
              {/if}
            </div>

            {#if usePositions}
              <div class="pos-preset-strip">
                <span class="hint">Quick add:</span>
                <button class="preset-pill" on:click={() => addPosition('Normal')}>Normal</button>
                <button class="preset-pill" on:click={() => addPosition('Witness')}>Witness</button>
                <button class="preset-pill" on:click={() => addPosition('Prosecution')}>Prosecution</button>
                <button class="preset-pill" on:click={() => addPosition('Defense')}>Defense</button>
                <button class="preset-pill" on:click={() => addPosition('Judge')}>Judge</button>
                {#if activePosKey && activePosKey !== 'Normal'}
                  <button class="mini-btn danger" style="margin-left:auto" on:click={() => removePosition(activePosKey)}>Delete position</button>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Primary Asset Slots for Active Context -->
          <div class="slots-grid">
            <!-- Background Image -->
            <div
              class="slot-card"
              role="region"
              aria-label="Background image slot"
              on:dragover|preventDefault
              on:drop={(e) => onSlotDrop(e, 'background')}
            >
              <div class="slot-head">
                <span class="slot-title">★ Background Image</span>
                {#if activeBgVal}
                  <button class="icon-btn" title="Clear image" on:click={() => assignSlotAsset('background', '')}>✕</button>
                {/if}
              </div>

              {#if activeBgVal}
                <div class="slot-content has-asset">
                  {#if activeBgThumb}
                    <img src={activeBgThumb} alt={activeBgVal} class="slot-thumb" />
                  {:else}
                    <div class="no-thumb-box">🖼</div>
                  {/if}
                  <span class="asset-filename" title={activeBgVal}>{activeBgVal}</span>
                </div>
              {:else}
                <div class="slot-content empty-drop">
                  <span>Drop image here</span>
                  <span class="subtext">or pick from asset pool</span>
                </div>
              {/if}
            </div>

            <!-- Foreground Overlay Filter -->
            <div
              class="slot-card"
              role="region"
              aria-label="Foreground overlay slot"
              on:dragover|preventDefault
              on:drop={(e) => onSlotDrop(e, 'foreground')}
            >
              <div class="slot-head">
                <span class="slot-title">Foreground Overlay (Filter / Desk)</span>
                {#if activeFgVal}
                  <button class="icon-btn" title="Clear overlay" on:click={() => assignSlotAsset('foreground', '')}>✕</button>
                {/if}
              </div>

              {#if activeFgVal}
                <div class="slot-content has-asset">
                  {#if activeFgThumb}
                    <img src={activeFgThumb} alt={activeFgVal} class="slot-thumb" />
                  {:else}
                    <div class="no-thumb-box">🌫</div>
                  {/if}
                  <span class="asset-filename" title={activeFgVal}>{activeFgVal}</span>
                </div>
              {:else}
                <div class="slot-content empty-drop">
                  <span>Drop overlay image</span>
                  <span class="subtext">(optional filter or desk)</span>
                </div>
              {/if}
            </div>

            <!-- Ambience Audio -->
            <div
              class="slot-card"
              role="region"
              aria-label="Ambience audio slot"
              on:dragover|preventDefault
              on:drop={(e) => onSlotDrop(e, 'ambience')}
            >
              <div class="slot-head">
                <span class="slot-title">Ambience Audio (base/sounds/ambient/)</span>
                {#if activeAmbienceVal}
                  <button class="icon-btn" title="Clear sound" on:click={() => assignSlotAsset('ambience', '')}>✕</button>
                {/if}
              </div>

              {#if activeAmbienceVal}
                <div class="slot-content has-asset">
                  <div class="no-thumb-box audio">🎵</div>
                  <span class="asset-filename" title={activeAmbienceVal}>{activeAmbienceVal}</span>
                </div>
              {:else}
                <div class="slot-content empty-drop">
                  <span>Drop sound (.opus / .mp3)</span>
                  <span class="subtext">(optional ambient loop)</span>
                </div>
              {/if}
            </div>
          </div>

          <!-- Time of Day Variants -->
          <div class="section-card">
            <div class="card-bar">
              <span class="bar-title">TIME OF DAY VARIANTS (time_variants)</span>
              <div class="tod-btn-row">
                <button class="mini-btn" on:click={() => addTimeVariant('day')}>+ Day</button>
                <button class="mini-btn" on:click={() => addTimeVariant('evening')}>+ Evening</button>
                <button class="mini-btn" on:click={() => addTimeVariant('night')}>+ Night</button>
                <button class="mini-btn" on:click={() => addTimeVariant()}>+ Custom</button>
              </div>
            </div>

            {#if Object.keys(activeTimeVariants).length === 0}
              <div class="empty-hint">
                No time variants configured for this {usePositions ? 'position' : 'state'}. Background stays constant across all times of day.
              </div>
            {:else}
              <div class="tod-list">
                {#each Object.entries(activeTimeVariants) as [todKey, tv]}
                  <div class="tod-row-card">
                    <div class="tod-badge-col">
                      <span class="tod-badge">{todKey}</span>
                      <button class="icon-btn danger" title="Remove {todKey} variant" on:click={() => removeTimeVariant(todKey)}>✕</button>
                    </div>

                    <!-- Mini slots -->
                    <div
                      class="mini-slot"
                      role="region"
                      aria-label="Background slot for {todKey}"
                      title="Drop or click to set background for {todKey}"
                      on:dragover|preventDefault
                      on:drop={(e) => onSlotDrop(e, 'background', todKey)}
                    >
                      <span class="mslot-lbl">BG:</span>
                      <span class="mslot-val">{tv.background || 'Same as base'}</span>
                    </div>

                    <div
                      class="mini-slot"
                      role="region"
                      aria-label="Foreground slot for {todKey}"
                      title="Drop or click to set foreground overlay for {todKey}"
                      on:dragover|preventDefault
                      on:drop={(e) => onSlotDrop(e, 'foreground', todKey)}
                    >
                      <span class="mslot-lbl">FG:</span>
                      <span class="mslot-val">{tv.foreground || 'None'}</span>
                    </div>

                    <div
                      class="mini-slot"
                      role="region"
                      aria-label="Ambience audio slot for {todKey}"
                      title="Drop or click to set ambience audio for {todKey}"
                      on:dragover|preventDefault
                      on:drop={(e) => onSlotDrop(e, 'ambience', todKey)}
                    >
                      <span class="mslot-lbl">Audio:</span>
                      <span class="mslot-val">{tv.ambience || 'Same as base'}</span>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <!-- Raw JSON Editor / Code Inspector with Indent Controls -->
          <div class="json-inspect-wrap">
            <div class="json-bar">
              <div class="json-bar-left">
                <span class="json-bar-title">INDENT:</span>
                <select
                  class="indent-select"
                  title="Choose indentation style (number of spaces or tabs)"
                  value={jsonIndent}
                  on:change={(e) => {
                    const v = e.target.value;
                    jsonIndent = v === 'tab' ? 'tab' : Number(v);
                  }}
                >
                  <option value={4}>4 spaces (Default)</option>
                  <option value={2}>2 spaces</option>
                  <option value={3}>3 spaces</option>
                  <option value={8}>8 spaces</option>
                  <option value="tab">Tabs (\t)</option>
                  <option value={0}>Compact (0)</option>
                </select>

                {#if jsonIndent !== 'tab' && jsonIndent !== 0}
                  <div class="custom-indent-box" title="Custom indentation level">
                    <span class="hint">Spaces:</span>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      class="indent-num-input"
                      value={jsonIndent}
                      on:input={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 0 && val <= 16) jsonIndent = val;
                      }}
                    />
                  </div>
                {/if}
              </div>

              <div class="json-bar-right">
                <span class="json-lines-meta">{(bgJsonString.match(/\n/g) || []).length + 1} lines</span>
                <button
                  class="mini-btn"
                  title="Copy formatted JSON to clipboard"
                  on:click={() => { copyText(bgJsonString); notify('Copied background.json to clipboard'); }}
                >
                  📋 Copy JSON
                </button>
              </div>
            </div>

            <textarea
              class="json-area"
              readonly
              value={bgJsonString}
              spellcheck="false"
            ></textarea>
          </div>
        {/if}
      </main>

      <!-- Right Column: Interactive Stage & Live Monitor -->
      <aside class="stage-col">
        <div class="stage-monitor">
          <div class="monitor-header">
            <span class="mon-title">LIVE STAGE MONITOR</span>
            <span class="mon-live">LIVE</span>
          </div>

          <!-- Scaled Canvas Viewport -->
          <div class="canvas-viewport">
            {#if resolvedBgUrl}
              <img src={resolvedBgUrl} alt="Background" class="stage-bg-layer" />
            {:else}
              <div class="stage-fallback">
                <span class="stage-msg">No image assigned</span>
                <span class="stage-sub">{resolvedVisual.background || 'None'}</span>
              </div>
            {/if}

            {#if resolvedFgUrl}
              <img src={resolvedFgUrl} alt="Foreground" class="stage-fg-layer" />
            {/if}
          </div>

          <!-- Stage Controls -->
          <div class="stage-controls">
            <div class="ctrl-row">
              <span class="ctrl-label">Time of Day:</span>
              <div class="tod-pills">
                <button class="tod-pill {stageTod === 'day' ? 'active' : ''}" on:click={() => (stageTod = 'day')}>☀ Day</button>
                <button class="tod-pill {stageTod === 'evening' ? 'active' : ''}" on:click={() => (stageTod = 'evening')}>🌆 Evening</button>
                <button class="tod-pill {stageTod === 'night' ? 'active' : ''}" on:click={() => (stageTod = 'night')}>🌙 Night</button>
              </div>
            </div>

            <!-- Active Resolution Details -->
            <div class="stage-meta">
              <div class="meta-line">
                <span class="mkey">State:</span>
                <span class="mval">{activeStateKey}</span>
              </div>
              {#if usePositions}
                <div class="meta-line">
                  <span class="mkey">Position:</span>
                  <span class="mval">{activePosKey}</span>
                </div>
              {/if}
              <div class="meta-line">
                <span class="mkey">BG:</span>
                <span class="mval text-truncate">{resolvedVisual.background || '—'}</span>
              </div>
              <div class="meta-line">
                <span class="mkey">FG:</span>
                <span class="mval text-truncate">{resolvedVisual.foreground || '—'}</span>
              </div>
              <div class="meta-line">
                <span class="mkey">Ambience:</span>
                <span class="mval text-truncate">{resolvedVisual.ambience || '—'}</span>
              </div>
            </div>

            <!-- Ambience Player -->
            {#if resolvedVisual.ambience}
              <div class="audio-ctrl-box">
                <button class="play-btn {isPlayingAudio ? 'playing' : ''}" on:click={toggleAudio}>
                  {isPlayingAudio ? '⏸ Pause' : '▶ Play Ambience'}
                </button>
                <audio
                  bind:this={audioEl}
                  src={resolvedAmbienceUrl}
                  loop
                  on:ended={() => (isPlayingAudio = false)}
                  on:pause={() => (isPlayingAudio = false)}
                  on:play={() => (isPlayingAudio = true)}
                ></audio>
              </div>
            {/if}
          </div>
        </div>
      </aside>
    </div>

    <!-- Bottom Dock: Asset Repository & Drag-and-Drop Pool -->
    <section
      class="asset-pool-dock {isDraggingOverPool ? 'dragover' : ''}"
      aria-label="Asset repository pool"
      on:dragover={onPoolDragOver}
      on:dragleave={onPoolDragLeave}
      on:drop={onPoolDrop}
    >
      <div class="dock-bar">
        <div class="dock-left">
          <span class="dock-title">ASSET REPOSITORY POOL ({assetPool.length})</span>
          <div class="filter-pills">
            <button class="filter-pill {assetFilter === 'all' ? 'active' : ''}" on:click={() => (assetFilter = 'all')}>All ({assetPool.length})</button>
            <button class="filter-pill {assetFilter === 'image' ? 'active' : ''}" on:click={() => (assetFilter = 'image')}>Images ({assetPool.filter((a) => a.type === 'image').length})</button>
            <button class="filter-pill {assetFilter === 'audio' ? 'active' : ''}" on:click={() => (assetFilter = 'audio')}>Audio ({assetPool.filter((a) => a.type === 'audio').length})</button>
          </div>
          <input
            type="search"
            class="search-input"
            placeholder="Search assets..."
            bind:value={assetSearch}
          />
        </div>

        <div class="dock-actions">
          <button class="mini-btn" on:click={() => fileInputGeneral.click()}>+ Upload Files</button>
          <button class="mini-btn" on:click={() => fileInputFolder.click()}>+ Upload Folder</button>
          <input type="file" multiple hidden bind:this={fileInputGeneral} on:change={(e) => handleFiles(e.target.files)} />
          <input type="file" webkitdirectory multiple hidden bind:this={fileInputFolder} on:change={(e) => handleFiles(e.target.files)} />
        </div>
      </div>

      <!-- Assets Grid / Carousel Strip -->
      <div class="assets-strip">
        {#if filteredAssets.length === 0}
          <div class="dock-empty-msg">
            <span>Drag & drop images (.webp, .png, .jpg) or audio (.opus, .mp3) here to build without re-uploading.</span>
          </div>
        {:else}
          {#each filteredAssets as asset (asset.id)}
            <div
              class="asset-card"
              role="button"
              tabindex="0"
              draggable="true"
              title="Drag onto any slot: {asset.relPath} ({Math.round(asset.size / 1024)} KB)"
              on:dragstart={(e) => onAssetDragStart(e, asset)}
            >
              {#if asset.type === 'image'}
                <div class="card-thumb-wrap">
                  <img src={asset.url} alt={asset.name} class="asset-img" />
                </div>
              {:else}
                <div class="card-thumb-wrap audio">
                  <span>🎵</span>
                </div>
              {/if}
              <span class="asset-card-name">{asset.relPath || asset.name}</span>
            </div>
          {/each}
        {/if}
      </div>
    </section>
  </div>
</div>

<style>
  .bg-maker-modal {
    width: min(1320px, 96vw);
    height: 92vh;
    max-height: 92vh;
    padding: 16px 20px 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
  }

  .maker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
    flex-shrink: 0;
  }

  .head-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .maker-tag {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--accent);
  }

  .path-bar {
    display: flex;
    align-items: center;
    background: var(--input-bg);
    border: 1px solid var(--line2);
    border-radius: var(--radius);
    padding: 2px 8px;
    font-family: inherit;
    font-size: 12px;
    gap: 6px;
  }

  .folder-input {
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-strong);
    font-weight: 700;
    font-size: 12px;
    min-width: 240px;
    padding: 2px 4px;
  }
  .folder-input:focus {
    color: var(--accent);
  }

  .view-toggle-btn {
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: 3px;
    color: var(--dim);
    font-size: 10px;
    padding: 2px 6px;
    cursor: pointer;
    font-weight: 600;
  }
  .view-toggle-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .split-path-bar {
    display: flex;
    align-items: center;
    background: var(--input-bg);
    border: 1px solid var(--line2);
    border-radius: var(--radius);
    padding: 2px 6px;
    font-family: inherit;
    font-size: 12px;
    gap: 4px;
  }

  .prefix {
    color: var(--dim);
    user-select: none;
    font-size: 11.5px;
  }

  .subfolder-box {
    display: flex;
    align-items: center;
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 1px 3px;
  }

  .subfolder-input {
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-strong);
    font-weight: 700;
    font-size: 11.5px;
    min-width: 140px;
    padding: 2px 4px;
  }

  .subfolder-dropdown {
    background: transparent;
    border: none;
    outline: none;
    color: var(--dim);
    font-size: 11px;
    cursor: pointer;
    padding: 0 2px;
  }
  .subfolder-dropdown:hover {
    color: var(--accent);
  }

  .path-divider {
    color: var(--dim);
    font-weight: 800;
  }

  .bgname-input {
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: 3px;
    outline: none;
    color: var(--accent);
    font-weight: 800;
    font-size: 11.5px;
    min-width: 130px;
    padding: 3px 6px;
  }
  .bgname-input:focus, .subfolder-input:focus {
    border-color: var(--accent);
  }

  .bg-item-titles {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .bg-subfolder-tag {
    font-size: 9.5px;
    color: var(--dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.1;
  }

  .head-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-right: 32px;
  }

  .accent-btn {
    border-color: color-mix(in srgb, var(--accent) 70%, transparent);
    color: var(--accent);
  }
  .accent-btn:hover {
    background: var(--sel);
  }

  /* 3-Column Workspace */
  .maker-body {
    display: flex;
    gap: 14px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Left Column: Navigator */
  .bg-nav {
    width: 210px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel2);
    overflow: hidden;
  }

  .nav-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-bottom: 1px solid var(--line);
  }

  .nav-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--dim);
  }

  .bg-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .bg-item {
    padding: 8px 10px;
    border-radius: var(--radius);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .bg-item:hover {
    background: var(--input-bg);
  }

  .bg-item.active {
    background: var(--sel);
    border-color: color-mix(in srgb, var(--accent) 60%, transparent);
  }

  .bg-item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .bg-folder {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-strong);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-actions {
    display: flex;
    gap: 2px;
    opacity: 0.4;
  }
  .bg-item:hover .item-actions {
    opacity: 1;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--dim);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 4px;
    border-radius: 3px;
  }
  .icon-btn:hover {
    color: var(--text-strong);
    background: var(--line);
  }
  .icon-btn.danger:hover {
    color: var(--danger);
  }

  .bg-item-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: var(--dim);
    margin-top: 4px;
  }

  .chip-pos {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
    padding: 1px 4px;
    border-radius: 3px;
    font-weight: 700;
  }

  /* Center Column: Builder */
  .builder-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    padding-right: 4px;
    min-width: 0;
  }

  .view-tabs {
    display: flex;
    gap: 6px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 6px;
  }

  .vtab {
    background: transparent;
    border: 1px solid transparent;
    color: var(--dim);
    font-size: 12px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: var(--radius);
    cursor: pointer;
  }
  .vtab:hover {
    color: var(--text);
  }
  .vtab.active {
    background: var(--sel);
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  }

  .section-card {
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .bar-title {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--dim);
  }

  .tabs-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .state-tab, .pos-tab {
    background: var(--input-bg);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: var(--radius);
    cursor: pointer;
  }
  .state-tab.active, .pos-tab.active {
    background: var(--sel);
    border-color: var(--accent);
    color: var(--accent);
  }

  .add-btn {
    padding: 2px 6px;
    font-size: 11px;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-strong);
    cursor: pointer;
  }

  .pos-preset-strip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding-top: 4px;
    border-top: 1px dashed var(--line);
  }

  .preset-pill {
    background: var(--input-bg);
    border: 1px solid var(--line);
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--dim);
    cursor: pointer;
  }
  .preset-pill:hover {
    color: var(--text-strong);
    border-color: var(--line2);
  }

  /* Slots Grid */
  .slots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
  }

  .slot-card {
    background: var(--panel2);
    border: 1px dashed var(--line2);
    border-radius: var(--radius);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 0.12s ease;
  }
  .slot-card:hover {
    border-color: var(--accent);
  }

  .slot-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .slot-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--dim);
  }

  .slot-content {
    min-height: 52px;
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .slot-content.empty-drop {
    border: 1px dashed var(--line);
    background: var(--input-bg);
    flex-direction: column;
    justify-content: center;
    font-size: 11px;
    color: var(--dim);
    padding: 6px;
    text-align: center;
  }

  .subtext {
    font-size: 9.5px;
    color: var(--dim);
    opacity: 0.7;
  }

  .slot-thumb {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid var(--line);
    flex-shrink: 0;
  }

  .no-thumb-box {
    width: 48px;
    height: 48px;
    border-radius: 4px;
    background: var(--input-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }

  .asset-filename {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-strong);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Time variants */
  .tod-btn-row {
    display: flex;
    gap: 4px;
  }

  .tod-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tod-row-card {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 6px 8px;
  }

  .tod-badge-col {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 80px;
  }

  .tod-badge {
    background: var(--sel);
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
    text-transform: capitalize;
  }

  .mini-slot {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--panel2);
    border: 1px dashed var(--line);
    border-radius: 3px;
    padding: 3px 6px;
    font-size: 10.5px;
    overflow: hidden;
  }

  .mslot-lbl {
    color: var(--dim);
    font-weight: 700;
  }

  .mslot-val {
    color: var(--text-strong);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty-hint {
    font-size: 11px;
    color: var(--dim);
    padding: 8px;
    text-align: center;
  }

  .json-inspect-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }

  .json-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 6px 10px;
    flex-shrink: 0;
  }

  .json-bar-left, .json-bar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .json-bar-title {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--accent);
  }

  .indent-select {
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--text-strong);
    font-size: 11px;
    padding: 3px 6px;
  }

  .custom-indent-box {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
  }

  .indent-num-input {
    width: 44px;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--text-strong);
    font-size: 11px;
    padding: 2px 4px;
    text-align: center;
  }

  .json-lines-meta {
    font-size: 10.5px;
    color: var(--dim);
    font-family: var(--mono);
  }

  .json-area {
    flex: 1;
    min-height: 380px;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--text-strong);
    font-family: var(--mono);
    font-size: 11.5px;
    line-height: 1.5;
    padding: 10px;
    resize: none;
    outline: none;
  }

  /* Right Column: Stage Monitor */
  .stage-col {
    width: 320px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }

  .stage-monitor {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel2);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .monitor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .mon-title {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--dim);
  }

  .mon-live {
    font-size: 9px;
    font-weight: 800;
    background: #10b981;
    color: #fff;
    padding: 1px 5px;
    border-radius: 3px;
    letter-spacing: 0.08em;
  }

  .canvas-viewport {
    width: 100%;
    aspect-ratio: 16 / 9;
    border: 1px solid var(--line2);
    border-radius: var(--radius);
    background: #000;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stage-bg-layer {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .stage-fg-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  .stage-fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: var(--dim);
  }
  .stage-msg {
    font-size: 11px;
    font-weight: 700;
  }
  .stage-sub {
    font-size: 10px;
    opacity: 0.6;
  }

  .stage-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ctrl-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .ctrl-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--dim);
  }

  .tod-pills {
    display: flex;
    gap: 4px;
  }

  .tod-pill {
    background: var(--input-bg);
    border: 1px solid var(--line);
    font-size: 10.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius);
    color: var(--dim);
    cursor: pointer;
  }
  .tod-pill.active {
    background: var(--sel);
    border-color: var(--accent);
    color: var(--accent);
  }

  .stage-meta {
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 10.5px;
  }

  .meta-line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .mkey {
    color: var(--dim);
  }
  .mval {
    font-weight: 600;
    color: var(--text-strong);
  }
  .text-truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 190px;
  }

  .audio-ctrl-box {
    display: flex;
    align-items: center;
  }
  .play-btn {
    width: 100%;
    background: var(--sel);
    border: 1px solid var(--accent);
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    padding: 5px;
    border-radius: var(--radius);
    cursor: pointer;
  }
  .play-btn.playing {
    background: color-mix(in srgb, var(--accent) 30%, transparent);
  }

  /* Bottom Dock */
  .asset-pool-dock {
    border-top: 1px solid var(--line);
    padding-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
    background: var(--panel);
    transition: background 0.12s ease;
  }
  .asset-pool-dock.dragover {
    background: color-mix(in srgb, var(--accent) 8%, var(--panel));
  }

  .dock-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .dock-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .dock-title {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--accent);
  }

  .filter-pills {
    display: flex;
    gap: 3px;
  }

  .filter-pill {
    background: var(--input-bg);
    border: 1px solid var(--line);
    font-size: 10.5px;
    padding: 2px 7px;
    border-radius: 3px;
    color: var(--dim);
    cursor: pointer;
  }
  .filter-pill.active {
    background: var(--sel);
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 700;
  }

  .search-input {
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: 3px;
    font-size: 11px;
    padding: 2px 6px;
    color: var(--text-strong);
    width: 140px;
  }

  .dock-actions {
    display: flex;
    gap: 6px;
  }

  .assets-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 4px 2px 6px 2px;
    min-height: 84px;
    max-height: 100px;
  }

  .dock-empty-msg {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed var(--line);
    border-radius: var(--radius);
    padding: 12px;
    font-size: 11px;
    color: var(--dim);
  }

  .asset-card {
    flex-shrink: 0;
    width: 80px;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    cursor: grab;
    transition: transform 0.1s ease, border-color 0.1s ease;
  }
  .asset-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
  }

  .card-thumb-wrap {
    width: 70px;
    height: 48px;
    border-radius: 3px;
    overflow: hidden;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card-thumb-wrap.audio {
    font-size: 20px;
    background: var(--panel2);
  }

  .asset-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .asset-card-name {
    font-size: 9.5px;
    font-weight: 600;
    color: var(--text-strong);
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
  }
</style>
