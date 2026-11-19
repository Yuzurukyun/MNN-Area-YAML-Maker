<script>
  import { state, update, download, historyState, undo, redo, clearHistory, theme, setTheme, notify } from '../lib/state.js';
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
  import { bgStore } from '../lib/bgStore.js';

  let yamlOpen = false;
  let tplOpen = false;
  let helpOpen = false;
  let testOpen = false;
  let settingsOpen = false;

  $: isBgMakerOpen = $bgStore.isMakerOpen;
  let newMenu = false;
  let exampleMenu = false;
  let importMenu = false;
  let exportMenu = false;
  let fileYaml;
  let fileJson;
  let pending = null;

  $: P = $state.project;

  const REPLACE_WARNING =
    "This replaces your current project and updates autosave (there is no undo across projects). Use Export → JSON first if you want a backup.";

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
    newMenu = false;
    exampleMenu = false;
    pending = {
      title: 'Start a blank project?',
      body: REPLACE_WARNING,
      confirmLabel: 'Start blank project',
      apply: () => startProject(M.blankProject()),
    };
  }

  function newExampleWsl() {
    newMenu = false;
    exampleMenu = false;
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
    newMenu = false;
    exampleMenu = false;
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
    exportMenu = false;
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
</script>

<svelte:window on:click={() => { newMenu = false; exampleMenu = false; importMenu = false; exportMenu = false; }} />

<header>
  <div class="brand" title="Made by Yuzuru">
    <span class="brand-mark">&gt;</span>
    <h1>MNN Area List <span>YAML Maker</span><span class="cursor">_</span></h1>
  </div>
  <div class="grp">
    <span class="drop-wrap">
      <button title="Start a blank or example project" on:click|stopPropagation={() => { newMenu = !newMenu; exampleMenu = false; importMenu = false; exportMenu = false; }}>New ▾</button>
      {#if newMenu}
        <div class="drop-menu">
          <button title="Create a fresh project containing only the Hub" on:click={newBlank}>Blank project — just the hub…</button>
          <button
            class="drop-sub-btn"
            title="Choose from built-in example projects"
            on:click|stopPropagation={() => (exampleMenu = !exampleMenu)}
          >
            <span>Example project</span><span>{exampleMenu ? '▾' : '▸'}</span>
          </button>
          {#if exampleMenu}
            <div class="drop-sub">
              <button title="Load the 47-area Witch Seed Lambda Chapter 3 map (wsl_ch3.yaml)" on:click={newExampleWsl}>WSL Chapter 3 (47 areas)…</button>
              <button title="Load the 8-area classic Class Trial sample project" on:click={newExampleClassic}>Classic sample (8 areas)…</button>
            </div>
          {/if}
          <div class="drop-hint">Starting over replaces your current project and autosave. You'll be asked to confirm first.</div>
        </div>
      {/if}
    </span>
    <span class="drop-wrap">
      <button title="Import an existing areas.yaml or JSON project backup" on:click|stopPropagation={() => { importMenu = !importMenu; newMenu = false; exportMenu = false; }}>Import ▾</button>
      {#if importMenu}
        <div class="drop-menu">
          <button title="Import a TsuMNN areas.yaml file and auto-arrange nodes" on:click={() => { importMenu = false; fileYaml.click(); }}>YAML — import server config (areas.yaml)…</button>
          <button title="Load a saved areas-project.json backup (restores areas, groups, backgrounds)" on:click={() => { importMenu = false; fileJson.click(); }}>JSON — import project backup (areas-project.json)…</button>
          <button title="Open Background Maker to import background packages or libraries" on:click={() => { importMenu = false; bgStore.openMaker(); }}>ZIP / JSON — import backgrounds & assets…</button>
          <div class="drop-hint">Import replaces everything. YAML auto-arranges nodes on the map; JSON restores positions, groups, and backgrounds.</div>
        </div>
      {/if}
    </span>
    <span class="drop-wrap">
      <button class="primary" title="Export finished areas.yaml or save a JSON project backup" on:click|stopPropagation={() => { exportMenu = !exportMenu; newMenu = false; importMenu = false; }}>Export ▾</button>
      {#if exportMenu}
        <div class="drop-menu">
          <button title="Preview, validate, copy, or download areas.yaml" on:click={() => { exportMenu = false; yamlOpen = true; }}>YAML — server config (areas.yaml)…</button>
          <button title="Download full project backup including positions, templates and backgrounds" on:click={exportJson}>JSON — project backup (areas-project.json)</button>
          <button title="Build, manage, and export background.json and asset packages (.zip)" on:click={() => { exportMenu = false; bgStore.openMaker(); }}>ZIP — background packages & assets (.zip)…</button>
          <div class="drop-hint">JSON saves full project data (nodes, positions, backgrounds). YAML is the server config. ZIP packages visual/audio assets.</div>
        </div>
      {/if}
    </span>
    <button class="snapshot-header-btn" title="Export high-resolution PNG image of the visible map canvas" on:click={() => window.dispatchEvent(new CustomEvent('export-graph-screenshot'))}>📷</button>
    <span class="h-sep"></span>
    <button on:click={undo} disabled={!$historyState.canUndo} title="Undo last change (Ctrl+Z)">↩ Undo</button>
    <button on:click={redo} disabled={!$historyState.canRedo} title="Redo undone change (Ctrl+Shift+Z)">↪ Redo</button>
  </div>
  <div class="sp"></div>
  <div class="grp">
    <label class="theme-picker" title="Switch interface colour theme (Dark Terminal or Light Terminal)">
      <span>Theme</span>
      <select value={$theme} title="Select colour theme" on:change={(e) => setTheme(e.target.value)}>
        <option value="dark">Dark Terminal</option>
        <option value="light">Light Terminal</option>
      </select>
    </label>
    <button on:click={() => (testOpen = true)} title="Walk through the live map like a player to verify exits">▶ Test mode</button>
    <button on:click={() => bgStore.openMaker()} title="Visual background.json builder & asset pool manager">🖼 Backgrounds</button>
    <button on:click={() => (tplOpen = true)} title="Manage reusable field/permission templates">Templates</button>
    <button on:click={() => (settingsOpen = true)} title="Adjust auto-arrange spacing, line thickness & glow">⚙ Settings</button>
    <MusicPlayer />
    <button on:click={() => (helpOpen = true)} title="Open the full usage guide and shortcut reference">? Help</button>
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
