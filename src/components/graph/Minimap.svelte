<script>
  import { NODE_W, NODE_H } from '../../lib/fields.js';
  import { settings, updateSettings } from '../../lib/state.js';

  export let areas = [];
  export let groups = [];
  export let view = { x: 0, y: 0, k: 1 };
  export let bounds = { w: 800, h: 600 };
  export let onPanTo;

  let collapsed = false;
  let isDragging = false;
  let dragStart = null;

  // Compute world bounding box with padding
  $: camW = bounds.w > 0 ? bounds.w / view.k : 800;
  $: camH = bounds.h > 0 ? bounds.h / view.k : 600;
  $: camX = -view.x / view.k;
  $: camY = -view.y / view.k;

  $: contentBounds = (() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    if (areas && areas.length) {
      for (let i = 0; i < areas.length; i++) {
        const a = areas[i];
        if (a.x < minX) minX = a.x;
        if (a.y < minY) minY = a.y;
        if (a.x + NODE_W > maxX) maxX = a.x + NODE_W;
        if (a.y + NODE_H > maxY) maxY = a.y + NODE_H;
      }
    } else {
      minX = 0;
      minY = 0;
      maxX = 800;
      maxY = 600;
    }

    if (groups && groups.length) {
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        if (g.x < minX) minX = g.x;
        if (g.y < minY) minY = g.y;
        if (g.x + g.w > maxX) maxX = g.x + g.w;
        if (g.y + g.h > maxY) maxY = g.y + g.h;
      }
    }

    return { minX, minY, maxX, maxY };
  })();

  $: bbox = (() => {
    const pad = 120;
    const minX = Math.min(camX, contentBounds.minX) - pad;
    const minY = Math.min(camY, contentBounds.minY) - pad;
    const maxX = Math.max(camX + camW, contentBounds.maxX) + pad;
    const maxY = Math.max(camY + camH, contentBounds.maxY) + pad;

    const w = Math.max(maxX - minX, 100);
    const h = Math.max(maxY - minY, 80);
    return { minX, minY, w, h };
  })();

  function mapClick(e) {
    if (isDragging) return;
    const svg = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - svg.left) / svg.width;
    const relY = (e.clientY - svg.top) / svg.height;
    const targetWorldX = bbox.minX + relX * bbox.w;
    const targetWorldY = bbox.minY + relY * bbox.h;
    if (onPanTo) onPanTo(targetWorldX, targetWorldY);
  }

  function startDragViewport(e) {
    e.stopPropagation();
    isDragging = true;
    dragStart = { clientX: e.clientX, clientY: e.clientY, initCamX: camX, initCamY: camY };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  }

  function onDragMove(e) {
    if (!isDragging || !dragStart) return;
    const miniEl = document.querySelector('.minimap-svg');
    if (!miniEl) return;
    const rect = miniEl.getBoundingClientRect();
    const scaleX = bbox.w / rect.width;
    const scaleY = bbox.h / rect.height;

    const deltaX = (e.clientX - dragStart.clientX) * scaleX;
    const deltaY = (e.clientY - dragStart.clientY) * scaleY;

    const newCenterWorldX = dragStart.initCamX + camW / 2 + deltaX;
    const newCenterWorldY = dragStart.initCamY + camH / 2 + deltaY;

    if (onPanTo) onPanTo(newCenterWorldX, newCenterWorldY, true); // true = instant
  }

  function onDragEnd() {
    isDragging = false;
    dragStart = null;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
  }
</script>

{#if $settings.showMinimap}
  <div class="minimap-container {collapsed ? 'collapsed' : ''}">
    {#if collapsed}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="minimap-pill" title="Expand Minimap radar (M)" on:click={() => (collapsed = false)}>
        <span class="radar-dot"></span>
        <b>RADAR</b>
        <span class="count-badge">{areas.length}</span>
        <span class="pill-caret">▴</span>
      </div>
    {:else}
      <div class="minimap-header">
        <div class="minimap-title">
          <span class="radar-dot"></span>
          <b>RADAR</b>
          <span class="count-badge">{areas.length}</span>
        </div>
        <div class="minimap-tools">
          <button
            class="mini-tool-btn"
            title="Collapse Minimap (M)"
            on:click={() => (collapsed = true)}
          >−</button>
        </div>
      </div>

      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <svg
        class="minimap-svg"
        viewBox="{bbox.minX} {bbox.minY} {bbox.w} {bbox.h}"
        preserveAspectRatio="xMidYMid meet"
        on:click={mapClick}
      >
        <!-- Groups -->
        {#each groups as g (g.id)}
          <rect
            class="mini-group"
            x={g.x}
            y={g.y}
            width={g.w}
            height={g.h}
            rx="4"
            style={g.color ? `fill:color-mix(in srgb, ${g.color} 25%, transparent); stroke:${g.color};` : ''}
          />
        {/each}

        <!-- Nodes -->
        {#each areas as a, idx (a.id)}
          <rect
            class="mini-node {idx === 0 ? 'mini-hub' : ''}"
            x={a.x}
            y={a.y}
            width={NODE_W}
            height={NODE_H}
            rx="3"
            style={a.color ? `fill:${a.color}; stroke:color-mix(in srgb, ${a.color} 50%, #fff);` : ''}
          />
        {/each}

        <!-- Camera Viewport Box -->
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <rect
          class="minimap-viewport"
          x={camX}
          y={camY}
          width={camW}
          height={camH}
          rx="4"
          on:pointerdown={startDragViewport}
        />
      </svg>
    {/if}
  </div>
{/if}

<style>
  .minimap-container {
    position: absolute;
    right: 12px;
    bottom: 48px;
    z-index: 18;
    width: 200px;
    background: color-mix(in srgb, var(--panel2) 90%, transparent);
    border: 1px solid var(--line2);
    border-radius: var(--radius-lg);
    box-shadow: 0 10px 30px -8px var(--shadow);
    backdrop-filter: blur(10px);
    overflow: hidden;
    user-select: none;
    transition: width 0.2s ease, opacity 0.2s ease;
  }

  .minimap-container.collapsed {
    width: auto;
    cursor: pointer;
  }

  .minimap-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font-size: 10.5px;
    color: var(--text-dim);
    letter-spacing: 0.05em;
  }

  .minimap-pill:hover {
    background: var(--hover);
    color: var(--text-strong);
  }

  .pill-caret {
    font-size: 10px;
    color: var(--dim);
    margin-left: 2px;
  }

  .minimap-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background: color-mix(in srgb, var(--panel) 70%, transparent);
    border-bottom: 1px solid var(--line);
    font-size: 10.5px;
    letter-spacing: 0.05em;
  }

  .minimap-title {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-dim);
  }

  .radar-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent-glow);
    display: inline-block;
  }

  .count-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 0 4px;
    border-radius: 3px;
    background: var(--hover);
    color: var(--accent);
  }

  .mini-tool-btn {
    background: transparent;
    border: none;
    color: var(--dim);
    font-size: 11px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 3px;
    cursor: pointer;
  }

  .mini-tool-btn:hover {
    color: var(--text);
    background: var(--hover);
  }

  .minimap-svg {
    width: 100%;
    height: 120px;
    display: block;
    background: rgba(10, 10, 14, 0.45);
    cursor: crosshair;
  }

  .mini-group {
    fill: color-mix(in srgb, var(--group-fill) 80%, transparent);
    stroke: var(--group-stroke);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
    pointer-events: none;
  }

  .mini-node {
    fill: color-mix(in srgb, var(--panel2) 80%, var(--line2));
    stroke: var(--line2);
    stroke-width: 1.2;
    pointer-events: none;
  }

  .mini-hub {
    fill: color-mix(in srgb, var(--accent) 70%, #000);
    stroke: var(--accent);
    stroke-width: 2;
  }

  .minimap-viewport {
    fill: color-mix(in srgb, var(--accent) 12%, transparent);
    stroke: var(--accent);
    stroke-width: 2;
    cursor: grab;
    filter: drop-shadow(0 0 4px var(--accent-glow));
    transition: stroke-width 0.1s ease;
  }

  .minimap-viewport:active {
    cursor: grabbing;
    stroke-width: 2.5;
    fill: color-mix(in srgb, var(--accent) 20%, transparent);
  }
</style>
