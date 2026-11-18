<script>
  import { copyText, notify } from '../../lib/state.js';

  export let x;
  export let y;
  export let items;
  export let onClose;

  let copiedKey = null;

  async function doCopy(text, key, label) {
    if (!text) return;
    const ok = await copyText(text);
    if (ok) {
      copiedKey = key;
      notify(`Copied ${label || text} to clipboard.`, 'ok');
      setTimeout(() => {
        if (copiedKey === key) copiedKey = null;
      }, 1500);
    } else {
      notify('Could not copy to clipboard.', 'error');
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="ctx-menu" style="left:{x}px;top:{y}px" on:pointerdown|stopPropagation on:contextmenu|preventDefault>
  {#each items as it}
    {#if it.type === 'zone'}
      <div class="ctx-zone-box">
        <div class="ctx-zone-hdr">
          <span class="ctx-zone-title">Zone Command</span>
          {#if it.hasAreas}
            {#if it.isRange}
              <span class="zone-pill ok" title="All {it.count} area IDs are consecutive">Range ({it.count})</span>
            {:else}
              <span class="zone-pill warn" title="Area IDs are scattered. Run 'Sort IDs' to make consecutive">Scattered ({it.count})</span>
            {/if}
          {/if}
        </div>

        {#if !it.hasAreas}
          <div class="zone-empty-hint">No areas inside this group yet.</div>
        {:else}
          {#if !it.isRange}
            <div class="zone-scattered-alert">
              <span>⚠ IDs not consecutive. Run <b>Sort IDs</b> to arrange into a range.</span>
            </div>
          {/if}

          <!-- Code block 1: Range / IDs -->
          <div class="zone-code-card">
            <div class="zone-code-lbl-row">
              <span class="zone-code-lbl">{it.isRange ? 'Range' : 'Area IDs'}</span>
              <button
                class="zone-copy-btn {copiedKey === 'val1' ? 'copied' : ''}"
                title="Copy to clipboard"
                on:click={() => doCopy(it.val1, 'val1', `"${it.val1}"`)}
              >{copiedKey === 'val1' ? '✓ Copied' : 'Copy'}</button>
            </div>
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div
              class="zone-code-snippet"
              title="Click to copy"
              on:click={() => doCopy(it.val1, 'val1', `"${it.val1}"`)}
            >
              <code>{it.val1}</code>
            </div>
          </div>

          <!-- Code block 2: /zone command -->
          <div class="zone-code-card">
            <div class="zone-code-lbl-row">
              <span class="zone-code-lbl">Command</span>
              <button
                class="zone-copy-btn {copiedKey === 'val2' ? 'copied' : ''}"
                title="Copy command to clipboard"
                on:click={() => doCopy(it.val2, 'val2', `"${it.val2}"`)}
              >{copiedKey === 'val2' ? '✓ Copied' : 'Copy'}</button>
            </div>
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div
              class="zone-code-snippet"
              title="Click to copy"
              on:click={() => doCopy(it.val2, 'val2', `"${it.val2}"`)}
            >
              <code>{it.val2}</code>
            </div>
          </div>

          {#if !it.isRange && it.onSortIds}
            <button
              class="zone-sort-act-btn"
              title="Open Sort IDs modal to reorder areas into consecutive ranges"
              on:click={() => { onClose(); it.onSortIds(); }}
            >⚡ Auto-sort IDs into range…</button>
          {/if}
        {/if}
      </div>
    {:else if it.type === 'swatches'}
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
    min-width: 224px;
    max-width: 320px;
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
  .ctx-zone-box {
    padding: 6px 8px 8px;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    margin: 2px 0 4px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ctx-zone-hdr {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .ctx-zone-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--dim);
  }
  .zone-pill {
    font-size: 9.5px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .zone-pill.ok {
    background: color-mix(in srgb, var(--ok) 20%, transparent);
    color: var(--ok);
    border: 1px solid color-mix(in srgb, var(--ok) 40%, transparent);
  }
  .zone-pill.warn {
    background: color-mix(in srgb, var(--warn) 20%, transparent);
    color: var(--warn);
    border: 1px solid color-mix(in srgb, var(--warn) 45%, transparent);
  }
  .zone-scattered-alert {
    font-size: 10.5px;
    color: var(--warn);
    line-height: 1.35;
    background: color-mix(in srgb, var(--warn) 10%, transparent);
    padding: 4px 6px;
    border-radius: 3px;
    border-left: 2px solid var(--warn);
  }
  .zone-code-card {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .zone-code-lbl-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .zone-code-lbl {
    font-size: 10px;
    font-weight: 600;
    color: var(--dim);
  }
  .zone-copy-btn {
    font-size: 10px;
    font-weight: 600;
    color: var(--accent);
    background: none;
    border: none;
    padding: 0 2px;
    cursor: pointer;
    transition: color 0.1s ease;
  }
  .zone-copy-btn:hover {
    color: var(--accent2);
    text-decoration: underline;
  }
  .zone-copy-btn.copied {
    color: var(--ok);
    font-weight: 700;
  }
  .zone-code-snippet {
    background: var(--panel2);
    border: 1px solid var(--line2);
    border-radius: 3px;
    padding: 4px 7px;
    cursor: pointer;
    transition: border-color 0.12s ease, background 0.12s ease;
    max-height: 65px;
    overflow-y: auto;
    word-break: break-all;
  }
  .zone-code-snippet:hover {
    border-color: var(--accent);
    background: var(--sel);
  }
  .zone-code-snippet code {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-strong);
    display: block;
    user-select: all;
  }
  .zone-sort-act-btn {
    background: var(--sel);
    border: 1px dashed var(--accent);
    color: var(--accent2);
    font-size: 10.5px;
    font-weight: 600;
    padding: 4px 6px;
    border-radius: 3px;
    cursor: pointer;
    text-align: center;
    margin-top: 2px;
  }
  .zone-sort-act-btn:hover {
    background: var(--hover);
    border-style: solid;
  }
  .zone-empty-hint {
    font-size: 11px;
    color: var(--dim);
    font-style: italic;
    padding: 4px 0;
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
