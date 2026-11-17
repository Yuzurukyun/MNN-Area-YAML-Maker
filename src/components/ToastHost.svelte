<script>
  import { toasts, dismissToast } from '../lib/state.js';
</script>

{#if $toasts.length}
  <div class="toast-host" aria-live="polite">
    {#each $toasts as t (t.id)}
      <div class="toast {t.kind}">
        <span class="toast-msg">{t.message}</span>
        <button class="toast-x" title="Dismiss" on:click={() => dismissToast(t.id)}>✕</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-host {
    position: fixed;
    bottom: 16px;
    right: 18px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 400px;
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 13px;
    border-radius: var(--radius-lg);
    background: var(--panel2);
    border: 1px solid var(--line2);
    border-left: 3px solid var(--accent);
    color: var(--text);
    box-shadow: 0 14px 34px -6px var(--shadow);
    font-size: 12.5px;
    animation: pop-in 0.14s ease-out;
  }
  .toast.ok { border-color: var(--ok); border-left-color: var(--ok); }
  .toast.warn { border-color: var(--warn); border-left-color: var(--warn); }
  .toast.error { border-color: var(--danger); border-left-color: var(--danger); }
  .toast-msg {
    flex: 1;
    line-height: 1.4;
  }
  .toast-x {
    flex: none;
    padding: 0 5px;
    border: none;
    background: none;
    color: var(--dim);
    font-size: 12px;
  }
</style>
