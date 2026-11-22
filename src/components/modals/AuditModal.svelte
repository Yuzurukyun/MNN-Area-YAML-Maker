<script>
  import { createEventDispatcher } from 'svelte';
  import { auditMap } from '../../lib/pathAudit.js';
  import { state, update, notify } from '../../lib/state.js';
  import { autoscroll } from '../../lib/autoscroll.js';
  import Icon from '../Icon.svelte';

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
  let searchQuery = '';

  $: displayedLists = (() => {
    switch (activeTab) {
      case 'deadEnds': return [audit.deadEnds];
      case 'oneWayTrips': return [audit.oneWayTrips];
      case 'disconnected': return [audit.disconnected];
      case 'noIncoming': return [audit.noIncoming];
      default: return [audit.deadEnds, audit.oneWayTrips, audit.disconnected, audit.noIncoming];
    }
  })();
  $: currentFilteredCount = displayedLists.reduce((sum, list) => sum + filterList(list).length, 0);
  $: currentCategoryTotal = displayedLists.reduce((sum, list) => sum + list.length, 0);

  function jumpTo(area) {
    if (onFocusArea) onFocusArea(area.id);
    dispatch('close');
  }

  function filterList(list) {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((a) => {
      const idx = project.areas.indexOf(a);
      return (
        a.area?.toLowerCase().includes(q) ||
        a.background?.toLowerCase().includes(q) ||
        String(idx).includes(q)
      );
    });
  }

  let scrimMouseDownTarget = null;
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && dispatch('close')} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="modal-bg"
  on:mousedown={(e) => (scrimMouseDownTarget = e.target)}
  on:click={(e) => {
    if (scrimMouseDownTarget === e.currentTarget && e.target === e.currentTarget) dispatch('close');
    scrimMouseDownTarget = null;
  }}
>
  <div class="modal audit-modal" on:mousedown|stopPropagation on:click|stopPropagation>
    <button class="modal-x" title="Close (Esc)" on:click={() => dispatch('close')}>✕</button>

    <div class="modal-hdr-row">
      <div class="hdr-title-wrap">
        <span class="audit-icon-mark"><Icon name="clipboard-check" /></span>
        <h3>Map Network Audit</h3>
      </div>
      {#if totalNotices === 0}
        <span class="status-pill ok" style="display:inline-flex;align-items:center;gap:4px"><Icon name="check" /> Clean Topology</span>
      {:else}
        <span class="status-pill warn">{totalNotices} notice{totalNotices === 1 ? '' : 's'}</span>
      {/if}
    </div>

    <div class="audit-notice-banner">
      <span class="banner-icon">ℹ</span>
      <span>
        Highlights potential topological oversights. <b>Note:</b> Some of these can be intentional game design choices (e.g. solitary confinement, one-way puzzle routes, or secret areas).
      </span>
    </div>

    <!-- Category Tabs Row (Never truncated, wraps comfortably) -->
    <div class="audit-tabs-row" role="tablist" aria-label="Issue category filters">
      <button
        class="audit-pill-tab {activeTab === 'all' ? 'active' : ''}"
        role="tab"
        aria-selected={activeTab === 'all'}
        on:click={() => (activeTab = 'all')}
      >
        <span>All Issues</span>
        <span class="pill-badge {totalNotices > 0 ? 'warn' : 'zero'}">{totalNotices}</span>
      </button>
      <button
        class="audit-pill-tab {activeTab === 'deadEnds' ? 'active' : ''}"
        role="tab"
        aria-selected={activeTab === 'deadEnds'}
        on:click={() => (activeTab = 'deadEnds')}
      >
        <span><Icon name="circle-slash" /> Dead Ends</span>
        <span class="pill-badge {audit.deadEnds.length > 0 ? 'danger' : 'zero'}">{audit.deadEnds.length}</span>
      </button>
      <button
        class="audit-pill-tab {activeTab === 'oneWayTrips' ? 'active' : ''}"
        role="tab"
        aria-selected={activeTab === 'oneWayTrips'}
        on:click={() => (activeTab = 'oneWayTrips')}
      >
        <span><Icon name="arrow-right" /> One-Way Trips</span>
        <span class="pill-badge {audit.oneWayTrips.length > 0 ? 'warn' : 'zero'}">{audit.oneWayTrips.length}</span>
      </button>
      <button
        class="audit-pill-tab {activeTab === 'disconnected' ? 'active' : ''}"
        role="tab"
        aria-selected={activeTab === 'disconnected'}
        on:click={() => (activeTab = 'disconnected')}
      >
        <span><Icon name="unlink" /> Disconnected</span>
        <span class="pill-badge {audit.disconnected.length > 0 ? 'danger' : 'zero'}">{audit.disconnected.length}</span>
      </button>
      <button
        class="audit-pill-tab {activeTab === 'noIncoming' ? 'active' : ''}"
        role="tab"
        aria-selected={activeTab === 'noIncoming'}
        on:click={() => (activeTab = 'noIncoming')}
      >
        <span style="display:inline-flex;align-items:center;gap:6px"><Icon name="route" /> No Way In</span>
        <span class="pill-badge {audit.noIncoming.length > 0 ? 'info' : 'zero'}">{audit.noIncoming.length}</span>
      </button>
    </div>

    <!-- Search & Filter Controls Toolbar (Dedicated Row Below) -->
    <div class="audit-toolbar-row">
      <div class="search-box">
        <span class="search-icon"><Icon name="search" /></span>
        <input
          type="search"
          class="audit-search-input"
          placeholder="Search notices by room name, background or #ID..."
          bind:value={searchQuery}
        />
        {#if searchQuery}
          <button class="clear-search-btn" title="Clear filter" on:click={() => (searchQuery = '')}>✕</button>
        {/if}
      </div>

      <div class="audit-filter-summary">
        {#if searchQuery.trim()}
          <span>Matching: <b class="highlight">{currentFilteredCount}</b> of {currentCategoryTotal}</span>
        {:else}
          <span>Category: <b class="highlight">{currentCategoryTotal}</b> notice{currentCategoryTotal === 1 ? '' : 's'}</span>
        {/if}
      </div>
    </div>

    <!-- Audit Content Area -->
    <div class="audit-content">
      {#if totalNotices === 0}
        <div class="clean-box">
          <div class="clean-icon"><Icon name="check" /></div>
          <div class="clean-title">Network topology is balanced!</div>
          <div class="hint">No completely isolated areas, dead ends without exits, or unreturnable one-way traps detected.</div>
        </div>
      {:else}
        <!-- Dead Ends Section -->
        {#if activeTab === 'all' || activeTab === 'deadEnds'}
          {@const filtered = filterList(audit.deadEnds)}
          {#if filtered.length > 0 || activeTab === 'deadEnds'}
            <div class="issue-section">
              <div class="issue-title">
                <div class="title-left">
                  <span class="section-tag danger" style="display:inline-flex;align-items:center;gap:4px"><Icon name="circle-slash" /> Dead Ends</span>
                  <span class="section-count">({filtered.length})</span>
                </div>
                <span class="issue-desc">Rooms entered from the network with 0 outgoing exits (&lt;ALL&gt; areas excluded)</span>
              </div>
              {#if filtered.length === 0}
                <div class="empty-tab-msg">No dead ends found matching your filter.</div>
              {:else}
                <div class="issue-list">
                  {#each filtered as a}
                    {@const idx = project.areas.indexOf(a)}
                    <div class="issue-row">
                      <div class="area-info">
                        <span class="id-badge">#{idx}</span>
                        <span class="area-name" use:autoscroll>{a.area}</span>
                        {#if a.background}
                          <span class="area-bg-chip" use:autoscroll>{a.background}</span>
                        {/if}
                      </div>
                      <button class="mini-btn focus-btn" title="Center camera on area" on:click={() => jumpTo(a)}><Icon name="crosshair" /> View Node</button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/if}

        <!-- One-Way Traps Section -->
        {#if activeTab === 'all' || activeTab === 'oneWayTrips'}
          {@const filtered = filterList(audit.oneWayTrips)}
          {#if filtered.length > 0 || activeTab === 'oneWayTrips'}
            <div class="issue-section">
              <div class="issue-title">
                <div class="title-left">
                  <span class="section-tag warn" style="display:inline-flex;align-items:center;gap:4px"><Icon name="arrow-right" /> One-Way Trips</span>
                  <span class="section-count">({filtered.length})</span>
                </div>
                <span class="issue-desc">Rooms entered from the network, but with no return route back to Hub or any &lt;ALL&gt; area</span>
              </div>
              {#if filtered.length === 0}
                <div class="empty-tab-msg">No one-way trips found matching your filter.</div>
              {:else}
                <div class="issue-list">
                  {#each filtered as a}
                    {@const idx = project.areas.indexOf(a)}
                    <div class="issue-row">
                      <div class="area-info">
                        <span class="id-badge">#{idx}</span>
                        <span class="area-name" use:autoscroll>{a.area}</span>
                        {#if a.background}
                          <span class="area-bg-chip" use:autoscroll>{a.background}</span>
                        {/if}
                      </div>
                      <button class="mini-btn focus-btn" title="Center camera on area" on:click={() => jumpTo(a)}><Icon name="crosshair" /> View Node</button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/if}

        <!-- Disconnected Section -->
        {#if activeTab === 'all' || activeTab === 'disconnected'}
          {@const filtered = filterList(audit.disconnected)}
          {#if filtered.length > 0 || activeTab === 'disconnected'}
            <div class="issue-section">
              <div class="issue-title">
                <div class="title-left">
                  <span class="section-tag danger" style="display:inline-flex;align-items:center;gap:4px"><Icon name="unlink" /> Disconnected</span>
                  <span class="section-count">({filtered.length})</span>
                </div>
                <span class="issue-desc">Completely isolated areas with zero incoming and zero outgoing walkable corridors</span>
              </div>
              {#if filtered.length === 0}
                <div class="empty-tab-msg">No completely disconnected areas found matching your filter.</div>
              {:else}
                <div class="issue-list">
                  {#each filtered as a}
                    {@const idx = project.areas.indexOf(a)}
                    <div class="issue-row">
                      <div class="area-info">
                        <span class="id-badge">#{idx}</span>
                        <span class="area-name" use:autoscroll>{a.area}</span>
                        {#if a.background}
                          <span class="area-bg-chip" use:autoscroll>{a.background}</span>
                        {/if}
                      </div>
                      <button class="mini-btn focus-btn" title="Center camera on area" on:click={() => jumpTo(a)}><Icon name="crosshair" /> View Node</button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/if}

        <!-- No Incoming Section -->
        {#if activeTab === 'all' || activeTab === 'noIncoming'}
          {@const filtered = filterList(audit.noIncoming)}
          {#if filtered.length > 0 || activeTab === 'noIncoming'}
            <div class="issue-section">
              <div class="issue-title">
                <div class="title-left">
                  <span class="section-tag info" style="display:inline-flex;align-items:center;gap:4px"><Icon name="route" /> No Way In</span>
                  <span class="section-count">({filtered.length})</span>
                </div>
                <span class="issue-desc">Rooms with exits, but 0 incoming links from other rooms (accessible only via &lt;ALL&gt; or script)</span>
              </div>
              {#if filtered.length === 0}
                <div class="empty-tab-msg">No un-entered rooms found matching your filter.</div>
              {:else}
                <div class="issue-list">
                  {#each filtered as a}
                    {@const idx = project.areas.indexOf(a)}
                    <div class="issue-row">
                      <div class="area-info">
                        <span class="id-badge">#{idx}</span>
                        <span class="area-name" use:autoscroll>{a.area}</span>
                        {#if a.background}
                          <span class="area-bg-chip" use:autoscroll>{a.background}</span>
                        {/if}
                      </div>
                      <button class="mini-btn focus-btn" title="Center camera on area" on:click={() => jumpTo(a)}><Icon name="crosshair" /> View Node</button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      {/if}
    </div>

    <div class="modal-footer">
      <span class="footer-hint">Click "View Node" on any entry to jump directly to it on the canvas.</span>
      <button class="primary" on:click={() => dispatch('close')}>Close</button>
    </div>
  </div>
</div>

<style>
  .audit-modal {
    width: min(840px, 96vw);
    max-width: 96vw;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .modal-hdr-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .hdr-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .audit-icon-mark {
    font-size: 16px;
  }

  .modal-hdr-row h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-strong);
  }

  .status-pill {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
    letter-spacing: 0.04em;
  }
  .status-pill.ok {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }
  .status-pill.warn {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .audit-notice-banner {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: color-mix(in srgb, var(--accent) 7%, var(--panel2));
    border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--line));
    border-radius: var(--radius);
    padding: 7px 11px;
    font-size: 11.5px;
    color: var(--dim);
    line-height: 1.45;
  }
  .banner-icon {
    color: var(--accent);
    font-weight: 800;
    flex-shrink: 0;
  }

  /* Category Tabs Row (Multi-item, wraps cleanly without truncation) */
  .audit-tabs-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding-bottom: 2px;
  }

  .audit-pill-tab {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--dim);
    cursor: pointer;
    white-space: nowrap;
    flex: 0 0 auto;
    transition: all 0.15s ease;
  }
  .audit-pill-tab:hover {
    color: var(--text-strong);
    border-color: var(--line2);
    background: var(--hover);
  }
  .audit-pill-tab.active {
    color: var(--text-strong);
    background: color-mix(in srgb, var(--accent) 14%, var(--panel2));
    border-color: var(--accent);
    font-weight: 700;
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 20%, transparent);
  }

  .pill-badge {
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
  }
  .pill-badge.zero {
    background: rgba(255, 255, 255, 0.06);
    color: var(--dim);
  }
  .pill-badge.danger {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }
  .pill-badge.warn {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }
  .pill-badge.info {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }

  /* Dedicated Toolbar Row Below Category Tabs */
  .audit-toolbar-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 10px;
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    max-width: 480px;
  }

  .search-icon {
    font-size: 12px;
    color: var(--dim);
    user-select: none;
  }

  .audit-search-input {
    background: transparent;
    border: none;
    outline: none;
    padding: 3px 0;
    font-size: 12px;
    color: var(--text-strong);
    width: 100%;
    font-family: inherit;
  }
  .audit-search-input::placeholder {
    color: var(--dim);
    font-size: 11.5px;
  }

  .clear-search-btn {
    background: transparent;
    border: none;
    color: var(--dim);
    cursor: pointer;
    font-size: 11px;
    padding: 0 4px;
    line-height: 1;
  }
  .clear-search-btn:hover {
    color: var(--text-strong);
  }

  .audit-filter-summary {
    font-size: 11px;
    color: var(--dim);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .audit-filter-summary .highlight {
    color: var(--accent);
    font-family: var(--font-mono);
  }

  .audit-content {
    max-height: 400px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-right: 2px;
  }

  .clean-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 36px 16px;
    text-align: center;
    gap: 10px;
  }
  .clean-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: 900;
  }
  .clean-title {
    font-weight: 700;
    font-size: 15px;
    color: var(--text-strong);
  }

  .issue-section {
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .issue-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    border-bottom: 1px dashed var(--line);
    padding-bottom: 6px;
  }
  .title-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .section-tag {
    font-size: 12px;
    font-weight: 700;
  }
  .section-tag.danger { color: #f87171; }
  .section-tag.warn { color: #fbbf24; }
  .section-tag.info { color: #60a5fa; }

  .section-count {
    font-size: 11px;
    color: var(--dim);
    font-weight: 600;
  }
  .issue-desc {
    font-size: 11px;
    color: var(--dim);
  }

  .issue-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .issue-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 5px 8px;
    border-radius: 4px;
    background: var(--input-bg);
    border: 1px solid transparent;
    transition: all 0.12s ease;
  }
  .issue-row:hover {
    background: var(--hover);
    border-color: var(--line);
  }

  .area-info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .id-badge {
    font-size: 10px;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--accent);
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 6px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .area-name {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-strong);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .area-bg-chip {
    font-size: 10.5px;
    font-family: var(--font-mono);
    color: var(--dim);
    background: var(--panel2);
    border: 1px solid var(--line);
    padding: 1px 6px;
    border-radius: 3px;
    flex-shrink: 1;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .focus-btn {
    padding: 3px 10px;
    font-size: 11px;
    flex-shrink: 0;
  }

  .empty-tab-msg {
    padding: 12px;
    text-align: center;
    font-size: 12px;
    color: var(--dim);
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }
  .footer-hint {
    font-size: 11px;
    color: var(--dim);
  }
</style>
