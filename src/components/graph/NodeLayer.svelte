<script>
  import * as M from '../../lib/core.js';
  import { titleText, bgText, tagText } from '../../lib/nodeLabels.js';
  import { onMount } from 'svelte';
  import { bgStore, resolveNodeImageUrl } from '../../lib/bgStore.js';
  import { update, notify } from '../../lib/state.js';
  import { getViewportBox, isNodeInViewport } from '../../lib/graphGeom.js';

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
  export let view = null;
  export let wrapBounds = null;

  $: viewportBox = getViewportBox(view, wrapBounds, 280);

  let bgStoreState = bgStore.get();
  onMount(() => {
    return bgStore.subscribe((s) => {
      if (s.isMakerOpen) return;
      bgStoreState = s;
    });
  });

  let dragOverNodeId = null;

  $: sortedAreas = selectedId
    ? [...P.areas].sort((a, b) => (a.id === selectedId ? 1 : b.id === selectedId ? -1 : 0))
    : P.areas;

  function onNodeDragOver(e, a) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    if (dragOverNodeId !== a.id) {
      dragOverNodeId = a.id;
    }
  }

  function onNodeDragLeave(e, a) {
    if (dragOverNodeId === a.id) {
      dragOverNodeId = null;
    }
  }

  async function onNodeDrop(e, a) {
    e.preventDefault();
    dragOverNodeId = null;

    // 1. From Asset Pool JSON
    const assetJson = e.dataTransfer?.getData('application/x-area-maker-asset');
    if (assetJson) {
      try {
        const asset = JSON.parse(assetJson);
        if (asset && asset.type === 'image') {
          update((s) => {
            const target = s.project.areas.find((ar) => ar.id === a.id);
            if (target) {
              target.image = asset.url;
              target.imageMode = 'node';
            }
          });
          notify(`Assigned icon "${asset.name}" to ${a.area || 'node'}`);
          return;
        }
      } catch (err) {
        console.warn('Failed to parse dropped asset JSON:', err);
      }
    }

    // 2. From plain text (asset path or background name)
    const textData = e.dataTransfer?.getData('text/plain');
    if (textData) {
      const imgUrl = bgStore.getAssetUrl(textData, 'image');
      if (imgUrl) {
        update((s) => {
          const target = s.project.areas.find((ar) => ar.id === a.id);
          if (target) {
            target.image = imgUrl;
            target.imageMode = 'node';
          }
        });
        notify(`Assigned icon to ${a.area || 'node'}`);
        return;
      }
    }

    // 3. From OS image file drag-and-drop
    if (e.dataTransfer?.files?.length) {
      const f = e.dataTransfer.files[0];
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const max = 512;
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > max || h > max) {
              if (w > h) { h = Math.round((h * max) / w); w = max; }
              else { h = Math.round((w * max) / h); h = max; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL(f.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88);
            update((s) => {
              const target = s.project.areas.find((ar) => ar.id === a.id);
              if (target) {
                target.image = dataUrl;
                target.imageMode = 'node';
              }
            });
            notify(`Set custom icon for "${a.area || 'node'}"`);
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(f);
      }
    }
  }
</script>

<g>
  <defs>
    <clipPath id="node-img-clip">
      <rect x="9" y="9" width="46" height="46" rx="4" />
    </clipPath>
  </defs>

  {#if pill && !inFocus}
    <g transform="translate({pill.x},{pill.y})">
      <rect width="118" height="40" rx="5" fill="var(--node-bg)" stroke="var(--accent)" stroke-width="1.4" />
      <text x="59" y="17" text-anchor="middle" font-size="11.5" font-weight="700" fill="var(--accent)">ALL AREAS</text>
      <text x="59" y="31" text-anchor="middle" font-size="9.5" fill="var(--dim)">{lt === 'reachable' ? 'incl. hub' : 'excl. hub'}</text>
    </g>
  {/if}

  {#each sortedAreas as a (a.id)}
    {@const isSel = a.id === selectedId}
    {@const isMulti = selectedIds && selectedIds.has(a.id) && !isSel}
    {@const isSelected = isSel || isMulti}
    {@const isNeighbour = neighbours && neighbours.has(a.id)}
    {@const inViewport = isSelected || isNeighbour || isNodeInViewport(a, viewportBox)}
    {#if inViewport && !hiddenIds.has(a.id) && (!inFocus || focusIds.has(a.id))}
      {@const idx = P.areas.indexOf(a)}
      {@const nodeImg = resolveNodeImageUrl(a, bgStoreState)}
      {@const hasImg = Boolean(nodeImg)}
      {@const tags = tagText(P, a, idx, dups, lt, hasImg)}
      {@const xOff = hasImg ? 60 : 13}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <g
        class="node-wrap"
        transform="translate({a.x},{a.y})"
        on:pointerdown={(e) => onNodeDown(e, a)}
        on:pointerenter={(e) => onNodeEnter(e, a)}
        on:pointerleave={(e) => onNodeLeave(e, a)}
        on:contextmenu={(e) => onNodeMenu(e, a)}
        on:dblclick={(e) => onNodeDblClick(e, a)}
        on:dragover={(e) => onNodeDragOver(e, a)}
        on:dragleave={(e) => onNodeDragLeave(e, a)}
        on:drop={(e) => onNodeDrop(e, a)}
      >
        <rect class="mask" x="-4" y="-4" width={NW + 8} height={NH + 8} rx="6" />
        <g
          class="node {idx === 0 ? 'hub' : ''} {isSel ? 'sel' : ''} {isMulti ? 'multi' : ''} {dups.has(M.strip(a.area)) ? 'dup' : ''} {dragOverNodeId === a.id ? 'drag-over' : ''}"
          opacity={focusOn && !isSelected && !isNeighbour ? 0.17 : 1}
        >
          <rect
            class="body"
            width={NW}
            height={NH}
            rx="5"
            style={isSelected
              ? `stroke: ${a.color || 'var(--accent)'}; stroke-width: 2px; fill: ${a.color ? `color-mix(in srgb, ${a.color} 16%, var(--node-bg))` : 'color-mix(in srgb, var(--accent) 12%, var(--node-bg))'}; filter: drop-shadow(0 0 18px color-mix(in srgb, ${a.color || 'var(--accent)'} 35%, transparent));`
              : (a.color ? `stroke: ${a.color}; fill: color-mix(in srgb, ${a.color} 14%, var(--node-bg));` : '')}
          />
          <rect
            class="node-accent"
            x="0"
            y="6"
            width="3.5"
            height={NH - 12}
            rx="1.5"
            style={a.color ? `fill: ${a.color};` : (isSelected ? 'fill: var(--accent);' : '')}
          />
          {#if hasImg}
            <image
              href={nodeImg}
              x="9"
              y="9"
              width="46"
              height="46"
              preserveAspectRatio="xMidYMid slice"
              clip-path="url(#node-img-clip)"
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
