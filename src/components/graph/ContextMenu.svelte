<script>
  export let x;
  export let y;
  export let items;
  export let onClose;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="ctx-menu" style="left:{x}px;top:{y}px" on:pointerdown|stopPropagation on:contextmenu|preventDefault>
  {#each items as it}
    {#if it.type === 'swatches'}
      <div class="ctx-swatches-wrap">
        <div class="ctx-swatches-hdr">
          <span>{it.label || 'Colour'}</span>
          {#if it.current}
            <button class="ctx-clear-btn" title="Reset to default colour" on:click={() => { onClose(); it.onSelect(''); }}>Reset</button>
          {/if}
        </div>
        <div class="ctx-swatches-row">
          {#each it.colors as [c, cname]}
            <button
              class="ctx-swatch {it.current === c ? 'active' : ''}"
              style="background:{c}"
              title={cname}
              on:click={() => { onClose(); it.onSelect(c); }}
            ></button>
          {/each}
          <label class="ctx-swatch-custom" title="Custom colour picker">
            <input
              type="color"
              value={it.current || '#3b82f6'}
              on:input={(e) => it.onSelect(e.target.value)}
              on:change={() => onClose()}
            />
            <span>🎨</span>
          </label>
        </div>
      </div>
    {:else if it.separator}
      <div class="ctx-sep"></div>
    {:else}
      <button
        class="ctx-item {it.danger ? 'danger' : ''}"
        disabled={it.disabled}
        on:click={() => { onClose(); it.run(); }}
      >{it.label}</button>
    {/if}
  {/each}
</div>

<style>
  .ctx-menu {
    position: absolute;
    z-index: 35;
    min-width: 206px;
    background: var(--panel2);
    border: 1px solid var(--line2);
    border-radius: var(--radius-lg);
    padding: 5px;
    box-shadow: 0 16px 38px -8px var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 2px;
    animation: pop-in 0.12s ease;
  }
  .ctx-swatches-wrap {
    padding: 4px 6px 6px;
    border-bottom: 1px solid var(--line);
    margin-bottom: 3px;
  }
  .ctx-swatches-hdr {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--dim);
    margin-bottom: 5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .ctx-clear-btn {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }
  .ctx-clear-btn:hover {
    text-decoration: underline;
  }
  .ctx-swatches-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    align-items: center;
  }
  .ctx-swatch {
    width: 17px;
    height: 17px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.3);
    cursor: pointer;
    padding: 0;
    transition: transform 0.1s ease;
    flex: none;
  }
  .ctx-swatch:hover {
    transform: scale(1.18);
  }
  .ctx-swatch.active {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .ctx-swatch-custom {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 17px;
    height: 17px;
    border-radius: 3px;
    border: 1px solid var(--line);
    cursor: pointer;
    position: relative;
    font-size: 10px;
    background: var(--input-bg);
    flex: none;
  }
  .ctx-swatch-custom input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }
  .ctx-sep {
    height: 1px;
    background: var(--line);
    margin: 3px 0;
  }
  .ctx-item {
    text-align: left;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    color: var(--text);
    padding: 6px 10px;
    border-radius: var(--radius);
    font-size: 12.5px;
    cursor: pointer;
  }
  .ctx-item:hover:not(:disabled) {
    background: var(--sel);
    border-left-color: var(--accent);
    color: var(--text-strong);
  }
  .ctx-item.danger {
    color: var(--danger);
  }
  .ctx-item:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
