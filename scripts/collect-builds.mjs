// After building both flavours, copy the outputs into export/ (and update
// docs/index.html with the no-music build for GitHub Pages branch hosting).
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';

mkdirSync('export', { recursive: true });
mkdirSync('docs', { recursive: true });

const jobs = [
  ['dist/index.html', 'export/yuzu_area_maker.html'],
  ['dist-nomusic/index.html', 'export/yuzu_area_maker_nomusic.html'],
  ['dist-nomusic/index.html', 'docs/index.html'],
];
for (const [from, to] of jobs) {
  copyFileSync(from, to);
  console.log(`${to}  (${(statSync(to).size / 1024).toFixed(0)} KB)`);
}

if (existsSync('public/og-image.png')) {
  copyFileSync('public/og-image.png', 'docs/og-image.png');
  copyFileSync('public/og-image.png', 'export/og-image.png');
  console.log('docs/og-image.png & export/og-image.png synced');
}
