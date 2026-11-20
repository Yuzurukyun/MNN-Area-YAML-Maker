<script>
  import { createEventDispatcher } from 'svelte';
  import { settings, updateSettings, DEFAULT_SETTINGS, notify } from '../../lib/state.js';

  const dispatch = createEventDispatcher();

  function onSeparation(e) {
    const val = parseFloat(e.target.value);
    updateSettings((s) => (s.arrangeSeparation = val));
  }

  function onThickness(e) {
    const val = parseFloat(e.target.value);
    updateSettings((s) => (s.edgeThickness = val));
  }

  function onGlow(e) {
    const val = parseInt(e.target.value, 10);
    updateSettings((s) => (s.edgeGlow = val));
  }

  function resetAll() {
    updateSettings((s) => Object.assign(s, DEFAULT_SETTINGS));
    notify('Reset settings to defaults.', 'info');
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
  <div class="modal settings-modal" on:mousedown|stopPropagation on:click|stopPropagation>
    <button class="modal-x" title="Close (Esc)" on:click={() => dispatch('close')}>✕</button>
    <h3>⚙ Settings</h3>
    <div class="hint">Customize map layout parameters, connection line styling, and canvas glow.</div>

    <div class="settings-list">
      <!-- 1. Auto-Arrange Separation -->
      <div class="setting-item">
        <div class="setting-header">
          <label for="sep-range" class="setting-title">Auto-arrange node separation</label>
          <span class="setting-val">
            {$settings.arrangeSeparation.toFixed(1)}×
            {#if $settings.arrangeSeparation === 1.0}<span class="default-tag">Default</span>{/if}
          </span>
        </div>
        <div class="hint">Distance multiplier between radial rings and clusters when pressing Auto-arrange.</div>
        <div class="slider-row">
          <span class="range-bound">0.5× Compact</span>
          <input
            id="sep-range"
            type="range"
            min="0.5"
            max="2.5"
            step="0.1"
            value={$settings.arrangeSeparation}
            on:input={onSeparation}
          />
          <span class="range-bound">2.5× Spacious</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:7px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line2)">
          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer">
            <input
              type="checkbox"
              style="margin-top:2px;cursor:pointer"
              checked={$settings.sortInsideGroup}
              on:change={(e) => updateSettings((s) => (s.sortInsideGroup = e.target.checked))}
            />
            <div>
              <b style="font-size:12px;color:var(--text-strong)">Sort inside group</b>
              <div class="hint" style="margin-top:1px">Re-aligns member nodes into a compact grid. When unchecked (default), preserves your custom internal group layout and shape.</div>
            </div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer">
            <input
              type="checkbox"
              style="margin-top:2px;cursor:pointer"
              checked={$settings.arrangeFitView}
              on:change={(e) => updateSettings((s) => (s.arrangeFitView = e.target.checked))}
            />
            <div>
              <b style="font-size:12px;color:var(--text-strong)">Fit view after arrange</b>
              <div class="hint" style="margin-top:1px">Automatically zoom and center the camera on the content after arranging.</div>
            </div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer">
            <input
              type="checkbox"
              style="margin-top:2px;cursor:pointer"
              checked={$settings.arrangeGroupsOnly}
              on:change={(e) => updateSettings((s) => (s.arrangeGroupsOnly = e.target.checked))}
            />
            <div>
              <b style="font-size:12px;color:var(--text-strong)">Arrange groups only</b>
              <div class="hint" style="margin-top:1px">Only repositions group containers, leaving ungrouped areas where they currently sit.</div>
            </div>
          </label>
        </div>
      </div>

      <!-- 2. Connection Line Thickness -->
      <div class="setting-item">
        <div class="setting-header">
          <label for="thick-range" class="setting-title">Connection line thickness</label>
          <span class="setting-val">
            {$settings.edgeThickness.toFixed(1)}px
            {#if $settings.edgeThickness === 1.6}<span class="default-tag">Default</span>{/if}
          </span>
        </div>
        <div class="hint">Stroke width of connection lines across Reachable, Visible, and Scream maps.</div>
        <div class="slider-row">
          <span class="range-bound">1.0px Thin</span>
          <input
            id="thick-range"
            type="range"
            min="1.0"
            max="6.0"
            step="0.2"
            value={$settings.edgeThickness}
            on:input={onThickness}
          />
          <span class="range-bound">6.0px Bold</span>
        </div>
      </div>

      <!-- 3. Connection Line Glow -->
      <div class="setting-item">
        <div class="setting-header">
          <label for="glow-range" class="setting-title">Connection line glow</label>
          <span class="setting-val">
            {$settings.edgeGlow}px
            {#if $settings.edgeGlow === 0}<span class="default-tag">Off</span>{/if}
          </span>
        </div>
        <div class="hint">Vibrant neon drop-shadow halo along edge lines.</div>
        <div class="slider-row">
          <span class="range-bound">0px (Off)</span>
          <input
            id="glow-range"
            type="range"
            min="0"
            max="14"
            step="1"
            value={$settings.edgeGlow}
            on:input={onGlow}
          />
          <span class="range-bound">14px Neon</span>
        </div>
      </div>

      <!-- 5. Autoscroll Long Labels -->
      <div class="setting-item">
        <label class="setting-header" style="cursor:pointer;margin-bottom:0">
          <div style="display:flex;align-items:center;gap:8px">
            <input
              type="checkbox"
              checked={$settings.autoscrollLongLabels}
              on:change={(e) => updateSettings((s) => (s.autoscrollLongLabels = e.target.checked))}
            />
            <span class="setting-title" style="cursor:pointer">Autoscroll long labels when not focused</span>
          </div>
          {#if !$settings.autoscrollLongLabels}<span class="default-tag">Default (Hover only)</span>{/if}
        </label>
        <div class="hint" style="margin-top:6px;margin-left:24px">
          Continuously scrolls overflowing area names and paths. When off, labels scroll smoothly on hover.
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-header">
          <span class="setting-title">Connection line style</span>
          <span class="setting-val">
            {$settings.edgeStyle || 'curved'}
            {#if ($settings.edgeStyle || 'curved') === 'curved'}<span class="default-tag">Default</span>{/if}
          </span>
        </div>
        <div class="hint">Visual geometry of connection paths between nodes.</div>
        <div class="style-btn-group">
          <button
            class="style-choice-btn {($settings.edgeStyle || 'curved') === 'curved' ? 'active' : ''}"
            on:click={() => updateSettings((s) => (s.edgeStyle = 'curved'))}
          >
            <span class="choice-icon">∿</span>
            <b>Curved</b>
            <span class="choice-sub">Smooth Bezier</span>
          </button>
          <button
            class="style-choice-btn {($settings.edgeStyle || 'curved') === 'orthogonal' ? 'active' : ''}"
            on:click={() => updateSettings((s) => (s.edgeStyle = 'orthogonal'))}
          >
            <span class="choice-icon">⌐</span>
            <b>Orthogonal</b>
            <span class="choice-sub">90° Circuit / Blueprint</span>
          </button>
          <button
            class="style-choice-btn {($settings.edgeStyle || 'curved') === 'straight' ? 'active' : ''}"
            on:click={() => updateSettings((s) => (s.edgeStyle = 'straight'))}
          >
            <span class="choice-icon">╱</span>
            <b>Straight</b>
            <span class="choice-sub">Direct Line</span>
          </button>
        </div>
      </div>

      <!-- 5. Minimap / Radar HUD Toggle -->
      <div class="setting-item">
        <div class="setting-header">
          <span class="setting-title">Minimap Radar HUD</span>
          <span class="setting-val">
            {$settings.showMinimap ? 'Enabled' : 'Hidden'}
            {#if $settings.showMinimap}<span class="default-tag">Default</span>{/if}
          </span>
        </div>
        <div class="hint">Birds-eye interactive radar in the bottom-right corner showing full network layout and camera viewport.</div>
        <label class="setting-check-row" style="margin-top:6px;display:flex;align-items:center;gap:10px;cursor:pointer">
          <input
            type="checkbox"
            checked={$settings.showMinimap}
            on:change={(e) => updateSettings((s) => (s.showMinimap = e.target.checked))}
          />
          <span style="font-size:12px;color:var(--text-strong)">Show Minimap radar HUD on canvas (Toggle with <b>M</b> key)</span>
        </label>
      </div>

      <!-- 6. Floating <ALL> Pill Toggle -->
      <div class="setting-item">
        <div class="setting-header">
          <span class="setting-title">&lt;ALL&gt; Target Pill</span>
          <span class="setting-val">
            {$settings.showAllPill ? 'Shown' : 'Hidden'}
            {#if !$settings.showAllPill}<span class="default-tag">Default</span>{/if}
          </span>
        </div>
        <div class="hint">Floating "ALL AREAS" summary target pill and dashed links on the canvas (off by default).</div>
        <label class="setting-check-row" style="margin-top:6px;display:flex;align-items:center;gap:10px;cursor:pointer">
          <input
            type="checkbox"
            checked={$settings.showAllPill}
            on:change={(e) => updateSettings((s) => (s.showAllPill = e.target.checked))}
          />
          <span style="font-size:12px;color:var(--text-strong)">Show &lt;ALL&gt; summary target pill on canvas</span>
        </label>
      </div>

      <!-- Live preview of line thickness, glow, and style -->
      <div class="preview-box">
        <div class="hint" style="margin-bottom:6px">Line appearance live preview:</div>
        <svg viewBox="0 0 400 46" width="100%" height="46" style="display:block;overflow:visible">
          {#if ($settings.edgeStyle || 'curved') === 'straight'}
            <line
              x1="20" y1="23" x2="380" y2="23"
              stroke="var(--edge-oneway)"
              stroke-width="{$settings.edgeThickness * 1.2}px"
              style="filter: drop-shadow(0 0 {$settings.edgeGlow}px var(--edge-oneway))"
            />
          {:else if ($settings.edgeStyle || 'curved') === 'orthogonal'}
            <path
              d="M 20 33 L 200 33 L 200 13 L 380 13"
              fill="none"
              stroke="var(--edge-oneway)"
              stroke-width="{$settings.edgeThickness * 1.2}px"
              style="filter: drop-shadow(0 0 {$settings.edgeGlow}px var(--edge-oneway))"
            />
          {:else}
            <path
              d="M 20 33 C 140 33, 260 13, 380 13"
              fill="none"
              stroke="var(--edge-oneway)"
              stroke-width="{$settings.edgeThickness * 1.2}px"
              style="filter: drop-shadow(0 0 {$settings.edgeGlow}px var(--edge-oneway))"
            />
          {/if}
        </svg>
      </div>
    </div>

    <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:12px;border-top:1px solid var(--line)">
      <button class="mini-btn" title="Reset all settings to original defaults" on:click={resetAll}>Reset to defaults</button>
      <button class="primary" on:click={() => dispatch('close')}>Done</button>
    </div>
  </div>
</div>

<style>
  .settings-modal {
    width: 480px;
    max-width: 95vw;
  }

  .settings-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 14px;
  }

  .setting-item {
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 10px 12px;
  }

  .setting-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
  }

  .setting-title {
    font-weight: 700;
    font-size: 13px;
    color: var(--text-strong);
  }

  .setting-val {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .default-tag {
    font-size: 9.5px;
    font-weight: 600;
    color: var(--dim);
    background: var(--hover);
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 0 4px;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
  }

  .slider-row input[type="range"] {
    flex: 1;
  }

  .range-bound {
    font-size: 10px;
    color: var(--dim);
    flex: none;
    min-width: 58px;
  }

  .range-bound:last-child {
    text-align: right;
  }

  .preview-box {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 8px 12px;
  }

  .style-btn-group {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 8px;
  }

  .style-choice-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 6px;
    background: var(--panel2);
    border: 1.5px solid var(--line);
    border-radius: var(--radius);
    color: var(--text);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;
  }

  .style-choice-btn:hover {
    border-color: var(--accent);
    background: var(--hover);
  }

  .style-choice-btn.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 15%, var(--panel2));
    color: var(--accent);
    box-shadow: 0 0 10px -2px var(--accent-glow);
  }

  .choice-icon {
    font-size: 16px;
    font-weight: 900;
    line-height: 1;
    color: var(--accent);
  }

  .choice-sub {
    font-size: 9.5px;
    color: var(--dim);
    margin-top: 1px;
  }
</style>
