<script>
  import { edgeMidpoint } from '../../lib/graphGeom.js';

  export let pairs;
  export let byId;
  export let selectedId;
  export let showAllMesh;
  export let inFocus;
</script>

<g>
  {#each pairs as p (p.x + '|' + p.y)}
    {@const touchesSelected = selectedId === p.x || selectedId === p.y}
    {#if touchesSelected && !p.derived && !p.ghost && (!p.allOnly || showAllMesh || inFocus)}
      {@const A = byId(p.x)}
      {@const B = byId(p.y)}
      {#if A && B}
        {@const selIsX = selectedId === p.x}
        {@const out = selIsX ? p.xy : p.yx}
        {@const inc = selIsX ? p.yx : p.xy}
        {@const dirLabel = out && inc ? '↔ both ways' : out ? 'one-way out' : 'one-way in'}
        {@const mid = edgeMidpoint(A, B)}
        {@const w = dirLabel.length * 6.8 + 16}
        <g pointer-events="none">
          <rect
            x={mid.x - w / 2}
            y={mid.y - 10}
            width={w}
            height="20"
            rx="10"
            fill="var(--tag-bg)"
            stroke={out && inc ? 'var(--edge-both)' : out ? 'var(--edge-oneway)' : 'var(--edge-oneway-in)'}
            stroke-width="1.2"
          />
          <text x={mid.x} y={mid.y + 3.5} text-anchor="middle" font-size="10.5" fill="var(--tag-text)">
            {dirLabel}
          </text>
        </g>
      {/if}
    {/if}
  {/each}
</g>
