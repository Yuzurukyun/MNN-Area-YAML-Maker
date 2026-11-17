<script>
  export let zoom;
  export let onZoomIn;
  export let onZoomOut;
  export let onZoomReset;
  export let onFit;
</script>

<div class="hud-legend">
  <span><i class="swatch out"></i>one-way out</span>
  <span><i class="swatch inc"></i>one-way in</span>
  <span><i class="swatch both"></i>both ways</span>
  <span class="sep">·</span>
  <span>Drag node / port · Space or middle-drag pans · Right-click menu</span>
</div>

<div class="hud-zoom">
  <button title="Zoom out" on:click={onZoomOut}>−</button>
  <button class="zoom-val" title="Reset zoom to 100%" on:click={onZoomReset}>{Math.round(zoom * 100)}%</button>
  <button title="Zoom in" on:click={onZoomIn}>+</button>
  <button title="Fit all areas in view (F)" on:click={onFit}>Fit</button>
</div>

<style>
  .hud-legend,
  .hud-zoom {
    position: absolute;
    bottom: 10px;
    z-index: 15;
    display: flex;
    align-items: center;
    gap: 8px;
    background: color-mix(in srgb, var(--panel2) 86%, transparent);
    border: 1px solid var(--line2);
    border-radius: var(--radius-lg);
    padding: 4px 10px;
    font-size: 11px;
    color: var(--dim);
    box-shadow: 0 8px 24px -6px var(--shadow);
    backdrop-filter: blur(8px);
  }
  .hud-legend {
    left: 10px;
    pointer-events: none;
    max-width: calc(100% - 210px);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .hud-legend span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .swatch {
    display: inline-block;
    width: 11px;
    height: 2.5px;
    border-radius: 2px;
  }
  .swatch.out { background: var(--edge-oneway); }
  .swatch.inc { background: var(--edge-oneway-in); }
  .swatch.both { background: var(--edge-both); }
  .hud-zoom {
    right: 10px;
    gap: 3px;
    padding: 3px;
  }
  .hud-zoom button {
    border: none;
    background: none;
    padding: 3px 7px;
    font-size: 11.5px;
  }
  .hud-zoom .zoom-val {
    min-width: 44px;
    text-align: center;
    color: var(--text);
  }
</style>
