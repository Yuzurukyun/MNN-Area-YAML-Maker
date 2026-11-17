<script>
  import { state, update, selectOnly, uiScale, refocusView, notify, centerCameraOn } from '../../lib/state.js';
  import * as M from '../../lib/core.js';

  export let onAddArea;

  let fileYamlAdd;
  let fileJsonAdd;
  let suppressClick = false;
  let addMenu = false;

  $: P = $state.project;
  $: q = M.strip($state.query).toLowerCase();
  $: dups = M.dupNames(P);
  $: rows = P.areas
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => !q || a.area.toLowerCase().includes(q) || String(i) === q);

  function badges(a, i) {
    const out = [];
    if (dups.has(M.strip(a.area))) out.push({ t: 'DUPLICATE', cls: 'tag dup' });
    if (i === 0) out.push({ t: 'HUB · AREA 0', cls: 'tag hub' });
    if (a.links.reachable.mode === 'all') out.push({ t: 'REACHABLE: ALL', cls: 'badge all' });
    if (a.lobby_area) out.push({ t: 'lobby', cls: 'badge' });
    if (a.private_area) out.push({ t: 'private', cls: 'badge' });
    return out;
  }

  function itemTitle(a, i) {
    const t = [];
    if (dups.has(M.strip(a.area))) t.push('Duplicate name — area names must be unique.');
    if (i === 0) t.push("Area 0 is the hub — it can't be deleted or moved");
    else t.push('Ctrl+drag or use ↑/↓ to reorder');
    t.push('Double-click to center on map');
    return t.join(' · ');
  }

  function dblClickArea(a) {
    update((s) => {
      selectOnly(s, a.id);
      refocusView(s);
    });
    centerCameraOn(a.id);
  }

  function pick(a) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    update((s) => {
      selectOnly(s, a.id);
      refocusView(s);
    });
  }

  function moveArea(e, i, delta) {
    e.stopPropagation();
    const target = i + delta;
    if (target < 1 || target >= P.areas.length) return;
    update((s) => M.reorderArea(s.project, i, target));
  }

  function del(e, a) {
    e.stopPropagation();
    update((s) => {
      M.deleteArea(s.project, a.id);
      s.selectedIds.delete(a.id);
      if (s.selectedId === a.id || !s.project.areas.some((x) => x.id === s.selectedId)) {
        s.selectedId = s.project.areas[0].id;
      }
      if (!s.selectedIds.size) s.selectedIds.add(s.selectedId);
      s.selectedEdge = null;
    });
  }

  function startReorder(e, i, el) {
    if (!(e.ctrlKey || e.metaKey) || e.target.closest('button')) return;
    e.preventDefault();
    const startY = e.clientY;
    const stepH = el.offsetHeight + 3;
    let curIdx = i;
    let moved = false;
    el.classList.add('reordering');
    const mv = (e2) => {
      const dy = (e2.clientY - startY) / uiScale.value;
      if (Math.abs(dy) > 4) moved = true;
      el.style.transform = 'translateY(' + dy + 'px)';
      curIdx = Math.max(1, Math.min(P.areas.length - 1, i + Math.round(dy / stepH)));
    };
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.classList.remove('reordering');
      el.style.transform = '';
      suppressClick = moved;
      if (moved && curIdx !== i) update((s) => M.reorderArea(s.project, i, curIdx));
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function mergeYaml(e) {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      e.target.value = '';
      const report = M.parseYamlWithReport(t);
      if (!report.areas.length) {
        notify(report.errors[0] || 'No areas found in that YAML file.', 'error');
        return;
      }
      update((s) => M.mergeAreas(s.project, report.areas));
      notify(`Merged ${report.areas.length} areas from YAML.`, report.warnings.length ? 'warn' : 'ok');
    });
  }

  function mergeJson(e) {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      e.target.value = '';
      try {
        const p = JSON.parse(t);
        if (p && Array.isArray(p.areas) && p.areas.length) {
          update((s) => M.mergeAreas(s.project, p.areas));
          notify(`Merged ${p.areas.length} areas from JSON.`, 'ok');
        } else {
          notify('No areas found in that JSON file.', 'error');
        }
      } catch {
        notify('Invalid JSON file — could not merge.', 'error');
      }
    });
  }
</script>

<svelte:window on:click={() => (addMenu = false)} />

<div class="pad">
  <input
    type="text"
    placeholder="Search areas or #ID…"
    title="Filter areas by name or exact numeric ID"
    value={$state.query}
    on:input={(e) => update((s) => (s.query = e.target.value), { skipHistory: true })}
  />
  <div class="list-meta">
    <span class="count-pill" title="Total number of areas in the project"><span class="count-num">{P.areas.length}</span> Areas</span>
    {#if q}<button class="mini-btn" title="Clear search filter" on:click={() => update((s) => (s.query = ''), { skipHistory: true })}>Clear</button>{/if}
  </div>
  <div class="hint" style="margin-top:2px" title="The list position IS the Area ID written to YAML">Index = Area ID (file order) · Ctrl+drag or ↑/↓ reorders</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0 2px;position:relative">
    <button class="mini-btn primary" title="Create a new area using the selected template below" on:click={onAddArea}>＋ Add Area</button>
    <button class="mini-btn" title="Merge areas from an external YAML or JSON file into this project" on:click|stopPropagation={() => (addMenu = !addMenu)}>＋ Merge ▾</button>
    {#if addMenu}
      <div class="drop-menu" style="left:auto;right:0;top:calc(100% + 4px);min-width:195px">
        <button title="Append areas from an areas.yaml file" on:click={() => { addMenu = false; fileYamlAdd.click(); }}>From a YAML file…</button>
        <button title="Append areas from a saved JSON project file" on:click={() => { addMenu = false; fileJsonAdd.click(); }}>From a JSON file…</button>
      </div>
    {/if}
  </div>
  <div class="tpl-row">
    <span class="hint" title="Template automatically applied to newly created areas">Template</span>
    <select
      value={$state.newAreaTemplate}
      on:change={(e) => update((s) => (s.newAreaTemplate = e.target.value), { skipHistory: true })}
      title="New areas start with this template"
    >
      <option value="">No template (blank)</option>
      {#each M.allTemplates(P) as t}
        <option value={t.id}>{t.name}{t.builtin ? ' · built-in' : ''}</option>
      {/each}
    </select>
  </div>
  <input type="file" accept=".yaml,.yml,.txt" hidden bind:this={fileYamlAdd} on:change={mergeYaml} />
  <input type="file" accept=".json" hidden bind:this={fileJsonAdd} on:change={mergeJson} />
</div>

<div id="areaList">
  {#each rows as { a, i } (a.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="area-item {a.id === $state.selectedId ? 'sel' : ''} {dups.has(M.strip(a.area)) ? 'dup' : ''}"
      title={itemTitle(a, i)}
      on:click={() => pick(a)}
      on:dblclick={() => dblClickArea(a)}
      on:pointerdown={(e) => i > 0 && startReorder(e, i, e.currentTarget)}
    >
      <div class="li-row">
        <span class="idx">{i}</span>
        <span class="nm">{a.area || 'Unnamed'}</span>
        {#if i > 0}
          <span class="row-actions">
            {#if !q}
              <button class="mv" title="Move up" disabled={i <= 1} on:click={(e) => moveArea(e, i, -1)}>↑</button>
              <button class="mv" title="Move down" disabled={i >= P.areas.length - 1} on:click={(e) => moveArea(e, i, 1)}>↓</button>
            {/if}
            <button class="del" title="Delete this area" on:click={(e) => del(e, a)}>✕</button>
          </span>
        {/if}
      </div>
      {#if badges(a, i).length || M.drifted(P, a)}
        <div class="li-tags">
          {#if M.drifted(P, a)}<span class="badge" style="color:var(--warn);border-color:var(--warn)">⚠ template differs</span>{/if}
          {#each badges(a, i) as b}<span class={b.cls}>{b.t}</span>{/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="empty">No matching areas.</div>
  {/each}
</div>

<style>
  .row-actions {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex: none;
  }
  .mv {
    background: none;
    border: none;
    color: var(--dim);
    padding: 1px 4px;
    font-size: 11px;
    border-radius: 4px;
    opacity: 0;
  }
  .area-item:hover .mv {
    opacity: 0.85;
  }
  .mv:hover:not(:disabled) {
    opacity: 1;
    background: var(--sel);
    color: var(--text);
  }
</style>
