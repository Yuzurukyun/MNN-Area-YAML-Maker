<script>
  export let images;
  export let onImageDown;
  export let onImageMenu;
</script>

<g>
  {#each images as im (im.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <g on:pointerdown={(e) => onImageDown(e, im, 'move')} on:contextmenu={(e) => onImageMenu(e, im)}>
      <rect class="img-frame" x={im.x - 3} y={im.y - 3} width={im.w + 6} height={im.h + 6} rx="6" />
      <image href={im.src} x={im.x} y={im.y} width={im.w} height={im.h} preserveAspectRatio="none" />
    </g>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <rect
      class="img-resize"
      x={im.x + im.w - 7} y={im.y + im.h - 7} width="14" height="14" rx="4"
      on:pointerdown={(e) => onImageDown(e, im, 'resize')}
      on:contextmenu={(e) => onImageMenu(e, im)}
    />
  {/each}
</g>

<style>
  .img-frame {
    fill: none;
    stroke: var(--img-frame);
    stroke-width: 1.2;
    cursor: grab;
  }
  .img-resize {
    fill: var(--img-frame);
    stroke: var(--line2);
    cursor: nwse-resize;
  }
  .img-resize:hover {
    fill: var(--accent);
  }
</style>
