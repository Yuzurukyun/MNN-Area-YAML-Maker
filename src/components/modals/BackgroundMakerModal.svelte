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
  import { bgStore, ensureUniqueBgFolder } from '../../lib/bgStore.js';
  import { autoscroll } from '../../lib/autoscroll.js';

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
  let poolCollapsed = false;

  // Variant & Template Modals
  let showAddTodModal = false;
  let newTodKey = 'day';
  let todCopyFromBase = true;

  let showAddStateModal = false;
  let newStateName = '';
  let stateCopySource = 'default';

  let showAddPositionModal = false;
  let newPosName = 'Witness';
  let posCopySource = '__active__';
  let posCopyTod = true;
  let selectedTplIdForPositions = '';

  let showManageTemplatesModal = false;
  let tplMenuOpen = false;
  let newTplName = '';
  let newTplDesc = '';

  let importMenuOpen = false;
  let navImportMenuOpen = false;

  // Purge menu & confirmation modal state
  let purgeMenuOpen = false;
  let showPurgeConfirmModal = false;
  let purgeTargetMode = 'unused'; // 'unused' | 'all'

  function openPurgeModal(mode = 'unused') {
    purgeTargetMode = mode;
    purgeMenuOpen = false;
    libraryMenuOpen = false;
    showPurgeConfirmModal = true;
  }

  async function executePurge() {
    showPurgeConfirmModal = false;
    if (purgeTargetMode === 'unused') {
      const count = await bgStore.purgeUnusedAssets();
      notify(`Purged ${count} unused asset(s).`, 'ok');
    } else if (purgeTargetMode === 'all') {
      const count = assetPool.length;
      await bgStore.clearAllAssets(true);
      notify(`Purged all ${count} asset(s). All background slots have been reset to empty.`, 'info');
    }
  }

  // Context Menu State
  let bgContextMenu = null; // { x, y, title, items: Array<{ label, icon, run, disabled, danger, separator }> }

  function openContextMenu(e, items, title = 'OPTIONS') {
    e.preventDefault();
    e.stopPropagation();
    const menuW = 230;
    const menuH = items.length * 28 + 36;
    const x = Math.min(e.clientX, window.innerWidth - menuW - 14);
    const y = Math.min(e.clientY, window.innerHeight - menuH - 14);
    bgContextMenu = { x: Math.max(10, x), y: Math.max(10, y), title, items };
  }

  function closeContextMenu() {
    bgContextMenu = null;
  }

  // Scrim Drag-Out Protection (Prevents text selection from accidentally closing modals)
  let scrimMouseDownTarget = null;
  function onScrimMouseDown(e) {
    scrimMouseDownTarget = e.target;
  }
  function handleScrimClose(e, closeFn) {
    if (scrimMouseDownTarget === e.currentTarget && e.target === e.currentTarget) {
      closeFn();
    }
    scrimMouseDownTarget = null;
  }

  // Lightbox Preview Modal State
  let inspectModalAsset = null; // { name, url, type, size, relPath, id }
  let inspectSlotContext = null; // { slotType, todKey } or null
  let inspectGlobalName = '';
  let inspectExportName = '';

  function inspectAsset(assetOrName, displayName = '', type = 'image', slotContext = null) {
    closeContextMenu();
    inspectSlotContext = slotContext;

    if (typeof assetOrName === 'object' && assetOrName !== null) {
      inspectModalAsset = { ...assetOrName };
    } else if (typeof assetOrName === 'string') {
      const matched = assetPool.find((a) => a.name === assetOrName || a.relPath === assetOrName);
      if (matched) {
        inspectModalAsset = { ...matched };
      } else {
        const url = bgStore.getAssetUrl(assetOrName, type, activeBg);
        inspectModalAsset = {
          name: displayName || assetOrName,
          url: url || assetOrName,
          type,
          size: 0,
          relPath: assetOrName,
        };
      }
    }

    if (inspectModalAsset) {
      const sourceName = activeBg?.assetSources?.[inspectModalAsset.name] || inspectModalAsset.name;
      inspectGlobalName = sourceName;

      // Determine export name for this background
      if (slotContext?.slotType) {
        const targetObj = slotContext.todKey
          ? (usePositions ? activePos?.time_variants?.[slotContext.todKey] : activeState?.time_variants?.[slotContext.todKey])
          : (usePositions ? activePos : activeState);
        inspectExportName = targetObj?.[slotContext.slotType] || inspectModalAsset.name;
      } else {
        let assignedExport = null;
        if (activeBg?.assetSources) {
          for (const [expName, srcName] of Object.entries(activeBg.assetSources)) {
            if (srcName === sourceName) {
              assignedExport = expName;
              break;
            }
          }
        }
        inspectExportName = assignedExport || inspectModalAsset.name;
      }
    }
  }

  async function applyInspectGlobalRename() {
    if (!inspectModalAsset || !inspectGlobalName) return;
    const clean = inspectGlobalName.trim();
    if (!clean) return;

    const oldName = activeBg?.assetSources?.[inspectModalAsset.name] || inspectModalAsset.name;
    if (clean === oldName) return;

    const poolAsset = assetPool.find((a) => a.id === inspectModalAsset.id || a.name === oldName || a.relPath === oldName || a.name === inspectModalAsset.name || a.relPath === inspectModalAsset.name);
    if (poolAsset) {
      const res = await bgStore.renameAsset(poolAsset.id, clean);
      if (!res.success) {
        notify(res.error || 'Failed to rename global asset', 'warn');
        inspectGlobalName = oldName;
        return;
      }
      inspectModalAsset.id = poolAsset.id;
      inspectModalAsset.name = clean;
      inspectModalAsset.relPath = clean;
      notify(`Renamed asset to "${clean}" globally across all backgrounds and nodes.`, 'ok');
    } else {
      updateBg((bg) => {
        bg.assetSources = bg.assetSources || {};
        for (const [k, v] of Object.entries(bg.assetSources)) {
          if (v === oldName || v === inspectModalAsset.name) bg.assetSources[k] = clean;
        }
        function updateSlots(obj) {
          if (!obj) return;
          if (obj.background === oldName || obj.background === inspectModalAsset.name) obj.background = clean;
          if (obj.foreground === oldName || obj.foreground === inspectModalAsset.name) obj.foreground = clean;
          if (obj.ambience === oldName || obj.ambience === inspectModalAsset.name) obj.ambience = clean;
          if (obj.positions) {
            for (const p of Object.values(obj.positions)) updateSlots(p);
          }
          if (obj.time_variants) {
            for (const tv of Object.values(obj.time_variants)) updateSlots(tv);
          }
        }
        for (const st of Object.values(bg.states || {})) updateSlots(st);
      });
      inspectModalAsset.name = clean;
      inspectModalAsset.relPath = clean;
      notify(`Updated asset reference to "${clean}".`, 'ok');
    }
  }

  function applyInspectExportRename() {
    if (!activeBg || !inspectExportName) return;
    const clean = inspectExportName.trim();
    if (!clean) return;

    if (inspectSlotContext?.slotType) {
      setSlotExportName(inspectSlotContext.slotType, clean, inspectSlotContext.todKey);
      inspectModalAsset.name = clean;
    } else {
      const targetObj = usePositions ? activePos : activeState;
      let foundSlot = null;
      if (targetObj) {
        for (const st of ['background', 'foreground', 'ambience']) {
          if (targetObj[st] === inspectGlobalName || targetObj[st] === inspectModalAsset?.name || activeBg.assetSources?.[targetObj[st]] === inspectGlobalName) {
            foundSlot = st;
            break;
          }
        }
      }
      if (foundSlot) {
        setSlotExportName(foundSlot, clean);
        inspectModalAsset.name = clean;
      } else {
        updateBg((bg) => {
          bg.assetSources = bg.assetSources || {};
          bg.assetSources[clean] = inspectGlobalName || inspectModalAsset.name;
        });
        inspectModalAsset.name = clean;
        notify(`Registered export alias "${clean}" for "${inspectGlobalName}".`, 'ok');
      }
    }
  }

  // Rename Dialog State
  let showRenameModal = false;
  let renameModalConfig = {
    title: 'Rename',
    label: 'New Name:',
    hint: '',
    placeholder: '',
    value: '',
    onConfirm: async () => ({ success: true }),
  };
  let renameInputValue = '';
  let renameModalError = '';

  function openRenameDialog(cfg) {
    closeContextMenu();
    renameModalConfig = cfg;
    renameInputValue = cfg.value || '';
    renameModalError = '';
    showRenameModal = true;
  }

  async function submitRenameModal() {
    const val = renameInputValue.trim();
    if (!val) {
      renameModalError = 'Name cannot be empty.';
      return;
    }
    const res = await renameModalConfig.onConfirm(val);
    if (res && res.error) {
      renameModalError = res.error;
      return;
    }
    showRenameModal = false;
  }

  // Global Asset Renaming
  function triggerRenameAsset(asset) {
    openRenameDialog({
      title: '✏️ Rename Asset (Global)',
      label: 'Asset Filename:',
      hint: `Renaming "${asset.name}" will update all backgrounds, states, and area nodes referencing it.`,
      placeholder: 'e.g. hallway_dark.png',
      value: asset.name,
      onConfirm: async (newName) => {
        const res = await bgStore.renameAsset(asset.id, newName);
        if (!res.success) return { error: res.error };
        notify(`Renamed asset to "${newName}" across all backgrounds and nodes.`, 'ok');
        return { success: true };
      },
    });
  }

  // Local Slot Override Renaming (Per-Background Export Name)
  function triggerRenameSlotExport(slotType, todKey = null) {
    if (!activeBg) return;
    const targetObj = todKey
      ? (usePositions ? activePos?.time_variants?.[todKey] : activeState?.time_variants?.[todKey])
      : (usePositions ? activePos : activeState);
    if (!targetObj) return;

    const currentVal = targetObj[slotType];
    if (!currentVal) return;

    const sourceName = activeBg.assetSources?.[currentVal] || currentVal;

    openRenameDialog({
      title: `✏️ Rename Export Filename (${slotType}${todKey ? ' @ ' + todKey : ''})`,
      label: 'Export Filename for this Background:',
      hint: `Customizes the filename written into background.json and package ZIP for this background only. The asset "${sourceName}" in the pool is unchanged.`,
      placeholder: 'e.g. cafeteria_night.png',
      value: currentVal,
      onConfirm: (newExportName) => {
        setSlotExportName(slotType, newExportName, todKey);
        return { success: true };
      },
    });
  }

  function setSlotExportName(slotType, newName, todKey = null) {
    if (!activeBg) return;
    const cleanName = (newName || '').trim();
    if (!cleanName) return;

    updateBg((bg) => {
      bg.assetSources = bg.assetSources || {};
      const targetObj = todKey
        ? (usePositions ? activePos?.time_variants?.[todKey] : activeState?.time_variants?.[todKey])
        : (usePositions ? activePos : activeState);

      if (!targetObj) return;
      const oldVal = targetObj[slotType];
      if (!oldVal || oldVal === cleanName) return;

      const originalSource = bg.assetSources[oldVal] || oldVal;
      bg.assetSources[cleanName] = originalSource;
      if (oldVal !== originalSource) {
        delete bg.assetSources[oldVal];
      }
      targetObj[slotType] = cleanName;
    });
    notify(`Set export filename for ${slotType} to "${cleanName}".`, 'ok');
  }

  function resetSlotToSourceName(slotType, todKey = null) {
    if (!activeBg || !activeBg.assetSources) return;
    updateBg((bg) => {
      const targetObj = todKey
        ? (usePositions ? activePos?.time_variants?.[todKey] : activeState?.time_variants?.[todKey])
        : (usePositions ? activePos : activeState);
      if (!targetObj) return;
      const curVal = targetObj[slotType];
      if (bg.assetSources && bg.assetSources[curVal]) {
        const originalSource = bg.assetSources[curVal];
        delete bg.assetSources[curVal];
        targetObj[slotType] = originalSource;
        notify(`Reset ${slotType} back to asset name "${originalSource}".`, 'info');
      }
    });
  }

  // Context Menu Openers
  function openAssetContextMenu(e, asset) {
    const isImg = asset.type === 'image';
    const isAud = asset.type === 'audio';
    const serverPath = isAud
      ? `base/sounds/ambient/${asset.name}`
      : `base/background/${activeBg?.folder || 'Background'}/${asset.name}`;

    openContextMenu(e, [
      {
        label: 'Rename Asset (Global)…',
        icon: '✏️',
        run: () => triggerRenameAsset(asset),
      },
      {
        label: 'Inspect Asset Preview',
        icon: '🔍',
        run: () => inspectAsset(asset),
      },
      { separator: true },
      {
        label: 'Assign as Background Image',
        icon: '🖼️',
        disabled: !isImg,
        run: () => assignSlotAsset('background', asset.name),
      },
      {
        label: 'Assign as Foreground Overlay',
        icon: '🌫️',
        disabled: !isImg,
        run: () => assignSlotAsset('foreground', asset.name),
      },
      {
        label: 'Assign as Ambience Audio',
        icon: '🎵',
        disabled: !isAud,
        run: () => assignSlotAsset('ambience', asset.name),
      },
      { separator: true },
      {
        label: 'Copy Filename',
        icon: '📋',
        run: () => { copyText(asset.name); notify(`Copied "${asset.name}".`, 'ok'); },
      },
      {
        label: 'Copy Server Path',
        icon: '📋',
        run: () => { copyText(serverPath); notify(`Copied path.`, 'ok'); },
      },
      { separator: true },
      {
        label: 'Delete from Pool',
        icon: '🗑️',
        danger: true,
        run: async () => {
          await bgStore.deleteAsset(asset.id);
          notify(`Removed "${asset.name}" from pool.`, 'info');
        },
      },
    ], `ASSET: ${asset.name}`);
  }

  function openSlotContextMenu(e, slotType, todKey = null) {
    const targetObj = todKey
      ? (usePositions ? activePos?.time_variants?.[todKey] : activeState?.time_variants?.[todKey])
      : (usePositions ? activePos : activeState);
    const curVal = targetObj ? targetObj[slotType] : '';
    const isAudio = slotType === 'ambience';
    const hasAsset = Boolean(curVal);
    const hasAlias = Boolean(activeBg?.assetSources?.[curVal]);
    const sourceName = hasAlias ? activeBg.assetSources[curVal] : curVal;

    const items = [];
    if (hasAsset) {
      items.push({
        label: 'Rename Export Filename…',
        icon: '✏️',
        run: () => triggerRenameSlotExport(slotType, todKey),
      });
      if (hasAlias) {
        items.push({
          label: `Reset to Asset Name (${sourceName})`,
          icon: '🔄',
          run: () => resetSlotToSourceName(slotType, todKey),
        });
      }
      items.push({
        label: 'Inspect Asset Preview',
        icon: '🔍',
        run: () => inspectAsset(sourceName, curVal, isAudio ? 'audio' : 'image'),
      });
      items.push({ separator: true });
      items.push({
        label: 'Copy Filename',
        icon: '📋',
        run: () => { copyText(curVal); notify(`Copied "${curVal}".`, 'ok'); },
      });
      items.push({
        label: 'Copy Server Path',
        icon: '📋',
        run: () => {
          const path = isAudio ? `base/sounds/ambient/${curVal}` : `base/background/${activeBg?.folder || 'Background'}/${curVal}`;
          copyText(path);
          notify(`Copied path.`, 'ok');
        },
      });
      items.push({ separator: true });
      items.push({
        label: todKey ? 'Clear Override (Use Base)' : 'Clear Slot',
        icon: '✕',
        danger: true,
        run: () => assignSlotAsset(slotType, '', todKey),
      });
    } else {
      const candidates = isAudio ? availableAudios : availableImages;
      items.push({
        label: candidates.length > 0 ? `Pick from Pool (${candidates.length} available)` : 'No matching assets in pool',
        icon: '▾',
        disabled: candidates.length === 0,
        run: () => {
          if (candidates.length > 0) {
            assignSlotAsset(slotType, candidates[0].relPath || candidates[0].name, todKey);
          }
        },
      });
      items.push({
        label: 'Upload File to this Slot…',
        icon: '📥',
        run: () => fileInputGeneral && fileInputGeneral.click(),
      });
    }

    const titlePrefix = slotType === 'background' ? 'BACKGROUND' : (slotType === 'foreground' ? 'FOREGROUND' : 'AMBIENCE');
    openContextMenu(e, items, `${titlePrefix} SLOT${todKey ? ' (' + todKey + ')' : ''}`);
  }

  function openBgContextMenu(e, bg) {
    openContextMenu(e, [
      {
        label: 'Duplicate Background',
        icon: '📋',
        run: () => bgStore.duplicateBackground(bg.id),
      },
      {
        label: 'Rename Folder Path…',
        icon: '✏️',
        run: () => {
          openRenameDialog({
            title: '✏️ Rename Background Folder',
            label: 'Folder Path (e.g. Umamusume/Library):',
            hint: 'Server folder path relative to base/background/.',
            placeholder: 'Series/Room',
            value: bg.folder,
            onConfirm: (newFolder) => bgStore.renameBackgroundFolder(bg.id, newFolder),
          });
        },
      },
      { separator: true },
      {
        label: 'Export background.json',
        icon: '💾',
        run: () => {
          const json = serializeBackgroundJson(bg);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'background.json';
          a.click();
          URL.revokeObjectURL(url);
        },
      },
      {
        label: 'Export Package (.zip)',
        icon: '📦',
        run: () => bgStore.exportZip(bg.id),
      },
      { separator: true },
      {
        label: 'Delete Background',
        icon: '🗑️',
        danger: true,
        disabled: backgrounds.length <= 1,
        run: () => removeBackground(bg.id),
      },
    ], `BACKGROUND: ${bg.folder}`);
  }

  function openStateContextMenu(e, stKey) {
    const isDefault = stKey === 'default';
    openContextMenu(e, [
      {
        label: 'Duplicate State Variant',
        icon: '📋',
        run: () => bgStore.duplicateState(activeBg.id, stKey),
      },
      {
        label: 'Rename State…',
        icon: '✏️',
        disabled: isDefault,
        title: isDefault ? 'The default state cannot be renamed.' : '',
        run: () => {
          openRenameDialog({
            title: `✏️ Rename State "${stKey}"`,
            label: 'New State Key:',
            hint: 'Alternative visual state key in background.json (e.g. crowded, dark, festive).',
            placeholder: 'e.g. night_festive',
            value: stKey,
            onConfirm: (newName) => {
              const clean = newName.trim();
              if (activeBg.states[clean]) return { error: `State "${clean}" already exists.` };
              updateBg((bg) => {
                bg.states[clean] = bg.states[stKey];
                delete bg.states[stKey];
                if (bg.activeState === stKey) bg.activeState = clean;
              });
              return { success: true };
            },
          });
        },
      },
      { separator: true },
      {
        label: 'Delete State',
        icon: '🗑️',
        danger: true,
        disabled: isDefault,
        title: isDefault ? 'The default state cannot be deleted.' : '',
        run: () => removeStateVariant(stKey),
      },
    ], `STATE: ${stKey}`);
  }

  function openTodContextMenu(e, todKey) {
    openContextMenu(e, [
      {
        label: 'Duplicate Time Variant',
        icon: '📋',
        run: () => bgStore.duplicateTimeVariant(activeBg.id, activeStateKey, activePosKey, todKey),
      },
      {
        label: 'Rename Time Variant Key…',
        icon: '✏️',
        run: () => {
          openRenameDialog({
            title: `✏️ Rename Time of Day "${todKey}"`,
            label: 'Time Key:',
            hint: 'Time-of-day key in background.json (e.g. day, evening, night, morning).',
            placeholder: 'e.g. midnight',
            value: todKey,
            onConfirm: (newName) => {
              const clean = newName.trim();
              const targetObj = usePositions ? activePos : activeState;
              if (targetObj.time_variants[clean]) return { error: `Variant "${clean}" already exists.` };
              updateBg((bg) => {
                const st = bg.states[activeStateKey];
                const tObj = usePositions ? st.positions[activePosKey] : st;
                tObj.time_variants[clean] = tObj.time_variants[todKey];
                delete tObj.time_variants[todKey];
                if (bg.activeTod === todKey) bg.activeTod = clean;
              });
              return { success: true };
            },
          });
        },
      },
      {
        label: 'Clear All Overrides (Reset to Base)',
        icon: '✕',
        run: () => {
          updateBg((bg) => {
            const st = bg.states[activeStateKey];
            const tObj = usePositions ? st.positions[activePosKey] : st;
            if (tObj.time_variants?.[todKey]) {
              tObj.time_variants[todKey] = { background: '', foreground: '', ambience: '' };
            }
          });
          notify(`Cleared slot overrides for "${todKey}".`, 'info');
        },
      },
      { separator: true },
      {
        label: 'Delete Time Variant',
        icon: '🗑️',
        danger: true,
        run: () => removeTimeVariant(todKey),
      },
    ], `TIME VARIANT: ${todKey}`);
  }

  function openStageContextMenu(e) {
    openContextMenu(e, [
      {
        label: stageFitMode === 'contain' ? 'Switch to Fit: Cover (Fill Screen)' : 'Switch to Fit: Contain (Letterbox)',
        icon: '🖼️',
        run: () => {
          stageFitMode = stageFitMode === 'contain' ? 'cover' : 'contain';
          notify(`Stage fit mode: ${stageFitMode}`, 'info');
        },
      },
      {
        label: 'Inspect Stage Image Preview',
        icon: '🔍',
        disabled: !resolvedVisual.background,
        run: () => inspectAsset(resolvedVisual.background, `${activeBg?.folder || 'Scene'} [${stageTod}]`, 'image'),
      },
      { separator: true },
      {
        label: 'Copy Live Visual Config JSON',
        icon: '📋',
        run: () => {
          copyText(JSON.stringify(resolvedVisual, null, 2));
          notify('Copied resolved visual JSON to clipboard.', 'ok');
        },
      },
    ], 'STAGE MONITOR');
  }

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

  // Stage Aspect Ratio & letterbox state
  let stageAspectPreset = '16:9'; // '16:9' | '4:3' | '21:9' | '1:1' | 'auto' | 'custom'
  let stageAspectW = 16;
  let stageAspectH = 9;
  let stageNaturalW = 0;
  let stageNaturalH = 0;
  let stageFitMode = 'contain'; // 'contain' (letterbox with black bars) | 'cover'

  function onStageImageLoad(e) {
    if (e.target) {
      stageNaturalW = e.target.naturalWidth || 0;
      stageNaturalH = e.target.naturalHeight || 0;
      if (stageAspectPreset === 'auto' && stageNaturalW && stageNaturalH) {
        stageAspectW = stageNaturalW;
        stageAspectH = stageNaturalH;
      }
    }
  }

  function setAspectPreset(preset) {
    stageAspectPreset = preset;
    if (preset === '16:9') {
      stageAspectW = 16;
      stageAspectH = 9;
    } else if (preset === '4:3') {
      stageAspectW = 4;
      stageAspectH = 3;
    } else if (preset === '21:9') {
      stageAspectW = 21;
      stageAspectH = 9;
    } else if (preset === '1:1') {
      stageAspectW = 1;
      stageAspectH = 1;
    } else if (preset === 'auto') {
      if (stageNaturalW && stageNaturalH) {
        stageAspectW = stageNaturalW;
        stageAspectH = stageNaturalH;
      }
    }
  }

  function onAspectCustomChange(w, h) {
    stageAspectPreset = 'custom';
    if (typeof w === 'number' && w > 0) stageAspectW = w;
    if (typeof h === 'number' && h > 0) stageAspectH = h;
  }

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

  $: resolvedBgUrl = bgStore.getAssetUrl(resolvedVisual.background, 'image', activeBg);
  $: resolvedFgUrl = bgStore.getAssetUrl(resolvedVisual.foreground, 'image', activeBg);
  $: resolvedAmbienceUrl = bgStore.getAssetUrl(resolvedVisual.ambience, 'audio', activeBg);

  // Slot values for active context
  $: activeBgVal = usePositions ? activePos?.background : activeState?.background;
  $: activeBgThumb = bgStore.getAssetUrl(activeBgVal, 'image', activeBg);
  $: activeFgVal = usePositions ? activePos?.foreground : activeState?.foreground;
  $: activeFgThumb = bgStore.getAssetUrl(activeFgVal, 'image', activeBg);
  $: activeAmbienceVal = usePositions ? activePos?.ambience : activeState?.ambience;
  $: activeTimeVariants = usePositions ? (activePos?.time_variants || {}) : (activeState?.time_variants || {});

  // Folder splitting & smart prefix management
  function splitFolderPath(folder) {
    if (!folder || typeof folder !== 'string') {
      return { subfolder: '', name: '' };
    }
    let s = folder.trim().replace(/\\/g, '/');
    s = s.replace(/^(\.\/)?(base\/)?background\//i, '');
    s = s.replace(/^\/+/, '');
    const lastSlash = s.lastIndexOf('/');
    if (lastSlash === -1) {
      return { subfolder: '', name: s };
    }
    return {
      subfolder: s.slice(0, lastSlash),
      name: s.slice(lastSlash + 1),
    };
  }

  $: currentFolderParts = splitFolderPath(activeBg?.folder || '');
  $: activeSubfolder = currentFolderParts.subfolder;
  $: activeBgName = currentFolderParts.name;

  $: isDuplicatePath = backgrounds.some(
    (b) => b.id !== activeBg?.id && normalizeBgPath(b.folder).toLowerCase() === normalizeBgPath(activeBg?.folder || '').toLowerCase()
  );

  function onSubfolderChange(newSub) {
    let s = (newSub || '').trim().replace(/\\/g, '/').replace(/^(\.\/)?(base\/)?background\//i, '').replace(/^\/+/, '');
    s = s.replace(/\/+$/, '');
    const newFull = s ? `${s}/${activeBgName}` : activeBgName;
    updateBg((bg) => (bg.folder = newFull));
  }

  function onBgNameChange(newName) {
    let s = (newName || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    const newFull = activeSubfolder ? `${activeSubfolder}/${s}` : s;
    updateBg((bg) => (bg.folder = newFull));
  }

  function onPathBlur() {
    if (activeBg) {
      const unique = ensureUniqueBgFolder(activeBg.folder, activeBg.id);
      if (unique !== activeBg.folder) {
        updateBg((bg) => (bg.folder = unique));
        notify(`Duplicate path collision avoided — renamed to "${unique}".`, 'warn');
      }
    }
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

  // Known time-of-day keys and states gathered across library, project areas & presets
  $: allKnownTodKeys = (() => {
    const set = new Set();
    for (const b of backgrounds) {
      for (const st of Object.values(b.states || {})) {
        for (const k of Object.keys(st.time_variants || {})) set.add(k.toLowerCase());
        for (const pos of Object.values(st.positions || {})) {
          for (const k of Object.keys(pos.time_variants || {})) set.add(k.toLowerCase());
        }
      }
    }
    for (const ar of $state.project.areas) {
      for (const [k] of ar.tod || []) {
        if (k) set.add(k.toLowerCase());
      }
    }
    return Array.from(set).sort();
  })();

  const stdPresets = new Set(['day', 'evening', 'night', 'morning', 'dawn', 'dusk', 'midnight']);
  $: otherKnownTodKeys = allKnownTodKeys.filter((k) => !stdPresets.has(k));

  $: allKnownStates = (() => {
    const set = new Set();
    for (const b of backgrounds) {
      for (const k of Object.keys(b.states || {})) {
        if (k !== 'default') set.add(k);
      }
    }
    return Array.from(set).sort();
  })();

  const stdStates = new Set(['crowded', 'festive', 'rainy', 'damaged', 'ruined', 'empty', 'dim', 'night', 'clean']);
  $: otherKnownStates = allKnownStates.filter((s) => !stdStates.has(s));

  // Known camera positions gathered across templates, presets & library
  const stdCourtroomPositions = [
    'Normal',
    'Witness',
    'Prosecution',
    'Defense',
    'Judge',
    'Counsel',
    'Gallery',
    'Jury',
    'Bench',
    'Wide',
  ];

  $: allTemplatePositions = (() => {
    const set = new Set();
    for (const tpl of storeState.templates || []) {
      if (tpl.structure?.positions && typeof tpl.structure.positions === 'object') {
        for (const k of Object.keys(tpl.structure.positions)) {
          if (k) set.add(k);
        }
      }
    }
    return Array.from(set).sort();
  })();

  $: allLibraryPositions = (() => {
    const set = new Set();
    for (const b of backgrounds) {
      for (const st of Object.values(b.states || {})) {
        if (st.positions && typeof st.positions === 'object') {
          for (const k of Object.keys(st.positions)) {
            if (k) set.add(k);
          }
        }
      }
    }
    return Array.from(set).sort();
  })();

  $: otherKnownPositionKeys = (() => {
    const stdSet = new Set(stdCourtroomPositions);
    const combined = new Set([...allTemplatePositions, ...allLibraryPositions]);
    for (const s of stdSet) combined.delete(s);
    return Array.from(combined).sort();
  })();

  $: positionTemplates = (storeState.templates || []).filter(
    (t) => t.structure?.positions && Object.keys(t.structure.positions).length > 0
  );

  function updateBg(mutator) {
    bgStore.updateActiveBg((bg) => {
      mutator(bg);
      return bg;
    });
  }

  // State variant actions
  function openAddStateModal() {
    const existing = new Set(Object.keys(activeBg?.states || {}).map((k) => k.toLowerCase()));
    const common = ['crowded', 'festive', 'rainy', 'damaged', 'ruined', 'empty', 'dim', 'night', 'clean'];
    newStateName = common.find((c) => !existing.has(c)) || '';
    stateCopySource = activeStateKey || 'default';
    showAddStateModal = true;
  }

  function confirmAddState() {
    const clean = newStateName.trim();
    if (!clean || clean.toLowerCase() === 'default') return;

    updateBg((bg) => {
      if (!bg.states) bg.states = {};
      const srcState = bg.states[stateCopySource];
      if (srcState && stateCopySource !== 'blank') {
        const cloned = JSON.parse(JSON.stringify(srcState));
        cloned.name = clean;
        bg.states[clean] = cloned;
      } else {
        bg.states[clean] = createStateVariant(clean, {
          background: '',
          usePositions: false,
        });
      }
      bg.activeState = clean;
    });

    showAddStateModal = false;
    notify(`Created state "${clean}".`, 'ok');
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

  function openAddPositionModal() {
    const existing = new Set(Object.keys(activeState?.positions || {}));
    const nextPreset =
      stdCourtroomPositions.find((p) => !existing.has(p)) ||
      otherKnownPositionKeys.find((p) => !existing.has(p)) ||
      'Custom';
    newPosName = nextPreset;
    posCopySource = activePosKey || '__active__';
    posCopyTod = true;
    if (positionTemplates.length > 0 && !selectedTplIdForPositions) {
      selectedTplIdForPositions = positionTemplates[0].id;
    }
    showAddPositionModal = true;
  }

  function confirmAddPosition() {
    const clean = newPosName.trim();
    if (!clean) return;

    updateBg((bg) => {
      const st = bg.states[bg.activeState || 'default'];
      if (!st) return;
      if (!st.positions) st.positions = {};

      let initialBg = '';
      let initialFg = '';
      let initialAmb = '';
      let initialTods = {};

      const effectiveSource = posCopySource === '__active__' ? activePosKey : posCopySource;

      if (effectiveSource === '__base__') {
        initialBg = st.background || '';
        initialFg = st.foreground || '';
        initialAmb = st.ambience || '';
        if (posCopyTod && st.time_variants) {
          initialTods = JSON.parse(JSON.stringify(st.time_variants));
        }
      } else if (effectiveSource !== 'blank' && st.positions[effectiveSource]) {
        const srcPos = st.positions[effectiveSource];
        initialBg = srcPos.background || '';
        initialFg = srcPos.foreground || '';
        initialAmb = srcPos.ambience || '';
        if (posCopyTod && srcPos.time_variants) {
          initialTods = JSON.parse(JSON.stringify(srcPos.time_variants));
        }
      }

      st.positions[clean] = createPosition(clean, {
        background: initialBg,
        foreground: initialFg,
        ambience: initialAmb,
        time_variants: initialTods,
      });
      st.usePositions = true;
      bg.activePosition = clean;
    });

    showAddPositionModal = false;
    notify(`Added camera position "${clean}".`, 'ok');
  }

  function importPositionsFromTemplate(tpl) {
    if (!tpl || !tpl.structure || !tpl.structure.positions) return;
    const posEntries = Object.entries(tpl.structure.positions);
    if (posEntries.length === 0) return;

    updateBg((bg) => {
      const st = bg.states[bg.activeState || 'default'];
      if (!st) return;
      if (!st.positions) st.positions = {};
      for (const [posKey, posData] of posEntries) {
        if (!st.positions[posKey]) {
          st.positions[posKey] = createPosition(posKey, {
            background: posData.background || '',
            foreground: posData.foreground || '',
            ambience: posData.ambience || '',
            time_variants: posData.time_variants ? JSON.parse(JSON.stringify(posData.time_variants)) : {},
          });
        }
      }
      st.usePositions = true;
      if (!st.positions[bg.activePosition]) {
        bg.activePosition = posEntries[0][0];
      }
    });

    showAddPositionModal = false;
    notify(`Imported ${posEntries.length} camera position(s) from template "${tpl.name}".`, 'ok');
  }

  function duplicatePosition(posKey) {
    const dupKey = bgStore.duplicatePosition(activeBg.id, activeStateKey, posKey);
    if (dupKey) {
      notify(`Duplicated camera position "${posKey}" to "${dupKey}".`, 'ok');
    }
  }

  function triggerRenamePosition(posKey) {
    openRenameDialog({
      title: '🎥 Rename Camera Position',
      label: 'Position Name:',
      hint: `Change camera angle label from "${posKey}".`,
      placeholder: 'e.g. Witness, Prosecution, Judge',
      value: posKey,
      onConfirm: (newName) => {
        const clean = newName.trim();
        if (!clean) return { error: 'Position name cannot be empty.' };
        if (clean === posKey) return { success: true };
        const positions = activeState?.positions || {};
        if (positions[clean]) {
          return { error: `Position "${clean}" already exists.` };
        }
        updateBg((bg) => {
          const st = bg.states[bg.activeState || 'default'];
          if (!st || !st.positions || !st.positions[posKey]) return;
          const posData = st.positions[posKey];
          posData.name = clean;
          delete st.positions[posKey];
          st.positions[clean] = posData;
          if (bg.activePosition === posKey) {
            bg.activePosition = clean;
          }
        });
        notify(`Renamed camera position "${posKey}" to "${clean}".`, 'ok');
        return { success: true };
      },
    });
  }

  function clearPositionSlots(posKey) {
    updateBg((bg) => {
      const st = bg.states[bg.activeState || 'default'];
      if (!st || !st.positions || !st.positions[posKey]) return;
      st.positions[posKey].background = '';
      st.positions[posKey].foreground = '';
      st.positions[posKey].ambience = '';
    });
    notify(`Cleared slot assignments for "${posKey}".`, 'info');
  }

  function removePosition(posKey) {
    const totalPos = Object.keys(activeState?.positions || {}).length;
    if (totalPos <= 1) {
      notify(`Cannot delete the only camera position. Disable "Courtroom / Camera Positions" instead.`, 'warn');
      return;
    }
    updateBg((bg) => {
      const st = bg.states[bg.activeState || 'default'];
      if (!st || !st.positions) return;
      delete st.positions[posKey];
      const remaining = Object.keys(st.positions);
      if (remaining.length > 0) {
        if (bg.activePosition === posKey) {
          bg.activePosition = remaining[0];
        }
      } else {
        st.usePositions = false;
      }
    });
    notify(`Deleted camera position "${posKey}".`, 'info');
  }

  function openPosContextMenu(e, posKey) {
    const totalPos = Object.keys(activeState?.positions || {}).length;
    const canDelete = totalPos > 1;

    openContextMenu(e, [
      {
        label: 'Duplicate Position',
        icon: '📋',
        run: () => duplicatePosition(posKey),
      },
      {
        label: 'Rename Position…',
        icon: '✏️',
        run: () => triggerRenamePosition(posKey),
      },
      {
        label: 'Clear Slot Overrides',
        icon: '🧹',
        run: () => clearPositionSlots(posKey),
      },
      { separator: true },
      {
        label: 'Delete Position',
        icon: '🗑️',
        danger: true,
        disabled: !canDelete,
        title: !canDelete ? 'Cannot delete the only camera position.' : '',
        run: () => removePosition(posKey),
      },
    ], `POSITION: ${posKey}`);
  }

  // Time variant actions
  function openAddTodModal() {
    const existing = new Set(Object.keys(activeTimeVariants).map((k) => k.toLowerCase()));
    const presets = ['day', 'evening', 'night', 'morning', 'dawn', 'dusk', 'midnight'];
    newTodKey = presets.find((p) => !existing.has(p)) || 'custom';
    todCopyFromBase = true;
    showAddTodModal = true;
  }

  function confirmAddTod() {
    const clean = newTodKey.trim().toLowerCase();
    if (!clean) return;

    updateBg((bg) => {
      const st = bg.states[bg.activeState || 'default'];
      if (!st) return;

      const baseBg = todCopyFromBase ? (activeBgVal || '') : '';
      const baseFg = todCopyFromBase ? (activeFgVal || '') : '';
      const baseAudio = todCopyFromBase ? (activeAmbienceVal || '') : '';

      if (st.usePositions && bg.activePosition && st.positions?.[bg.activePosition]) {
        const pos = st.positions[bg.activePosition];
        if (!pos.time_variants) pos.time_variants = {};
        pos.time_variants[clean] = createTimeVariant({
          background: baseBg,
          foreground: baseFg,
          ambience: baseAudio,
        });
      } else {
        if (!st.time_variants) st.time_variants = {};
        st.time_variants[clean] = createTimeVariant({
          background: baseBg,
          foreground: baseFg,
          ambience: baseAudio,
        });
      }
    });

    showAddTodModal = false;
    notify(`Added time variant "${clean}".`, 'ok');
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

  // Template actions
  function applyTemplateToBg(tpl) {
    if (!activeBg || !tpl) return;
    bgStore.applyTemplate(activeBg.id, tpl);
    tplMenuOpen = false;
    showManageTemplatesModal = false;
    notify(`Applied background template "${tpl.name}" to ${activeBg.folder}.`, 'ok');
  }

  function saveBgAsTemplate() {
    if (!activeBg) return;
    const name = newTplName.trim() || `${activeBg.folder} Template`;
    bgStore.saveTemplate(name, newTplDesc);
    newTplName = '';
    newTplDesc = '';
    notify(`Saved background template "${name}".`, 'ok');
  }

  function deleteBgTemplate(tplId) {
    bgStore.deleteTemplate(tplId);
    notify('Deleted background template.', 'info');
  }

  // Slot asset assignments
  function assignSlotAsset(targetType, filename, targetTod = null) {
    if (targetType === 'ambience') {
      filename = normalizeAmbiencePath(filename);
    } else {
      filename = (filename || '').trim().replace(/\\/g, '/');
    }

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
  let fileInputLibrary;
  let libraryMenuOpen = false;
  let isDraggingOverModal = false;

  // Type classification helpers
  function isImageAsset(assetOrFile) {
    if (!assetOrFile) return false;
    if (assetOrFile.type === 'image') return true;
    if (typeof assetOrFile.type === 'string' && assetOrFile.type.startsWith('image/')) return true;
    const name = assetOrFile.name || assetOrFile.relPath || '';
    return /\.(png|webp|jpg|jpeg|gif|svg|avif)$/i.test(name);
  }

  function isAudioAsset(assetOrFile) {
    if (!assetOrFile) return false;
    if (assetOrFile.type === 'audio') return true;
    if (typeof assetOrFile.type === 'string' && assetOrFile.type.startsWith('audio/')) return true;
    const name = assetOrFile.name || assetOrFile.relPath || '';
    return /\.(opus|mp3|ogg|wav|m4a|flac)$/i.test(name);
  }

  let dragOverSlot = null; // e.g. 'background', 'foreground', 'ambience', or 'background:day'
  let dragOverSlotValid = false;

  function onSlotDragOver(e, slotType, tod = null) {
    e.preventDefault();
    const slotKey = tod ? `${slotType}:${tod}` : slotType;
    dragOverSlot = slotKey;

    const isImgSlot = slotType === 'background' || slotType === 'foreground';
    const isAmbSlot = slotType === 'ambience';

    let isValid = false;
    if (draggedAsset) {
      if (isImgSlot) isValid = isImageAsset(draggedAsset);
      else if (isAmbSlot) isValid = isAudioAsset(draggedAsset);
    } else if (e.dataTransfer?.items?.length) {
      if (e.dataTransfer.items.length > 1) {
        // Multi-file drag is treated as general import, not single-slot drop
        isValid = false;
      } else {
        const item = e.dataTransfer.items[0];
        if (isImgSlot) isValid = item.type.startsWith('image/');
        else if (isAmbSlot) isValid = item.type.startsWith('audio/') || item.type === '';
      }
    } else {
      isValid = true;
    }

    dragOverSlotValid = isValid;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = isValid ? 'copy' : 'none';
    }
  }

  function onSlotDragLeave(e, slotType, tod = null) {
    const slotKey = tod ? `${slotType}:${tod}` : slotType;
    if (dragOverSlot === slotKey) {
      dragOverSlot = null;
      dragOverSlotValid = false;
    }
  }

  // Recursively extracts all files and directory relative paths from a DataTransfer object
  async function getAllFilesFromDataTransfer(dataTransfer) {
    if (!dataTransfer) return [];
    const items = dataTransfer.items;
    if (!items || items.length === 0) {
      return Array.from(dataTransfer.files || []);
    }

    const files = [];
    const entries = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (typeof item.webkitGetAsEntry === 'function') {
        const entry = item.webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
    }

    if (entries.length === 0) {
      return Array.from(dataTransfer.files || []);
    }

    async function traverseEntry(entry, path = '') {
      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file((file) => {
            const fullRel = path ? `${path}/${file.name}` : file.name;
            try {
              Object.defineProperty(file, 'webkitRelativePath', {
                value: fullRel,
                writable: true,
              });
            } catch {
              file.customRelativePath = fullRel;
            }
            files.push(file);
            resolve();
          }, () => resolve());
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const currentPath = path ? `${path}/${entry.name}` : entry.name;
        return new Promise((resolve) => {
          function readBatch() {
            dirReader.readEntries(async (batch) => {
              if (!batch || batch.length === 0) {
                resolve();
              } else {
                for (const child of batch) {
                  await traverseEntry(child, currentPath);
                }
                readBatch();
              }
            }, () => resolve());
          }
          readBatch();
        });
      }
    }

    for (const ent of entries) {
      await traverseEntry(ent);
    }

    return files.length > 0 ? files : Array.from(dataTransfer.files || []);
  }

  async function handleFiles(files) {
    if (!files || !files.length) return;
    const res = await bgStore.registerFiles(files);
    const bgsCount = res?.importedBackgrounds?.length || 0;
    const assetsCount = res?.addedAssets?.length || 0;

    if (bgsCount > 0) {
      const first = res.importedBackgrounds[0];
      const posCount = Object.keys(first.states?.default?.positions || {}).length;
      const posInfo = posCount > 0 ? ` (${posCount} camera angle${posCount > 1 ? 's' : ''})` : '';
      notify(`Imported background "${first.folder}"${posInfo} (${bgsCount} bg${bgsCount > 1 ? 's' : ''}, ${assetsCount} asset${assetsCount > 1 ? 's' : ''})`, 'ok');
    } else if (assetsCount > 0) {
      notify(`Loaded ${assetsCount} asset(s) into Asset Pool.`, 'ok');
    } else {
      notify('Loaded files into Asset Pool & Background Library.', 'info');
    }
  }

  function onModalDragOver(e) {
    e.preventDefault();
    if (!draggedAsset && e.dataTransfer?.types?.includes('Files')) {
      isDraggingOverModal = true;
    }
  }
  function onModalDragLeave(e) {
    if (e.currentTarget?.contains?.(e.relatedTarget)) return;
    isDraggingOverModal = false;
  }
  async function onModalDrop(e) {
    e.preventDefault();
    isDraggingOverModal = false;
    dragOverSlot = null;
    dragOverSlotValid = false;

    // Internal asset card drag dropped outside slots -> ignore, do not re-import as file!
    if (draggedAsset || e.dataTransfer?.types?.includes('application/x-area-maker-asset')) {
      draggedAsset = null;
      return;
    }

    if (e.dataTransfer) {
      const files = await getAllFilesFromDataTransfer(e.dataTransfer);
      if (files && files.length > 0) {
        await handleFiles(files);
      }
    }
  }

  // Drag over pool
  function onPoolDragOver(e) {
    e.preventDefault();
    if (!draggedAsset && e.dataTransfer?.types?.includes('Files')) {
      isDraggingOverPool = true;
    }
  }
  function onPoolDragLeave() {
    isDraggingOverPool = false;
  }
  async function onPoolDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    isDraggingOverPool = false;
    dragOverSlot = null;
    dragOverSlotValid = false;

    if (draggedAsset || e.dataTransfer?.types?.includes('application/x-area-maker-asset')) {
      draggedAsset = null;
      return;
    }

    if (e.dataTransfer) {
      const files = await getAllFilesFromDataTransfer(e.dataTransfer);
      if (files && files.length > 0) {
        await handleFiles(files);
      }
    }
  }

  // Drag asset onto slot or canvas node
  let assetDragOccurred = false;
  function onAssetDragStart(e, asset) {
    assetDragOccurred = true;
    draggedAsset = asset;
    e.dataTransfer.setData('text/plain', asset.relPath);
    try {
      e.dataTransfer.setData('application/x-area-maker-asset', JSON.stringify({
        id: asset.id,
        name: asset.name,
        relPath: asset.relPath,
        type: asset.type,
        url: asset.url
      }));
    } catch {}
    e.dataTransfer.effectAllowed = 'copyMove';
  }

  function onAssetDragEnd() {
    setTimeout(() => { assetDragOccurred = false; }, 120);
    draggedAsset = null;
    dragOverSlot = null;
    dragOverSlotValid = false;
  }

  function onAssetCardClick(asset) {
    if (assetDragOccurred) return;
    inspectAsset(asset);
  }

  async function onSlotDrop(e, slotType, tod = null) {
    e.preventDefault();
    e.stopPropagation();
    dragOverSlot = null;
    dragOverSlotValid = false;

    const isImgSlot = slotType === 'background' || slotType === 'foreground';
    const isAmbSlot = slotType === 'ambience';

    // 1. Dragged from Asset Pool
    if (draggedAsset) {
      if (isImgSlot && !isImageAsset(draggedAsset)) {
        notify('Audio files cannot be assigned to image slots.', 'warn');
        draggedAsset = null;
        return;
      }
      if (isAmbSlot && !isAudioAsset(draggedAsset)) {
        notify('Image files cannot be assigned to Ambience Audio.', 'warn');
        draggedAsset = null;
        return;
      }

      const val = isAmbSlot ? normalizeAmbiencePath(draggedAsset.relPath) : draggedAsset.relPath;
      assignSlotAsset(slotType, val, tod);
      notify(`Assigned ${val} to ${slotType}${tod ? ` (${tod})` : ''}`, 'ok');
      draggedAsset = null;
      return;
    }

    // 2. Dropped from OS File Manager
    if (e.dataTransfer) {
      const files = await getAllFilesFromDataTransfer(e.dataTransfer);
      if (!files || files.length === 0) return;

      // If directory, archive (.zip), or multiple files dropped over a slot, treat as general import into the library
      if (files.length > 1 || files.some((f) => f.name.endsWith('.ini') || f.name.endsWith('.json') || f.name.endsWith('.zip'))) {
        await handleFiles(files);
        return;
      }

      // Single file dropped directly onto a slot
      const f = files[0];
      const isFileAudio = isAudioAsset(f);
      const isFileImage = isImageAsset(f);

      if (isImgSlot && !isFileImage) {
        notify('Only image files (.webp, .png, .jpg) can be assigned to image slots.', 'warn');
        return;
      }
      if (isAmbSlot && !isFileAudio) {
        notify('Only audio files (.opus, .mp3, .ogg, .wav) can be assigned to Ambience Audio.', 'warn');
        return;
      }

      // Register into pool
      await handleFiles([f]);
      const val = isAmbSlot ? normalizeAmbiencePath(f.name) : f.name;
      assignSlotAsset(slotType, val, tod);
      notify(`Assigned ${val} to ${slotType}${tod ? ` (${tod})` : ''}`, 'ok');
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

  // Referenced and unused asset counts
  $: referencedAssetNames = bgStore.getReferencedAssetNames(backgrounds);
  $: usedAssetsCount = assetPool.filter((a) => referencedAssetNames.has(a.name) || referencedAssetNames.has(a.relPath) || referencedAssetNames.has(a.fullRelPath)).length;
  $: unusedAssetCount = Math.max(0, assetPool.length - usedAssetsCount);

  // Filtered assets in pool
  $: filteredAssets = assetPool.filter((a) => {
    const isUsed = referencedAssetNames.has(a.name) || referencedAssetNames.has(a.relPath) || referencedAssetNames.has(a.fullRelPath);
    if (assetFilter === 'used' && !isUsed) return false;
    if (assetFilter === 'unused' && isUsed) return false;
    if (assetFilter === 'image' && a.type !== 'image') return false;
    if (assetFilter === 'audio' && a.type !== 'audio') return false;
    if (assetSearch) {
      const q = assetSearch.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.relPath?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Available categorized assets for quick-picking
  $: availableImages = assetPool.filter((a) => a.type === 'image');
  $: availableAudios = assetPool.filter((a) => a.type === 'audio');
</script>

<svelte:window
  on:click={() => { libraryMenuOpen = false; tplMenuOpen = false; purgeMenuOpen = false; importMenuOpen = false; navImportMenuOpen = false; closeContextMenu(); }}
  on:keydown={(e) => {
    if (e.key === 'Escape') {
      if (bgContextMenu) { closeContextMenu(); e.stopPropagation(); }
      else if (inspectModalAsset) { inspectModalAsset = null; e.stopPropagation(); }
      else if (showRenameModal) { showRenameModal = false; e.stopPropagation(); }
      else if (showPurgeConfirmModal) { showPurgeConfirmModal = false; e.stopPropagation(); }
      else if (showAddTodModal) { showAddTodModal = false; e.stopPropagation(); }
      else if (showAddStateModal) { showAddStateModal = false; e.stopPropagation(); }
      else if (showAddPositionModal) { showAddPositionModal = false; e.stopPropagation(); }
      else if (showManageTemplatesModal) { showManageTemplatesModal = false; e.stopPropagation(); }
      else if (purgeMenuOpen) { purgeMenuOpen = false; e.stopPropagation(); }
      else if (importMenuOpen || navImportMenuOpen) { importMenuOpen = false; navImportMenuOpen = false; e.stopPropagation(); }
    }
  }}
/>

<div
  class="modal-bg"
  role="presentation"
  on:mousedown={onScrimMouseDown}
  on:click={(e) => handleScrimClose(e, () => dispatch('close'))}
>
  <div
    class="modal bg-maker-modal {isDraggingOverModal ? 'dragover' : ''}"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label="Background.json Maker"
    on:dragover={onModalDragOver}
    on:dragleave={onModalDragLeave}
    on:drop={onModalDrop}
  >
    <!-- ROW 1: Title Bar with Blinking Caret -->
    <div class="maker-title-row">
      <h2 class="maker-title">
        <span class="maker-prefix">//</span> BACKGROUND.JSON <span>MAKER</span><span class="cursor">_</span>
      </h2>
      <button class="modal-x" title="Close Background Maker (Esc)" on:click={() => dispatch('close')}>✕</button>
    </div>

    <!-- ROW 2: Header Action Toolbar -->
    <div class="maker-toolbar-row">
      <div class="toolbar-left">
        {#if selectedArea}
          <button
            class="primary-btn mini-btn"
            title="Set background: '{activeBg?.folder}' on the currently inspected area"
            on:click={applyToCurrentArea}
          >
            ✓ Apply to Area #{Math.max(0, $state.project.areas.indexOf(selectedArea))}
          </button>
        {/if}
      </div>

      <div class="toolbar-right">
        <span class="toolbar-dropdown-anchor">
          <button
            class="mini-btn"
            title="Import background definitions, folders, positions.ini, or asset ZIPs"
            on:click|stopPropagation={() => (importMenuOpen = !importMenuOpen)}
          >
            📥 Import ▾
          </button>
          {#if importMenuOpen}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="drop-menu import-drop-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
              <div class="menu-header-tag">IMPORT BACKGROUNDS</div>
              <button
                title="Select and import a background folder from disk (auto-detects positions.ini or background.json)"
                on:click={() => { importMenuOpen = false; fileInputFolder && fileInputFolder.click(); }}
              >
                📁 Import Directory / Folder…
              </button>
              <button
                title="Import a ZIP archive, positions.ini, or background.json file"
                on:click={() => { importMenuOpen = false; fileInputLibrary && fileInputLibrary.click(); }}
              >
                📦 Import ZIP, INI, or JSON File…
              </button>
            </div>
          {/if}
        </span>
        <button
          class="mini-btn"
          title="Copy formatted background.json to clipboard"
          on:click={() => { copyText(bgJsonString); notify('Copied background.json to clipboard'); }}
        >
          📋 Copy JSON
        </button>
        <button
          class="mini-btn"
          title="Export background.json file"
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
          💾 Export JSON
        </button>
        <button
          class="mini-btn"
          title="Export complete package ZIP containing background.json, images and sounds"
          on:click={() => bgStore.exportZip(activeBg.id)}
        >
          📦 Export Package (.zip)
        </button>
        <span class="drop-wrap">
          <button
            class="mini-btn accent-btn"
            title="Export full background library for sharing with collaborators"
            on:click|stopPropagation={() => (libraryMenuOpen = !libraryMenuOpen)}
          >
            📚 Library ▾
          </button>
          {#if libraryMenuOpen}
            <div class="drop-menu library-drop-menu">
              <button
                title="Download backgrounds-library.json backup containing all background definitions"
                on:click={() => { libraryMenuOpen = false; bgStore.downloadLibraryJson(); }}
              >
                💾 Export Library Backup (.json)
              </button>
              <button
                title="Download comprehensive ZIP package with all background.json files and assets"
                on:click={() => { libraryMenuOpen = false; bgStore.exportAllZip(); }}
              >
                📦 Export All Backgrounds & Assets (.zip)
              </button>
              <div class="menu-divider"></div>
              <button
                title="Import single background.json, backgrounds-library.json, or package ZIP"
                on:click={() => { libraryMenuOpen = false; fileInputLibrary && fileInputLibrary.click(); }}
              >
                📥 Import Package or JSON (.json, .zip)…
              </button>
              {#if assetPool.length > 0}
                <div class="menu-divider"></div>
                <button
                  class="menu-item"
                  disabled={unusedAssetCount === 0}
                  title="Remove {unusedAssetCount} unreferenced assets from memory and cache"
                  on:click={() => openPurgeModal('unused')}
                >
                  🧹 Purge Unused Assets ({unusedAssetCount})
                </button>
                <button
                  class="danger-item"
                  title="Clear all {assetPool.length} imported assets from memory and cache"
                  on:click={() => openPurgeModal('all')}
                >
                  🗑 Purge All Assets ({assetPool.length})
                </button>
              {/if}
            </div>
          {/if}
        </span>
        <span class="drop-wrap">
          <button
            class="mini-btn"
            title="Apply or manage background templates (courtroom positions, time-of-day cycles, trial states)"
            on:click|stopPropagation={() => (tplMenuOpen = !tplMenuOpen)}
          >
            📋 Templates ▾
          </button>
          {#if tplMenuOpen}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="drop-menu templates-drop-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
              <div class="menu-header-tag">APPLY BACKGROUND TEMPLATE</div>
              {#each storeState.templates as tpl}
                <button
                  class="tpl-drop-item"
                  title={tpl.description}
                  on:click={() => applyTemplateToBg(tpl)}
                >
                  <span class="tpl-item-name">{tpl.name}</span>
                  {#if tpl.builtin}<span class="tpl-item-tag">preset</span>{/if}
                </button>
              {/each}
              <div class="menu-divider"></div>
              <button
                title="Manage templates or save current background as a reusable template"
                on:click={() => { tplMenuOpen = false; showManageTemplatesModal = true; }}
              >
                ⚙ Manage & Save Templates…
              </button>
            </div>
          {/if}
        </span>
      </div>
    </div>

    <!-- FULL-WIDTH HORIZONTAL PATH STRIP (3-Part Layout + Full Path Label) -->
    <div class="maker-path-strip" title="MNN server relative path for this background">
      <div class="path-strip-row">
        <!-- Part 1: Fixed base/background/ badge -->
        <div class="path-part-prefix" title="Root directory in MNN asset package">
          <span class="terminal-prompt">&gt;</span>
          <span class="prefix-text">base/background/</span>
        </div>

        <!-- Part 2: Directory Path (70% width, with shortcut dropdown) -->
        <div class="path-part-dir" title="Directory path / series subfolders (e.g. WS Lambda/Montreal)">
          <input
            type="text"
            class="dir-input {isDuplicatePath ? 'input-dup-warning' : ''}"
            placeholder="Directory / Series Subfolder (e.g. WS Lambda/Montreal)"
            value={activeSubfolder}
            list="known-bg-maker-folders"
            on:input={(e) => onSubfolderChange(e.target.value)}
            on:blur={onPathBlur}
          />
          {#if knownSubfolders.length > 0}
            <select
              class="subfolder-dropdown"
              title="Shortcut: Pick an existing directory path"
              on:change={(e) => {
                if (e.target.value !== '') {
                  onSubfolderChange(e.target.value);
                  onPathBlur();
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
        </div>

        <!-- Slash divider -->
        <span class="path-divider">/</span>

        <!-- Part 3: File / Room Name (30% width) -->
        <div class="path-part-file" title="Background scene folder / file name">
          <input
            type="text"
            class="file-input {isDuplicatePath ? 'input-dup-warning' : ''}"
            placeholder="RoomName"
            value={activeBgName}
            on:input={(e) => onBgNameChange(e.target.value)}
            on:blur={onPathBlur}
          />
        </div>

        {#if isDuplicatePath}
          <span class="path-dup-badge" title="Duplicate folder path! Another background shares this path. Renamed automatically on blur/export.">
            ⚠️ Duplicate Path
          </span>
        {/if}

        <!-- Copy button -->
        <button
          class="icon-tool-btn"
          title="Copy relative folder path to clipboard"
          on:click={() => { copyText(activeBg?.folder || ''); notify('Copied background folder path'); }}
        >
          📋 Copy
        </button>
      </div>

      <!-- Small font label below input boxes displaying full path -->
      <div class="path-strip-full" title="Computed full server asset path">
        <span class="full-path-tag">FULL PATH:</span>
        <code class="full-path-text" use:autoscroll>base/background/{normalizeBgPath(activeBg?.folder) || 'Untitled'}/background.json</code>
        {#if isDuplicatePath}
          <span class="full-path-dup-alert">⚠ Will be disambiguated on blur or export</span>
        {/if}
      </div>

      <datalist id="known-bg-maker-folders">
        {#each knownSubfolders as sub}
          <option value="{sub}">{sub}/</option>
        {/each}
      </datalist>
    </div>

    <!-- Main 3-Column Workspace -->
    <div class="maker-body">
      <!-- Left Column: Backgrounds Navigator -->
      <aside class="bg-nav">
        <div class="nav-head">
          <div class="nav-head-title-row">
            <span class="nav-title">BACKGROUNDS ({backgrounds.length})</span>
          </div>
          <div class="nav-head-actions">
            <button
              class="mini-btn primary"
              title="Create a new background in the current folder ({activeSubfolder || 'root'})"
              on:click={createNewBackgroundInCurrentFolder}
            >＋ New</button>
            <span class="toolbar-dropdown-anchor">
              <button
                class="mini-btn icon-action-btn"
                title="Import background directory, positions.ini, background.json, or package .zip"
                on:click|stopPropagation={() => (navImportMenuOpen = !navImportMenuOpen)}
              >📥 Import ▾</button>
              {#if navImportMenuOpen}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div class="drop-menu nav-import-drop-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
                  <div class="menu-header-tag">IMPORT BACKGROUND</div>
                  <button
                    title="Select and import a background folder from disk (auto-detects positions.ini or background.json)"
                    on:click={() => { navImportMenuOpen = false; fileInputFolder && fileInputFolder.click(); }}
                  >
                    📁 Import Folder…
                  </button>
                  <button
                    title="Import a ZIP archive, positions.ini, or background.json file"
                    on:click={() => { navImportMenuOpen = false; fileInputLibrary && fileInputLibrary.click(); }}
                  >
                    📦 Import ZIP / File…
                  </button>
                </div>
              {/if}
            </span>
          </div>
        </div>

        <div class="bg-list">
          {#each backgrounds as bg (bg.id)}
            {@const parts = splitFolderPath(bg.folder)}
            <div
              class="bg-item {bg.id === activeBg?.id ? 'active' : ''}"
              role="button"
              tabindex="0"
              title="Click to select; right-click for options"
              on:click={() => bgStore.selectBg(bg.id)}
              on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && bgStore.selectBg(bg.id)}
              on:contextmenu|preventDefault|stopPropagation={(e) => openBgContextMenu(e, bg)}
            >
              <div class="bg-item-row">
                <div class="bg-item-titles" title={bg.folder}>
                  {#if parts.subfolder}
                    <span class="bg-subfolder-tag">{parts.subfolder}/</span>
                  {/if}
                  <span class="bg-folder" use:autoscroll>{parts.name || bg.folder || 'Untitled'}</span>
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
                    title="Click to switch state; right-click for options"
                    on:click={() => updateBg((bg) => (bg.activeState = stKey))}
                    on:contextmenu|preventDefault|stopPropagation={(e) => openStateContextMenu(e, stKey)}
                  >
                    {stKey}{stKey === 'default' ? ' ★' : ''}
                  </button>
                {/each}
                <button class="mini-btn add-btn" title="Add alternative state variant (e.g. crowded, festive)" on:click={openAddStateModal}>+ State</button>
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
                      title="Click to switch position; right-click for options"
                      on:click={() => updateBg((bg) => (bg.activePosition = posKey))}
                      on:contextmenu|preventDefault|stopPropagation={(e) => openPosContextMenu(e, posKey)}
                    >
                      {posKey}
                    </button>
                  {/each}
                  <button class="mini-btn add-btn" title="Add camera position" on:click={openAddPositionModal}>+ Position</button>
                </div>
              {/if}
            </div>

            {#if usePositions && activePosKey}
              <div class="pos-manage-strip">
                <span class="hint">Camera position: <code>{activePosKey}</code> <span class="tip-sub">(Right-click tab for options)</span></span>
                {#if Object.keys(activeState?.positions || {}).length > 1}
                  <button class="mini-btn danger" on:click={() => removePosition(activePosKey)}>Delete position</button>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Primary Asset Slots for Active Context -->
          <div class="slots-grid">
            <!-- Background Image -->
            <div
              class="slot-card {dragOverSlot === 'background' ? (dragOverSlotValid ? 'drag-target-valid' : 'drag-target-invalid') : ''}"
              role="region"
              aria-label="Background image slot"
              title="Drop image to assign; right-click for options"
              on:contextmenu|preventDefault|stopPropagation={(e) => openSlotContextMenu(e, 'background')}
              on:dragover={(e) => onSlotDragOver(e, 'background')}
              on:dragleave={(e) => onSlotDragLeave(e, 'background')}
              on:drop={(e) => onSlotDrop(e, 'background')}
            >
              <div class="slot-head">
                <div class="slot-title-group">
                  <span class="slot-title">Background Image</span>
                  <span class="slot-desc">Scene backdrop</span>
                </div>
                {#if activeBgVal}
                  <div class="slot-head-actions">
                    <button class="slot-rename-btn" title="Rename export filename for this background" on:click|stopPropagation={() => triggerRenameSlotExport('background')}>✏️</button>
                    <button class="icon-btn" title="Clear image" on:click|stopPropagation={() => assignSlotAsset('background', '')}>✕</button>
                  </div>
                {:else if availableImages.length > 0}
                  <select
                    class="mini-slot-picker"
                    title="Quick pick from imported images"
                    on:change={(e) => {
                      if (e.target.value) {
                        assignSlotAsset('background', e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">▾ Pick image…</option>
                    {#each availableImages as a}
                      <option value={a.relPath || a.name}>{a.relPath || a.name}</option>
                    {/each}
                  </select>
                {/if}
              </div>

              {#if activeBgVal}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
                <div class="slot-content has-asset">
                  {#if activeBgThumb}
                    <img
                      draggable="false"
                      src={activeBgThumb}
                      alt={activeBgVal}
                      class="slot-thumb clickable-preview"
                      title="Click to view & inspect in Lightbox"
                      on:click|stopPropagation={() => inspectAsset(activeBgVal, `${activeBg?.folder || 'Scene'} Background`, 'image', { slotType: 'background' })}
                    />
                  {:else}
                    <div
                      class="no-thumb-box clickable-preview"
                      title="Click to view & inspect in Lightbox"
                      on:click|stopPropagation={() => inspectAsset(activeBgVal, `${activeBg?.folder || 'Scene'} Background`, 'image', { slotType: 'background' })}
                    >🖼</div>
                  {/if}
                  <div
                    class="slot-name-col clickable-rename"
                    title="Click to rename export filename; right-click for options"
                    on:click|stopPropagation={() => triggerRenameSlotExport('background')}
                  >
                    <span class="asset-filename" title={activeBgVal} use:autoscroll>{activeBgVal}</span>
                    {#if activeBg?.assetSources?.[activeBgVal]}
                      <span class="alias-tag" title="Custom export filename (source: {activeBg.assetSources[activeBgVal]})">
                        alias of <em>{activeBg.assetSources[activeBgVal]}</em>
                      </span>
                    {/if}
                  </div>
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
              class="slot-card {dragOverSlot === 'foreground' ? (dragOverSlotValid ? 'drag-target-valid' : 'drag-target-invalid') : ''}"
              role="region"
              aria-label="Foreground overlay slot"
              title="Drop overlay image to assign; right-click for options"
              on:contextmenu|preventDefault|stopPropagation={(e) => openSlotContextMenu(e, 'foreground')}
              on:dragover={(e) => onSlotDragOver(e, 'foreground')}
              on:dragleave={(e) => onSlotDragLeave(e, 'foreground')}
              on:drop={(e) => onSlotDrop(e, 'foreground')}
            >
              <div class="slot-head">
                <div class="slot-title-group">
                  <span class="slot-title">Foreground</span>
                  <span class="slot-desc">Filter / Desk</span>
                </div>
                {#if activeFgVal}
                  <div class="slot-head-actions">
                    <button class="slot-rename-btn" title="Rename export filename for this background" on:click|stopPropagation={() => triggerRenameSlotExport('foreground')}>✏️</button>
                    <button class="icon-btn" title="Clear overlay" on:click|stopPropagation={() => assignSlotAsset('foreground', '')}>✕</button>
                  </div>
                {:else if availableImages.length > 0}
                  <select
                    class="mini-slot-picker"
                    title="Quick pick from imported overlay images"
                    on:change={(e) => {
                      if (e.target.value) {
                        assignSlotAsset('foreground', e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">▾ Pick overlay…</option>
                    {#each availableImages as a}
                      <option value={a.relPath || a.name}>{a.relPath || a.name}</option>
                    {/each}
                  </select>
                {/if}
              </div>

              {#if activeFgVal}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
                <div class="slot-content has-asset">
                  {#if activeFgThumb}
                    <img
                      draggable="false"
                      src={activeFgThumb}
                      alt={activeFgVal}
                      class="slot-thumb clickable-preview"
                      title="Click to view & inspect in Lightbox"
                      on:click|stopPropagation={() => inspectAsset(activeFgVal, `${activeBg?.folder || 'Scene'} Foreground`, 'image', { slotType: 'foreground' })}
                    />
                  {:else}
                    <div
                      class="no-thumb-box clickable-preview"
                      title="Click to view & inspect in Lightbox"
                      on:click|stopPropagation={() => inspectAsset(activeFgVal, `${activeBg?.folder || 'Scene'} Foreground`, 'image', { slotType: 'foreground' })}
                    >🌫</div>
                  {/if}
                  <div
                    class="slot-name-col clickable-rename"
                    title="Click to rename export filename; right-click for options"
                    on:click|stopPropagation={() => triggerRenameSlotExport('foreground')}
                  >
                    <span class="asset-filename" title={activeFgVal} use:autoscroll>{activeFgVal}</span>
                    {#if activeBg?.assetSources?.[activeFgVal]}
                      <span class="alias-tag" title="Custom export filename (source: {activeBg.assetSources[activeFgVal]})">
                        alias of <em>{activeBg.assetSources[activeFgVal]}</em>
                      </span>
                    {/if}
                  </div>
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
              class="slot-card {dragOverSlot === 'ambience' ? (dragOverSlotValid ? 'drag-target-valid' : 'drag-target-invalid') : ''}"
              role="region"
              aria-label="Ambience audio slot"
              title="Drop sound to assign; right-click for options"
              on:contextmenu|preventDefault|stopPropagation={(e) => openSlotContextMenu(e, 'ambience')}
              on:dragover={(e) => onSlotDragOver(e, 'ambience')}
              on:dragleave={(e) => onSlotDragLeave(e, 'ambience')}
              on:drop={(e) => onSlotDrop(e, 'ambience')}
            >
              <div class="slot-head">
                <div class="slot-title-group">
                  <span class="slot-title">Ambience</span>
                  <span class="slot-desc">base/sounds/ambient</span>
                </div>
                {#if activeAmbienceVal}
                  <div class="slot-head-actions">
                    <button class="slot-rename-btn" title="Rename export filename for this background" on:click|stopPropagation={() => triggerRenameSlotExport('ambience')}>✏️</button>
                    <button class="icon-btn" title="Clear sound" on:click|stopPropagation={() => assignSlotAsset('ambience', '')}>✕</button>
                  </div>
                {:else if availableAudios.length > 0}
                  <select
                    class="mini-slot-picker"
                    title="Quick pick from imported audio"
                    on:change={(e) => {
                      if (e.target.value) {
                        assignSlotAsset('ambience', e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">▾ Pick audio…</option>
                    {#each availableAudios as a}
                      <option value={a.relPath || a.name}>{a.relPath || a.name}</option>
                    {/each}
                  </select>
                {/if}
              </div>

              {#if activeAmbienceVal}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div class="slot-content has-asset">
                  <div
                    class="no-thumb-box audio clickable-preview"
                    title="Click to view & play in Lightbox"
                    on:click|stopPropagation={() => inspectAsset(activeAmbienceVal, `${activeBg?.folder || 'Scene'} Ambience`, 'audio', { slotType: 'ambience' })}
                  >🎵</div>
                  <div
                    class="slot-name-col clickable-rename"
                    title="Click to rename export filename; right-click for options"
                    on:click|stopPropagation={() => triggerRenameSlotExport('ambience')}
                  >
                    <span class="asset-filename" title={activeAmbienceVal} use:autoscroll>{activeAmbienceVal}</span>
                    {#if activeBg?.assetSources?.[activeAmbienceVal] || (activeAmbienceVal && activeBg?.assetSources?.[activeAmbienceVal.split('/').pop()])}
                      <span class="alias-tag" title="Custom export filename">
                        alias of <em>{activeBg.assetSources[activeAmbienceVal] || activeBg.assetSources[activeAmbienceVal.split('/').pop()]}</em>
                      </span>
                    {/if}
                  </div>
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
              <button class="mini-btn add-btn" title="Add time of day variant (opens preset & existing key modal)" on:click={openAddTodModal}>
                + Time Variant
              </button>
            </div>

            {#if Object.keys(activeTimeVariants).length === 0}
              <div class="empty-hint">
                No time variants configured for this {usePositions ? 'position' : 'state'}. Background stays constant across all times of day.
              </div>
            {:else}
              <div class="tod-list">
                {#each Object.entries(activeTimeVariants) as [todKey, tv]}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="tod-row-card"
                    title="Right-click for time variant options"
                    on:contextmenu|preventDefault|stopPropagation={(e) => openTodContextMenu(e, todKey)}
                  >
                    <div class="tod-badge-col">
                      <span class="tod-badge">{todKey}</span>
                    </div>

                    <!-- Mini slots -->
                    <div
                      class="mini-slot {dragOverSlot === `background:${todKey}` ? (dragOverSlotValid ? 'drag-target-valid' : 'drag-target-invalid') : ''}"
                      role="region"
                      aria-label="Background slot for {todKey}"
                      title="Right-click for options; drop image to set background for {todKey}"
                      on:contextmenu|preventDefault|stopPropagation={(e) => openSlotContextMenu(e, 'background', todKey)}
                      on:dragover={(e) => onSlotDragOver(e, 'background', todKey)}
                      on:dragleave={(e) => onSlotDragLeave(e, 'background', todKey)}
                      on:drop={(e) => onSlotDrop(e, 'background', todKey)}
                    >
                      <span class="mslot-lbl">BG:</span>
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <span
                        class="mslot-val clickable-rename"
                        title="{tv.background || 'Same as base'} (Click to rename)"
                        on:click|stopPropagation={() => tv.background && triggerRenameSlotExport('background', todKey)}
                      >{tv.background || 'Same as base'}</span>
                      {#if tv.background && activeBg?.assetSources?.[tv.background]}
                        <span class="mslot-alias-dot" title="Alias of {activeBg.assetSources[tv.background]}">●</span>
                      {/if}
                      {#if tv.background}
                        <button class="mslot-rename-btn" title="Rename export filename for this background" on:click|stopPropagation={() => triggerRenameSlotExport('background', todKey)}>✏️</button>
                        <button class="mslot-clear-btn" title="Clear background (fallback to base)" on:click|stopPropagation={() => assignSlotAsset('background', '', todKey)}>✕</button>
                      {/if}
                    </div>

                    <div
                      class="mini-slot {dragOverSlot === `foreground:${todKey}` ? (dragOverSlotValid ? 'drag-target-valid' : 'drag-target-invalid') : ''}"
                      role="region"
                      aria-label="Foreground slot for {todKey}"
                      title="Right-click for options; drop overlay image to set foreground for {todKey}"
                      on:contextmenu|preventDefault|stopPropagation={(e) => openSlotContextMenu(e, 'foreground', todKey)}
                      on:dragover={(e) => onSlotDragOver(e, 'foreground', todKey)}
                      on:dragleave={(e) => onSlotDragLeave(e, 'foreground', todKey)}
                      on:drop={(e) => onSlotDrop(e, 'foreground', todKey)}
                    >
                      <span class="mslot-lbl">FG:</span>
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <span
                        class="mslot-val clickable-rename"
                        title="{tv.foreground || 'None'} (Click to rename)"
                        on:click|stopPropagation={() => tv.foreground && triggerRenameSlotExport('foreground', todKey)}
                      >{tv.foreground || 'None'}</span>
                      {#if tv.foreground && activeBg?.assetSources?.[tv.foreground]}
                        <span class="mslot-alias-dot" title="Alias of {activeBg.assetSources[tv.foreground]}">●</span>
                      {/if}
                      {#if tv.foreground}
                        <button class="mslot-rename-btn" title="Rename export filename for this background" on:click|stopPropagation={() => triggerRenameSlotExport('foreground', todKey)}>✏️</button>
                        <button class="mslot-clear-btn" title="Clear foreground" on:click|stopPropagation={() => assignSlotAsset('foreground', '', todKey)}>✕</button>
                      {/if}
                    </div>

                    <div
                      class="mini-slot {dragOverSlot === `ambience:${todKey}` ? (dragOverSlotValid ? 'drag-target-valid' : 'drag-target-invalid') : ''}"
                      role="region"
                      aria-label="Ambience audio slot for {todKey}"
                      title="Right-click for options; drop sound to set ambience audio for {todKey}"
                      on:contextmenu|preventDefault|stopPropagation={(e) => openSlotContextMenu(e, 'ambience', todKey)}
                      on:dragover={(e) => onSlotDragOver(e, 'ambience', todKey)}
                      on:dragleave={(e) => onSlotDragLeave(e, 'ambience', todKey)}
                      on:drop={(e) => onSlotDrop(e, 'ambience', todKey)}
                    >
                      <span class="mslot-lbl">Audio:</span>
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <span
                        class="mslot-val clickable-rename"
                        title="{tv.ambience || 'Same as base'} (Click to rename)"
                        on:click|stopPropagation={() => tv.ambience && triggerRenameSlotExport('ambience', todKey)}
                      >{tv.ambience || 'Same as base'}</span>
                      {#if tv.ambience && (activeBg?.assetSources?.[tv.ambience] || activeBg?.assetSources?.[tv.ambience.split('/').pop()])}
                        <span class="mslot-alias-dot" title="Alias">●</span>
                      {/if}
                      {#if tv.ambience}
                        <button class="mslot-rename-btn" title="Rename export filename for this background" on:click|stopPropagation={() => triggerRenameSlotExport('ambience', todKey)}>✏️</button>
                        <button class="mslot-clear-btn" title="Clear ambience (fallback to base)" on:click|stopPropagation={() => assignSlotAsset('ambience', '', todKey)}>✕</button>
                      {/if}
                    </div>

                    <button
                      class="icon-btn danger tod-delete-btn"
                      title="Remove {todKey} variant"
                      on:click={() => removeTimeVariant(todKey)}
                    >✕</button>
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

          <!-- Aspect Ratio Toolbar -->
          <div class="stage-aspect-bar">
            <div class="aspect-left">
              <span class="aspect-label">RATIO:</span>
              <select
                class="aspect-select"
                value={stageAspectPreset}
                on:change={(e) => setAspectPreset(e.target.value)}
                title="Stage display aspect ratio"
              >
                <option value="16:9">16:9</option>
                <option value="4:3">4:3</option>
                <option value="21:9">21:9</option>
                <option value="1:1">1:1</option>
                <option value="auto">Auto</option>
                <option value="custom">Custom</option>
              </select>

              <div class="aspect-ratio-inputs" title="Edit custom aspect ratio (Width : Height)">
                <input
                  type="number"
                  min="1"
                  max="9999"
                  class="aspect-num-input"
                  value={stageAspectW}
                  on:input={(e) => onAspectCustomChange(parseInt(e.target.value, 10) || 16, stageAspectH)}
                />
                <span class="aspect-colon">:</span>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  class="aspect-num-input"
                  value={stageAspectH}
                  on:input={(e) => onAspectCustomChange(stageAspectW, parseInt(e.target.value, 10) || 9)}
                />
              </div>
            </div>

            <div class="aspect-right">
              <button
                class="mini-btn {stageFitMode === 'contain' ? 'active-filter' : ''}"
                style="font-size:10px;padding:2px 6px"
                title={stageFitMode === 'contain' ? 'Letterboxed with black bars (full image visible)' : 'Cropped to fill viewport'}
                on:click={() => (stageFitMode = stageFitMode === 'contain' ? 'cover' : 'contain')}
              >
                {stageFitMode === 'contain' ? '◼ Letterbox' : '⛶ Cover'}
              </button>
            </div>
          </div>

          <!-- Scaled Canvas Viewport with letterboxing (black bars) -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="canvas-viewport"
            style="--stage-aspect:{stageAspectW} / {stageAspectH}"
            title="Live Stage Preview. Right-click for options (aspect ratio fit, inspect, copy JSON)"
            on:contextmenu|preventDefault|stopPropagation={openStageContextMenu}
          >
            {#if resolvedBgUrl}
              <img
                draggable="false"
                src={resolvedBgUrl}
                alt="Background"
                class="stage-bg-layer"
                style="object-fit:{stageFitMode}"
                on:load={onStageImageLoad}
              />
            {:else}
              <div class="stage-fallback">
                <span class="stage-msg">No image assigned</span>
                <span class="stage-sub">{resolvedVisual.background || 'None'}</span>
              </div>
            {/if}

            {#if resolvedFgUrl}
              <img
                draggable="false"
                src={resolvedFgUrl}
                alt="Foreground"
                class="stage-fg-layer"
                style="object-fit:{stageFitMode}"
              />
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
          <button
            class="mini-btn dock-toggle-btn"
            title={poolCollapsed ? 'Expand Asset Pool' : 'Collapse Asset Pool'}
            on:click={() => (poolCollapsed = !poolCollapsed)}
          >
            {poolCollapsed ? '▲' : '▼'}
          </button>
          <span class="dock-title">ASSET REPOSITORY POOL ({assetPool.length})</span>
          <div class="filter-pills">
            <button class="filter-pill {assetFilter === 'all' ? 'active' : ''}" on:click={() => (assetFilter = 'all')}>All ({assetPool.length})</button>
            <button class="filter-pill {assetFilter === 'image' ? 'active' : ''}" on:click={() => (assetFilter = 'image')}>Images ({assetPool.filter((a) => a.type === 'image').length})</button>
            <button class="filter-pill {assetFilter === 'audio' ? 'active' : ''}" on:click={() => (assetFilter = 'audio')}>Audio ({assetPool.filter((a) => a.type === 'audio').length})</button>
            <button class="filter-pill {assetFilter === 'used' ? 'active' : ''}" on:click={() => (assetFilter = 'used')}>Used ({usedAssetsCount})</button>
            <button class="filter-pill {assetFilter === 'unused' ? 'active' : ''}" on:click={() => (assetFilter = 'unused')}>Unused ({unusedAssetCount})</button>
          </div>
          <input
            type="search"
            class="search-input"
            placeholder="Search assets..."
            bind:value={assetSearch}
          />
        </div>

        <div class="dock-actions">
          <span class="drop-wrap">
            <button
              class="mini-btn purge-btn {purgeMenuOpen ? 'active' : ''}"
              title="Purge assets from memory and cache"
              disabled={assetPool.length === 0}
              on:click|stopPropagation={() => { purgeMenuOpen = !purgeMenuOpen; }}
            >
              🧹 Purge ▾
            </button>
            {#if purgeMenuOpen}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <div class="drop-menu purge-drop-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
                <button
                  class="menu-item"
                  disabled={unusedAssetCount === 0}
                  title="Remove unreferenced assets from memory and IndexedDB cache"
                  on:click={() => openPurgeModal('unused')}
                >
                  🧹 Purge Unused ({unusedAssetCount})
                </button>
                <button
                  class="danger-item"
                  disabled={assetPool.length === 0}
                  title="Clear all assets from memory and IndexedDB cache"
                  on:click={() => openPurgeModal('all')}
                >
                  🗑 Purge All ({assetPool.length})
                </button>
              </div>
            {/if}
          </span>
          <button class="mini-btn" on:click={() => fileInputGeneral.click()}>+ Upload Files</button>
          <button class="mini-btn" on:click={() => fileInputFolder.click()}>+ Upload Folder</button>
          <input type="file" accept="image/*,audio/*,.json,.zip,.ini" multiple hidden bind:this={fileInputGeneral} on:change={(e) => handleFiles(e.target.files)} />
          <input type="file" webkitdirectory multiple hidden bind:this={fileInputFolder} on:change={(e) => handleFiles(e.target.files)} />
          <input type="file" accept=".zip,.ini,.json" multiple hidden bind:this={fileInputLibrary} on:change={(e) => handleFiles(e.target.files)} />
        </div>
      </div>

      {#if !poolCollapsed}
        <!-- Assets Grid / Carousel Strip -->
        <div class="assets-strip">
          {#if filteredAssets.length === 0}
            <div class="dock-empty-msg">
              <span>Drag & drop images (.webp, .png, .jpg) or audio (.opus, .mp3) here to build without re-uploading.</span>
            </div>
          {:else}
            {#each filteredAssets as asset (asset.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                class="asset-card"
                role="button"
                tabindex="0"
                draggable="true"
                title="Click to view & edit in Lightbox, drag onto any slot, double-click to rename: {asset.relPath} ({Math.round(asset.size / 1024)} KB)"
                on:dragstart={(e) => onAssetDragStart(e, asset)}
                on:dragend={onAssetDragEnd}
                on:contextmenu|preventDefault|stopPropagation={(e) => openAssetContextMenu(e, asset)}
                on:click={() => onAssetCardClick(asset)}
                on:dblclick|stopPropagation={() => triggerRenameAsset(asset)}
              >
                {#if asset.type === 'image'}
                  <div class="card-thumb-wrap">
                    <img draggable="false" src={asset.url} alt={asset.name} class="asset-img" />
                  </div>
                {:else}
                  <div class="card-thumb-wrap audio">
                    <span>🎵</span>
                  </div>
                {/if}
                <span class="asset-card-name" use:autoscroll>{asset.relPath || asset.name}</span>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </section>
  </div>
</div>

{#if showAddTodModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-bg submodal-scrim" on:mousedown={onScrimMouseDown} on:click={(e) => handleScrimClose(e, () => (showAddTodModal = false))}>
    <div class="modal submodal-card" on:mousedown|stopPropagation on:click|stopPropagation>
      <button class="modal-x" title="Close (Esc)" on:click={() => (showAddTodModal = false)}>✕</button>
      <h3>🕒 Add Time of Day Variant</h3>
      <div class="hint">Configure a time-of-day visual variant for this {usePositions ? 'position' : 'state'}.</div>

      <div class="submodal-field">
        <span class="submodal-label">Pick preset or existing time of day:</span>
        <select
          class="submodal-select"
          value={newTodKey}
          on:change={(e) => { if (e.target.value) newTodKey = e.target.value; }}
        >
          <option value="">— Select a time of day preset —</option>
          <optgroup label="Standard Presets">
            <option value="day">day (Daytime)</option>
            <option value="evening">evening (Sunset / Twilight)</option>
            <option value="night">night (Nighttime)</option>
            <option value="morning">morning (Dawn / Morning)</option>
            <option value="dawn">dawn (Early Dawn)</option>
            <option value="dusk">dusk (Dusk)</option>
            <option value="midnight">midnight (Late Night)</option>
          </optgroup>
          {#if otherKnownTodKeys.length > 0}
            <optgroup label="Existing in Project / Library">
              {#each otherKnownTodKeys as k}
                <option value={k}>{k}</option>
              {/each}
            </optgroup>
          {/if}
        </select>
      </div>

      <div class="submodal-field">
        <span class="submodal-label">Time of day key:</span>
        <input
          type="text"
          placeholder="e.g. day, evening, night"
          class="submodal-input"
          bind:value={newTodKey}
          on:keydown={(e) => e.key === 'Enter' && confirmAddTod()}
        />
        {#if activeTimeVariants[newTodKey.trim().toLowerCase()]}
          <div class="submodal-warn">
            ⚠ A variant named "{newTodKey}" already exists on this {usePositions ? 'position' : 'state'}.
          </div>
        {/if}
      </div>

      <label class="submodal-check-row">
        <input type="checkbox" bind:checked={todCopyFromBase} />
        <span>Copy current base slot assets (image/audio) into new variant</span>
      </label>

      <div class="submodal-actions">
        <button on:click={() => (showAddTodModal = false)}>Cancel</button>
        <button class="primary" on:click={confirmAddTod} disabled={!newTodKey.trim()}>
          Add Variant
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showAddStateModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-bg submodal-scrim" on:mousedown={onScrimMouseDown} on:click={(e) => handleScrimClose(e, () => (showAddStateModal = false))}>
    <div class="modal submodal-card" on:mousedown|stopPropagation on:click|stopPropagation>
      <button class="modal-x" title="Close (Esc)" on:click={() => (showAddStateModal = false)}>✕</button>
      <h3>✨ Add State Variant</h3>
      <div class="hint">Create an alternative scene state (e.g. crowded, festive, damaged, rainy).</div>

      <div class="submodal-field">
        <span class="submodal-label">Pick suggested or existing state:</span>
        <select
          class="submodal-select"
          value={newStateName}
          on:change={(e) => { if (e.target.value) newStateName = e.target.value; }}
        >
          <option value="">— Select suggested state —</option>
          <optgroup label="Common States">
            <option value="crowded">crowded</option>
            <option value="festive">festive</option>
            <option value="rainy">rainy</option>
            <option value="damaged">damaged</option>
            <option value="ruined">ruined</option>
            <option value="empty">empty</option>
            <option value="dim">dim</option>
            <option value="night">night</option>
            <option value="clean">clean</option>
          </optgroup>
          {#if otherKnownStates.length > 0}
            <optgroup label="Existing in Library">
              {#each otherKnownStates as s}
                <option value={s}>{s}</option>
              {/each}
            </optgroup>
          {/if}
        </select>
      </div>

      <div class="submodal-field">
        <span class="submodal-label">State variant name:</span>
        <input
          type="text"
          placeholder="e.g. crowded, festive, rainy"
          class="submodal-input"
          bind:value={newStateName}
          on:keydown={(e) => e.key === 'Enter' && confirmAddState()}
        />
        {#if activeBg?.states?.[newStateName.trim()]}
          <div class="submodal-warn">
            ⚠ State "{newStateName}" already exists on this background.
          </div>
        {/if}
      </div>

      <div class="submodal-field">
        <span class="submodal-label">Initial slots:</span>
        <select
          class="submodal-select"
          bind:value={stateCopySource}
        >
          {#each Object.keys(activeBg?.states || {}) as stKey}
            <option value={stKey}>Copy from "{stKey}" {stKey === activeStateKey ? '(active)' : ''}</option>
          {/each}
          <option value="blank">Blank (empty slots)</option>
        </select>
      </div>

      <div class="submodal-actions">
        <button on:click={() => (showAddStateModal = false)}>Cancel</button>
        <button class="primary" on:click={confirmAddState} disabled={!newStateName.trim() || newStateName.trim() === 'default'}>
          Add State
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showAddPositionModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-bg submodal-scrim" on:mousedown={onScrimMouseDown} on:click={(e) => handleScrimClose(e, () => (showAddPositionModal = false))}>
    <div class="modal submodal-card" on:mousedown|stopPropagation on:click|stopPropagation>
      <button class="modal-x" title="Close (Esc)" on:click={() => (showAddPositionModal = false)}>✕</button>
      <h3>🎥 Add Camera Position</h3>
      <div class="hint">Configure a courtroom or scene camera angle (e.g. Witness, Prosecution, Defense, Judge).</div>

      <div class="submodal-field">
        <span class="submodal-label">Pick preset or template position:</span>
        <select
          class="submodal-select"
          value={newPosName}
          on:change={(e) => { if (e.target.value) newPosName = e.target.value; }}
        >
          <option value="">— Select preset or template position —</option>
          <optgroup label="Standard Courtroom Presets">
            {#each stdCourtroomPositions as pos}
              <option value={pos}>{pos}</option>
            {/each}
          </optgroup>
          {#if otherKnownPositionKeys.length > 0}
            <optgroup label="From Templates & Library">
              {#each otherKnownPositionKeys as pos}
                <option value={pos}>{pos}</option>
              {/each}
            </optgroup>
          {/if}
        </select>
      </div>

      <div class="submodal-field">
        <span class="submodal-label">Position name:</span>
        <input
          type="text"
          placeholder="e.g. Witness, Prosecution, Defense"
          class="submodal-input"
          bind:value={newPosName}
          on:keydown={(e) => e.key === 'Enter' && confirmAddPosition()}
        />
        {#if activeState?.positions?.[newPosName.trim()]}
          <div class="submodal-warn">
            ⚠ Camera position "{newPosName}" already exists on this state.
          </div>
        {/if}
      </div>

      <div class="submodal-field">
        <span class="submodal-label">Initial slots:</span>
        <select
          class="submodal-select"
          bind:value={posCopySource}
        >
          {#each Object.keys(activeState?.positions || {}) as posK}
            <option value={posK}>Copy from "{posK}" {posK === activePosKey ? '(active)' : ''}</option>
          {/each}
          <option value="__base__">Copy base state slots</option>
          <option value="blank">Blank (empty slots)</option>
        </select>
      </div>

      <label class="submodal-check-row">
        <input type="checkbox" bind:checked={posCopyTod} />
        <span>Copy Time of Day variants from source position</span>
      </label>

      <div class="submodal-actions">
        <button on:click={() => (showAddPositionModal = false)}>Cancel</button>
        <button
          class="primary"
          on:click={confirmAddPosition}
          disabled={!newPosName.trim() || Boolean(activeState?.positions?.[newPosName.trim()])}
        >
          Add Position
        </button>
      </div>

      {#if positionTemplates.length > 0}
        <div class="submodal-divider-row">
          <span>OR IMPORT FROM TEMPLATE</span>
        </div>
        <div class="submodal-field">
          <span class="submodal-label">Load all positions from background template:</span>
          <div class="template-import-row">
            <select class="submodal-select" bind:value={selectedTplIdForPositions}>
              {#each positionTemplates as tpl}
                <option value={tpl.id}>{tpl.name} ({Object.keys(tpl.structure?.positions || {}).length} positions)</option>
              {/each}
            </select>
            <button
              class="mini-btn primary"
              on:click={() => {
                const tpl = positionTemplates.find((t) => t.id === selectedTplIdForPositions);
                if (tpl) importPositionsFromTemplate(tpl);
              }}
            >
              Import All
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if showManageTemplatesModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-bg submodal-scrim" on:mousedown={onScrimMouseDown} on:click={(e) => handleScrimClose(e, () => (showManageTemplatesModal = false))}>
    <div class="modal submodal-card bg-templates-dialog" on:mousedown|stopPropagation on:click|stopPropagation>
      <button class="modal-x" title="Close (Esc)" on:click={() => (showManageTemplatesModal = false)}>✕</button>
      <h3>📋 Background Templates</h3>
      <div class="hint">Apply structural presets (courtroom positions, day/night cycles, trial states) or save custom templates.</div>

      <div class="tpl-list-scroll">
        {#each storeState.templates as tpl}
          <div class="tpl-card-row">
            <div class="tpl-info-col">
              <div class="tpl-title-line">
                <b class="tpl-name-text">{tpl.name}</b>
                {#if tpl.builtin}
                  <span class="default-tag">preset</span>
                {:else}
                  <span class="default-tag custom-tag">custom</span>
                {/if}
              </div>
              <div class="tpl-desc-text">{tpl.description}</div>
              <div class="tpl-spec-meta">
                {#if tpl.structure.usePositions}
                  Positions: {Object.keys(tpl.structure.positions || {}).join(', ')}
                {:else if Object.keys(tpl.structure.time_variants || {}).length > 0}
                  Time variants: {Object.keys(tpl.structure.time_variants || {}).join(', ')}
                {:else}
                  Single scene
                {/if}
                {#if tpl.structure.states && tpl.structure.states.length > 1}
                  · States: {tpl.structure.states.join(', ')}
                {/if}
              </div>
            </div>
            <div class="tpl-action-col">
              <button class="mini-btn primary" title="Apply this template structure to active background" on:click={() => applyTemplateToBg(tpl)}>
                Apply
              </button>
              {#if !tpl.builtin}
                <button class="icon-btn danger" title="Delete custom template" on:click={() => deleteBgTemplate(tpl.id)}>
                  ✕
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Save Current BG as Template -->
      <div class="save-tpl-section">
        <b class="save-tpl-title">Save Active Background as Reusable Template:</b>
        <div class="save-tpl-inputs">
          <input
            type="text"
            placeholder="Template name (e.g. My Courtroom)"
            class="submodal-input flex-1"
            bind:value={newTplName}
          />
          <input
            type="text"
            placeholder="Short description (optional)"
            class="submodal-input flex-15"
            bind:value={newTplDesc}
          />
          <button class="mini-btn" on:click={saveBgAsTemplate}>
            💾 Save Template
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showPurgeConfirmModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-bg submodal-scrim" on:mousedown={onScrimMouseDown} on:click={(e) => handleScrimClose(e, () => (showPurgeConfirmModal = false))}>
    <div class="modal submodal-card purge-confirm-dialog" on:mousedown|stopPropagation on:click|stopPropagation>
      <button class="modal-x" title="Close (Esc)" on:click={() => (showPurgeConfirmModal = false)}>✕</button>

      {#if purgeTargetMode === 'all'}
        <h3>🗑 Purge All Assets</h3>
        <div class="purge-warning-box">
          <div class="purge-warning-badge">⚠️ Destructive Action</div>
          <div class="purge-warning-text">
            This will permanently remove <b>all {assetPool.length} imported asset(s)</b> from memory and browser storage (IndexedDB).
          </div>
          <div class="purge-impact-note">
            Existing backgrounds and states referencing these files will not be deleted, but will show missing asset placeholders until re-imported.
          </div>
        </div>
      {:else}
        <h3>🧹 Purge Unused Assets</h3>
        <div class="purge-info-box">
          <div class="purge-info-text">
            Remove <b>{unusedAssetCount} unreferenced asset(s)</b> from memory and browser storage (IndexedDB)?
          </div>
          <div class="purge-impact-note">
            Assets currently assigned to backgrounds, states, or time variants will remain untouched.
          </div>
        </div>
      {/if}

      <div class="submodal-actions">
        <button on:click={() => (showPurgeConfirmModal = false)}>Cancel</button>
        <button
          class="primary {purgeTargetMode === 'all' ? 'danger-btn' : ''}"
          on:click={executePurge}
        >
          {purgeTargetMode === 'all' ? `🗑 Yes, Purge All (${assetPool.length})` : `🧹 Purge (${unusedAssetCount})`}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Context Menu Overlay -->
{#if bgContextMenu}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="bg-ctx-menu"
    style="top: {bgContextMenu.y}px; left: {bgContextMenu.x}px;"
    on:click|stopPropagation
  >
    <div class="ctx-header-tag">{bgContextMenu.title}</div>
    {#each bgContextMenu.items as it}
      {#if it.separator}
        <div class="ctx-sep"></div>
      {:else}
        <button
          class="ctx-item {it.danger ? 'danger' : ''}"
          disabled={it.disabled}
          on:click={() => { closeContextMenu(); it.run?.(); }}
        >
          {#if it.icon}<span class="ctx-item-icon">{it.icon}</span>{/if}
          <span class="ctx-item-label">{it.label}</span>
        </button>
      {/if}
    {/each}
  </div>
{/if}

<!-- Rename Dialog Submodal -->
{#if showRenameModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-bg submodal-scrim" on:mousedown={onScrimMouseDown} on:click={(e) => handleScrimClose(e, () => (showRenameModal = false))}>
    <div class="modal submodal-card rename-dialog" on:mousedown|stopPropagation on:click|stopPropagation>
      <button class="modal-x" title="Close (Esc)" on:click={() => (showRenameModal = false)}>✕</button>
      <h3>{renameModalConfig.title}</h3>
      {#if renameModalConfig.hint}
        <div class="hint" style="margin-top: 4px; line-height: 1.4;">{renameModalConfig.hint}</div>
      {/if}
      <div class="submodal-field" style="margin-top: 12px;">
        <span class="submodal-label">{renameModalConfig.label}</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          class="submodal-input"
          placeholder={renameModalConfig.placeholder}
          bind:value={renameInputValue}
          on:keydown={(e) => e.key === 'Enter' && submitRenameModal()}
          autofocus
        />
        {#if renameModalError}
          <div class="submodal-warn" style="color: var(--danger); margin-top: 6px;">
            ⚠️ {renameModalError}
          </div>
        {/if}
      </div>
      <div class="submodal-actions">
        <button on:click={() => (showRenameModal = false)}>Cancel</button>
        <button class="primary" on:click={submitRenameModal}>Save Name</button>
      </div>
    </div>
  </div>
{/if}

<!-- Lightbox Asset Inspection Modal -->
{#if inspectModalAsset}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-bg submodal-scrim lightbox-scrim" on:mousedown={onScrimMouseDown} on:click={(e) => handleScrimClose(e, () => (inspectModalAsset = null))}>
    <div class="modal submodal-card inspect-lightbox" on:mousedown|stopPropagation on:click|stopPropagation>
      <div class="lightbox-head">
        <div class="lightbox-head-left">
          <span class="lightbox-badge">{inspectModalAsset.type?.toUpperCase() || 'ASSET'}</span>
          <div class="lightbox-inputs-row">
            <div class="lightbox-input-box" title="Global asset filename in repository pool (updates all backgrounds & areas)">
              <span class="lightbox-tag-prefix">GLOBAL:</span>
              <input
                type="text"
                class="lightbox-input-text"
                bind:value={inspectGlobalName}
                on:blur={applyInspectGlobalRename}
                on:change={applyInspectGlobalRename}
                on:keydown={(e) => {
                  if (e.key === 'Enter') {
                    applyInspectGlobalRename();
                    e.currentTarget.blur();
                  }
                }}
                placeholder="asset_name.png"
              />
            </div>
            <div class="lightbox-input-box" title="Export filename for this background (written to background.json & zip export)">
              <span class="lightbox-tag-prefix">EXPORT:</span>
              <input
                type="text"
                class="lightbox-input-text"
                bind:value={inspectExportName}
                on:blur={applyInspectExportRename}
                on:change={applyInspectExportRename}
                on:keydown={(e) => {
                  if (e.key === 'Enter') {
                    applyInspectExportRename();
                    e.currentTarget.blur();
                  }
                }}
                placeholder="export_name.png"
              />
            </div>
          </div>
        </div>
        <button class="modal-x" title="Close (Esc)" on:click={() => (inspectModalAsset = null)}>✕</button>
      </div>
      <div class="lightbox-body">
        {#if inspectModalAsset.type === 'image' || (inspectModalAsset.name && inspectModalAsset.name.match(/\.(png|webp|jpg|jpeg|gif|svg|avif)$/i))}
          <img src={inspectModalAsset.url} alt={inspectModalAsset.name} class="lightbox-img" />
        {:else}
          <div class="lightbox-audio-player">
            <span class="lightbox-audio-icon">🎵</span>
            <audio src={inspectModalAsset.url} controls autoplay></audio>
          </div>
        {/if}
      </div>
      <div class="lightbox-meta">
        <span>Path: <code>{inspectModalAsset.relPath || inspectModalAsset.name}</code></span>
        {#if inspectModalAsset.size}
          <span>Size: <code>{Math.round(inspectModalAsset.size / 1024)} KB</code></span>
        {/if}
      </div>
    </div>
  </div>
{/if}

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
    transition: outline 0.15s ease;
  }
  .bg-maker-modal.dragover {
    outline: 2px dashed var(--accent);
    outline-offset: -4px;
  }

  .maker-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 12px;
    padding-bottom: 2px;
  }

  .maker-title {
    font-size: 14px;
    margin: 0;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--text-strong);
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-mono);
  }

  .maker-prefix {
    color: var(--accent);
    font-weight: 800;
    margin-right: 2px;
  }

  .maker-title span:not(.maker-prefix):not(.cursor) {
    color: var(--accent2);
    font-weight: 700;
  }

  .maker-title .cursor {
    color: var(--accent);
    font-weight: 800;
    margin-left: 1px;
    animation: cursor-blink 1.1s steps(1) infinite;
  }

  .maker-toolbar-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
    flex-shrink: 0;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .maker-path-strip {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    background: var(--panel2);
    border: 1px solid var(--line);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius);
    padding: 6px 10px 5px 10px;
    box-sizing: border-box;
    flex-shrink: 0;
    gap: 4px;
    transition: all 0.15s ease;
  }
  .maker-path-strip:focus-within {
    border-color: var(--line2);
    border-left-color: var(--accent);
    box-shadow: 0 0 0 1px var(--ring), 0 2px 10px rgba(0, 0, 0, 0.45);
    background: var(--input-bg);
  }

  .path-strip-row {
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
    gap: 8px;
    font-family: var(--font-mono);
  }

  /* Part 1: Fixed base/background/ badge */
  .path-part-prefix {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 3px 8px;
    font-size: 11px;
    color: var(--dim);
    user-select: none;
    flex-shrink: 0;
  }

  .terminal-prompt {
    color: var(--accent);
    font-weight: 800;
  }

  .prefix-text {
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  /* Part 2: Directory Path (70% width, with shortcut dropdown) */
  .path-part-dir {
    flex: 7;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 1px 4px 1px 8px;
    transition: border-color 0.12s ease;
  }
  .path-part-dir:focus-within {
    border-color: var(--accent);
  }

  .dir-input {
    flex: 1 1 0;
    min-width: 0;
    width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 12.5px;
    padding: 3px 0;
    text-overflow: ellipsis;
  }

  .subfolder-dropdown {
    background: var(--panel2);
    border: 1px solid var(--line2);
    border-radius: 3px;
    outline: none;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    cursor: pointer;
    flex-shrink: 0;
    max-width: 140px;
    transition: all 0.15s ease;
  }
  .subfolder-dropdown:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .input-dup-warning {
    color: #f97316 !important;
  }

  .path-dup-badge {
    background: rgba(249, 115, 22, 0.2);
    border: 1px solid #f97316;
    color: #f97316;
    font-size: 10.5px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 3px;
    white-space: nowrap;
    animation: pulse 1.5s infinite;
  }

  .full-path-dup-alert {
    color: #f97316;
    font-weight: 700;
    margin-left: 8px;
    font-size: 9.5px;
  }

  .menu-divider {
    height: 1px;
    background: var(--line);
    margin: 4px 0;
  }

  .danger-item {
    color: #ef4444 !important;
  }
  .danger-item:hover {
    background: rgba(239, 68, 68, 0.15) !important;
    color: #f87171 !important;
  }

  .purge-btn {
    border-color: rgba(239, 68, 68, 0.5) !important;
    color: #ef4444 !important;
  }
  .purge-btn:hover,
  .purge-btn.active {
    background: rgba(239, 68, 68, 0.15) !important;
    border-color: #ef4444 !important;
  }
  .purge-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    border-color: var(--line) !important;
    color: var(--dim) !important;
    background: none !important;
  }

  .purge-drop-menu {
    top: auto;
    bottom: calc(100% + 6px);
    right: 0;
    left: auto;
    min-width: 210px;
    z-index: 100;
  }
  .purge-confirm-dialog {
    width: min(480px, 92vw);
  }
  .purge-warning-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--radius);
  }
  .purge-warning-badge {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #ef4444;
    text-transform: uppercase;
  }
  .purge-warning-text,
  .purge-info-text {
    font-size: 13px;
    line-height: 1.45;
    color: var(--text);
  }
  .purge-info-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .purge-impact-note {
    font-size: 11px;
    color: var(--dim);
    line-height: 1.4;
  }
  .danger-btn {
    background: #dc2626 !important;
    border-color: #ef4444 !important;
    color: #fff !important;
  }
  .danger-btn:hover {
    background: #b91c1c !important;
  }

  .path-divider {
    color: var(--dim);
    font-weight: 800;
    font-size: 14px;
    flex-shrink: 0;
    user-select: none;
  }

  /* Part 3: File / Room Name (30% width) */
  .path-part-file {
    flex: 3;
    min-width: 110px;
    display: flex;
    align-items: center;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 1px 8px;
    transition: border-color 0.12s ease;
  }
  .path-part-file:focus-within {
    border-color: var(--accent);
  }

  .file-input {
    flex: 1 1 0;
    min-width: 0;
    width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: var(--accent);
    font-family: var(--font-mono);
    font-weight: 800;
    font-size: 12.5px;
    padding: 3px 0;
  }

  .icon-tool-btn {
    flex-shrink: 0;
    width: auto;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: 3px;
    color: var(--dim);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.15s ease;
  }
  .icon-tool-btn:hover {
    border-color: var(--line2);
    color: var(--text-strong);
  }

  /* Small font label below input boxes displaying full path */
  .path-strip-full {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: var(--dim);
    padding: 2px 4px 0 4px;
    font-family: var(--font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-top: 1px dashed color-mix(in srgb, var(--line) 60%, transparent);
  }

  .full-path-tag {
    font-weight: 800;
    color: var(--dim);
    letter-spacing: 0.06em;
    font-size: 9.5px;
  }

  .full-path-text {
    color: var(--text);
    opacity: 0.85;
    font-size: 10.5px;
    user-select: text;
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
    overflow: visible;
    position: relative;
  }

  .nav-head {
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    border-bottom: 1px solid var(--line);
    gap: 6px;
  }

  .nav-head-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .nav-title {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--dim);
    white-space: nowrap;
    text-transform: uppercase;
  }

  .nav-head-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    width: 100%;
  }

  .nav-head-actions .mini-btn {
    width: 100%;
    justify-content: center;
    padding: 4px 6px;
    font-size: 11px;
    white-space: nowrap;
    text-align: center;
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
    padding: 4px 10px;
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

  .pos-manage-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-top: 4px;
    border-top: 1px dashed var(--line);
    font-size: 11px;
  }

  .tip-sub {
    color: var(--dim);
    font-size: 10px;
    margin-left: 4px;
  }

  .submodal-divider-row {
    position: relative;
    text-align: center;
    margin: 14px 0 10px;
    border-top: 1px dashed var(--line);
  }
  .submodal-divider-row span {
    position: relative;
    top: -8px;
    background: var(--bg2);
    padding: 0 8px;
    font-size: 9px;
    font-weight: 700;
    color: var(--dim);
    letter-spacing: 0.5px;
  }

  .template-import-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .template-import-row select {
    flex: 1;
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
  .slot-card.drag-target-valid,
  .mini-slot.drag-target-valid {
    outline: 2px dashed var(--accent) !important;
    outline-offset: -2px;
    background: rgba(224, 90, 71, 0.12) !important;
  }
  .slot-card.drag-target-invalid,
  .mini-slot.drag-target-invalid {
    outline: 2px dashed #ef4444 !important;
    outline-offset: -2px;
    background: rgba(239, 68, 68, 0.15) !important;
    cursor: not-allowed !important;
  }
  .mini-slot-picker {
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--dim);
    font-size: 9.5px;
    padding: 2px 4px;
    max-width: 105px;
    cursor: pointer;
    outline: none;
    transition: all 0.15s ease;
  }
  .mini-slot-picker:hover {
    border-color: var(--accent);
    color: var(--text);
  }
  .mslot-clear-btn {
    background: none;
    border: none;
    color: var(--dim);
    font-size: 10px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    margin-left: auto;
    flex-shrink: 0;
    transition: color 0.15s ease;
  }
  .mslot-clear-btn:hover {
    color: #ef4444;
  }

  .slot-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 28px;
  }

  .slot-title-group {
    display: flex;
    flex-direction: column;
    gap: 1.5px;
    min-width: 0;
    flex: 1;
  }

  .slot-title {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-strong);
    letter-spacing: 0.01em;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .slot-desc {
    font-size: 9.5px;
    font-weight: 400;
    color: var(--dim);
    letter-spacing: normal;
    line-height: 1.2;
    opacity: 0.85;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    min-width: 75px;
  }

  .tod-delete-btn {
    flex-shrink: 0;
    margin-left: 2px;
  }

  .toolbar-dropdown-anchor {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .nav-head-actions .toolbar-dropdown-anchor {
    width: 100%;
  }
  .nav-head-actions .toolbar-dropdown-anchor > button {
    width: 100%;
    justify-content: center;
  }

  .templates-drop-menu,
  .import-drop-menu {
    right: 0;
    left: auto;
    width: 280px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 1000;
  }
  .nav-import-drop-menu {
    left: 0;
    right: auto;
    width: 250px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 1000;
  }
  .menu-header-tag {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--dim);
    padding: 4px 6px;
    border-bottom: 1px solid var(--line);
    margin-bottom: 3px;
  }
  .tpl-drop-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 5px 8px;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 11.5px;
    transition: background 0.1s ease;
  }
  .tpl-drop-item:hover {
    background: var(--hover);
  }
  .tpl-item-name {
    color: var(--text-strong);
    font-weight: 500;
  }
  .tpl-item-tag {
    font-size: 9px;
    color: var(--dim);
    background: var(--line);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .submodal-scrim {
    z-index: 100 !important;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(5px);
  }
  .submodal-card {
    width: min(520px, 94vw);
    max-height: 84vh;
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--panel);
    border: 1px solid var(--line2);
    border-radius: var(--radius-lg);
    box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.7);
  }
  .bg-templates-dialog {
    width: min(780px, 94vw);
    max-height: 86vh;
  }
  .submodal-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .submodal-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--dim);
  }
  .submodal-select,
  .submodal-input {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 9px;
    background: var(--input-bg);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    font-size: 12px;
  }
  .submodal-select {
    cursor: pointer;
  }
  .submodal-warn {
    font-size: 11px;
    color: var(--warn);
    margin-top: 2px;
  }
  .submodal-check-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 12px;
    color: var(--text);
    margin: 4px 0 8px;
  }
  .submodal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }
  .tpl-list-scroll {
    margin-top: 6px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 48vh;
    padding-right: 4px;
  }
  .tpl-card-row {
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .tpl-info-col {
    flex: 1;
    min-width: 0;
  }
  .tpl-title-line {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tpl-name-text {
    font-size: 13px;
    color: var(--text-strong);
  }
  .custom-tag {
    background: var(--accent) !important;
    color: #fff !important;
  }
  .tpl-desc-text {
    font-size: 11.5px;
    color: var(--dim);
    margin-top: 2px;
  }
  .tpl-spec-meta {
    font-size: 10.5px;
    color: var(--dim);
    margin-top: 4px;
    opacity: 0.85;
  }
  .tpl-action-col {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-shrink: 0;
  }
  .save-tpl-section {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  .save-tpl-title {
    font-size: 12px;
    color: var(--text-strong);
    display: block;
    margin-bottom: 6px;
  }
  .save-tpl-inputs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .flex-1 { flex: 1; min-width: 180px; }
  .flex-15 { flex: 1.5; min-width: 200px; }

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

  /* Aspect Ratio Toolbar */
  .stage-aspect-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 3px 8px;
    font-family: var(--font-mono);
    font-size: 10px;
    flex-shrink: 0;
  }

  .aspect-left {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .aspect-label {
    font-weight: 800;
    color: var(--dim);
    font-size: 9px;
    letter-spacing: 0.05em;
  }

  .aspect-select {
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: 3px;
    color: var(--text);
    font-size: 10.5px;
    font-family: var(--font-mono);
    padding: 2px 4px;
    outline: none;
    cursor: pointer;
  }
  .aspect-select:hover {
    border-color: var(--line2);
  }

  .aspect-ratio-inputs {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .aspect-num-input {
    width: 28px;
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: 3px;
    color: var(--text-strong);
    font-size: 10.5px;
    font-family: var(--font-mono);
    text-align: center;
    padding: 2px 1px;
    outline: none;
    -moz-appearance: textfield;
  }
  .aspect-num-input::-webkit-outer-spin-button,
  .aspect-num-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .aspect-num-input:focus {
    border-color: var(--accent);
  }

  .aspect-colon {
    font-weight: 800;
    color: var(--dim);
    padding: 0 1px;
  }

  .aspect-right {
    display: flex;
    align-items: center;
  }

  .canvas-viewport {
    width: 100%;
    aspect-ratio: var(--stage-aspect, 16 / 9);
    border: 1px solid var(--line2);
    border-radius: var(--radius);
    background: #000;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: aspect-ratio 0.15s ease;
  }

  .stage-bg-layer {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .stage-fg-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
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
    gap: 8px;
  }

  .dock-toggle-btn {
    padding: 2px 6px;
    font-size: 10px;
    line-height: 1;
    font-weight: 700;
    cursor: pointer;
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

  /* Slot Head Actions & Rename Buttons */
  .slot-head-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }

  .slot-rename-btn {
    font-size: 10px;
    padding: 2px 5px;
    border-radius: 3px;
    background: var(--input-bg);
    border: 1px solid var(--line);
    cursor: pointer;
    line-height: 1;
    color: var(--dim);
    transition: all 0.12s ease;
  }
  .slot-rename-btn:hover {
    background: var(--sel);
    border-color: var(--accent);
    color: var(--accent);
  }

  .slot-name-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
    gap: 2px;
  }

  .alias-tag {
    font-size: 9.5px;
    color: var(--accent2);
    font-family: var(--font-mono);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }
  .alias-tag em {
    font-style: normal;
    color: var(--dim);
  }

  .mslot-alias-dot {
    color: var(--accent2);
    font-size: 8px;
    margin: 0 2px;
    user-select: none;
  }

  .mslot-rename-btn {
    font-size: 9px;
    background: transparent;
    border: none;
    color: var(--dim);
    cursor: pointer;
    padding: 0 2px;
    border-radius: 2px;
    line-height: 1;
    margin-left: auto;
    transition: color 0.12s ease;
  }
  .mslot-rename-btn:hover {
    color: var(--accent2);
    background: var(--sel);
  }

  /* Floating Context Menu */
  .bg-ctx-menu {
    position: fixed;
    z-index: 300;
    min-width: 210px;
    max-width: 290px;
    background: var(--panel);
    border: 1px solid var(--line2);
    border-radius: var(--radius);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    user-select: none;
    font-family: var(--font-sans);
    animation: fadeIn 0.08s ease-out;
  }

  .ctx-header-tag {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--dim);
    padding: 5px 8px 3px 8px;
    font-family: var(--font-mono);
    text-transform: uppercase;
  }

  .ctx-sep {
    height: 1px;
    background: var(--line);
    margin: 3px 0;
  }

  .ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text);
    font-size: 11.5px;
    font-weight: 500;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
    cursor: pointer;
    transition: background 0.1s ease, color 0.1s ease;
  }

  .ctx-item:hover:not(:disabled) {
    background: var(--sel);
    color: var(--text-strong);
  }

  .ctx-item.danger {
    color: var(--danger);
  }

  .ctx-item.danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--danger) 15%, transparent);
    color: #ff6b6b;
  }

  .ctx-item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ctx-item-icon {
    font-size: 12px;
    flex-shrink: 0;
    width: 16px;
    text-align: center;
  }

  .ctx-item-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Lightbox Asset Inspector */
  .lightbox-scrim {
    z-index: 250;
  }

  .inspect-lightbox {
    max-width: 780px;
    width: 92vw;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .lightbox-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
  }

  .lightbox-head-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .lightbox-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    padding: 0 8px;
    font-size: 10px;
    font-weight: 800;
    border-radius: var(--radius-sm, 4px);
    background: rgba(255, 90, 44, 0.08);
    border: 1px solid var(--accent);
    color: var(--accent);
    font-family: var(--font-mono);
    flex-shrink: 0;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    box-sizing: border-box;
  }

  .lightbox-inputs-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .lightbox-input-box {
    display: inline-flex;
    align-items: center;
    height: 26px;
    background: var(--bg-surface, var(--panel));
    border: 1px solid var(--line2, var(--border-subtle, #333));
    border-radius: var(--radius-sm, 4px);
    padding: 0 8px;
    gap: 6px;
    flex: 1;
    min-width: 140px;
    max-width: 320px;
    box-sizing: border-box;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .lightbox-input-box:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px rgba(255, 90, 44, 0.25);
  }

  .lightbox-tag-prefix {
    font-size: 9.5px;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--text-muted, var(--dim));
    letter-spacing: 0.05em;
    flex-shrink: 0;
    user-select: none;
  }

  .lightbox-input-text {
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-strong, #fff);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    width: 100%;
    min-width: 0;
    padding: 0;
  }

  .clickable-preview {
    cursor: pointer;
    transition: transform 0.12s ease, filter 0.12s ease;
  }
  .clickable-preview:hover {
    filter: brightness(1.18);
    transform: scale(1.03);
  }

  .clickable-rename {
    cursor: pointer;
    transition: color 0.12s ease;
  }
  .clickable-rename:hover .asset-filename,
  .clickable-rename:hover.mslot-val {
    color: var(--accent);
    text-decoration: underline dotted;
  }

  .lightbox-body {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    border: 1px solid var(--line);
    border-radius: 4px;
    min-height: 200px;
    max-height: 52vh;
    overflow: hidden;
    padding: 8px;
  }

  .lightbox-img {
    max-width: 100%;
    max-height: 50vh;
    object-fit: contain;
  }

  .lightbox-audio-player {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 24px;
  }

  .lightbox-audio-icon {
    font-size: 38px;
  }

  .lightbox-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: var(--dim);
    padding-top: 6px;
    border-top: 1px solid var(--line);
    font-family: var(--font-mono);
  }
  .lightbox-meta code {
    color: var(--text);
  }

  .rename-dialog {
    max-width: 440px;
  }
</style>
