<script>
  import { NODE_W, NODE_H } from '../../lib/fields.js';

  export let groups;
  export let areas = [];
  export let onGroupDown;
  export let onGroupMenu;
  export let onGroupDblClick;

  function countMembers(g) {
    if (!areas || !areas.length) return 0;
    let count = 0;
    for (let i = 0; i < areas.length; i++) {
      const a = areas[i];
      if (a.x >= g.x && a.x + NODE_W <= g.x + g.w && a.y >= g.y && a.y + NODE_H <= g.y + g.h) {
        count++;
      }
    }
    return count;
  }
</script>

<g>
  {#each groups as g (g.id)}
    {@const count = countMembers(g)}
    {@const countText = count > 0 ? ` · ${count}` : ''}
    {@const fullLabel = g.name + countText}
    {@const tabWidth = Math.max(96, fullLabel.length * 7.5 + 24)}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <g
      on:pointerdown={(e) => onGroupDown(e, g, 'move')}
      on:contextmenu={(e) => onGroupMenu(e, g)}
      on:dblclick={(e) => onGroupDblClick(e, g)}
    >
      <rect
        class="group-body"
        class:custom-color={!!g.color}
        x={g.x}
        y={g.y}
        width={g.w}
        height={g.h}
        rx="6"
        style={g.color ? `fill:color-mix(in srgb, ${g.color} 14%, var(--group-fill)); stroke:color-mix(in srgb, ${g.color} 80%, var(--group-stroke)); stroke-width:2px;` : ''}
      />
      <rect
        class="group-tab"
        class:custom-color={!!g.color}
        x={g.x}
        y={g.y}
        width={tabWidth}
        height="24"
        rx="5"
        style={g.color ? `fill:color-mix(in srgb, ${g.color} 24%, var(--panel2)); stroke:color-mix(in srgb, ${g.color} 80%, var(--group-stroke)); stroke-width:1.5px;` : ''}
      />
      <text
        class="group-name"
        x={g.x + 11}
        y={g.y + 16}
        style={g.color ? `fill:color-mix(in srgb, ${g.color} 85%, var(--text-strong)); font-weight:700;` : ''}
      >{g.name}<tspan class="group-count">{countText}</tspan></text>
    </g>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <rect
      class="group-resize"
      x={g.x + g.w - 16} y={g.y + g.h - 16} width="16" height="16" rx="4"
      on:pointerdown={(e) => onGroupDown(e, g, 'resize')}
      on:contextmenu={(e) => onGroupMenu(e, g)}
    />
  {/each}
</g>

<style>
  .group-body {
    fill: var(--group-fill);
    stroke: var(--group-stroke);
    stroke-width: 1.8;
    stroke-dasharray: 8 5;
    cursor: grab;
  }
  .group-tab {
    fill: var(--panel2);
    stroke: var(--group-stroke);
    stroke-width: 1.4;
  }
  .group-name {
    font-size: 12px;
    font-weight: 600;
    fill: var(--text);
    pointer-events: none;
  }
  .group-count {
    fill: var(--accent);
    font-weight: 700;
  }
  .group-resize {
    fill: color-mix(in srgb, var(--accent) 32%, transparent);
    stroke: var(--accent);
    stroke-width: 1;
    cursor: nwse-resize;
  }
  .group-resize:hover {
    fill: color-mix(in srgb, var(--accent) 60%, transparent);
  }
</style>
