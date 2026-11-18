<script>
	import musicUrl from "../lib/music-track.js";

	// The little header music player. It knows exactly one track and
	// loops it; the caption scrolls past like on a real music player.
	const CAPTION = "I only say morning because if it's a good morning, I'd be fishing";
	let paused = true;
	let volume = 0.1;
</script>

{#if musicUrl}
	<div class="music-player">
		<button class="music-btn {!paused ? 'on' : ''}" on:click={() => (paused = !paused)} title={paused ? "Play the music" : "Pause the music"}>{paused ? "▶" : "⏸"}</button>
		<div class="music-label" title={CAPTION}>
			<div class="music-scroll"><span>{CAPTION}</span><span>{CAPTION}</span></div>
		</div>
		<input class="music-vol" type="range" min="0" max="1" step="0.01" bind:value={volume} title="Volume" />
		<audio src={musicUrl} loop preload="metadata" bind:paused bind:volume></audio>
	</div>
{:else}
	<div class="music-player musicless" title={CAPTION}>
		<div class="music-label" title={CAPTION}>
			<div class="music-scroll"><span>{CAPTION}</span><span>{CAPTION}</span></div>
		</div>
	</div>
{/if}
