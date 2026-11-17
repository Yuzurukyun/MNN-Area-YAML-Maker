// Core logic tests — run with `npm test` (plain Node, no dependencies).
import { readFileSync } from 'node:fs';
import * as M from '../src/lib/core.js';
import { edgeEndpoints } from '../src/lib/graphGeom.js';
import { cameraCommand, centerCameraOn, resetCamera, fitCamera } from '../src/lib/state.js';

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) pass++;
  else {
    fail++;
    console.log('FAIL:', name);
  }
};
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name + ` (got ${JSON.stringify(a)})`);

/* ---- sample project + export ---- */
const P = M.sampleProject();
eq(P.areas.length, 8, 'sample has 8 areas');
const y = M.exportYaml(P);
ok(y.includes('reachable_areas: <ALL>'), 'reachable ALL exports as the <ALL> token');
ok(!y.includes('evidence_mod'), 'evidence_mod never exported');
eq(M.exportErrors(P), [], 'sample project has no export errors');

/* ---- round trip ---- */
const rt = M.parseYaml(y);
eq(rt.find((a) => a.area === 'Test 1').links.reachable.mode, 'all', 'round trip keeps ALL mode');
eq(rt[2].area, 'Class Trial Room, 2', 'comma name survives the round trip');
ok(rt.find((a) => a.area === 'Basement').links.reachable.targets.length === 6, 'hub list round trips');

/* ---- import semantics: missing keys keep SERVER defaults ---- */
const bare = M.parseYaml('- area: Solo\n  background: bg\n');
eq(bare[0].links.reachable.mode, 'all', 'missing reachable_areas imports as ALL (server default)');
eq(bare[0].links.scream.mode, 'none', 'missing scream_range imports as none (server default)');
eq(bare[0].links.visible.mode, 'reachable', 'missing visible_areas imports as REACHABLE AREAS');

/* ---- quoted tokens, YAML lists, block scalars, inline comments ---- */
const tricky = M.parseYamlWithReport(`
---
areas:
  - area: "Hub #1" # inline comment
    background: Lobby/Main
    reachable_areas: "Room A, Room B"
    visible_areas: "<REACHABLE_AREAS>"
    default_description: |
      Line one
      Line two
  - area: Room A
    background: BG1
    reachable_areas:
      - "Hub #1"
      - missing room
    scream_range: "<ALL>"
  - area: Room B
    background: BG2
    reachable_areas: "<ALL>"
    visible_areas: ""
`);
eq(tricky.errors, [], 'tricky YAML parses with no errors');
eq(tricky.areas.length, 3, 'parses 3 areas under areas: wrapper');
eq(tricky.areas[0].area, 'Hub #1', 'preserves # inside double quotes while stripping inline comment');
eq(tricky.areas[0].links.reachable.targets.length, 2, 'quoted comma-separated reachable_areas splits into both targets');
eq(tricky.areas[0].links.visible.mode, 'reachable', 'quoted <REACHABLE_AREAS> resolves to reachable mode');
ok(tricky.areas[0].default_description.includes('Line one\nLine two'), 'block scalar | preserves newlines');
eq(tricky.areas[1].links.reachable.targets, [tricky.areas[0].id], 'YAML block list resolves known targets');
eq(tricky.areas[1].links.scream.mode, 'all', 'quoted <ALL> resolves to all mode');
eq(tricky.areas[2].links.reachable.mode, 'all', 'quoted <ALL> on reachable_areas resolves to all mode');
eq(tricky.areas[2].links.visible.mode, 'list', 'empty string "" on visible_areas stays explicit empty list');
ok(tricky.warnings.some((w) => w.includes('missing room')), 'unknown target produces an import warning');

/* ---- PyYAML wrapped unquoted list & double-quoted hex/line-join ---- */
const pyyaml = M.parseYamlWithReport(`
- area: Lobby
  background: BG
  reachable_areas: Area One, Area
    Two, Area Three
  default_description: "Montr\\xE9al\\
    \\ airport"
- area: Area One
  background: BG
  reachable_areas: Lobby
- area: Area Two
  background: BG
  reachable_areas: Lobby
- area: Area Three
  background: BG
  reachable_areas: Lobby
`);
eq(pyyaml.warnings, [], 'PyYAML wrapped plain scalar list parses with zero warnings');
eq(pyyaml.areas[0].links.reachable.targets.length, 3, 'wrapped unquoted reachable_areas preserves all targets across lines');
eq(pyyaml.areas[0].default_description, 'Montréal airport', 'decodes \\xHH and YAML backslash line-joining');

/* ---- empty list export round trip ---- */
const emptyVis = M.blankProject();
emptyVis.areas[0].background = 'BG';
emptyVis.areas[0].default_description = '   ';
emptyVis.areas[0].links.reachable = { mode: 'list', targets: [] };
emptyVis.areas[0].links.visible = { mode: 'list', targets: [] };
emptyVis.areas[0].links.scream = { mode: 'list', targets: [] };
const emptyYaml = M.exportYaml(emptyVis);
ok(emptyYaml.includes('reachable_areas: ""'), 'empty reachable list exports as "" instead of blank null');
ok(!emptyYaml.includes('default_description:'), 'empty default_description is omitted on export');
ok(!emptyYaml.includes('scream_range:'), 'empty scream_range list is omitted to use server default');
const reEmpty = M.parseYaml(emptyYaml);
eq(reEmpty[0].links.reachable, { mode: 'list', targets: [] }, 'empty "" reachable_areas round trips as empty list');

/* ---- built-in templates ---- */
const tpls = M.allTemplates({ templates: [] });
ok(tpls.some((t) => t.name === "Yuzu's RP Defaults"), "Yuzu's RP Defaults template present");
const privTpl = tpls.find((t) => t.name === 'Private Area');
const lobTpl = tpls.find((t) => t.name === 'Lobby Area');
ok(privTpl && privTpl.values.private_area === true && privTpl.values.locking_allowed === false, 'Private Area template is private and lockable');
ok(lobTpl && lobTpl.values.lobby_area === true && lobTpl.values.locking_allowed === true && lobTpl.values.bglock === true && lobTpl.values.cbg_allowed === false, 'Lobby Area template locks out locking, bg lock, and custom bg');

/* ---- uid collision guard ---- */
M.resetUid();
const loaded = M.ensureProject({
  areas: [
    { id: 'a1', area: 'Hub', background: 'BG' },
    { id: 'a2', area: 'Hall', background: 'BG' },
  ].map(M.normaliseArea),
});
const freshAdded = M.addArea(loaded, { name: 'Library' });
ok(freshAdded.id !== 'a1' && freshAdded.id !== 'a2', 'syncUid prevents ID collision with loaded areas');

/* ---- quoting helpers ---- */
eq(M.unquote("'it''s'"), "it's", 'single-quote doubling unwraps');
eq(M.unquote('"a \\"b\\" c"'), 'a "b" c', 'double-quote escapes unwrap');
eq(M.splitList('Class Trial Room,\\ 2, Basement'), ['Class Trial Room, 2', 'Basement'], 'escaped comma is not a separator');
eq(
  M.splitList("Yak's Cauldron, City's Edge, Participant 1's Showcase Area"),
  ["Yak's Cauldron", "City's Edge", "Participant 1's Showcase Area"],
  'apostrophes inside unquoted area names never trigger quote mode',
);
ok(M.yamlScalar('foo #bar').startsWith('"'), 'yamlScalar quotes values containing #');
ok(M.yamlScalar('...').startsWith('"'), 'yamlScalar quotes YAML document end marker ...');

/* ---- description escape decoding ---- */
const dec = M.decodeDesc('point to\\ \\ another place\\n\\nthere\\u2019s more');
ok(dec.includes('there’s more'), 'unicode escape decodes');
ok(dec.includes('\n\n'), 'literal \\n becomes a paragraph break');
ok(!dec.includes('\\ \\'), 'line-join backslashes are removed');

/* ---- export errors & warnings ---- */
const bad = M.sampleProject();
bad.areas[1].area = bad.areas[0].area;
bad.areas[2].background = '';
ok(M.exportErrors(bad).length >= 2, 'duplicate name and blank background are export errors');

const warnProj = M.blankProject();
warnProj.areas[0].background = 'BG';
const iso = M.addArea(warnProj, { name: 'Isolated' });
iso.background = 'BG';
iso.links.reachable.targets = [];
warnProj.areas[0].links.reachable.targets = [];
ok(M.exportWarnings(warnProj).some((w) => w.includes('cannot be reached')), 'exportWarnings flags unreachable area');
ok(M.exportWarnings(warnProj).some((w) => w.includes('no reachable exits')), 'exportWarnings flags dead-end area');

/* ---- mirroring ---- */
const mp = { areas: [M.blankArea('A'), M.blankArea('B')], templates: [], todPresets: [] };
mp.areas[0].links.reachable = { mode: 'list', targets: [] };
M.mirrorLink(mp, 'reachable', mp.areas[0].id, mp.areas[1].id, true);
ok(mp.areas[1].links.reachable.targets.includes(mp.areas[0].id), 'checking a target adds the reverse link');

const mp2 = { areas: [M.blankArea('A'), M.blankArea('B')], templates: [], todPresets: [] };
mp2.areas[1].links.scream = { mode: 'none', targets: [] };
M.mirrorLink(mp2, 'scream', mp2.areas[0].id, mp2.areas[1].id, true);
eq(mp2.areas[1].links.scream.mode, 'list', 'mirroring onto a none scream range makes it a list');

/* ---- edges & canonical pair orientation ---- */
const cp = { areas: [M.blankArea('Hub'), M.blankArea('First'), M.blankArea('Second')], templates: [], todPresets: [] };
M.setSide(cp, 'reachable', cp.areas[2].id, cp.areas[1].id, true);
let cpPair = M.pairEdges(cp, 'reachable').find((p) => p.x === cp.areas[1].id && p.y === cp.areas[2].id);
ok(cpPair && cpPair.yx && !cpPair.xy, 'pair orientation is canonical (x = earlier area)');
M.setSide(cp, 'reachable', cp.areas[1].id, cp.areas[2].id, true);
cpPair = M.pairEdges(cp, 'reachable').find((p) => p.x === cp.areas[1].id && p.y === cp.areas[2].id);
ok(cpPair && cpPair.xy && cpPair.yx, 'adding the other direction keeps the same orientation');
M.setSide(cp, 'reachable', cp.areas[1].id, cp.areas[2].id, false);
cpPair = M.pairEdges(cp, 'reachable').find((p) => p.x === cp.areas[1].id && p.y === cp.areas[2].id);
ok(cpPair && !cpPair.xy && cpPair.yx, 'setSide off removes only its own side');

// Hub connections in list mode are freely toggleable (no forced lock)
M.setSide(cp, 'reachable', cp.areas[2].id, cp.areas[0].id, true);
ok(cp.areas[2].links.reachable.targets.includes(cp.areas[0].id), 'setSide can switch a hub direction on');
M.setSide(cp, 'reachable', cp.areas[2].id, cp.areas[0].id, false);
ok(!cp.areas[2].links.reachable.targets.includes(cp.areas[0].id), 'setSide can switch a hub direction off freely');

/* ---- setDir leaves ALL side untouched ---- */
const sp = { areas: [M.blankArea('Hub'), M.blankArea('X'), M.blankArea('Y')], templates: [], todPresets: [] };
sp.areas[1].links.reachable = { mode: 'all', targets: [] };
M.setDir(sp, 'reachable', { x: sp.areas[1].id, y: sp.areas[2].id }, 'ba');
eq(sp.areas[1].links.reachable.mode, 'all', 'setDir leaves an ALL link as ALL');
ok(sp.areas[2].links.reachable.targets.includes(sp.areas[1].id), 'the list side of the pair is still set');

/* ---- focus neighbourhood ---- */
const ctr3 = P.areas.find((a) => a.area === 'Class Trial Room 3');
const nb = M.neighbourhoodIds(P, [ctr3.id]);
ok(nb.has(ctr3.id) && nb.has(P.areas[0].id), 'neighbourhood includes the seed and the hub that links to it');
ok(!nb.has(P.areas[1].id), 'neighbourhood does NOT leak through the hub');

/* ---- edgeEndpoints boundary clipping ---- */
const nA = { x: 0, y: 0 };
const nB = { x: 400, y: 0 };
const epPts = edgeEndpoints(nA, nB);
ok(epPts.x1 > M.NODE_W / 2 && epPts.x2 < 400, 'edgeEndpoints clips lines to node box boundaries so arrowheads stay visible');

/* ---- auto-arrange: deterministic, no overlaps ---- */
const ap = M.sampleProject();
M.autoArrange(ap);
const first = ap.areas.map((a) => [a.x, a.y]);
M.autoArrange(ap);
eq(ap.areas.map((a) => [a.x, a.y]), first, 'auto-arrange is idempotent');

const big = { areas: [], templates: [], todPresets: [] };
for (let i = 0; i < 200; i++) big.areas.push(M.blankArea('Area ' + i));
for (let i = 1; i < 200; i += 3) {
  big.areas[i].links.reachable = {
    mode: 'list',
    targets: [big.areas[Math.min(i + 1, 199)].id, big.areas[Math.min(i + 2, 199)].id],
  };
}
M.autoArrange(big);
let overlap = false;
for (let i = 0; i < 200 && !overlap; i++) {
  for (let j = i + 1; j < 200; j++) {
    const A = big.areas[i];
    const B = big.areas[j];
    if (Math.abs(A.x - B.x) < M.NODE_W && Math.abs(A.y - B.y) < M.NODE_H) {
      overlap = true;
      break;
    }
  }
}
ok(!overlap, 'auto-arrange: no overlaps across 200 areas');

/* ---- duplicate, delete, groups ---- */
const dp = M.sampleProject();
dp.areas[2].afk_sendto = 3;
const dup = M.duplicateArea(dp, dp.areas[1].id);
ok(dup && dup.area === 'Class Trial Room 1 copy', 'duplicate gets a unique copy name');
eq(dp.areas[3].afk_sendto, 4, 'afk_sendto remapped through insertion');

const gp = { areas: [], templates: [], todPresets: [], groups: [], layouts: [], images: [] };
['Hub', 'A', 'B', 'C', 'D'].forEach((n) => gp.areas.push(M.blankArea(n)));
gp.areas.forEach((a, i) => { a.x = i * 300; a.y = 0; });
gp.groups = [{ id: 'g1', name: 'Zone', x: 640, y: -50, w: 420, h: 300 }];
eq(M.groupMembers(gp, gp.groups[0]).map((a) => a.area), ['B', 'C'], 'group membership is spatial');
gp.areas[4].afk_sendto = 1;
M.sortAreasByGroups(gp);
eq(gp.areas.map((a) => a.area), ['Hub', 'B', 'C', 'A', 'D'], 'sort: hub first, group members consecutive, rest after');
eq(gp.areas[4].afk_sendto, 3, 'sort remaps afk_sendto');

/* ---- bundled wsl_ch3.yaml example asset ---- */
const wslRaw = readFileSync(new URL('../src/assets/wsl_ch3.yaml', import.meta.url), 'utf8');
const wslReport = M.parseYamlWithReport(wslRaw);
eq(wslReport.errors, [], 'bundled wsl_ch3.yaml parses with no errors');
eq(wslReport.warnings, [], 'bundled wsl_ch3.yaml parses with no warnings');
eq(wslReport.areas.length, 47, 'bundled wsl_ch3.yaml has 47 areas');

/* ---- camera commands ---- */
let lastCmd = null;
const unsub = cameraCommand.subscribe((v) => (lastCmd = v));
centerCameraOn('node-42');
ok(lastCmd && lastCmd.type === 'center' && lastCmd.id === 'node-42' && typeof lastCmd.ts === 'number', 'centerCameraOn dispatches center command with target node ID and timestamp');
resetCamera();
ok(lastCmd && lastCmd.type === 'reset' && typeof lastCmd.ts === 'number', 'resetCamera dispatches reset command with timestamp');
fitCamera();
ok(lastCmd && lastCmd.type === 'fit' && typeof lastCmd.ts === 'number', 'fitCamera dispatches fit command with timestamp');
unsub();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
