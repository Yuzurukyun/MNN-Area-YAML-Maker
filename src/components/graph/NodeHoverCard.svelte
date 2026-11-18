<script>
  import * as M from '../../lib/core.js';
  import { bgStore } from '../../lib/bgStore.js';
  import { resolveActiveVisual, normalizeBgPath } from '../../lib/bgSchema.js';

  export let area;
  export let idx;
  export let pos = { left: 0, top: 0 };
  export let dups = new Set();

  $: bgState = bgStore.get();
  $: matchedBg = bgState.backgrounds.find(
    (b) => b.folder.toLowerCase() === normalizeBgPath(area?.background).toLowerCase()
  );
  $: bgVisual = matchedBg ? resolveActiveVisual(matchedBg, { state: 'default', tod: 'day' }) : null;
  $: bgUrl = bgVisual
    ? bgStore.getAssetUrl(bgVisual.background, 'image')
    : (area?.background ? bgStore.getAssetUrl(area.background.split('/').pop(), 'image') : '');

  $: reachL = area.links?.reachable;
  $: reachTxt = reachL?.mode === 'all'
    ? '<ALL>'
    : reachL?.mode === 'reachable'
      ? '<REACHABLE>'
      : `${(reachL?.targets || []).length} exits`;

  $: visL = area.links?.visible;
  $: visTxt = visL?.mode === 'all' ? '<ALL>' : visL?.mode === 'reachable' ? '<REACHABLE>' : `${(visL?.targets || []).length} areas`;

  $: screamL = area.links?.scream;
  $: screamTxt = screamL?.mode === 'all' ? '<ALL>' : screamL?.mode === 'reachable' ? '<REACHABLE>' : screamL?.mode === 'none' ? 'None' : `${(screamL?.targets || []).length} areas`;

  $: flags = [
    area.lobby_area && 'Lobby',
    area.private_area && 'Private',
    area.environment_indoors && 'Indoors',
    area.environment_darkness && 'Darkness',
    M.strip(area.weather) && `Weather: ${area.weather}`,
    area.afk_delay > 0 && `AFK: ${area.afk_delay}s → #${area.afk_sendto}`,
    dups.has(M.strip(area.area)) && '⚠ DUPLICATE',
  ].filter(Boolean);
</script>

<div
  class="node-hover-card"
  style="left: {pos.left}px; top: {pos.top}px; {area.color ? `--card-accent: ${area.color}; border-left: 3px solid ${area.color};` : ''}"
>
  {#if area.image}
    <div class="card-img-wrap">
      <img src={area.image} alt={area.area} />
    </div>
  {:else if bgUrl}
    <div class="card-img-wrap" style="aspect-ratio: 16/9; height: auto; max-height: 120px;">
      <img src={bgUrl} alt={area.background} style="width: 100%; height: 100%; object-fit: cover;" />
    </div>
  {/if}

  <div class="card-head">
    <span class="card-id">#{idx}{idx === 0 ? ' · HUB' : ''}</span>
    <h3 class="card-title">{area.area || 'Unnamed'}</h3>
  </div>

  <div class="card-meta">
    <div class="meta-row">
      <span class="meta-label">Background:</span>
      <span class="meta-val">{area.background || 'None'}</span>
    </div>
    {#if area.tod && area.tod.length}
      <div class="meta-row">
        <span class="meta-label">TOD Backgrounds:</span>
        <span class="meta-val">{area.tod.length} variant{area.tod.length === 1 ? '' : 's'}</span>
      </div>
    {/if}
  </div>

  <div class="card-links">
    <span class="link-pill" title="Reachable connections">🚶 {reachTxt}</span>
    <span class="link-pill" title="Visible connections">👁 {visTxt}</span>
    {#if screamL?.mode !== 'none'}
      <span class="link-pill" title="Scream hearing range">📢 {screamTxt}</span>
    {/if}
  </div>

  {#if flags.length}
    <div class="card-tags">
      {#each flags as fl}
        <span class="flag-tag {fl.includes('⚠') ? 'warn' : ''}">{fl}</span>
      {/each}
    </div>
  {/if}

  {#if M.strip(area.default_description)}
    <div class="card-desc">
      {area.default_description}
    </div>
  {/if}
</div>

<style>
  .node-hover-card {
    position: absolute;
    z-index: 30;
    pointer-events: none;
    width: 260px;
    background: color-mix(in srgb, var(--panel2) 94%, transparent);
    border: 1px solid var(--line2);
    border-radius: var(--radius-lg);
    padding: 10px;
    box-shadow: 0 10px 30px -4px var(--shadow), 0 0 1px 1px rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    font-size: 11px;
    color: var(--text);
    transition: opacity 0.12s ease;
    animation: cardFadeIn 0.14s ease-out;
  }

  @keyframes cardFadeIn {
    from {
      opacity: 0;
      transform: translateY(4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .card-img-wrap {
    width: 100%;
    height: 120px;
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 8px;
    background: var(--input-bg);
    border: 1px solid var(--line);
  }

  .card-img-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .card-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 6px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 6px;
  }

  .card-id {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .card-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-strong);
    word-break: break-word;
    line-height: 1.3;
  }

  .card-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 6px;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    gap: 6px;
  }

  .meta-label {
    color: var(--dim);
    flex: none;
  }

  .meta-val {
    color: var(--text);
    font-weight: 500;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-links {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 6px;
  }

  .link-pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: var(--input-bg);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 2px 7px;
    font-size: 10px;
    color: var(--text);
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 6px;
  }

  .flag-tag {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--sel);
    color: var(--accent);
    font-size: 9.5px;
    font-weight: 600;
  }

  .flag-tag.warn {
    background: rgba(240, 181, 74, 0.15);
    color: var(--warn);
    border: 1px solid var(--warn);
  }

  .card-desc {
    padding-top: 5px;
    border-top: 1px solid var(--line);
    color: var(--dim);
    font-size: 10.5px;
    line-height: 1.35;
    max-height: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre-wrap;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }
</style>
