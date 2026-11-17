<script>
  // The inline rename box that floats over a node or group on the map.
  // It owns the text being typed; Graph owns where it sits and what a
  // commit means. Enter or blur commits, Escape cancels — and a commit
  // after Escape is a no-op because Graph has already closed the edit.
  export let value; // the name the edit starts from
  export let styleText; // left/top/width, computed by Graph from the camera
  export let onCommit; // (value) => void
  export let onCancel; // () => void

  let v = value;

  function focusInput(el) {
    el.focus();
    el.select();
  }
</script>

<input
  class="rename-input"
  style={styleText}
  bind:value={v}
  use:focusInput
  on:keydown={(e) => {
    // Stop the keys here: Escape is also the board's "exit focus view"
    // key, and cancelling a rename must not trigger it on the way up.
    if (e.key === 'Enter') { e.stopPropagation(); onCommit(v); }
    if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
  }}
  on:blur={() => onCommit(v)}
/>

<style>
  .rename-input {
    position: absolute;
    z-index: 25;
    background: var(--panel2);
    border: 1.5px solid var(--accent);
    border-radius: 7px;
    color: var(--text);
    font-size: 13.5px;
    font-weight: 600;
    padding: 4px 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  }
</style>
