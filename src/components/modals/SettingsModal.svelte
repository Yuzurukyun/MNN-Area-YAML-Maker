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
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && dispatch('close')} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal-bg" on:click={() => dispatch('close')}>
  <div class="modal settings-modal" on:click|stopPropagation>
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

      <!-- Live preview of line thickness and glow -->
      <div class="preview-box">
        <div class="hint" style="margin-bottom:6px">Line appearance live preview:</div>
        <svg width="100%" height="46" style="display:block">
          <!-- Background preview line -->
          <line
            x1="20"
            y1="23"
            x2="90%"
            y2="23"
            stroke="var(--edge-oneway)"
            stroke-width="{$settings.edgeThickness * 1.2}px"
            style="filter: drop-shadow(0 0 {$settings.edgeGlow}px var(--edge-oneway))"
          />
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
</style>
