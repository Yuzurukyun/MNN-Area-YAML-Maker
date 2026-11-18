<script>
  import { state, update } from '../../lib/state.js';
  import * as M from '../../lib/core.js';
  import Field from './Field.svelte';
  import Bool from './Bool.svelte';
  import LinkEditor from './LinkEditor.svelte';
  import { onMount } from 'svelte';
  import { bgStore } from '../../lib/bgStore.js';
  import { resolveActiveVisual, normalizeBgPath } from '../../lib/bgSchema.js';

  let open = { basics: true, links: true, access: false, behaviour: false, perms: false };
  let todPresetIdx = 0;
  let todPresetName = '';
  let armDelete = false;
  let armFor = null;
  let imageDisplayMode = 'node'; // 'node' | 'scene'

  let bgStoreState = bgStore.get();
  onMount(() => {
    return bgStore.subscribe((s) => {
      bgStoreState = s;
    });
  });
  $: if (armFor !== $state.selectedId) {
    armFor = $state.selectedId;
    armDelete = false;
  }

  $: P = $state.project;
  $: a = P.areas.find((x) => x.id === $state.selectedId);
  $: hub = P.areas[0];
  $: isHub = !!(a && hub && a.id === hub.id);
  $: tpl = a ? M.templateById(P, a.templateId) : null;
  $: isDrifted = a ? M.drifted(P, a) : false;
  $: isDup = a ? M.dupNames(P).has(M.strip(a.area)) : false;
  $: allPresets = M.BUILTIN_TOD_PRESETS.concat(P.todPresets || []);
  $: filter = $state.fieldFilter;

  $: currentBgDef = bgStoreState.backgrounds.find(
    (b) => b.folder.toLowerCase() === normalizeBgPath(a?.background).toLowerCase()
  );

  $: currentBgVisual = currentBgDef
    ? resolveActiveVisual(currentBgDef, { state: 'default', tod: 'day' })
    : null;

  $: currentBgUrl = currentBgVisual
    ? bgStore.getAssetUrl(currentBgVisual.background, 'image')
    : (a?.background ? bgStore.getAssetUrl(a.background.split('/').pop(), 'image') : '');

  $: hasInternalTod = Boolean(
    currentBgDef && (
      (currentBgDef.states?.default?.time_variants && Object.keys(currentBgDef.states.default.time_variants).length > 0) ||
      (currentBgDef.states?.default?.positions && Object.values(currentBgDef.states.default.positions).some(p => p.time_variants && Object.keys(p.time_variants).length > 0))
    )
  );

  const grpOf = (k) => M.FIELD_GROUP[k] || 'common';
  const showG = (g) =>
    filter === 'all' ? true : filter === 'rarely' ? g === 'rarely' : M.GROUP_RANK[g] <= (filter === 'common' ? 0 : 1);
  const showK = (k) => showG(grpOf(k));

  $: showBasics = ['area', 'background', 'background_tod', 'default_description'].some(showK);
  $: showLinks = ['reachable_areas', 'visible_areas', 'scream_range', 'restricted_chars'].some(showK);
  $: accessFields = M.BOOL_FIELDS.filter((f) => f[1] === 'access');
  $: behBools = M.BOOL_FIELDS.filter((f) => f[1] === 'behaviour');
  $: permFields = M.BOOL_FIELDS.filter((f) => f[1] === 'perm');
  $: showAccess = accessFields.some(([k]) => showK(k));
  $: showBeh =
    behBools.some(([k]) => showK(k)) || ['afk_delay', 'afk_sendto', 'weather', 'investigation', 'map_visual'].some(showK);
  $: showPerms = permFields.some(([k]) => showK(k));

  $: accessMod = a ? accessFields.filter(([k, , d]) => a[k] !== d).length : 0;
  $: behMod = a
    ? behBools.filter(([k, , d]) => a[k] !== d).length +
      (a.afk_delay > 0 ? 1 : 0) +
      (a.afk_sendto > 0 ? 1 : 0) +
      (M.strip(a.weather) ? 1 : 0) +
      (M.strip(a.investigation) ? 1 : 0) +
      (M.strip(a.map_visual) && M.strip(a.map_visual) !== 'None' ? 1 : 0)
    : 0;
  $: permMod = a ? permFields.filter(([k, , d]) => a[k] !== d).length : 0;

  const withArea = (fn) =>
    update((s) => {
      const ar = s.project.areas.find((x) => x.id === s.selectedId);
      if (ar) fn(s, ar);
    });

  // Update immediately on input so map labels & area list stay live while typing,
  // and trim cleanly on blur/change.
  const inputStr = (key) => (e) => withArea((s, ar) => (ar[key] = e.target.value));
  const trimStr = (key) => (e) => withArea((s, ar) => (ar[key] = M.strip(e.target.value)));
  const setNum = (key) => (e) => withArea((s, ar) => (ar[key] = Math.max(0, parseInt(e.target.value) || 0)));

  function todSet(i, pos, e) {
    const v = e.target.value;
    withArea((s, ar) => {
      if (ar.tod[i]) ar.tod[i][pos] = v;
    });
  }

  function todAdd() {
    withArea((s, ar) => ar.tod.push(['', '']));
  }

  function todRemove(i) {
    withArea((s, ar) => ar.tod.splice(i, 1));
  }

  function presetApply() {
    const p = allPresets[todPresetIdx];
    if (!p) return;
    withArea((s, ar) => {
      const have = new Set(ar.tod.map(([k]) => M.strip(k)));
      p.keys.forEach((k) => {
        if (!have.has(k)) ar.tod.push([k, '']);
      });
    });
  }

  function presetSave() {
    const name = M.strip(todPresetName);
    if (!name || !a) return;
    const keys = a.tod.map(([k]) => M.strip(k)).filter(Boolean);
    if (!keys.length) return;
    update((s) => {
      if (!Array.isArray(s.project.todPresets)) s.project.todPresets = [];
      s.project.todPresets.push({ name, keys });
    });
    todPresetName = '';
  }

  function sync() {
    withArea((s, ar) => M.syncToTemplate(s.project, ar));
  }

  function dup() {
    if (!a) return;
    update((s) => {
      const copy = M.duplicateArea(s.project, a.id);
      if (copy) {
        s.selectedId = copy.id;
        s.selectedIds = new Set([copy.id]);
        s.selectedEdge = null;
      }
    });
  }

  function del() {
    if (!a) return;
    const id = a.id;
    update((s) => {
      M.deleteArea(s.project, id);
      s.selectedIds.delete(id);
      if (s.selectedId === id || !s.project.areas.some((x) => x.id === s.selectedId)) {
        s.selectedId = s.project.areas[0].id;
      }
      if (!s.selectedIds.size) s.selectedIds.add(s.selectedId);
      s.selectedEdge = null;
    });
  }
  let iconInput;
  function onIconUpload(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f || !a) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 512;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > max || h > max) {
          if (w > h) { h = Math.round((h * max) / w); w = max; }
          else { w = Math.round((w * max) / h); h = max; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL(f.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88);
        withArea((s, ar) => (ar.image = dataUrl));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  }
</script>

{#if a}
  <div class="insp-head">
    <div class="insp-title">
      <span class="insp-id" title="Area ID (list index)">#{P.areas.indexOf(a)}</span>
      <h2 title="Currently selected area">{a.area || 'Unnamed'}</h2>
    </div>
    <div class="hint" title="Template snapshot last applied to this area">
      {#if tpl}Template: <b style="color:var(--text)">{tpl.name}</b>{:else}No template assigned{/if}
    </div>
    <div class="btn-row" style="margin:8px 0 0;align-items:center">
      <span class="hint" title="Filter inspector fields by importance group">Show fields</span>
      <select
        style="flex:1;width:auto"
        title="Filter inspector fields by importance (Common / Uncommon / Rarely)"
        value={filter}
        on:change={(e) => update((s) => (s.fieldFilter = e.target.value), { skipHistory: true })}
      >
        <option value="all">All fields</option>
        <option value="common">■ Common only</option>
        <option value="uncommon">■ Common + Uncommon</option>
        <option value="rarely">■ Rarely only</option>
      </select>
    </div>

    <div class="node-style-row" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--line)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span class="hint" title="Custom color for this area node on the map">Node Colour</span>
        {#if a.color}
          <button class="mini-btn" title="Reset to current theme default" on:click={() => withArea((s, ar) => (ar.color = ''))}>Reset</button>
        {/if}
      </div>
      <div class="swatch-bar">
        {#each [
          ['#ef4444', 'Red'],
          ['#f97316', 'Orange'],
          ['#f59e0b', 'Amber'],
          ['#10b981', 'Green'],
          ['#06b6d4', 'Teal'],
          ['#3b82f6', 'Blue'],
          ['#8b5cf6', 'Purple'],
          ['#ec4899', 'Pink'],
          ['#64748b', 'Slate'],
        ] as [c, cname]}
          <button
            class="c-swatch {a.color === c ? 'active' : ''}"
            style="background:{c}"
            title={cname}
            on:click={() => withArea((s, ar) => (ar.color = c))}
          ></button>
        {/each}
        <label class="c-swatch-custom" title="Custom color picker">
          <input
            type="color"
            value={a.color || '#3b82f6'}
            on:input={(e) => withArea((s, ar) => (ar.color = e.target.value))}
          />
          <span>🎨</span>
        </label>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:9px">
        <span class="hint" title="Visual asset preview for this area">Visual Preview</span>
        <div style="display:flex;gap:4px">
          {#if a.image && currentBgUrl}
            <button
              class="mini-btn {imageDisplayMode === 'node' ? 'active-filter' : ''}"
              title="Show custom cropped node icon"
              on:click={() => (imageDisplayMode = 'node')}
            >Icon</button>
            <button
              class="mini-btn {imageDisplayMode === 'scene' ? 'active-filter' : ''}"
              title="Show full background scene"
              on:click={() => (imageDisplayMode = 'scene')}
            >Scene</button>
          {/if}
          {#if a.image}
            <button class="mini-btn" title="Replace area icon" on:click={() => iconInput.click()}>Replace</button>
            <button class="mini-btn" title="Remove area icon" on:click={() => withArea((s, ar) => (ar.image = ''))}>✕</button>
          {/if}
        </div>
      </div>

      {#if (imageDisplayMode === 'node' && a.image) || (!currentBgUrl && a.image)}
        <div class="node-image-preview" style="margin-top:6px;border-radius:5px;overflow:hidden;border:1px solid var(--line2);background:var(--input-bg);display:flex;align-items:center;justify-content:center;max-height:180px">
          <img src={a.image} alt="Node preview" style="max-width:100%;max-height:180px;width:auto;height:auto;object-fit:contain;display:block" />
        </div>
      {:else if currentBgUrl}
        <div class="node-image-preview" style="margin-top:6px;border-radius:5px;overflow:hidden;border:1px solid var(--line2);background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;max-height:180px;position:relative">
          <img src={currentBgUrl} alt="Background scene" style="max-width:100%;max-height:180px;width:100%;height:auto;object-fit:cover;display:block" />
          <div style="position:absolute;bottom:4px;right:6px;background:rgba(0,0,0,0.7);padding:1px 6px;border-radius:3px;font-size:9.5px;color:#fff">
            Background: {a.background}
          </div>
        </div>
      {:else}
        <div style="margin-top:5px;display:flex;gap:4px">
          <button class="mini-btn" style="flex:1;padding:4px" on:click={() => iconInput.click()}>＋ Attach Node Icon</button>
          {#if a.background}
            <button class="mini-btn" style="padding:4px 8px" title="Configure in Background Maker" on:click={() => bgStore.openMaker(a.background)}>🖼 Open BG</button>
          {/if}
        </div>
      {/if}
      <input type="file" accept="image/*" hidden bind:this={iconInput} on:change={onIconUpload} />
    </div>
  </div>

  {#if isDrifted}
    <div class="drift-box" title="One or more fields have changed since applying this template">
      <span>⚠ Settings differ from template.</span>
      <button class="mini-btn" title="Reset template-covered fields back to the template values" on:click={sync}>Sync</button>
    </div>
  {/if}

  {#if showBasics}
    <details class="sec" open={open.basics} on:toggle={(e) => (open.basics = e.target.open)}>
      <summary title="Area name, background path, time-of-day backgrounds, and /look description">
        <span class="sum-title">Basics</span><span class="cnt">name · background</span>
      </summary>
      <div class="body">
        {#if showK('area')}
          <Field fkey="area" mandatory={true}>
            <input type="text" title="Unique name of this area" placeholder="Area name" value={a.area} on:input={inputStr('area')} on:change={trimStr('area')} />
            {#if isDup}
              <div class="hint" style="color:var(--danger);margin-top:4px">
                Duplicate name — area names must be unique because links reference them by name.
              </div>
            {/if}
          </Field>
        {/if}
        {#if showK('background')}
          <Field fkey="background" mandatory={true}>
            <div style="display:flex;gap:4px">
              <input type="text" style="flex:1" title="Background path relative to your server's backgrounds folder" placeholder="e.g. DR/Hallway" value={a.background} on:input={inputStr('background')} on:change={trimStr('background')} />
              <button class="mini-btn" title="Open in Background.json Maker" on:click={() => bgStore.openMaker(a.background)}>🖼 Maker…</button>
            </div>
            {#if bgStoreState.backgrounds.length > 0}
              <div style="display:flex;align-items:center;gap:4px;margin-top:4px">
                <span class="hint">Library:</span>
                <select
                  style="flex:1;font-size:11px;padding:2px 4px;background:var(--input-bg);border:1px solid var(--line);border-radius:var(--radius);color:var(--text)"
                  value={normalizeBgPath(a.background)}
                  on:change={(e) => {
                    const chosen = e.target.value;
                    if (chosen) withArea((s, ar) => (ar.background = chosen));
                  }}
                >
                  <option value="">— Pick from Library ({bgStoreState.backgrounds.length}) —</option>
                  {#each bgStoreState.backgrounds as bgItem}
                    <option value={bgItem.folder}>{bgItem.folder}</option>
                  {/each}
                </select>
              </div>
            {/if}
            <div class="hint" style="margin-top:4px">Path from your backgrounds folder, e.g. <code>DR/Hallway</code> or <code>Umamusume/Cafeteria</code>.</div>
          </Field>
        {/if}
        {#if showK('background_tod')}
          <Field fkey="background_tod">
            {#if hasInternalTod}
              <div style="margin-bottom:8px;padding:6px 8px;border-radius:4px;background:color-mix(in srgb, #10b981 12%, transparent);border:1px solid color-mix(in srgb, #10b981 40%, transparent);color:#10b981;font-size:11px;display:flex;align-items:center;gap:6px">
                <span>✓</span>
                <span>Handled by <code>{currentBgDef.folder}/background.json</code> — separate <code>bg_tod</code> is optional.</span>
              </div>
            {/if}
            {#each a.tod as row, i}
              <div class="tod-row">
                <input type="text" title="Time-of-day key (e.g. day, evening, night)" placeholder="time of day (e.g. day)" value={row[0]} on:change={(e) => todSet(i, 0, e)} />
                <input type="text" title="Background path used during this time of day" placeholder="background" value={row[1]} on:change={(e) => todSet(i, 1, e)} />
                <button class="mini-btn" title="Remove this time-of-day row" on:click={() => todRemove(i)}>✕</button>
              </div>
            {/each}
            <button class="mini-btn" title="Add a new time-of-day background row" on:click={todAdd}>+ Add row</button>
            <div class="btn-row">
              <select style="flex:1;width:auto" title="Choose a saved time-of-day key preset" bind:value={todPresetIdx}>
                {#each allPresets as p, i}<option value={i}>{p.name} ({p.keys.join(', ')})</option>{/each}
              </select>
              <button class="mini-btn" title="Add any missing keys from the selected preset" on:click={presetApply}>Apply preset</button>
            </div>
            <div class="btn-row">
              <input type="text" title="Name for a new reusable time-of-day key preset" placeholder="Preset name" style="flex:1;width:auto" bind:value={todPresetName} />
              <button class="mini-btn" title="Save this area's current time-of-day keys as a preset" on:click={presetSave}>Save preset</button>
            </div>
          </Field>
        {/if}
        {#if showK('default_description')}
          <Field fkey="default_description">
            <textarea rows="3" title="Default /look description (omitted from YAML if empty)" placeholder="Leave blank to omit and use server default" value={a.default_description} on:input={inputStr('default_description')} on:change={trimStr('default_description')}></textarea>
          </Field>
        {/if}
      </div>
    </details>
  {/if}

  {#if showLinks}
    <details class="sec" open={open.links} on:toggle={(e) => (open.links = e.target.open)}>
      <summary title="Reachable, Visible, Scream range, and restricted characters">
        <span class="sum-title">Reachables & links</span><span class="cnt">reachable / visible / scream</span>
      </summary>
      <div class="body">
        <LinkEditor {P} {a} {hub} {showK} {withArea} />
      </div>
    </details>
  {/if}

  {#if showAccess}
    <details class="sec" open={open.access} on:toggle={(e) => (open.access = e.target.open)}>
      <summary title="Locks, lobby, and privacy flags">
        <span class="sum-title">Access & locks</span>
        {#if accessMod}<span class="mod-pill" title="{accessMod} setting(s) differ from server defaults">{accessMod} modified</span>{/if}
      </summary>
      <div class="body">
        <div class="bool-grid">
          {#each accessFields as [k, , d, label]}{#if showK(k)}<Bool area={a} fkey={k} {label} def={d} />{/if}{/each}
        </div>
      </div>
    </details>
  {/if}

  {#if showBeh}
    <details class="sec" open={open.behaviour} on:toggle={(e) => (open.behaviour = e.target.open)}>
      <summary title="Lights, weather, AFK timeout, and map transition visuals">
        <span class="sum-title">Behaviour</span>
        {#if behMod}<span class="mod-pill" title="{behMod} setting(s) differ from server defaults">{behMod} modified</span>{/if}
      </summary>
      <div class="body">
        <div class="bool-grid">
          {#each behBools as [k, , d, label]}{#if showK(k)}<Bool area={a} fkey={k} {label} def={d} />{/if}{/each}
        </div>
        {#if showK('afk_delay')}
          <Field fkey="afk_delay"><input type="number" min="0" title="Seconds before an idle player is kicked to afk_sendto (0 = disabled)" value={a.afk_delay} on:change={setNum('afk_delay')} /></Field>
        {/if}
        {#if showK('afk_sendto')}
          <Field fkey="afk_sendto">
            <select title="Area ID that AFK players are sent to" value={a.afk_sendto} on:change={setNum('afk_sendto')}>
              {#each P.areas as x, i}<option value={i}>{i} — {x.area}</option>{/each}
            </select>
          </Field>
        {/if}
        {#if showK('weather')}
          <Field fkey="weather"><input type="text" title="Default weather effect (leave blank to omit)" placeholder="Leave blank for none" value={a.weather || ''} on:input={inputStr('weather')} on:change={trimStr('weather')} /></Field>
        {/if}
        {#if showK('investigation')}
          <Field fkey="investigation"><input type="text" title="Optional investigation placeholder string (leave blank to omit)" placeholder="Leave blank for none" value={a.investigation || ''} on:input={inputStr('investigation')} on:change={trimStr('investigation')} /></Field>
        {/if}
        {#if showK('map_visual')}
          <Field fkey="map_visual"><input type="text" title="Map transition visual shown on movement (None = server default, omitted)" placeholder="None" value={a.map_visual || 'None'} on:input={inputStr('map_visual')} on:change={trimStr('map_visual')} /></Field>
        {/if}
      </div>
    </details>
  {/if}

  {#if showPerms}
    <details class="sec" open={open.perms} on:toggle={(e) => (open.perms = e.target.open)}>
      <summary title="Player command permissions in this area">
        <span class="sum-title">Permissions</span>
        {#if permMod}<span class="mod-pill" title="{permMod} setting(s) differ from server defaults">{permMod} modified</span>{/if}
      </summary>
      <div class="body">
        <div class="bool-grid">
          {#each permFields as [k, , d, label]}{#if showK(k)}<Bool area={a} fkey={k} {label} def={d} />{/if}{/each}
        </div>
      </div>
    </details>
  {/if}

  <div class="btn-row" style="margin-top:8px">
    <button on:click={dup} title="Copy this area's settings and outgoing links into a new area right after it">Duplicate this area</button>
  </div>
  {#if isHub}
    <div class="hint" style="margin-top:6px" title="Area 0 is always the server hub">Area 0 is the hub — it can't be deleted or moved.</div>
  {:else if armDelete}
    <button class="danger" style="margin-top:6px" title="Click again to delete this area (Undo can restore it)" on:click={del}>Confirm delete "{a.area}"? (Undo can restore)</button>
  {:else}
    <button class="danger" style="margin-top:6px" title="Delete this area and clean up links targeting it" on:click={() => (armDelete = true)}>Delete this area</button>
  {/if}
{:else}
  <div class="empty">Select an area to edit it.</div>
{/if}
