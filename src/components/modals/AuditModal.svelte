<script>
  import { createEventDispatcher } from 'svelte';
  import { auditMap } from '../../lib/pathAudit.js';
  import { state, update, notify } from '../../lib/state.js';

  export let project;
  export let onFocusArea;

  const dispatch = createEventDispatcher();

  $: audit = auditMap(project);
  $: totalNotices =
    (audit.deadEnds?.length || 0) +
    (audit.oneWayTrips?.length || 0) +
    (audit.disconnected?.length || 0) +
    (audit.noIncoming?.length || 0);

  let activeTab = 'all'; // 'all' | 'deadEnds' | 'oneWayTrips' | 'disconnected' | 'noIncoming'

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
      {#if totalNotices === 0}
        <span class="status-pill ok">✓ Clean</span>
      {:else}
        <span class="status-pill info">{totalNotices} notices</span>
      {/if}
    </div>
    <div class="hint">
      Highlights potential oversights or structural dead ends. Some of these can be intentional design choices (e.g. prisons, one-way puzzle routes, or secret rooms).
    </div>

    <!-- Category Tabs -->
    <div class="audit-tabs">
      <button
        class="audit-tab {activeTab === 'all' ? 'active' : ''}"
        on:click={() => (activeTab = 'all')}
      >All ({totalNotices})</button>
      <button
        class="audit-tab {activeTab === 'deadEnds' ? 'active' : ''}"
        on:click={() => (activeTab = 'deadEnds')}
      >🛑 Dead Ends ({audit.deadEnds.length})</button>
      <button
        class="audit-tab {activeTab === 'oneWayTrips' ? 'active' : ''}"
        on:click={() => (activeTab = 'oneWayTrips')}
      >🚪 One-Way Trips ({audit.oneWayTrips.length})</button>
      <button
        class="audit-tab {activeTab === 'disconnected' ? 'active' : ''}"
        on:click={() => (activeTab = 'disconnected')}
      >🏝️ Disconnected ({audit.disconnected.length})</button>
      <button
        class="audit-tab {activeTab === 'noIncoming' ? 'active' : ''}"
        on:click={() => (activeTab = 'noIncoming')}
      >🚶 No Way In ({audit.noIncoming.length})</button>
    </div>

    <div class="audit-content">
      {#if totalNotices === 0}
        <div class="clean-box">
          <div class="clean-icon">✓</div>
          <div class="clean-title">Network topology is balanced!</div>
          <div class="hint">No completely isolated areas, dead ends without exits, or unreturnable one-way traps detected.</div>
        </div>
      {:else}
        <!-- Dead Ends Section -->
        {#if (activeTab === 'all' || activeTab === 'deadEnds') && audit.deadEnds.length > 0}
          <div class="issue-section">
            <div class="issue-title">
              <span>🛑 Dead Ends ({audit.deadEnds.length})</span>
              <span class="issue-desc">Rooms entered from the network with 0 outgoing exits (&lt;ALL&gt; areas are excluded)</span>
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
        {#if (activeTab === 'all' || activeTab === 'oneWayTrips') && audit.oneWayTrips.length > 0}
          <div class="issue-section">
            <div class="issue-title">
              <span>🚪 One-Way Trips ({audit.oneWayTrips.length})</span>
              <span class="issue-desc">Rooms that can be entered, but have no path leading back to the Hub or an &lt;ALL&gt; area</span>
            </div>
            <div class="issue-list">
              {#each audit.oneWayTrips as a}
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

        <!-- Disconnected Section -->
        {#if (activeTab === 'all' || activeTab === 'disconnected') && audit.disconnected.length > 0}
          <div class="issue-section">
            <div class="issue-title">
              <span>🏝️ Completely Disconnected ({audit.disconnected.length})</span>
              <span class="issue-desc">Areas with zero incoming and zero outgoing links (isolated nodes)</span>
            </div>
            <div class="issue-list">
              {#each audit.disconnected as a}
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

        <!-- No Incoming Section -->
        {#if (activeTab === 'all' || activeTab === 'noIncoming') && audit.noIncoming.length > 0}
          <div class="issue-section">
            <div class="issue-title">
              <span>🚶 No Incoming Corridors ({audit.noIncoming.length})</span>
              <span class="issue-desc">Rooms with exits, but 0 incoming links from other areas (entered only via &lt;ALL&gt; or teleport)</span>
            </div>
            <div class="issue-list">
              {#each audit.noIncoming as a}
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
    width: min(620px, 94vw);
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
  .status-pill.info {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
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
