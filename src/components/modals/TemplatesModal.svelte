<script>
  import { createEventDispatcher } from 'svelte';
  import { state, update, download, notify } from '../../lib/state.js';
  import * as M from '../../lib/core.js';

  const dispatch = createEventDispatcher();
  let editingId = null;
  let newName = '';
  let fileTplImport;

  $: P = $state.project;
  $: all = M.allTemplates(P);
  $: editing = editingId ? M.templateById(P, editingId) : null;
  $: sel = P.areas.find((x) => x.id === $state.selectedId);
  const driftCount = (t) => P.areas.filter((a) => a.templateId === t.id && M.drifted(P, a)).length;
  const isBool = (k) => Object.prototype.hasOwnProperty.call(M.BOOL_DEFAULT, k);

  function apply(t) {
    update((s) => {
      const ar = s.project.areas.find((x) => x.id === s.selectedId);
      if (ar) M.applyTemplate(ar, t);
    });
    notify(`Applied "${t.name}" to ${sel?.area || 'area'}.`, 'ok');
  }

  function del(t) {
    update((s) => {
      s.project.templates = s.project.templates.filter((x) => x.id !== t.id);
      s.project.areas.forEach((a) => {
        if (a.templateId === t.id) a.templateId = null;
      });
    });
    if (editingId === t.id) editingId = null;
  }

  function createFromArea() {
    if (!sel) return;
    const name = M.strip(newName) || 'Template ' + ((P.templates || []).length + 1);
    const values = {};
    M.TEMPLATE_FIELDS.forEach((k) => (values[k] = sel[k]));
    const tpl = { id: 't' + Date.now().toString(36), name, values, include: [...M.TEMPLATE_FIELDS] };
    update((s) => {
      if (!Array.isArray(s.project.templates)) s.project.templates = [];
      s.project.templates.push(tpl);
    });
    editingId = tpl.id;
    newName = '';
    notify(`Created template "${name}".`, 'ok');
  }

  function fixAll() {
    let fixed = 0;
    update((s) =>
      s.project.areas.forEach((a) => {
        if (M.drifted(s.project, a)) {
          M.syncToTemplate(s.project, a);
          fixed++;
        }
      }),
    );
    notify(fixed ? `Synced ${fixed} drifted area(s).` : 'All template-linked areas are already in sync.', 'info');
  }

  function setInclude(t, k, on) {
    update((s) => {
      const tp = s.project.templates.find((x) => x.id === t.id);
      if (!tp) return;
      if (on && !tp.include.includes(k)) tp.include.push(k);
      if (!on) tp.include = tp.include.filter((x) => x !== k);
    });
  }

  function setValue(t, k, v) {
    update((s) => {
      const tp = s.project.templates.find((x) => x.id === t.id);
      if (tp) tp.values[k] = v;
    });
  }

  function exportJson() {
    const data = {
      kind: 'area-maker-templates',
      templates: all.map((t) => ({ name: t.name, include: t.include, values: t.values })),
    };
    download('area-templates.json', JSON.stringify(data, null, 2), 'application/json');
    notify('Exported templates to area-templates.json.', 'ok');
  }

  function importJson(e) {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      e.target.value = '';
      try {
        const p = JSON.parse(t);
        const arr = Array.isArray(p) ? p : p.templates;
        if (Array.isArray(arr)) {
          let count = 0;
          update((s) => {
            if (!Array.isArray(s.project.templates)) s.project.templates = [];
            arr.forEach((t2) => {
              if (!t2 || !t2.name || !t2.values) return;
              s.project.templates.push({
                id: 't' + Date.now().toString(36) + Math.floor(Math.random() * 999),
                name: M.strip(t2.name),
                values: t2.values,
                include: Array.isArray(t2.include) ? t2.include : Object.keys(t2.values),
              });
              count++;
            });
          });
          notify(`Imported ${count} template(s).`, 'ok');
          return;
        }
      } catch {
        /* fall through */
      }
      notify('Could not read templates from that JSON file.', 'error');
    });
  }
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && dispatch('close')} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal-bg" on:click={() => dispatch('close')}>
  <div class="modal" on:click|stopPropagation>
    <button class="modal-x" title="Close" on:click={() => dispatch('close')}>✕</button>
    <h3>Templates</h3>
    <div class="hint">
      Templates capture field defaults and toggles (never name, background or description).
      Areas keep their own snapshot and flag ⚠ if they drift later.
    </div>
    <div style="margin-top:10px">
      {#each all as t}
        <div class="tpl-row">
          <span class="nm">
            <b>{t.name}</b>
            <span class="hint">
              {t.include.length} fields{t.builtin ? ' · built-in' : ''}{#if driftCount(t)} ·
                <span style="color:var(--warn)">⚠ {driftCount(t)} differ</span>{/if}
            </span>
          </span>
          <button title="Apply '{t.name}' values to the currently selected area" on:click={() => apply(t)}>Apply to selected</button>
          {#if !t.builtin}
            <button title="Edit fields included in '{t.name}'" on:click={() => (editingId = editingId === t.id ? null : t.id)}>{editingId === t.id ? 'Done editing' : 'Edit'}</button>
            <button class="danger" title="Delete custom template '{t.name}'" on:click={() => del(t)}>Delete</button>
          {/if}
        </div>
      {/each}
    </div>
    <div class="row" style="justify-content:flex-start">
      <input type="text" title="Name for the new template" placeholder="New template name" style="flex:1" bind:value={newName} />
      <button title="Save the selected area's current settings as a new template" on:click={createFromArea}>Create from selected area</button>
    </div>
    {#if editing}
      <h4 style="margin:12px 0 2px">Editing: {editing.name}</h4>
      <div class="hint">Ticked fields are written when applying the template.</div>
      <div class="tpl-fields">
        {#each M.TEMPLATE_FIELDS as k}
          <label class="tgl">
            <input
              type="checkbox"
              title="Include in template"
              checked={editing.include.includes(k)}
              on:change={(e) => setInclude(editing, k, e.target.checked)}
            />
            <span class="fn">{k}</span>
            {#if isBool(k)}
              <input type="checkbox" checked={!!editing.values[k]} on:change={(e) => setValue(editing, k, e.target.checked)} />
              <span class="fd">{editing.values[k] ? 'true' : 'false'}</span>
            {:else if k === 'afk_delay'}
              <input type="number" min="0" style="width:80px" value={editing.values[k] || 0} on:change={(e) => setValue(editing, k, Math.max(0, parseInt(e.target.value) || 0))} />
            {:else}
              <input type="text" style="width:130px" value={editing.values[k] || ''} on:change={(e) => setValue(editing, k, M.strip(e.target.value))} />
            {/if}
          </label>
        {/each}
      </div>
    {/if}
    <div class="row" style="justify-content:flex-start">
      <button title="Download all templates as a JSON file to share or back up" on:click={exportJson}>Export templates (JSON)</button>
      <button title="Import templates from a JSON file" on:click={() => fileTplImport.click()}>Import templates (JSON)</button>
      <input type="file" accept=".json" hidden bind:this={fileTplImport} on:change={importJson} />
    </div>
    <div class="row">
      <button title="Re-sync all areas that drifted from their assigned template" on:click={fixAll}>Sync all drifted areas</button>
      <button class="primary" title="Close templates window" on:click={() => dispatch('close')}>Close</button>
    </div>
  </div>
</div>

<style>
  .tpl-fields {
    overflow-y: auto;
    max-height: 36vh;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 6px 10px;
    margin-top: 8px;
  }
</style>
