<script>
  import * as M from '../../lib/core.js';
  import Field from './Field.svelte';

  export let P;
  export let a;
  export let hub;
  export let showK;
  export let withArea;

  const linkKey = (lt) => (lt === 'scream' ? 'scream_range' : lt + '_areas');

  let pickerFor = null;
  let query = '';
  let lastAreaId = null;
  $: if (a?.id !== lastAreaId) {
    lastAreaId = a?.id || null;
    pickerFor = null;
    query = '';
  }

  function entriesFor(P, a, lt) {
    const also = a.links[lt].also || [];
    const out = [];
    P.areas.forEach((x) => {
      if (x.id === a.id) return;
      const isOut = (a.links[lt].targets || []).includes(x.id);
      const xl = x.links[lt];
      const isInList = xl.mode === 'list' && (xl.targets || []).includes(a.id);
      // Include explicit list rows + retained dead rows, and resolve incoming
      // direction accurately (e.g. when the Hub uses <ALL>, it really does reach `a`).
      if (isOut || isInList || also.includes(x.id)) {
        const isIn = isInList || M.effectiveIds(P, x, lt).includes(a.id);
        const isInModal = !isInList && isIn;
        out.push({ x, isOut, isInList, isIn, isInModal });
      }
    });
    return out;
  }

  function candidatesFor(P, a, entryList, qText) {
    const have = new Set(entryList.map((e) => e.x.id));
    const q = M.strip(qText).toLowerCase();
    return P.areas.filter(
      (x, idx) =>
        x.id !== a.id &&
        !have.has(x.id) &&
        (!q || x.area.toLowerCase().includes(q) || String(idx) === q),
    );
  }

  $: entriesMap = {
    reachable: entriesFor(P, a, 'reachable'),
    visible: entriesFor(P, a, 'visible'),
    scream: entriesFor(P, a, 'scream'),
  };
  $: candList = pickerFor ? candidatesFor(P, a, entriesMap[pickerFor], query) : [];

  function retain(ar, lt, id) {
    const L = ar.links[lt];
    if (!Array.isArray(L.also)) L.also = [];
    if (!L.also.includes(id)) L.also.push(id);
  }

  function unretain(ar, lt, id) {
    const L = ar.links[lt];
    if (Array.isArray(L.also)) L.also = L.also.filter((t) => t !== id);
  }

  function applySide(s, ar, lt, entry, side, on) {
    if (side === 'out') {
      const L = ar.links[lt];
      if (on && !L.targets.includes(entry.x.id)) L.targets.push(entry.x.id);
      if (!on) L.targets = L.targets.filter((t) => t !== entry.x.id);
    } else {
      const other = s.project.areas.find((z) => z.id === entry.x.id);
      if (!other) return;
      const L = other.links[lt];
      if (on) {
        if (L.mode === 'list' && !L.targets.includes(ar.id)) L.targets.push(ar.id);
        else if (L.mode === 'none') {
          L.mode = 'list';
          L.targets = [ar.id];
        }
      } else if (L.mode === 'list') {
        L.targets = L.targets.filter((t) => t !== ar.id);
      }
    }
  }

  function toggleOut(lt, entry, on) {
    withArea((s, ar) => {
      applySide(s, ar, lt, entry, 'out', on);
      if (on) unretain(ar, lt, entry.x.id);
      else if (!entry.isInList) retain(ar, lt, entry.x.id);
    });
  }

  function removeEntry(lt, entry) {
    withArea((s, ar) => {
      applySide(s, ar, lt, entry, 'out', false);
      applySide(s, ar, lt, entry, 'in', false);
      unretain(ar, lt, entry.x.id);
    });
  }

  function addArea(lt, x) {
    withArea((s, ar) => {
      if (!ar.links[lt].targets.includes(x.id)) ar.links[lt].targets.push(x.id);
      M.mirrorLink(s.project, lt, ar.id, x.id, true);
      unretain(ar, lt, x.id);
    });
  }

  function makeAllTwoWay(lt) {
    withArea((s, ar) => {
      entriesFor(s.project, ar, lt).forEach((e) => {
        if (e.isOut !== e.isIn) {
          applySide(s, ar, lt, e, 'out', true);
          applySide(s, ar, lt, e, 'in', true);
          unretain(ar, lt, e.x.id);
        }
      });
    });
  }

  function setLinkMode(lt, e) {
    const mode = e.target.value;
    withArea((s, ar) => {
      ar.links[lt].mode = mode;
    });
  }

  function setRestricted(e) {
    const v = e.target.value;
    withArea((s, ar) => {
      ar.restricted_chars = v.split(',').map((x) => M.strip(x)).filter(Boolean);
    });
  }

  function modeNote(lt, mode) {
    if (mode === 'all') {
      return lt === 'reachable'
        ? 'ALL AREAS — exports as <ALL> and covers every area (hub included):'
        : 'ALL AREAS — exports as an explicit list excluding the hub (server rule):';
    }
    if (mode === 'reachable') {
      return 'Follows this area’s Reachable list — exports as <REACHABLE_AREAS>:';
    }
    return 'This area reaches no other areas.';
  }
</script>

{#each Object.keys(M.LINK_TYPES) as lt}
  {#if showK(linkKey(lt))}
    <Field fkey={linkKey(lt)}>
      <select title="Select how {linkKey(lt)} is resolved for this area" value={a.links[lt].mode} on:change={(e) => setLinkMode(lt, e)}>
        {#each M.LINK_TYPES[lt].modes as [v, l]}<option value={v}>{l}</option>{/each}
      </select>
    </Field>

    {#if a.links[lt].mode === 'list'}
      {#if lt === 'reachable'}
        <div class="hint" style="margin:-6px 0 6px">
          Ticked = in this area's list. ↔ both ways · → out only · ← in only.
        </div>
      {/if}
      <div class="link-entries">
        {#each entriesMap[lt] as e (e.x.id)}
          {@const dead = !e.isOut && !e.isIn}
          <div class="link-entry {dead ? 'dead' : ''}">
            <span
              class="le-arrow {dead ? 'dead-arrow' : ''}"
              title={dead
                ? 'Neither area lists the other. Kept here until you click ✕.'
                : e.isOut && e.isIn
                  ? e.isInModal
                    ? 'Both ways — this area lists it, and it reaches back via ALL AREAS / REACHABLE'
                    : 'Both ways — each area lists the other'
                  : e.isOut
                    ? 'Out only — this area lists it'
                    : 'In only — it lists this area, not vice-versa'}
            >{dead ? '⊘' : e.isOut && e.isIn ? '↔' : e.isOut ? '→' : '←'}</span>
            <span class="le-name">
              {e.x.area}{#if hub && e.x.id === hub.id} <span class="tag hub">HUB</span>{/if}
            </span>
            <input
              class="le-box"
              type="checkbox"
              checked={e.isOut}
              title="Checked = this area lists {e.x.area}"
              on:change={(ev) => toggleOut(lt, e, ev.target.checked)}
            />
            <button
              class="le-x"
              title={e.isInModal
                ? 'Remove from this area’s list (its incoming <ALL> coverage stays until you change its mode)'
                : 'Remove connection both ways'}
              on:click={() => removeEntry(lt, e)}
            >✕</button>
          </div>
        {:else}
          <div class="hint" style="margin:2px 0 4px">No connections yet.</div>
        {/each}
      </div>

      {#if pickerFor === lt}
        <div class="le-picker">
          <div class="le-picker-head">
            <input
              type="text"
              title="Type an area name or ID and press Enter to connect"
              placeholder="Search areas (Enter adds top match)…"
              bind:value={query}
              on:keydown={(e) => {
                if (e.key === 'Enter' && candList.length) {
                  e.preventDefault();
                  addArea(lt, candList[0]);
                } else if (e.key === 'Escape') {
                  pickerFor = null;
                  query = '';
                }
              }}
            />
            <button class="mini-btn" title="Close area picker" on:click={() => { pickerFor = null; query = ''; }}>✕</button>
          </div>
          <div class="le-cands">
            {#each candList as x (x.id)}
              <button class="le-cand" title="Connect two-way with {x.area}" on:click={() => addArea(lt, x)}>{P.areas.indexOf(x)} — {x.area}</button>
            {:else}
              <div class="hint" style="padding:4px 8px">Nothing matches.</div>
            {/each}
          </div>
        </div>
      {:else}
        <div class="btn-row" style="margin:2px 0 10px">
          <button class="mini-btn" title="Search and add a connection to this list" on:click={() => { pickerFor = lt; query = ''; }}>+ Add area…</button>
          {#if entriesMap[lt].some((e) => e.isOut !== e.isIn)}
            <button class="mini-btn" title="Mirror all listed links so every pair is two-way" on:click={() => makeAllTwoWay(lt)}>Make all ↔</button>
          {/if}
        </div>
      {/if}
    {:else}
      <div class="hint" style="margin:-6px 0 4px">{modeNote(lt, a.links[lt].mode)}</div>
      {#if M.effectiveNames(P, a, lt).length}
        <div class="chips" title="Resolved target areas for {linkKey(lt)}">
          {#each M.effectiveNames(P, a, lt) as n}<span class="chip">{n}</span>{/each}
        </div>
      {/if}
    {/if}
  {/if}
{/each}

{#if showK('restricted_chars')}
  <Field fkey="restricted_chars">
    <input type="text" title="Comma-separated character folder names blocked from entering (non-GMs)" value={a.restricted_chars.join(', ')} on:change={setRestricted} placeholder="Comma-separated folder names" />
  </Field>
{/if}

<style>
  .link-entries {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 2px 0 6px;
  }
  .link-entry {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 4px 6px 4px 8px;
    transition: border-color 0.12s ease, background 0.12s ease;
  }
  .link-entry:hover {
    border-color: var(--line2);
  }
  .le-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12.5px;
  }
  .link-entry.dead {
    opacity: 0.62;
  }
  .le-arrow {
    flex: none;
    width: 17px;
    text-align: center;
    font-size: 13px;
    color: var(--dim);
  }
  .le-arrow.dead-arrow {
    color: var(--warn);
  }
  .le-name .tag {
    margin-left: 6px;
  }
  .le-box {
    flex: none;
  }
  .le-x {
    flex: none;
    padding: 1px 6px;
    font-size: 11px;
  }
  .le-picker {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 6px;
    margin: 2px 0 8px;
    background: var(--panel);
  }
  .le-picker-head {
    display: flex;
    gap: 6px;
    margin-bottom: 6px;
  }
  .le-picker-head input {
    flex: 1;
  }
  .le-cands {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 170px;
    overflow-y: auto;
  }
  .le-cand {
    flex: none;
    text-align: left;
    padding: 4px 8px;
    font-size: 12.5px;
  }
</style>
