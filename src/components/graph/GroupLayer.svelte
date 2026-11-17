<script>
  export let groups;
  export let onGroupDown;
  export let onGroupMenu;
  export let onGroupDblClick;
</script>

<g>
  {#each groups as g (g.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <g
      on:pointerdown={(e) => onGroupDown(e, g, 'move')}
      on:contextmenu={(e) => onGroupMenu(e, g)}
      on:dblclick={(e) => onGroupDblClick(e, g)}
    >
      <rect class="group-body" x={g.x} y={g.y} width={g.w} height={g.h} rx="6" />
      <rect class="group-tab" x={g.x} y={g.y} width={Math.max(96, g.name.length * 7.5 + 22)} height="24" rx="5" />
      <text class="group-name" x={g.x + 11} y={g.y + 16}>{g.name}</text>
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
    stroke-width: 1.4;
    stroke-dasharray: 7 5;
    cursor: grab;
  }
  .group-tab {
    fill: var(--panel2);
    stroke: var(--group-stroke);
    stroke-width: 1.2;
  }
  .group-name {
    font-size: 12px;
    font-weight: 600;
    fill: var(--text);
    pointer-events: none;
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
