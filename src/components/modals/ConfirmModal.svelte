<script>
  export let title;
  export let body;
  export let confirmLabel;
  export let onConfirm;
  export let onCancel;

  let scrimMouseDownTarget = null;
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && onCancel()} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="modal-bg"
  on:mousedown={(e) => (scrimMouseDownTarget = e.target)}
  on:click={(e) => {
    if (scrimMouseDownTarget === e.currentTarget && e.target === e.currentTarget) onCancel();
    scrimMouseDownTarget = null;
  }}
>
  <div class="modal" style="max-width:520px" on:mousedown|stopPropagation on:click|stopPropagation>
    <button class="modal-x" title="Close" on:click={onCancel}>✕</button>
    <h3>{title}</h3>
    <p style="margin:0 0 14px;line-height:1.5;white-space:pre-line">{body}</p>
    <div class="row">
      <button title="Cancel and keep your current work" on:click={onCancel}>Cancel</button>
      <button class="danger primary" title="Confirm and proceed" on:click={onConfirm}>{confirmLabel}</button>
    </div>
  </div>
</div>
