<script>
  import * as M from '../../lib/core.js';
  import { titleText, bgText, tagText } from '../../lib/nodeLabels.js';

  const NW = M.NODE_W;
  const NH = M.NODE_H;

  export let P;
  export let lt;
  export let pill;
  export let inFocus;
  export let hiddenIds;
  export let focusIds;
  export let selectedId;
  export let selectedIds;
  export let dups;
  export let neighbours;
  export let focusOn;
  export let onNodeDown;
  export let onPortDown;
  export let onNodeMenu;
  export let onNodeDblClick;
</script>

<g>
  {#if pill && !inFocus}
    <g transform="translate({pill.x},{pill.y})">
      <rect width="118" height="40" rx="5" fill="var(--node-bg)" stroke="var(--accent)" stroke-width="1.4" />
      <text x="59" y="17" text-anchor="middle" font-size="11.5" font-weight="700" fill="var(--accent)">ALL AREAS</text>
      <text x="59" y="31" text-anchor="middle" font-size="9.5" fill="var(--dim)">{lt === 'reachable' ? 'incl. hub' : 'excl. hub'}</text>
    </g>
  {/if}

  {#each P.areas as a, idx (a.id)}
    {@const tags = tagText(P, a, idx, dups, lt)}
    {#if !hiddenIds.has(a.id) && (!inFocus || focusIds.has(a.id))}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <g
        class="node-wrap"
        transform="translate({a.x},{a.y})"
        on:pointerdown={(e) => onNodeDown(e, a)}
        on:contextmenu={(e) => onNodeMenu(e, a)}
        on:dblclick={(e) => onNodeDblClick(e, a)}
      >
        <rect class="mask" x="-4" y="-4" width={NW + 8} height={NH + 8} rx="6" />
        <g
          class="node {idx === 0 ? 'hub' : ''} {a.id === selectedId ? 'sel' : ''} {selectedIds.has(a.id) && a.id !== selectedId ? 'multi' : ''} {dups.has(M.strip(a.area)) ? 'dup' : ''}"
          opacity={focusOn && !neighbours.has(a.id) ? 0.17 : 1}
        >
          <rect class="body" width={NW} height={NH} rx="5" />
          <rect class="node-accent" x="0" y="6" width="3.5" height={NH - 12} rx="1.5" />
          <text class="title" x="13" y="21" font-size="13" font-weight="650">{titleText(a, idx)}</text>
          <text x="13" y="39" font-size="10.5" class="sub">{bgText(a)}</text>
          {#if tags}
            <text x="13" y="57" font-size="9.5" font-weight="600" class="tags">{tags}</text>
          {/if}
        </g>
        <!-- Quick-connect handle on the right edge (alternative to Shift+drag) -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <circle
          class="node-port"
          cx={NW}
          cy={NH / 2}
          r="5.5"
          on:pointerdown|stopPropagation={(e) => onPortDown(e, a)}
        >
          <title>Drag to another area to connect</title>
        </circle>
      </g>
    {/if}
  {/each}
</g>
