<script>
  export let x;
  export let y;
  export let items;
  export let onClose;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="ctx-menu" style="left:{x}px;top:{y}px" on:pointerdown|stopPropagation on:contextmenu|preventDefault>
  {#each items as it}
    <button
      class="ctx-item {it.danger ? 'danger' : ''}"
      disabled={it.disabled}
      on:click={() => { onClose(); it.run(); }}
    >{it.label}</button>
  {/each}
</div>

<style>
  .ctx-menu {
    position: absolute;
    z-index: 35;
    min-width: 196px;
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
