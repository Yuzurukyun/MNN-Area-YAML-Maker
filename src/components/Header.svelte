<script>
  import {
    state,
    update,
    download,
    historyState,
    undo,
    redo,
    clearHistory,
    theme,
    setTheme,
    notify,
    graphView,
    resetCamera,
    centerCameraOn,
    fitCamera,
    saveLayout,
    applyLayout,
    deleteLayout,
    sortByGroup,
    duplicateSelectedArea,
    deleteSelectedArea,
    settings,
    updateSettings,
  } from '../lib/state.js';
  import * as M from '../lib/core.js';
  import wslCh3Yaml from '../assets/wsl_ch3.yaml?raw';
  import MusicPlayer from './MusicPlayer.svelte';
  import ExportModal from './modals/ExportModal.svelte';
  import ConfirmModal from './modals/ConfirmModal.svelte';
  import HelpModal from './modals/HelpModal.svelte';
  import TemplatesModal from './modals/TemplatesModal.svelte';
  import TestMode from './modals/TestMode.svelte';
  import SettingsModal from './modals/SettingsModal.svelte';
  import BackgroundMakerModal from './modals/BackgroundMakerModal.svelte';
  import AuditModal from './modals/AuditModal.svelte';
  import Icon from './Icon.svelte';
  import { bgStore } from '../lib/bgStore.js';

  let yamlOpen = false;
  let tplOpen = false;
  let helpOpen = false;
  let testOpen = false;
  let settingsOpen = false;
  let auditOpen = false;

  $: isBgMakerOpen = $bgStore.isMakerOpen;

  // Active dropdown: 'file' | 'edit' | 'view' | 'map' | 'tools' | 'link' | 'tb-view' | null
  let activeMenu = null;
  let subMenu = null; // 'example' | 'theme' | 'layouts' | 'arrange'

  let fileYaml;
  let fileJson;
  let pending = null;
  let layoutNameInput = '';

  $: P = $state.project;
  $: lt = $state.activeLink;
  $: selectedArea = P.areas.find((x) => x.id === $state.selectedId);

  $: activeViewCount =
    ($state.focus ? 1 : 0) +
    ($state.isolateSelection ? 1 : 0) +
    ($graphView.hideHub ? 1 : 0) +
    ($graphView.hideAll ? 1 : 0) +
    ($graphView.showAllMesh ? 1 : 0) +
    ($settings.showAllPill ? 1 : 0) +
    ($settings.showMinimap ? 1 : 0) +
    ($settings.hideLinesUnlessFocused ? 1 : 0);



  const REPLACE_WARNING =
    "This replaces your current project and updates autosave (there is no undo across projects). Use Export → JSON first if you want a backup.";

  function closeAllMenus() {
    activeMenu = null;
    subMenu = null;
  }

  function toggleMenu(m) {
    if (activeMenu === m) {
      activeMenu = null;
      subMenu = null;
    } else {
      activeMenu = m;
      subMenu = null;
    }
  }

  function startProject(p) {
    clearHistory();
    update(
      (s) => {
        s.project = M.ensureProject(p);
        s.selectedId = s.project.areas[0].id;
        s.selectedIds = new Set([s.selectedId]);
        s.selectedEdge = null;
        s.focusViewIds = null;
        s.query = '';
      },
      { skipHistory: true },
    );
  }

  function newBlank() {
    closeAllMenus();
    pending = {
      title: 'Start a blank project?',
      body: REPLACE_WARNING,
      confirmLabel: 'Start blank project',
      apply: () => startProject(M.blankProject()),
    };
  }

  function newExampleWsl() {
    closeAllMenus();
    pending = {
      title: 'Load WSL Chapter 3 example?',
      body: REPLACE_WARNING,
      confirmLabel: 'Load WSL Chapter 3',
      apply: () => {
        const report = M.parseYamlWithReport(wslCh3Yaml);
        const p = M.ensureProject({
          areas: report.areas,
          templates: $state.project.templates || [],
          todPresets: $state.project.todPresets || [],
        });
        M.autoArrange(p);
        startProject(p);
        notify(`Loaded WSL Chapter 3 example (${p.areas.length} areas).`, 'ok');
      },
    };
  }

  function newExampleClassic() {
    closeAllMenus();
    pending = {
      title: 'Load Classic sample project?',
      body: REPLACE_WARNING,
      confirmLabel: 'Load Classic sample',
      apply: () => {
        const p = M.sampleProject();
        M.autoArrange(p);
        startProject(p);
        notify(`Loaded Classic sample project (${p.areas.length} areas).`, 'ok');
      },
    };
  }

  function importYaml(e) {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      e.target.value = '';
      const report = M.parseYamlWithReport(t);
      if (report.errors.length || !report.areas.length) {
        notify(report.errors[0] || 'Could not parse any areas from that YAML file.', 'error', 5000);
        return;
      }
      const warnSuffix = report.warnings.length
        ? `\n\nImport notes (${report.warnings.length}):\n• ${report.warnings.slice(0, 5).join('\n• ')}${report.warnings.length > 5 ? `\n• …and ${report.warnings.length - 5} more` : ''}`
        : '';
      pending = {
        title: `Import ${report.areas.length} area${report.areas.length === 1 ? '' : 's'} from YAML?`,
        body: REPLACE_WARNING + warnSuffix,
        confirmLabel: 'Import & auto-arrange',
        apply: () => {
          const next = M.ensureProject({
            areas: report.areas,
            templates: $state.project.templates || [],
            todPresets: $state.project.todPresets || [],
          });
          M.autoArrange(next);
          startProject(next);
          notify(
            report.warnings.length
              ? `Imported ${report.areas.length} areas (${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'}).`
              : `Imported ${report.areas.length} areas from YAML.`,
            report.warnings.length ? 'warn' : 'ok',
          );
        },
      };
    });
  }

  function importJson(e) {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      e.target.value = '';
      try {
        const p = JSON.parse(t);
        if (!p || !Array.isArray(p.areas) || !p.areas.length) {
          notify('That JSON file does not contain a valid project (missing areas list).', 'error', 5000);
          return;
        }
        p.areas.forEach(M.normaliseArea);
        M.ensureProject(p);
        pending = {
          title: `Load project (${p.areas.length} areas)?`,
          body: REPLACE_WARNING,
          confirmLabel: 'Load project',
          apply: () => {
            if (p.backgrounds && Array.isArray(p.backgrounds) && p.backgrounds.length > 0) {
              bgStore.loadBackgrounds(p.backgrounds, { replace: true });
            }
            if (p.bgAssets && Array.isArray(p.bgAssets)) {
              bgStore.loadAssetsMetadata(p.bgAssets);
            }
            startProject(p);
            const bgCount = p.backgrounds?.length || 0;
            notify(
              bgCount > 0
                ? `Loaded project "${f.name}" (${p.areas.length} areas, ${bgCount} background${bgCount === 1 ? '' : 's'}).`
                : `Loaded project "${f.name}" (${p.areas.length} areas).`,
              'ok',
            );
          },
        };
      } catch {
        notify('Invalid JSON file — could not parse project.', 'error', 5000);
      }
    });
  }

  function exportJson() {
    closeAllMenus();
    P.backgrounds = bgStore.get().backgrounds;
    const pool = bgStore.get().assetPool || [];
    if (pool.length > 0) {
      P.bgAssets = pool.map((a) => ({
        name: a.name,
        relPath: a.relPath,
        fromFolder: a.fromFolder || '',
        type: a.type,
        size: a.size,
      }));
    }
    download('areas-project.json', JSON.stringify(P, null, 2), 'application/json');
    const bgCount = P.backgrounds?.length || 0;
    notify(
      bgCount > 0
        ? `Saved project backup (${P.areas.length} areas, ${bgCount} background${bgCount === 1 ? '' : 's'}).`
        : 'Saved project backup (areas-project.json).',
      'ok',
    );
  }

  function handleSaveLayout() {
    const nm = layoutNameInput;
    layoutNameInput = '';
    closeAllMenus();
    saveLayout(nm);
  }

  function runArrange() {
    closeAllMenus();
    update((s) => {
      M.autoArrange(s.project, {
        sortInsideGroup: $settings.sortInsideGroup,
        groupsOnly: $settings.arrangeGroupsOnly,
        separation: $settings.arrangeSeparation || 1.0,
      });
    });
    if ($settings.arrangeFitView) {
      fitCamera();
    }
    notify('Auto-arranged nodes on map.', 'ok');
  }

  function togglePan() {
    graphView.update((g) => ({ ...g, panTool: !g.panTool }));
  }

  function toggleRoute() {
    graphView.update((g) => ({ ...g, routeActive: !g.routeActive }));
  }

  function setLinkTab(tab) {
    update((s) => (s.activeLink = tab));
    closeAllMenus();
  }
</script>

<svelte:window on:pointerdown={closeAllMenus} />

<header class="app-header">
  <!-- (a) Menu bar, title left (music player NOT on this bar, stays separate on right) -->
  <div class="header-menu-row">
    <div class="header-brand-nav">
      <div class="brand" title="Made by Yuzuru">
        <span class="brand-mark">&gt;</span>
        <h1>MNN Area List <span>YAML Maker</span><span class="cursor">_</span></h1>
      </div>

      <nav class="menu-nav">
        <!-- File Menu -->
        <span class="drop-wrap">
          <button
            class="menu-btn {activeMenu === 'file' ? 'active' : ''}"
            on:pointerdown|stopPropagation
            on:click|stopPropagation={() => toggleMenu('file')}
          >
            File ▾
          </button>
          {#if activeMenu === 'file'}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="drop-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
              <button title="Create a fresh project containing only the Hub" on:click={newBlank}>
                <Icon name="plus" /> Blank project…
              </button>
              <button
                class="drop-sub-btn"
                title="Built-in example projects"
                on:click|stopPropagation={() => (subMenu = subMenu === 'example' ? null : 'example')}
              >
                <span><Icon name="folder" /> Example project</span>
                <span>{subMenu === 'example' ? '▾' : '▸'}</span>
              </button>
              {#if subMenu === 'example'}
                <div class="drop-sub">
                  <button title="Load the 47-area Witch Seed Lambda Chapter 3 map" on:click={newExampleWsl}>
                    WSL Chapter 3 (47 areas)…
                  </button>
                  <button title="Load the 8-area classic Class Trial sample project" on:click={newExampleClassic}>
                    Classic sample (8 areas)…
                  </button>
                </div>
              {/if}
              <div class="menu-divider"></div>
              <button title="Import TsuMNN areas.yaml server config" on:click={() => { closeAllMenus(); fileYaml.click(); }}>
                <Icon name="file-up" /> Import YAML (areas.yaml)…
              </button>
              <button title="Import full areas-project.json backup" on:click={() => { closeAllMenus(); fileJson.click(); }}>
                <Icon name="file-text" /> Import JSON project backup…
              </button>
              <button title="Open Background Maker to import assets" on:click={() => { closeAllMenus(); bgStore.openMaker(); }}>
                <Icon name="image-plus" /> Import backgrounds & assets…
              </button>
              <div class="menu-divider"></div>
              <button title="Export finished areas.yaml server file" on:click={() => { closeAllMenus(); yamlOpen = true; }}>
                <Icon name="download" /> Export YAML (areas.yaml)…
              </button>
              <button title="Download full JSON project backup" on:click={exportJson}>
                <Icon name="file-text" /> Export JSON project backup
              </button>
              <button title="Package backgrounds and assets to ZIP" on:click={() => { closeAllMenus(); bgStore.openMaker(); }}>
                <Icon name="image" /> Export background packages (.zip)…
              </button>
              <button title="Export high-resolution PNG image of the canvas" on:click={() => { closeAllMenus(); window.dispatchEvent(new CustomEvent('export-graph-screenshot')); }}>
                <Icon name="image-down" /> Export map snapshot (PNG)
              </button>
            </div>
          {/if}
        </span>

        <!-- Edit Menu -->
        <span class="drop-wrap">
          <button
            class="menu-btn {activeMenu === 'edit' ? 'active' : ''}"
            on:pointerdown|stopPropagation
            on:click|stopPropagation={() => toggleMenu('edit')}
          >
            Edit ▾
          </button>
          {#if activeMenu === 'edit'}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="drop-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
              <button on:click={() => { closeAllMenus(); undo(); }} disabled={!$historyState.canUndo} title="Undo last change (Ctrl+Z)">
                <Icon name="undo" /> Undo (Ctrl+Z)
              </button>
              <button on:click={() => { closeAllMenus(); redo(); }} disabled={!$historyState.canRedo} title="Redo undone change (Ctrl+Shift+Z)">
                <Icon name="redo" /> Redo (Ctrl+Shift+Z)
              </button>
              <div class="menu-divider"></div>
              <button on:click={() => { closeAllMenus(); duplicateSelectedArea(); }} disabled={!$state.selectedId} title="Duplicate selected area">
                <Icon name="copy" /> Duplicate area
              </button>
              <button class="danger" on:click={() => { closeAllMenus(); deleteSelectedArea(); }} disabled={!$state.selectedId || $state.selectedId === P.areas[0]?.id} title="Delete selected area">
                <Icon name="trash" /> Delete area
              </button>
            </div>
          {/if}
        </span>

        <!-- View Menu -->
        <span class="drop-wrap">
          <button
            class="menu-btn {activeMenu === 'view' ? 'active' : ''}"
            on:pointerdown|stopPropagation
            on:click|stopPropagation={() => toggleMenu('view')}
          >
            View ▾
          </button>
          {#if activeMenu === 'view'}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="drop-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
              <button
                class="drop-sub-btn"
                title="Select interface colour theme"
                on:click|stopPropagation={() => (subMenu = subMenu === 'theme' ? null : 'theme')}
              >
                <span><Icon name="palette" /> Theme ({$theme === 'dark' ? 'Dark Terminal' : 'Light Terminal'})</span>
                <span>{subMenu === 'theme' ? '▾' : '▸'}</span>
              </button>
              {#if subMenu === 'theme'}
                <div class="drop-sub">
                  <button on:click={() => { setTheme('dark'); closeAllMenus(); }}>Dark Terminal {$theme === 'dark' ? '✓' : ''}</button>
                  <button on:click={() => { setTheme('light'); closeAllMenus(); }}>Light Terminal {$theme === 'light' ? '✓' : ''}</button>
                </div>
              {/if}
              <div class="menu-divider"></div>
              <label class="menu-check-row" title="Dim unrelated areas when node selected">
                <input
                  type="checkbox"
                  checked={$state.focus}
                  on:change={(e) => update((s) => (s.focus = e.target.checked), { skipHistory: true })}
                />
                <div class="check-text">
                  <b>Only Focused</b>
                  <span class="check-desc">Dim unrelated areas when node selected</span>
                </div>
              </label>

              <label class="menu-check-row" title="Hide everything except selected area and direct neighbours">
                <input
                  type="checkbox"
                  checked={$state.isolateSelection}
                  on:change={(e) => update((s) => (s.isolateSelection = e.target.checked), { skipHistory: true })}
                />
                <div class="check-text">
                  <b>Isolate selection</b>
                  <span class="check-desc">Show only selected area and neighbours</span>
                </div>
              </label>

              <label class="menu-check-row" title="Hide the hub node (Area 0) and lines touching it">
                <input
                  type="checkbox"
                  checked={$graphView.hideHub}
                  on:change={(e) => graphView.update((g) => ({ ...g, hideHub: e.target.checked }))}
                />
                <div class="check-text">
                  <b>Hide Hub</b>
                  <span class="check-desc">Hide Area 0 and lines touching it</span>
                </div>
              </label>

              <label class="menu-check-row" title="Hide areas whose Reachable mode is ALL AREAS">
                <input
                  type="checkbox"
                  checked={$graphView.hideAll}
                  on:change={(e) => graphView.update((g) => ({ ...g, hideAll: e.target.checked }))}
                />
                <div class="check-text">
                  <b>Ignore ALL</b>
                  <span class="check-desc">Hide areas connected to all rooms</span>
                </div>
              </label>

              <label class="menu-check-row" title="Toggle RADAR minimap in bottom-right corner">
                <input
                  type="checkbox"
                  checked={$settings.showMinimap}
                  on:change={(e) => updateSettings((s) => (s.showMinimap = e.target.checked))}
                />
                <div class="check-text">
                  <b>RADAR</b>
                  <span class="check-desc">Show mini-radar navigator</span>
                </div>
              </label>

              <label class="menu-check-row" title="Only show connection lines for selected or focused nodes to optimize performance">
                <input
                  type="checkbox"
                  checked={$settings.hideLinesUnlessFocused}
                  on:change={(e) => updateSettings((s) => (s.hideLinesUnlessFocused = e.target.checked))}
                />
                <div class="check-text">
                  <b>Hide lines (focus only)</b>
                  <span class="check-desc">Only show lines for selected/focused nodes</span>
                </div>
              </label>

              <div class="menu-divider"></div>

              <button on:click={() => { closeAllMenus(); fitCamera(); }} title="Fit view to all areas">
                <Icon name="fit" /> Fit to view
              </button>
              <button on:click={() => { closeAllMenus(); centerCameraOn($state.selectedId); }} title="Center on selected area (C)">
                <Icon name="center" /> Centre on selected
              </button>
            </div>
          {/if}
        </span>

        <!-- Map Menu -->
        <span class="drop-wrap">
          <button
            class="menu-btn {activeMenu === 'map' ? 'active' : ''}"
            on:pointerdown|stopPropagation
            on:click|stopPropagation={() => toggleMenu('map')}
          >
            Map ▾
          </button>
          {#if activeMenu === 'map'}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="drop-menu" style="min-width: 280px;" on:pointerdown|stopPropagation on:click|stopPropagation>
              <button
                class="drop-sub-btn"
                title="Saved board layouts"
                on:click|stopPropagation={() => (subMenu = subMenu === 'layouts' ? null : 'layouts')}
              >
                <span><Icon name="layout-template" /> Layouts</span>
                <span>{subMenu === 'layouts' ? '▾' : '▸'}</span>
              </button>
              {#if subMenu === 'layouts'}
                <div class="drop-sub">
                  {#each P.layouts || [] as l}
                    <div style="display:flex;gap:4px;align-items:center;">
                      <button style="flex:1" on:click={() => { closeAllMenus(); applyLayout(l); }}>{l.name}</button>
                      <button style="width:24px;text-align:center;padding:2px" title="Delete layout" on:click={() => deleteLayout(l.id)}>✕</button>
                    </div>
                  {:else}
                    <div class="drop-hint" style="padding:4px 6px">No saved layouts.</div>
                  {/each}
                  <div style="display:flex;gap:4px;margin-top:4px;border-top:1px solid var(--line);padding-top:4px">
                    <input type="text" placeholder="Layout name" style="flex:1;font-size:11px;padding:3px" bind:value={layoutNameInput} />
                    <button class="mini-btn" on:click={handleSaveLayout}>Save</button>
                  </div>
                </div>
              {/if}

              <button
                class="drop-sub-btn"
                title="Auto-arrange board nodes"
                on:click|stopPropagation={() => (subMenu = subMenu === 'arrange' ? null : 'arrange')}
              >
                <span><Icon name="play" /> Auto-arrange</span>
                <span>{subMenu === 'arrange' ? '▾' : '▸'}</span>
              </button>
              {#if subMenu === 'arrange'}
                <div class="drop-sub">
                  <button class="mini-btn" style="width:100%;margin-bottom:4px" on:click={runArrange}>
                    Run Auto-arrange
                  </button>
                  <label class="menu-check-row">
                    <input
                      type="checkbox"
                      checked={$settings.sortInsideGroup}
                      on:change={(e) => updateSettings((s) => (s.sortInsideGroup = e.target.checked))}
                    />
                    <div class="check-text">
                      <b>Sort inside group</b>
                      <span class="check-desc">Grids nodes inside container</span>
                    </div>
                  </label>
                  <label class="menu-check-row">
                    <input
                      type="checkbox"
                      checked={$settings.arrangeFitView}
                      on:change={(e) => updateSettings((s) => (s.arrangeFitView = e.target.checked))}
                    />
                    <div class="check-text">
                      <b>Fit view after arrange</b>
                    </div>
                  </label>
                  <label class="menu-check-row">
                    <input
                      type="checkbox"
                      checked={$settings.arrangeGroupsOnly}
                      on:change={(e) => updateSettings((s) => (s.arrangeGroupsOnly = e.target.checked))}
                    />
                    <div class="check-text">
                      <b>Arrange groups only</b>
                    </div>
                  </label>
                </div>
              {/if}

              <button on:click={() => { closeAllMenus(); sortByGroup(); }} title="Reorder area IDs so group members hold consecutive IDs">
                <Icon name="sliders" /> Sort IDs
              </button>
            </div>
          {/if}
        </span>

        <!-- Tools Menu -->
        <span class="drop-wrap">
          <button
            class="menu-btn {activeMenu === 'tools' ? 'active' : ''}"
            on:pointerdown|stopPropagation
            on:click|stopPropagation={() => toggleMenu('tools')}
          >
            Tools ▾
          </button>
          {#if activeMenu === 'tools'}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="drop-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
              <button on:click={() => { closeAllMenus(); testOpen = true; }} title="Walk through the live map like a player">
                <Icon name="play" /> Test Mode
              </button>
              <button on:click={() => { closeAllMenus(); tplOpen = true; }} title="Manage reusable field/permission templates">
                <Icon name="layout-template" /> Templates
              </button>
              <button on:click={() => { closeAllMenus(); settingsOpen = true; }} title="Adjust auto-arrange spacing, line thickness & glow">
                <Icon name="settings" /> Settings
              </button>
              <div class="menu-divider"></div>
              <button on:click={() => { closeAllMenus(); toggleRoute(); }} title="Trace shortest walkable route between areas">
                <Icon name="route" /> Route
              </button>
              <button on:click={() => { closeAllMenus(); auditOpen = true; }} title="Audit map network for isolated rooms and traps">
                <Icon name="clipboard-check" /> Audit
              </button>
              <div class="menu-divider"></div>
              <button on:click={() => { closeAllMenus(); helpOpen = true; }} title="Open the full usage guide and shortcut reference">
                <Icon name="circle-help" /> Help
              </button>
            </div>
          {/if}
        </span>
      </nav>
    </div>

    <!-- Music player: DO NOT TOUCH, in its current header position -->
    <div class="header-player-slot">
      <MusicPlayer />
    </div>
  </div>

  <!-- Permanent toolbar: Pan, Reset, Centre | Reachable ▾ | right side: Background Maker, Test Mode, Export -->
  <div class="header-toolbar-row">
    <!-- Group 1: Pan, Reset, Centre -->
    <div class="tb-group">
      <button
        class="tb-btn {$graphView.panTool ? 'active' : ''}"
        on:click={togglePan}
        title="Toggle drag-to-pan tool (Space + drag)"
      >
        <Icon name="pan" /> Pan
      </button>
      <button
        class="tb-btn"
        on:click={resetCamera}
        title="Reset camera zoom & position to default 100% (Home or 0)"
      >
        <Icon name="reset" /> Reset
      </button>
      <button
        class="tb-btn"
        on:click={() => centerCameraOn($state.selectedId)}
        title="Center camera on selected area (C)"
      >
        <Icon name="center" /> Centre
      </button>
    </div>

    <span class="tb-divider"></span>

    <!-- Group 2: Reachable layer dropdown -->
    <div class="tb-group">
      <span class="drop-wrap">
        <button
          class="tb-btn"
          title="Choose which link layer to display and edit on the map"
          on:pointerdown|stopPropagation
          on:click|stopPropagation={() => toggleMenu('link')}
        >
          {#if lt === 'reachable'}
            <Icon name="link" /> Reachable
          {:else if lt === 'visible'}
            <Icon name="eye" /> Visible
          {:else if lt === 'scream'}
            <Icon name="megaphone" /> Scream
          {/if} ▾
        </button>
        {#if activeMenu === 'link'}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div class="drop-menu link-mode-menu" on:pointerdown|stopPropagation on:click|stopPropagation>
            <button class="link-opt {lt === 'reachable' ? 'active' : ''}" on:click={() => setLinkTab('reachable')}>
              <Icon name="link" />
              <div class="link-opt-text">
                <b>Reachable</b>
                <span class="link-opt-desc">Walkable connections (reachable_areas)</span>
              </div>
              {#if lt === 'reachable'}<span class="link-check">✓</span>{/if}
            </button>
            <button class="link-opt {lt === 'visible' ? 'active' : ''}" on:click={() => setLinkTab('visible')}>
              <Icon name="eye" />
              <div class="link-opt-text">
                <b>Visible</b>
                <span class="link-opt-desc">Visible passages even if unreachable (visible_areas)</span>
              </div>
              {#if lt === 'visible'}<span class="link-check">✓</span>{/if}
            </button>
            <button class="link-opt {lt === 'scream' ? 'active' : ''}" on:click={() => setLinkTab('scream')}>
              <Icon name="megaphone" />
              <div class="link-opt-text">
                <b>Scream</b>
                <span class="link-opt-desc">Areas that hear shouts (scream_range)</span>
              </div>
              {#if lt === 'scream'}<span class="link-check">✓</span>{/if}
            </button>
          </div>
        {/if}
      </span>
    </div>

    <div class="tb-spacer"></div>

    <span class="tb-divider"></span>

    <!-- Right side: Background Maker + Test Mode (Tier 2) + filled Export (Tier 1) -->
    <div class="tb-group tb-right">
      <button
        class="tb-btn"
        on:click={() => bgStore.openMaker()}
        title="Visual background.json builder & asset pool manager"
      >
        <Icon name="image" /> Backgrounds
      </button>

      <button
        class="tb-btn"
        on:click={() => (testOpen = true)}
        title="Walk through the live map like a player to verify exits"
      >
        <Icon name="play" /> Test Mode
      </button>

      <button
        class="export-btn-tier1"
        on:click={() => (yamlOpen = true)}
        title="Export finished areas.yaml server file or project backup"
      >
        <Icon name="download" /> Export
      </button>
    </div>
  </div>

  <input type="file" accept=".yaml,.yml,.txt" hidden bind:this={fileYaml} on:change={importYaml} />
  <input type="file" accept=".json" hidden bind:this={fileJson} on:change={importJson} />
</header>

{#if yamlOpen}
  <ExportModal {P} onClose={() => (yamlOpen = false)} />
{/if}

{#if testOpen}
  <TestMode {P} onClose={() => (testOpen = false)} />
{/if}

{#if settingsOpen}
  <SettingsModal on:close={() => (settingsOpen = false)} />
{/if}

{#if auditOpen}
  <AuditModal project={P} onClose={() => (auditOpen = false)} />
{/if}

{#if pending}
  <ConfirmModal
    title={pending.title}
    body={pending.body}
    confirmLabel={pending.confirmLabel}
    onConfirm={() => { const p = pending; pending = null; p.apply(); }}
    onCancel={() => (pending = null)}
  />
{/if}

{#if helpOpen}
  <HelpModal onClose={() => (helpOpen = false)} />
{/if}

{#if tplOpen}
  <TemplatesModal on:close={() => (tplOpen = false)} />
{/if}

{#if isBgMakerOpen}
  <BackgroundMakerModal on:close={() => bgStore.closeMaker()} />
{/if}

<style>
  .app-header {
    display: flex;
    flex-direction: column;
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--panel2) 70%, transparent), transparent),
      var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    position: relative;
    z-index: 50;
    overflow: visible;
    padding: 6px 12px 8px;
    gap: 6px;
    width: 100%;
    box-sizing: border-box;
    align-items: stretch;
  }

  .header-menu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 28px;
    width: 100%;
    align-self: stretch;
    position: relative;
    z-index: 60;
  }

  .header-brand-nav {
    display: flex;
    align-items: center;
    gap: 14px;
    flex: 0 0 auto;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .brand-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius);
    background: var(--sel);
    border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
    color: var(--accent);
    font-size: 13px;
    font-weight: 800;
    flex: none;
    box-shadow: 0 0 12px -4px var(--glow) inset;
  }

  .brand h1 {
    font-size: 13.5px;
    margin: 0;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--text-strong);
    white-space: nowrap;
  }

  .brand h1 span:not(.cursor) {
    color: var(--accent2);
    font-weight: 700;
  }

  .brand h1 .cursor {
    color: var(--accent);
    font-weight: 800;
    margin-left: 1px;
    animation: cursor-blink 1.1s steps(1) infinite;
  }

  .menu-nav {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .menu-btn {
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius);
    color: var(--text);
    padding: 3px 8px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
  }

  .menu-btn:hover {
    background: var(--hover);
    border-color: var(--line2);
    color: var(--text-strong);
  }

  .menu-btn.active {
    border-color: var(--accent) !important;
    background: var(--panel2);
    color: var(--text-strong);
  }

  .header-player-slot {
    flex-shrink: 0;
    margin-left: auto;
  }

  /* Permanent Toolbar Row */
  .header-toolbar-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-top: 5px;
    border-top: 1px solid var(--line);
    min-width: 0;
    width: 100%;
    align-self: stretch;
    overflow: visible;
    position: relative;
    z-index: 50;
  }

  .tb-group {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .tb-divider {
    width: 1px;
    height: 18px;
    background: var(--line);
    margin: 0;
    flex: none;
  }

  .tb-btn {
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 4px 9px;
    font-size: 11.5px;
    color: var(--text);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
    white-space: nowrap;
  }

  .tb-btn:hover:not(:disabled) {
    background: var(--hover);
    border-color: var(--line2);
    color: var(--text-strong);
  }

  .tb-btn.active {
    border-color: var(--accent) !important;
    background: var(--panel2);
    color: var(--text-strong);
  }

  .tb-btn:disabled {
    opacity: 0.4 !important;
    cursor: not-allowed;
  }

  /* Tier 1: Export is ONLY filled button */
  .export-btn-tier1 {
    background: var(--accent) !important;
    color: #0e0e12 !important;
    font-weight: 700 !important;
    border: 1px solid var(--accent) !important;
    border-radius: var(--radius);
    padding: 4px 12px;
    font-size: 11.5px;
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
    color: #0e0e12 !important;
  }

  .export-btn-tier1:active {
    transform: scale(0.98);
  }

  .tb-spacer {
    flex: 1;
    min-width: 12px;
  }

  .drop-wrap {
    position: relative;
    display: inline-block;
  }

  .drop-menu {
    position: absolute;
    top: calc(100% + 5px);
    left: 0;
    min-width: 240px;
    background: var(--panel2);
    border: 1px solid var(--line2);
    border-radius: var(--radius-lg);
    padding: 5px;
    z-index: 90;
    box-shadow: 0 18px 40px -8px var(--shadow);
    animation: pop-in 0.12s ease;
  }

  .drop-menu button {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    border-radius: var(--radius);
    padding: 6px 9px;
    color: var(--text);
    cursor: pointer;
    font-size: 12px;
  }

  .drop-menu button:hover:not(:disabled) {
    background: var(--sel);
    border-left-color: var(--accent);
    color: var(--text-strong);
  }

  .menu-divider {
    height: 1px;
    background: var(--line);
    margin: 4px 0;
  }

  .menu-check-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: var(--radius);
    transition: background 0.1s ease;
  }

  .menu-check-row:hover {
    background: var(--hover);
  }

  .menu-check-row input {
    margin-top: 2px;
    flex: none;
    cursor: pointer;
  }

  .menu-check-row .check-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    line-height: 1.25;
  }

  .menu-check-row b {
    font-size: 11.5px;
    color: var(--text-strong);
  }

  .menu-check-row .check-desc {
    font-size: 10px;
    color: var(--dim);
  }

  .link-mode-menu {
    left: 0;
    width: 250px;
    padding: 5px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .link-opt {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 5px 8px;
    border-radius: var(--radius);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    text-align: left;
  }

  .link-opt:hover {
    background: var(--hover);
  }

  .link-opt.active {
    background: var(--sel);
    border-color: var(--accent);
  }

  .link-opt-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    line-height: 1.2;
  }

  .link-opt-text b {
    font-size: 11.5px;
    color: var(--text-strong);
  }

  .link-opt-desc {
    font-size: 9.5px;
    color: var(--dim);
  }

  .link-check {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
  }

  .drop-sub-btn {
    display: flex !important;
    align-items: center;
    justify-content: space-between;
  }

  .drop-sub {
    margin: 2px 0 4px 10px;
    padding-left: 6px;
    border-left: 1px solid var(--line2);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .drop-sub button {
    font-size: 11.5px;
    padding: 4px 7px;
    color: var(--dim);
  }

  .drop-hint {
    padding: 6px 8px;
    font-size: 10.5px;
    line-height: 1.4;
    color: var(--dim);
  }
</style>
