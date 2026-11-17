import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The whole app (JS + CSS + inline assets) bundles into one standalone HTML file.
// Building with `--mode nomusic` — or building from a clean clone where the
// optional local audio file is absent — aliases music-track.js to the empty
// module so the player hides itself cleanly.
const hasLocalMusic = existsSync(resolve(process.cwd(), 'src/assets/i-only-say-morning.opus'));

export default defineConfig(({ mode }) => ({
  plugins: [svelte(), viteSingleFile()],
  resolve: {
    alias:
      mode === 'nomusic' || !hasLocalMusic
        ? [
            {
              find: /^.*\/music-track\.js$/,
              replacement: resolve(process.cwd(), 'src/lib/music-track-empty.js'),
            },
          ]
        : [],
  },
  build: {
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
  },
}));
