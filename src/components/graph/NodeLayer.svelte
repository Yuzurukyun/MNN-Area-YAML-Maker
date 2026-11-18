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
  export let onTitleDblClick = () => {};
  export let onNodeEnter = () => {};
  export let onNodeLeave = () => {};
</script>

<g>
  <defs>
    {#each P.areas as a (a.id)}
      {#if a.image}
        <clipPath id="clip-{a.id}">
          <rect x="9" y="9" width="46" height="46" rx="4" />
        </clipPath>
      {/if}
    {/each}
  </defs>

  {#if pill && !inFocus}
    <g transform="translate({pill.x},{pill.y})">
      <rect width="118" height="40" rx="5" fill="var(--node-bg)" stroke="var(--accent)" stroke-width="1.4" />
      <text x="59" y="17" text-anchor="middle" font-size="11.5" font-weight="700" fill="var(--accent)">ALL AREAS</text>
      <text x="59" y="31" text-anchor="middle" font-size="9.5" fill="var(--dim)">{lt === 'reachable' ? 'incl. hub' : 'excl. hub'}</text>
    </g>
  {/if}

  {#each P.areas as a, idx (a.id)}
    {@const hasImg = !!a.image}
    {@const tags = tagText(P, a, idx, dups, lt, hasImg)}
    {@const isSel = a.id === selectedId}
    {@const isMulti = selectedIds.has(a.id) && !isSel}
    {@const xOff = hasImg ? 60 : 13}
    {#if !hiddenIds.has(a.id) && (!inFocus || focusIds.has(a.id))}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <g
        class="node-wrap"
        transform="translate({a.x},{a.y})"
        on:pointerdown={(e) => onNodeDown(e, a)}
        on:pointerenter={(e) => onNodeEnter(e, a)}
        on:pointerleave={(e) => onNodeLeave(e, a)}
        on:contextmenu={(e) => onNodeMenu(e, a)}
        on:dblclick={(e) => onNodeDblClick(e, a)}
      >
        <rect class="mask" x="-4" y="-4" width={NW + 8} height={NH + 8} rx="6" />
        <g
          class="node {idx === 0 ? 'hub' : ''} {isSel ? 'sel' : ''} {isMulti ? 'multi' : ''} {dups.has(M.strip(a.area)) ? 'dup' : ''}"
          opacity={focusOn && !neighbours.has(a.id) ? 0.17 : 1}
        >
          <rect
            class="body"
            width={NW}
            height={NH}
            rx="5"
            style={a.color ? `stroke: ${a.color}; fill: color-mix(in srgb, ${a.color} 14%, var(--node-bg)); ${isSel ? `filter: drop-shadow(0 0 10px ${a.color}); stroke-width: 2px;` : ''}` : ''}
          />
          <rect
            class="node-accent"
            x="0"
            y="6"
            width="3.5"
            height={NH - 12}
            rx="1.5"
            style={a.color ? `fill: ${a.color};` : ''}
          />
          {#if hasImg}
            <image
              href={a.image}
              x="9"
              y="9"
              width="46"
              height="46"
              preserveAspectRatio="xMidYMid slice"
              clip-path="url(#clip-{a.id})"
            />
            <rect x="9" y="9" width="46" height="46" rx="4" fill="none" stroke="var(--line2)" stroke-width="1" />
          {/if}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <rect
            class="title-hitbox"
            x="0"
            y="0"
            width={NW}
            height="27"
            rx="5"
            fill="transparent"
            style="cursor:pointer"
            on:dblclick|stopPropagation={(e) => onTitleDblClick(e, a)}
          />
          <text
            class="title"
            x={xOff}
            y="21"
            font-size="13"
            font-weight="650"
            on:dblclick|stopPropagation={(e) => onTitleDblClick(e, a)}
          >{titleText(a, idx, hasImg)}</text>
          <text x={xOff} y="39" font-size="10.5" class="sub">{bgText(a, hasImg)}</text>
          {#if tags}
            <text x={xOff} y="57" font-size="9.5" font-weight="600" class="tags">{tags}</text>
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
