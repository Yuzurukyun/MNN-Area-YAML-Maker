<script>
  export let pair;
  export let byId;
  export let lt;
  export let pos;
  export let onToggle;
  export let onClose;

  $: X = byId(pair.x);
  $: Y = byId(pair.y);
  const isModal = (a) =>
    a && (a.links[lt].mode === 'all' || (lt !== 'reachable' && a.links[lt].mode === 'reachable'));
  $: xModal = isModal(X);
  $: yModal = isModal(Y);
  const modeWord = (a) => (a.links[lt].mode === 'all' ? 'ALL AREAS' : 'follows reachable');
  $: xLock = xModal ? modeWord(X) : null;
  $: yLock = yModal ? modeWord(Y) : null;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="dircard" style="left:{pos.left}px;top:{pos.top}px" on:pointerdown|stopPropagation>
  <div class="dc-head">
    <span>Connection</span>
    <button class="dc-x" title="Close" on:click={onClose}>✕</button>
  </div>
  <div class="dc-row">
    <span class="dc-label">{X?.area} → {Y?.area}</span>
    {#if xLock}
      <span class="dc-locked" title="Decided by {X?.area}'s mode">{pair.xy ? 'Always' : 'Off'} · {xLock}</span>
    {:else}
      <button class="dc-toggle {pair.xy ? 'on' : ''}" title="Toggle {X?.area} → {Y?.area}" on:click={() => onToggle(pair.x, pair.y, !pair.xy)}>
        {pair.xy ? 'On' : 'Off'}
      </button>
    {/if}
  </div>
  <div class="dc-row">
    <span class="dc-label">{Y?.area} → {X?.area}</span>
    {#if yLock}
      <span class="dc-locked" title="Decided by {Y?.area}'s mode">{pair.yx ? 'Always' : 'Off'} · {yLock}</span>
    {:else}
      <button class="dc-toggle {pair.yx ? 'on' : ''}" title="Toggle {Y?.area} → {X?.area}" on:click={() => onToggle(pair.y, pair.x, !pair.yx)}>
        {pair.yx ? 'On' : 'Off'}
      </button>
    {/if}
  </div>
  {#if pair.ghost}
    <div class="dc-note">Both directions are off. Switch one back on to keep this line, or close to discard.</div>
  {:else if xLock || yLock}
    <div class="dc-note">Locked sides come from a mode (ALL AREAS / follows reachable) — change the mode in that area's sidebar.</div>
  {/if}
</div>

<style>
  .dircard {
    position: absolute;
    transform: translate(-50%, 14px);
    z-index: 30;
    min-width: 268px;
    max-width: 350px;
    background: var(--panel2);
    border: 1px solid var(--line2);
    border-radius: var(--radius-lg);
    padding: 10px 12px 11px;
    box-shadow: 0 16px 40px -8px var(--shadow);
    animation: pop-in 0.13s ease-out;
  }
  .dc-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-strong);
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line);
    margin-bottom: 7px;
  }
  .dc-head span::before {
    content: "// ";
    color: var(--accent);
  }
  .dc-x {
    padding: 0 4px;
    border: none;
    background: none;
    color: var(--dim);
    font-size: 12px;
  }
  .dc-x:hover {
    background: none;
    color: var(--text);
  }
  .dc-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 3px 0;
  }
  .dc-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
  }
  .dc-toggle {
    min-width: 52px;
    text-align: center;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .dc-toggle.on {
    background: var(--accent-solid);
    border-color: var(--accent);
    color: #fff;
  }
  .dc-locked {
    font-size: 11px;
    color: var(--warn);
    border: 1px dashed var(--line2);
    border-radius: var(--radius);
    padding: 2px 7px;
    white-space: nowrap;
  }
  .dc-note {
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.45;
    color: var(--dim);
  }
</style>
