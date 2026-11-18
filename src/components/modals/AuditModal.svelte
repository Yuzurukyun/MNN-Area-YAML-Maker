<script>
  import { createEventDispatcher } from 'svelte';
  import { auditMap } from '../../lib/pathAudit.js';
  import { state, update, notify } from '../../lib/state.js';

  export let project;
  export let onFocusArea;

  const dispatch = createEventDispatcher();

  $: audit = auditMap(project);
  $: totalIssues = (audit.islands?.length || 0) + (audit.deadEnds?.length || 0) + (audit.oneWayTraps?.length || 0);

  let activeTab = 'all'; // 'all' | 'islands' | 'deadEnds' | 'oneWayTraps'

  function jumpTo(area) {
    if (onFocusArea) onFocusArea(area.id);
    dispatch('close');
  }
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && dispatch('close')} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal-bg" on:click={() => dispatch('close')}>
  <div class="modal audit-modal" on:click|stopPropagation>
    <button class="modal-x" title="Close (Esc)" on:click={() => dispatch('close')}>✕</button>
    <div class="modal-hdr-row">
      <h3>🔍 Map Network Audit</h3>
      {#if totalIssues === 0}
        <span class="status-pill ok">✓ Clean</span>
      {:else}
        <span class="status-pill warn">{totalIssues} issues</span>
      {/if}
    </div>
    <div class="hint">Inspect area connectivity, unreachable island rooms, dead ends, and one-way traps.</div>

    <!-- Category Tabs -->
    <div class="audit-tabs">
      <button
        class="audit-tab {activeTab === 'all' ? 'active' : ''}"
        on:click={() => (activeTab = 'all')}
      >All ({totalIssues})</button>
      <button
        class="audit-tab {activeTab === 'islands' ? 'active' : ''}"
        on:click={() => (activeTab = 'islands')}
      >🏝️ Islands ({audit.islands.length})</button>
      <button
        class="audit-tab {activeTab === 'deadEnds' ? 'active' : ''}"
        on:click={() => (activeTab = 'deadEnds')}
      >🛑 Dead Ends ({audit.deadEnds.length})</button>
      <button
        class="audit-tab {activeTab === 'oneWayTraps' ? 'active' : ''}"
        on:click={() => (activeTab = 'oneWayTraps')}
      >🚪 Traps ({audit.oneWayTraps.length})</button>
    </div>

    <div class="audit-content">
      {#if totalIssues === 0}
        <div class="clean-box">
          <div class="clean-icon">✓</div>
          <div class="clean-title">No connectivity issues found!</div>
          <div class="hint">Every area is walkable from Hub (Area 0), has valid exits, and can route back to the Hub.</div>
        </div>
      {:else}
        <!-- Islands Section -->
        {#if (activeTab === 'all' || activeTab === 'islands') && audit.islands.length > 0}
          <div class="issue-section">
            <div class="issue-title">
              <span>🏝️ Unreachable Islands ({audit.islands.length})</span>
              <span class="issue-desc">Areas that players cannot walk to from the Hub</span>
            </div>
            <div class="issue-list">
              {#each audit.islands as a}
                {@const idx = project.areas.indexOf(a)}
                <div class="issue-row">
                  <div class="area-info">
                    <span class="id-badge">#{idx}</span>
                    <span class="area-name">{a.area}</span>
                  </div>
                  <button class="mini-btn focus-btn" title="Center camera on area" on:click={() => jumpTo(a)}>⌖ View</button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Dead Ends Section -->
        {#if (activeTab === 'all' || activeTab === 'deadEnds') && audit.deadEnds.length > 0}
          <div class="issue-section">
            <div class="issue-title">
              <span>🛑 Dead Ends ({audit.deadEnds.length})</span>
              <span class="issue-desc">Areas with 0 outgoing exits (players get stuck here)</span>
            </div>
            <div class="issue-list">
              {#each audit.deadEnds as a}
                {@const idx = project.areas.indexOf(a)}
                <div class="issue-row">
                  <div class="area-info">
                    <span class="id-badge">#{idx}</span>
                    <span class="area-name">{a.area}</span>
                  </div>
                  <button class="mini-btn focus-btn" title="Center camera on area" on:click={() => jumpTo(a)}>⌖ View</button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- One-Way Traps Section -->
        {#if (activeTab === 'all' || activeTab === 'oneWayTraps') && audit.oneWayTraps.length > 0}
          <div class="issue-section">
            <div class="issue-title">
              <span>🚪 One-Way Traps ({audit.oneWayTraps.length})</span>
              <span class="issue-desc">Areas reachable from Hub, but with no walkable path back to Hub</span>
            </div>
            <div class="issue-list">
              {#each audit.oneWayTraps as a}
                {@const idx = project.areas.indexOf(a)}
                <div class="issue-row">
                  <div class="area-info">
                    <span class="id-badge">#{idx}</span>
                    <span class="area-name">{a.area}</span>
                  </div>
                  <button class="mini-btn focus-btn" title="Center camera on area" on:click={() => jumpTo(a)}>⌖ View</button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>

    <div class="modal-footer" style="display:flex;justify-content:flex-end;margin-top:14px;padding-top:10px;border-top:1px solid var(--line)">
      <button class="primary" on:click={() => dispatch('close')}>Close</button>
    </div>
  </div>
</div>

<style>
  .audit-modal {
    width: 490px;
    max-width: 95vw;
  }
  .modal-hdr-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .status-pill {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 999px;
  }
  .status-pill.ok {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .status-pill.warn {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .audit-tabs {
    display: flex;
    gap: 6px;
    margin: 12px 0;
    border-bottom: 1px solid var(--line);
    padding-bottom: 6px;
  }
  .audit-tab {
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius);
    padding: 4px 8px;
    font-size: 11px;
    color: var(--dim);
    cursor: pointer;
  }
  .audit-tab:hover {
    color: var(--text);
    background: var(--hover);
  }
  .audit-tab.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    border-color: var(--accent);
    font-weight: 700;
  }
  .audit-content {
    max-height: 340px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .clean-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 16px;
    text-align: center;
    gap: 8px;
  }
  .clean-icon {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 900;
  }
  .clean-title {
    font-weight: 700;
    font-size: 14px;
    color: var(--text-strong);
  }
  .issue-section {
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 8px 10px;
  }
  .issue-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-strong);
    margin-bottom: 6px;
    border-bottom: 1px dashed var(--line);
    padding-bottom: 4px;
  }
  .issue-desc {
    font-size: 10px;
    font-weight: 400;
    color: var(--dim);
  }
  .issue-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .issue-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px;
    border-radius: 3px;
    background: var(--panel2);
  }
  .issue-row:hover {
    background: var(--hover);
  }
  .area-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .id-badge {
    font-size: 10px;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--accent);
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 5px;
    border-radius: 3px;
  }
  .area-name {
    font-size: 12px;
    color: var(--text);
  }
  .focus-btn {
    padding: 2px 8px;
    font-size: 10.5px;
  }
</style>
