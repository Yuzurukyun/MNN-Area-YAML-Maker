<script>
	import * as M from "../../lib/core.js";
	export let fkey;
	export let mandatory = false;
	$: grp = M.FIELD_GROUP[fkey] || "common";
	$: apt = M.SHORT_DESC[fkey] || "";
	$: full = M.DESC[fkey] || apt;
</script>

<div class="field" data-group={grp} data-fkey={fkey} title={full}>
	<div class="fline">
		<span class="gsym {grp}" title={M.GROUP_LABEL[grp]}></span>
		<div class="ftext">
			{#if mandatory}<span class="mand" title="Mandatory — this field must be set">★</span>{/if}<b>{fkey}</b>{#if apt}&nbsp;<span class="apt">— {M.capFirst(apt)}</span>{/if}
		</div>
	</div>
	<slot />
</div>
