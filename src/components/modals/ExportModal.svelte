<script>
  import { download, copyText, notify } from '../../lib/state.js';
  import * as M from '../../lib/core.js';

  export let P;
  export let onClose;

  $: errors = M.exportErrors(P);
  $: warnings = errors.length ? [] : M.exportWarnings(P);
  $: yamlText = errors.length ? '' : M.exportYaml(P);

  async function copyYaml() {
    if (errors.length) return;
    const ok = await copyText(yamlText);
    notify(ok ? 'Copied areas.yaml to clipboard.' : 'Clipboard blocked — select and copy from the box instead.', ok ? 'ok' : 'warn');
  }

  function downloadYaml() {
    if (errors.length) return;
    download('areas.yaml', yamlText);
    notify('Downloaded areas.yaml.', 'ok');
  }

  let scrimMouseDownTarget = null;
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && onClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="modal-bg"
  on:mousedown={(e) => (scrimMouseDownTarget = e.target)}
  on:click={(e) => {
    if (scrimMouseDownTarget === e.currentTarget && e.target === e.currentTarget) onClose();
    scrimMouseDownTarget = null;
  }}
>
  <div class="modal" on:mousedown|stopPropagation on:click|stopPropagation>
    <button class="modal-x" title="Close" on:click={onClose}>✕</button>
    <h3>areas.yaml — export preview</h3>
    {#if errors.length}
      <div class="err-box">
        <b>Can't export yet — fix these first:</b>
        <ul>
          {#each errors as e}<li>{e}</li>{/each}
        </ul>
        <span>YAML export stays locked until errors are fixed. JSON backup still works anytime.</span>
      </div>
    {:else}
      {#if warnings.length}
        <div class="warn-box">
          <b>Heads up ({warnings.length} warning{warnings.length === 1 ? '' : 's'} — non-blocking):</b>
          <ul>
            {#each warnings.slice(0, 6) as w}<li>{w}</li>{/each}
            {#if warnings.length > 6}<li>…and {warnings.length - 6} more.</li>{/if}
          </ul>
        </div>
      {/if}
      <textarea readonly value={yamlText}></textarea>
    {/if}
    <div class="row">
      <button title="Copy generated areas.yaml to your clipboard" on:click={copyYaml} disabled={errors.length > 0}>Copy YAML</button>
      <button class="primary" title="Download generated areas.yaml file" on:click={downloadYaml} disabled={errors.length > 0}>Download areas.yaml</button>
      <button title="Close export preview" on:click={onClose}>Close</button>
    </div>
  </div>
</div>
