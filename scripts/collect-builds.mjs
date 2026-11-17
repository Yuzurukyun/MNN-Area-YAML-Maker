// After building both flavours, copy the outputs into the export/ folder
// under their shareable names: yuzu_area_maker.html (music) and
// yuzu_area_maker_nomusic.html (no music). The dist/ originals stay put.
import { copyFileSync, mkdirSync, statSync } from "node:fs";

mkdirSync("export", { recursive: true });
const jobs = [
	["dist/index.html", "export/yuzu_area_maker.html"],
	["dist-nomusic/index.html", "export/yuzu_area_maker_nomusic.html"],
];
for (const [from, to] of jobs) {
	copyFileSync(from, to);
	console.log(`${to}  (${(statSync(to).size / 1024).toFixed(0)} KB)`);
}
