<script>
  import { update } from '../../lib/state.js';
  import * as M from '../../lib/core.js';
  export let area;
  export let fkey;
  export let label;
  export let def;
  $: grp = M.FIELD_GROUP[fkey] || 'common';
  $: changed = area[fkey] !== def;
  $: keyName = label.split(' — ')[0];
  $: apt = M.SHORT_DESC[fkey] || label.split(' — ')[1] || '';
  $: full = M.DESC[fkey] || apt;
  function toggle(e) {
    const v = e.target.checked;
    update((s) => {
      const ar = s.project.areas.find((x) => x.id === area.id);
      if (ar) ar[fkey] = v;
    });
  }
</script>

<label class="tgl {changed ? '' : 'at-default'}" data-group={grp} title={full}>
  <input type="checkbox" checked={area[fkey]} on:change={toggle} />
  <span class="gsym {grp}" title={M.GROUP_LABEL[grp]}>{M.GROUP_SYM[grp]}</span>
  <span class="fn"><b class:changed>{keyName}</b><span class="bdesc">{M.capFirst(apt)}</span></span>
</label>
