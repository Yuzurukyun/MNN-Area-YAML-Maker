<script>
  import { centreOf, edgeEndpoints, edgePath, getViewportBox, isEdgeInViewport } from '../../lib/graphGeom.js';

  export let pairs;
  export let byId;
  export let selectedId;
  export let selectedIds = null;
  export let selectedEdge;
  export let focusOn;
  export let allAreas;
  export let pill;
  export let inFocus;
  export let focusIds = null;
  export let showAllMesh;
  export let drag;
  export let tempTo;
  export let band;
  export let onPickEdge;
  export let edgeStyle = 'curved';
  export let routeEdgeSet = null;
  export let view = null;
  export let wrapBounds = null;
  export let hideLinesUnlessFocused = false;

  $: viewportBox = getViewportBox(view, wrapBounds, 280);
</script>

<g>
  {#if pill && !inFocus}
    {#each allAreas as a}
      {@const inBox = !viewportBox || (a.x + 204 >= viewportBox.minX && a.x <= viewportBox.maxX && a.y + 66 >= viewportBox.minY && a.y <= viewportBox.maxY)}
      {@const aSelected = selectedId === a.id || (selectedIds && selectedIds.has(a.id))}
      {#if inBox && (!hideLinesUnlessFocused || aSelected)}
        {@const c = centreOf(a)}
        <line
          x1={c.x} y1={c.y} x2={pill.x + 59} y2={pill.y + 20}
          stroke="var(--accent)" stroke-width="1.3" stroke-dasharray="5 4" pointer-events="none"
          opacity={focusOn && a.id !== selectedId ? 0.07 : 0.65}
        />
      {/if}
    {/each}
  {/if}

  {#each pairs as p (p.x + '|' + p.y)}
    {@const touchesSelected = (selectedId && (selectedId === p.x || selectedId === p.y)) || (selectedIds && (selectedIds.has(p.x) || selectedIds.has(p.y)))}
    {#if !p.allOnly || showAllMesh || (inFocus && touchesSelected)}
      {@const A = byId(p.x)}
      {@const B = byId(p.y)}
      {#if A && B}
        {@const isSel = selectedEdge && selectedEdge.x === p.x && selectedEdge.y === p.y}
        {@const isRoute = routeEdgeSet && (routeEdgeSet.has(p.x + '->' + p.y) || routeEdgeSet.has(p.y + '->' + p.x))}
        {@const touchesFocus = inFocus && focusIds && (focusIds.has(p.x) || focusIds.has(p.y))}
        {@const passesFocusFilter = !hideLinesUnlessFocused || touchesSelected || isSel || isRoute || touchesFocus}
        {#if passesFocusFilter}
          {@const mustRender = isSel || isRoute || touchesSelected}
          {#if mustRender || isEdgeInViewport(A, B, viewportBox)}
            {@const oneway = p.xy !== p.yx}
            {@const selIn = oneway && ((selectedId === p.x && p.yx) || (selectedId === p.y && p.xy))}
            {@const dim = focusOn && !touchesSelected}
            {@const flip = p.yx && !p.xy}
            {@const fromNode = flip ? B : A}
            {@const toNode = flip ? A : B}
            {@const pts = edgeEndpoints(fromNode, toNode)}
            {@const d = edgePath(pts, edgeStyle)}

            {#if !p.derived}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <path
                class="edge-hit"
                {d}
                fill="none"
                on:pointerdown={(e) => onPickEdge(e, p)}
              />
            {/if}
            <path
              class="edge {p.ghost ? 'ghost' : isSel ? 'sel' : ''} {p.derived ? 'derived' : ''} {p.allOnly ? 'all-mesh' : ''} {oneway ? (selIn ? 'oneway-in' : 'oneway') : ''} {isRoute ? 'route-active' : ''}"
              {d}
              fill="none"
              opacity={isRoute ? 1 : dim ? 0.07 : p.ghost ? 0.5 : p.derived ? 0.42 : 1}
              marker-end={oneway ? `url(#${isRoute ? 'arrowRoute' : p.derived ? 'arrow' : isSel ? 'arrowSel' : selIn ? 'arrowAmber' : 'arrowRed'})` : undefined}
            />
          {/if}
        {/if}
      {/if}
    {/if}
  {/each}

  {#if drag && drag.kind === 'connect' && tempTo}
    {@const src = byId(drag.id)}
    {#if src}
      {@const c = centreOf(src)}
      <line
        x1={c.x} y1={c.y} x2={tempTo.x} y2={tempTo.y}
        stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 3"
        marker-end="url(#arrowSel)" pointer-events="none"
      />
    {/if}
  {/if}

  {#if band}
    <rect id="bandRect" x={band.x} y={band.y} width={band.w} height={band.h} />
  {/if}
</g>
