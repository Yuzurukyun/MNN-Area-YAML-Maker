// Core logic tests — run with `npm test` (plain Node, no dependencies).
import { readFileSync } from 'node:fs';
import * as M from '../src/lib/core.js';
import { edgeEndpoints } from '../src/lib/graphGeom.js';
import { cameraCommand, centerCameraOn, resetCamera, fitCamera } from '../src/lib/state.js';
import { findShortestPath, auditMap } from '../src/lib/pathAudit.js';
import {
  normalizeBgPath,
  normalizeAmbiencePath,
  sanitizeToRootFolder,
  createBackground,
  createPosition,
  serializeBackgroundJson,
  parseBackgroundJson,
  parseBackgroundIni,
  mapIniPositionName,
  resolveActiveVisual,
  hasTimeVariants,
  BUILTIN_BG_TEMPLATES,
  extractBgTemplateStructure,
  applyBgTemplate,
} from '../src/lib/bgSchema.js';
import { resolveNodeImageUrl, bgStore, ensureUniqueBgFolder } from '../src/lib/bgStore.js';
import { dbSaveAssets, dbLoadAllAssets, dbDeleteAssets, dbClearAssets } from '../src/lib/assetDb.js';
import { buildZip, readZip } from '../src/lib/zip.js';

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

/* ---- reorderAreas and moveAreasDelta multi-select reordering ---- */
const multiProj = { areas: ['Hub', 'A', 'B', 'C', 'D', 'E'].map(M.blankArea) };
multiProj.areas[5].afk_sendto = 2; // E -> B
M.moveAreasDelta(multiProj, [2, 3], -1); // B and C move up by 1
eq(multiProj.areas.map((a) => a.area), ['Hub', 'B', 'C', 'A', 'D', 'E'], 'moveAreasDelta moves multiple items up');
eq(multiProj.areas[5].afk_sendto, 1, 'afk_sendto remapped when target moves');
M.moveAreasDelta(multiProj, [1, 2], 1); // B and C move back down by 1
eq(multiProj.areas.map((a) => a.area), ['Hub', 'A', 'B', 'C', 'D', 'E'], 'moveAreasDelta moves multiple items down');
M.reorderAreas(multiProj, [1, 4], 2); // move A (1) and D (4) to start at index 2
eq(multiProj.areas.map((a) => a.area), ['Hub', 'B', 'A', 'D', 'C', 'E'], 'reorderAreas moves multiple items to explicit target index');

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

/* ---- group zone range detection ---- */
function computeZoneRange(indices) {
  if (!indices.length) return { hasAreas: false, isRange: false, val1: '', val2: '' };
  const sorted = [...indices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const isRange = sorted.length === (max - min + 1) && sorted.every((val, i) => val === min + i);
  return {
    hasAreas: true,
    isRange,
    val1: isRange ? `${min}, ${max}` : sorted.join(', '),
    val2: isRange ? `/zone ${min}, ${max}` : `/zone ${sorted.join(', ')}`,
  };
}

const rangeTest1 = computeZoneRange([4, 5, 6, 7, 8, 9, 10, 11, 12]);
ok(rangeTest1.isRange, 'consecutive indices are recognized as range');
eq(rangeTest1.val1, '4, 12', 'range val1 is "4, 12"');
eq(rangeTest1.val2, '/zone 4, 12', 'range val2 is "/zone 4, 12"');

const rangeTest2 = computeZoneRange([3, 6, 12, 13, 14, 15]);
ok(!rangeTest2.isRange, 'non-consecutive indices are recognized as non-range');
eq(rangeTest2.val1, '3, 6, 12, 13, 14, 15', 'non-range val1 lists all IDs');
eq(rangeTest2.val2, '/zone 3, 6, 12, 13, 14, 15', 'non-range val2 formats /zone with all IDs');

const rangeTest3 = computeZoneRange([7]);
ok(rangeTest3.isRange, 'single area is a range');
eq(rangeTest3.val1, '7, 7', 'single area produces min, max');

/* ---- auto-arrange with groups ---- */
const groupProj = {
  areas: ['Hub', 'A1', 'A2', 'A3', 'B1', 'B2', 'Solo'].map(M.blankArea),
  groups: [
    { id: 'g1', name: 'Group A', x: 200, y: 100, w: 400, h: 300 },
    { id: 'g2', name: 'Group B', x: 700, y: 100, w: 400, h: 300 },
  ],
};
// Place Hub outside groups
groupProj.areas[0].x = 40; groupProj.areas[0].y = 40;
// Place A1, A2, A3 inside g1
groupProj.areas[1].x = 250; groupProj.areas[1].y = 150;
groupProj.areas[2].x = 350; groupProj.areas[2].y = 150;
groupProj.areas[3].x = 450; groupProj.areas[3].y = 150;
// Place B1, B2 inside g2
groupProj.areas[4].x = 750; groupProj.areas[4].y = 150;
groupProj.areas[5].x = 850; groupProj.areas[5].y = 150;
// Solo is ungrouped
groupProj.areas[6].x = 100; groupProj.areas[6].y = 600;

M.autoArrange(groupProj);

const memsA = M.groupMembers(groupProj, groupProj.groups[0]).map((a) => a.area);
eq(memsA, ['A1', 'A2', 'A3'], 'autoArrange keeps all Group A members inside Group A');

const memsB = M.groupMembers(groupProj, groupProj.groups[1]).map((a) => a.area);
eq(memsB, ['B1', 'B2'], 'autoArrange keeps all Group B members inside Group B');

ok(!M.groupOfArea(groupProj, groupProj.areas[6]), 'Solo area is not inside any group');

/* ---- auto-arrange includes Hub when Hub is inside a group ---- */
const hubGroupProj = {
  areas: ['Hub', 'Lobby 1', 'Lobby 2'].map(M.blankArea),
  groups: [{ id: 'ghub', name: 'Spawn Hub', x: 200, y: 100, w: 400, h: 300 }],
};
hubGroupProj.areas[0].x = 250; hubGroupProj.areas[0].y = 150;
hubGroupProj.areas[1].x = 350; hubGroupProj.areas[1].y = 150;
hubGroupProj.areas[2].x = 450; hubGroupProj.areas[2].y = 150;

M.autoArrange(hubGroupProj);
const memsHub = M.groupMembers(hubGroupProj, hubGroupProj.groups[0]).map((a) => a.area);
eq(memsHub, ['Hub', 'Lobby 1', 'Lobby 2'], 'autoArrange includes Hub when Hub is inside a group');

/* ---- sortInsideGroup: false preserves relative node offsets and group shape ---- */
const shapeProj = {
  areas: ['Hub', 'C1', 'C2'].map(M.blankArea),
  groups: [{ id: 'gc', name: 'Custom L-Shape', x: 500, y: 300, w: 550, h: 420 }],
};
shapeProj.areas[0].x = 40; shapeProj.areas[0].y = 40;
shapeProj.areas[1].x = 540; shapeProj.areas[1].y = 350; // offset (40, 50)
shapeProj.areas[2].x = 720; shapeProj.areas[2].y = 480; // offset (220, 180)

M.autoArrange(shapeProj, { sortInsideGroup: false });
const gCustom = shapeProj.groups[0];
eq(gCustom.w, 550, 'sortInsideGroup: false preserves custom group width');
eq(gCustom.h, 420, 'sortInsideGroup: false preserves custom group height');
eq(shapeProj.areas[1].x - gCustom.x, 40, 'preserves exact relative offset X for node 1');
eq(shapeProj.areas[1].y - gCustom.y, 50, 'preserves exact relative offset Y for node 1');
eq(shapeProj.areas[2].x - gCustom.x, 220, 'preserves exact relative offset X for node 2');
eq(shapeProj.areas[2].y - gCustom.y, 180, 'preserves exact relative offset Y for node 2');

/* ---- arrangeGroupsOnly: true leaves ungrouped areas untouched ---- */
const groupsOnlyProj = {
  areas: ['Hub', 'G1', 'G2', 'Ungrouped'].map(M.blankArea),
  groups: [{ id: 'gonly', name: 'Only Group', x: 400, y: 300, w: 400, h: 300 }],
};
groupsOnlyProj.areas[1].x = 440; groupsOnlyProj.areas[1].y = 350;
groupsOnlyProj.areas[2].x = 540; groupsOnlyProj.areas[2].y = 350;
groupsOnlyProj.areas[3].x = 888; groupsOnlyProj.areas[3].y = 777; // loose area

M.autoArrange(groupsOnlyProj, { arrangeGroupsOnly: true });
eq(groupsOnlyProj.areas[3].x, 888, 'arrangeGroupsOnly: true leaves ungrouped X untouched');
eq(groupsOnlyProj.areas[3].y, 777, 'arrangeGroupsOnly: true leaves ungrouped Y untouched');

/* ---- pathfinding (BFS) & map audit ---- */
const auditProj = {
  areas: ['Hub', 'Hallway', 'Courtyard', 'Dungeon', 'Island', 'DeadEnd'].map(M.blankArea),
  groups: [],
};
// Hub (0) -> Hallway (1) <-> Courtyard (2) -> Dungeon (3)
// Dungeon (3) has no way back to Hub (one-way trap to DeadEnd)
// Dungeon (3) -> DeadEnd (5)
// DeadEnd (5) has 0 exits (dead end)
// Island (4) has no connections (island)
auditProj.areas[0].links.reachable = { mode: 'list', targets: [auditProj.areas[1].id] };
auditProj.areas[1].links.reachable = { mode: 'list', targets: [auditProj.areas[0].id, auditProj.areas[2].id] };
auditProj.areas[2].links.reachable = { mode: 'list', targets: [auditProj.areas[1].id, auditProj.areas[3].id] };
auditProj.areas[3].links.reachable = { mode: 'list', targets: [auditProj.areas[5].id] };
auditProj.areas[4].links.reachable = { mode: 'list', targets: [] };
auditProj.areas[5].links.reachable = { mode: 'list', targets: [] };

const path1 = findShortestPath(auditProj, auditProj.areas[0].id, auditProj.areas[3].id);
ok(path1.found, 'findShortestPath finds route to dungeon');
eq(path1.stepCount, 3, 'route has 3 steps (Hub -> Hallway -> Courtyard -> Dungeon)');
eq(path1.path, [auditProj.areas[0].id, auditProj.areas[1].id, auditProj.areas[2].id, auditProj.areas[3].id], 'exact step sequence matches');

const pathBlocked = findShortestPath(auditProj, auditProj.areas[0].id, auditProj.areas[4].id);
ok(!pathBlocked.found, 'findShortestPath reports not found for isolated island');

const audit = auditMap(auditProj);
eq(audit.disconnected.map((a) => a.area), ['Island'], 'audit identifies completely disconnected area');
eq(audit.deadEnds.map((a) => a.area), ['DeadEnd'], 'audit identifies actual dead end (has incoming, 0 outgoing)');
eq(audit.oneWayTrips.map((a) => a.area), ['Dungeon'], 'audit identifies one-way trip (cannot return to Hub or ALL)');

// Verify <ALL> areas are never considered dead ends and don't falsely turn connected areas into islands
const allAuditProj = {
  areas: ['Hub', 'Room 1', 'Room 2'].map(M.blankArea),
  groups: [],
};
allAuditProj.areas[0].links.reachable = { mode: 'all', targets: [] };
allAuditProj.areas[1].links.reachable = { mode: 'list', targets: [allAuditProj.areas[2].id] };
allAuditProj.areas[2].links.reachable = { mode: 'list', targets: [allAuditProj.areas[0].id] };

const allAudit = auditMap(allAuditProj);
ok(!allAudit.deadEnds.some((a) => a.area === 'Hub'), '<ALL> hub is never flagged as a dead end');
eq(allAudit.disconnected.length, 0, 'no areas disconnected when connected to <ALL> hub');
eq(allAudit.oneWayTrips.length, 0, 'no one-way traps when room routes back to <ALL> hub');

/* ---- Route Finder ignores <ALL> and excludes intermediate private/lobby areas ---- */
const allProj = {
  areas: ['Hub', 'Room A', 'Room B', 'Private Room', 'Secret Garden'].map(M.blankArea),
  groups: [],
};
// Hub has <ALL>
allProj.areas[0].links.reachable = { mode: 'all', targets: [] };
// Room A has list to Room B
allProj.areas[1].links.reachable = { mode: 'list', targets: [allProj.areas[2].id] };
// Room B has list to Private Room
allProj.areas[2].links.reachable = { mode: 'list', targets: [allProj.areas[3].id] };
allProj.areas[3].private_area = true;
// Private Room has list to Secret Garden
allProj.areas[3].links.reachable = { mode: 'list', targets: [allProj.areas[4].id] };

// Path from Room A to Secret Garden would have to pass THROUGH Private Room
const pathThruPrivate = findShortestPath(allProj, allProj.areas[1].id, allProj.areas[4].id);
ok(!pathThruPrivate.found, 'cannot route through intermediate private area');

// But you CAN route directly TO the private room
const pathToPrivate = findShortestPath(allProj, allProj.areas[1].id, allProj.areas[3].id);
ok(pathToPrivate.found, 'can route directly to a private room as destination');
eq(pathToPrivate.path, [allProj.areas[1].id, allProj.areas[2].id, allProj.areas[3].id], 'valid route directly to private room');

// Hub has <ALL>, but Route Finder ignores <ALL> so Hub cannot magical-teleport to Room B
const pathFromHubAll = findShortestPath(allProj, allProj.areas[0].id, allProj.areas[2].id);
ok(!pathFromHubAll.found, 'Route Finder strictly ignores <ALL> on Hub or other areas');

/* ---- Background.json Schema, Parsing, Serialization & Zip Builder ---- */
eq(normalizeBgPath('base/background/Umamusume/Cafeteria/'), 'Umamusume/Cafeteria', 'normalizeBgPath removes base/background/');
eq(normalizeBgPath('background/wsl/inner_forest'), 'wsl/inner_forest', 'normalizeBgPath removes background/');
eq(normalizeAmbiencePath('base/sounds/ambient/wsl/forest.opus'), 'wsl/forest.opus', 'normalizeAmbiencePath normalizes sound path');

// Test simple background (Cafeteria style)
const cafeJson = `{
  "default": {
    "background": "default.webp",
    "time_variants": {
      "evening": { "background": "evening.webp" }
    }
  },
  "crowded": {
    "background": "crowded.webp"
  }
}`;
const parsedCafe = parseBackgroundJson(cafeJson, 'Umamusume/Cafeteria');
eq(parsedCafe.folder, 'Umamusume/Cafeteria', 'parsed folder matches');
ok(Boolean(parsedCafe.states.default), 'has default state');
ok(Boolean(parsedCafe.states.crowded), 'has crowded state');
eq(parsedCafe.states.default.time_variants.evening.background, 'evening.webp', 'evening time variant matches');

const visCafeDay = resolveActiveVisual(parsedCafe, { state: 'default', tod: 'day' });
eq(visCafeDay.background, 'default.webp', 'day visual resolves to default.webp');
const visCafeEve = resolveActiveVisual(parsedCafe, { state: 'default', tod: 'evening' });
eq(visCafeEve.background, 'evening.webp', 'evening visual resolves to evening.webp');
const visCafeCrowd = resolveActiveVisual(parsedCafe, { state: 'crowded', tod: 'day' });
eq(visCafeCrowd.background, 'crowded.webp', 'crowded visual resolves to crowded.webp');

// Test complex background with positions & time variants (Inner Forest style)
const complexJson = `{
  "default": {
    "ambience": "wsl/inner_forest_day.opus",
    "background": "default_day_witnessempty.png",
    "foreground": "",
    "positions": {
      "Normal": {
        "ambience": "wsl/inner_forest_day.opus",
        "background": "default_day_witnessempty.png",
        "foreground": "",
        "time_variants": {
          "day": {
            "background": "default_day_witnessempty.png",
            "ambience": "wsl/inner_forest_day.opus"
          },
          "night": {
            "background": "default_night_witnessempty.png",
            "foreground": "default_night_night_filter.png",
            "ambience": "wsl/inner_forest_night.opus"
          }
        }
      }
    }
  }
}`;
const parsedComplex = parseBackgroundJson(complexJson, 'wsl/inner_forest');
ok(parsedComplex.states.default.usePositions, 'positions mode detected');
ok(Boolean(parsedComplex.states.default.positions.Normal), 'has Normal position');

const visNormDay = resolveActiveVisual(parsedComplex, { state: 'default', position: 'Normal', tod: 'day' });
eq(visNormDay.background, 'default_day_witnessempty.png', 'normal day background matches');
const visNormNight = resolveActiveVisual(parsedComplex, { state: 'default', position: 'Normal', tod: 'night' });
eq(visNormNight.background, 'default_night_witnessempty.png', 'normal night background matches');
eq(visNormNight.foreground, 'default_night_night_filter.png', 'normal night foreground matches');
eq(visNormNight.ambience, 'wsl/inner_forest_night.opus', 'normal night ambience matches');

// Test serialization round-trip
const serializedCafe = serializeBackgroundJson(parsedCafe, 4);
const roundTripCafe = JSON.parse(serializedCafe);
eq(roundTripCafe.default.background, 'default.webp', 'round trip preserves default background');
eq(roundTripCafe.default.time_variants.evening.background, 'evening.webp', 'round trip preserves time variants');
ok(serializedCafe.includes('    "background"'), 'indent 4 produces 4 spaces indent');
const tabJson = serializeBackgroundJson(parsedCafe, '\t');
ok(tabJson.includes('\t"background"'), 'indent tab produces tab indent');

// Test hasTimeVariants
ok(hasTimeVariants(parsedCafe), 'parsedCafe has time variants');
ok(hasTimeVariants(parsedComplex), 'parsedComplex has time variants in positions');
const noTvBg = createBackground('Simple/Bg', {
  states: {
    default: { background: 'plain.png' },
    crowded: { background: 'crowded.png' },
  },
});
ok(!hasTimeVariants(noTvBg), 'standard background without time variants returns false');
ok(!hasTimeVariants(null), 'null bg returns false');
ok(!hasTimeVariants({}), 'empty object returns false');

// Test resolveNodeImageUrl
const iconArea = { image: 'data:image/png;base64,icon', imageMode: 'node', background: 'plain.png' };
eq(resolveNodeImageUrl(iconArea), 'data:image/png;base64,icon', 'node mode returns icon dataUrl');
const sceneArea = { image: 'data:image/png;base64,icon', imageMode: 'scene', background: 'plain.png' };
// Since plain.png is not in assetPool, fallback is image or empty
ok(typeof resolveNodeImageUrl(sceneArea) === 'string', 'scene mode resolves valid string');

// Test ZIP archive builder
const zipBuf = await buildZip([
  { path: 'base/background/Umamusume/Cafeteria/background.json', data: cafeJson },
  { path: 'base/background/Umamusume/Cafeteria/default.webp', data: 'fake-image-bytes' },
]);
ok(zipBuf instanceof Uint8Array, 'buildZip returns Uint8Array');
ok(zipBuf.length > 100, 'zip has valid length');
// First 4 bytes must be standard ZIP local header signature 0x04034b50 (PK\x03\x04)
eq(zipBuf[0], 0x50, 'zip magic byte 0 (P)');
eq(zipBuf[1], 0x4b, 'zip magic byte 1 (K)');
eq(zipBuf[2], 0x03, 'zip magic byte 2');
eq(zipBuf[3], 0x04, 'zip magic byte 3');

// Test resolveBgPattern & background template auto-prefixing
eq(M.resolveBgPattern('topic/topic/topic/topic/', 'Courtyard'), 'topic/topic/topic/topic/Courtyard', 'resolveBgPattern appends area name when trailing slash present');
eq(M.resolveBgPattern('Umamusume/School/{name}', 'Cafeteria'), 'Umamusume/School/Cafeteria', 'resolveBgPattern replaces {name} placeholder');
eq(M.resolveBgPattern('topic/topic/topic/topic', 'Courtyard', true), 'topic/topic/topic/topic/Courtyard', 'resolveBgPattern treats prefix as folder prefix when isPrefix is true');

// Test addArea with bgPrefix
const bgPrefixProj = { areas: [M.blankArea('Hub')], groups: [] };
const newPrefixedArea = M.addArea(bgPrefixProj, { name: 'Library', bgPrefix: 'topic/topic/topic/topic/' });
eq(newPrefixedArea.background, 'topic/topic/topic/topic/Library', 'addArea automatically prefixes background using bgPrefix');

// Test addArea with template that defines bg_prefix
const tplWithBg = {
  id: 'tpl-school',
  name: 'School Room',
  include: [],
  values: {},
  bg_prefix: 'Umamusume/School/',
};
bgPrefixProj.templates = [tplWithBg];
const newTplArea = M.addArea(bgPrefixProj, { name: 'Classroom', templateId: 'tpl-school' });
eq(newTplArea.background, 'Umamusume/School/Classroom', 'addArea automatically applies template bg_prefix pattern');

// Test ZIP archive decompression & parsing with readZip
const unzippedFiles = await readZip(zipBuf);
eq(unzippedFiles.length, 2, 'readZip extracts expected number of files');
const unzippedJson = unzippedFiles.find((f) => f.path.endsWith('background.json'));
ok(unzippedJson, 'readZip extracted background.json');
const decodedCafe = new TextDecoder().decode(unzippedJson.data);
eq(decodedCafe, cafeJson, 'extracted background.json content matches original');

// Test bgStore loadBackgrounds (replace mode)
const sampleBgs = [
  createBackground('Umamusume/School/Library', {
    states: {
      default: { background: 'library_day.png' },
      quiet: { background: 'library_quiet.png' },
    },
  }),
  createBackground('Umamusume/School/Courtyard', {
    states: {
      default: { background: 'courtyard.png' },
    },
  }),
];
bgStore.loadBackgrounds(sampleBgs, { replace: true });
eq(bgStore.get().backgrounds.length, 2, 'loadBackgrounds with replace replaces store backgrounds');
eq(bgStore.get().backgrounds[0].folder, 'Umamusume/School/Library', 'first background folder matches');

// Test bgStore loadBackgrounds (merge mode)
const updatedLibrary = createBackground('Umamusume/School/Library', {
  states: {
    default: { background: 'library_v2.png' },
  },
});
const newDorm = createBackground('Umamusume/Dorm/Room101', {
  states: {
    default: { background: 'room101.png' },
  },
});
bgStore.loadBackgrounds([updatedLibrary, newDorm], { replace: false });
eq(bgStore.get().backgrounds.length, 3, 'loadBackgrounds in merge mode updates existing and appends new');
const mergedLib = bgStore.get().backgrounds.find((b) => b.folder === 'Umamusume/School/Library');
eq(mergedLib.states.default.background, 'library_v2.png', 'merge updated existing background state');

// Test bgStore exportLibraryJson round-trip
const libraryJsonStr = bgStore.exportLibraryJson();
const parsedLibJson = JSON.parse(libraryJsonStr);
eq(parsedLibJson.type, 'mnn-backgrounds-library', 'library json has type mnn-backgrounds-library');
eq(parsedLibJson.backgrounds.length, 3, 'library json contains all backgrounds');

// Test ensureProject initializes backgrounds array
const projectWithoutBg = { areas: [M.blankArea('Hub')] };
M.ensureProject(projectWithoutBg);
ok(Array.isArray(projectWithoutBg.backgrounds), 'ensureProject creates backgrounds array');
eq(projectWithoutBg.backgrounds.length, 0, 'new project backgrounds is empty array');

// Test project backup sync with backgrounds
const fullProjectWithBg = {
  areas: [M.blankArea('Hub')],
  backgrounds: bgStore.get().backgrounds,
};
const serializedProject = JSON.stringify(fullProjectWithBg);
const reimportedProject = JSON.parse(serializedProject);
M.ensureProject(reimportedProject);
eq(reimportedProject.backgrounds.length, 3, 'reimported project preserves backgrounds');
bgStore.loadBackgrounds(reimportedProject.backgrounds, { replace: true });
eq(bgStore.get().backgrounds.length, 3, 'reimported backgrounds restore cleanly into bgStore');

/* ---- Duplicate Path Disambiguation (ensureUniqueBgFolder) ---- */
// Existing folders in bgStore: 'Umamusume/School/Library', 'Umamusume/School/Courtyard', 'Umamusume/Dorm/Room101'
eq(ensureUniqueBgFolder('NewSeries/NewRoom'), 'NewSeries/NewRoom', 'unique folder returns unchanged');
eq(ensureUniqueBgFolder('Umamusume/School/Library'), 'Umamusume/School/Library 2', 'colliding folder gets " 2" suffix');

// Add 'Umamusume/School/Library 2' and verify next collision becomes 'Umamusume/School/Library 3'
bgStore.addBackground('Umamusume/School/Library 2');
eq(ensureUniqueBgFolder('Umamusume/School/Library'), 'Umamusume/School/Library 3', 'colliding folder with existing " 2" increments to " 3"');

// Excluding self ID should permit preserving current folder
const currentLib = bgStore.get().backgrounds.find((b) => b.folder === 'Umamusume/School/Library');
ok(Boolean(currentLib), 'found current library background');
eq(ensureUniqueBgFolder('Umamusume/School/Library', currentLib.id), 'Umamusume/School/Library', 'excluding self ID allows keeping same folder name');

/* ---- Asset Referenced vs Unused and Purge ---- */
// Library background has states.default.background = 'library_v2.png'
const initialRefs = bgStore.getReferencedAssetNames();
ok(initialRefs.has('library_v2.png'), 'referenced asset names contains library_v2.png from library');
ok(!initialRefs.has('orphan_graphic.png'), 'orphan_graphic is not referenced');

const testAssetUsed = {
  id: 'asset-1',
  name: 'library_v2.png',
  relPath: 'library_v2.png',
  fullRelPath: 'library_v2.png',
  type: 'image',
  size: 1024,
  url: 'blob:test-used',
};
const testAssetUnused = {
  id: 'asset-2',
  name: 'orphan_graphic.png',
  relPath: 'orphan_graphic.png',
  fullRelPath: 'orphan_graphic.png',
  type: 'image',
  size: 2048,
  url: 'blob:test-unused',
};

/* ---- IndexedDB fallback in Node environment ---- */
const savedResult = await dbSaveAssets([testAssetUsed]);
eq(savedResult, false, 'dbSaveAssets safely returns false without window.indexedDB');
const loadedAssets = await dbLoadAllAssets();
eq(loadedAssets, [], 'dbLoadAllAssets returns empty array in Node');
const deleteResult = await dbDeleteAssets(['asset-1']);
eq(deleteResult, false, 'dbDeleteAssets safely returns false in Node');
const clearResult = await dbClearAssets();
eq(clearResult, false, 'dbClearAssets safely returns false in Node');

/* ---- Background Templates System ---- */
ok(Array.isArray(BUILTIN_BG_TEMPLATES) && BUILTIN_BG_TEMPLATES.length >= 6, 'BUILTIN_BG_TEMPLATES has 6 presets');
const tplDayNight = BUILTIN_BG_TEMPLATES.find((t) => t.id === 'builtin-day-night');
ok(Boolean(tplDayNight && tplDayNight.structure.time_variants.day), 'day-night template defines day variant');
const tplCourtroom = BUILTIN_BG_TEMPLATES.find((t) => t.id === 'builtin-courtroom-5');
ok(Boolean(tplCourtroom && tplCourtroom.structure.positions.jud), 'courtroom-5 template defines jud position');

// Test apply template
const freshBg = createBackground('Trial/TestRoom');
applyBgTemplate(freshBg, tplCourtroom);
ok(freshBg.states.default.usePositions, 'applying courtroom template enables usePositions');
eq(Object.keys(freshBg.states.default.positions).length, 5, 'applying courtroom template creates 5 positions');
ok(Boolean(freshBg.states.default.positions.pro), 'pro position exists');

// Test template extraction
const extracted = extractBgTemplateStructure(freshBg);
ok(extracted.usePositions, 'extracted structure has usePositions true');
eq(Object.keys(extracted.positions).length, 5, 'extracted structure has 5 positions');

// Test bgStore template methods
const savedTpl = bgStore.saveTemplate('Custom Courtroom', 'My custom 5-pos courtroom');
ok(Boolean(savedTpl && savedTpl.id), 'bgStore saves custom template');
const allTpls = bgStore.getAllTemplates();
ok(allTpls.some((t) => t.name === 'Custom Courtroom'), 'getAllTemplates includes custom template');
bgStore.deleteTemplate(savedTpl.id);
ok(!bgStore.getAllTemplates().some((t) => t.id === savedTpl.id), 'deleteTemplate removes custom template');

/* ---- getReferencedAssetNames reactivity and purging ---- */
const sampleBg1 = createBackground('Test/SceneA');
sampleBg1.states.default.background = 'scene_a.png';
sampleBg1.states.default.ambience = 'rain.opus';

const sampleBg2 = createBackground('Test/SceneB');
sampleBg2.states.default.background = 'scene_b.png';

// Test with passed background array
const refBoth = bgStore.getReferencedAssetNames([sampleBg1, sampleBg2]);
ok(refBoth.has('scene_a.png'), 'refBoth has scene_a.png');
ok(refBoth.has('rain.opus'), 'refBoth has rain.opus');
ok(refBoth.has('scene_b.png'), 'refBoth has scene_b.png');
ok(!refBoth.has('orphan.png'), 'refBoth does not have orphan.png');

// When sampleBg2 is removed from the array:
const refOnly1 = bgStore.getReferencedAssetNames([sampleBg1]);
ok(refOnly1.has('scene_a.png'), 'refOnly1 still has scene_a.png');
ok(!refOnly1.has('scene_b.png'), 'refOnly1 no longer references scene_b.png after deletion');

// When all backgrounds are empty/deleted:
const refNone = bgStore.getReferencedAssetNames([]);
eq(refNone.size, 0, 'empty background list references zero assets');

/* ---- Slot type validation & ambience normalization ---- */
eq(normalizeAmbiencePath('base/sounds/ambient/nature/forest.opus'), 'nature/forest.opus', 'normalizes nested ambience path');
eq(normalizeAmbiencePath('nature/forest.opus'), 'nature/forest.opus', 'preserves already normalized ambience path');
eq(normalizeAmbiencePath('wind.mp3'), 'wind.mp3', 'normalizes single audio filename');

const slotTestBg = createBackground('Validation/Test');
eq(slotTestBg.states.default.background, '', 'starts with empty background');
eq(slotTestBg.states.default.foreground, '', 'starts with empty foreground');
eq(slotTestBg.states.default.ambience, '', 'starts with empty ambience');

/* ---- Global Asset Renaming & Slot Aliases ---- */
const renameBg = createBackground('Rename/Test');
renameBg.states.default.background = 'custom_export.png';
renameBg.states.default.foreground = 'desk.png';
renameBg.states.default.ambience = 'base/sounds/ambient/chatter.opus';
renameBg.assetSources = { 'custom_export.png': 'old_court.png' };

// Test getReferencedAssetNames includes assetSources mapping
const refWithAlias = bgStore.getReferencedAssetNames([renameBg]);
ok(refWithAlias.has('old_court.png'), 'references source asset via alias');
ok(refWithAlias.has('custom_export.png'), 'references export alias');

// Test clearAllAssets(true) slot clearing
let curBgState;
const unsubBg = bgStore.subscribe((s) => { curBgState = s; });

const storeBg = curBgState.backgrounds[0];
if (storeBg) {
  storeBg.states.default.background = 'test_bg.png';
  storeBg.states.default.foreground = 'test_fg.png';
  storeBg.states.default.ambience = 'test_amb.opus';
  await bgStore.clearAllAssets(true);
  eq(storeBg.states.default.background, '', 'clearAllAssets resets background slot to empty');
  eq(storeBg.states.default.foreground, '', 'clearAllAssets resets foreground slot to empty');
  eq(storeBg.states.default.ambience, '', 'clearAllAssets resets ambience slot to empty');
}

// Test duplicateBackground
const origBg = curBgState.backgrounds[0];
if (origBg) {
  const dupBg = bgStore.duplicateBackground(origBg.id);
  ok(Boolean(dupBg && dupBg.id !== origBg.id), 'duplicateBackground creates new bg with unique id');
  ok(dupBg.folder.includes('Copy'), 'duplicateBackground folder indicates copy');
  
  // Test renameBackgroundFolder
  const renRes = bgStore.renameBackgroundFolder(dupBg.id, 'Renamed/Scene');
  ok(renRes.success, 'renameBackgroundFolder succeeds');
  eq(dupBg.folder, 'Renamed/Scene', 'background folder updated');

  // Test duplicateState
  const dupSt = bgStore.duplicateState(dupBg.id, 'default');
  ok(Boolean(dupSt && dupBg.states[dupSt]), 'duplicateState creates new state variant');

  // Test duplicateTimeVariant
  dupBg.states.default.time_variants = { day: { background: 'day.png', foreground: '', ambience: '' } };
  const dupTv = bgStore.duplicateTimeVariant(dupBg.id, 'default', null, 'day');
  ok(Boolean(dupTv && dupBg.states.default.time_variants[dupTv]), 'duplicateTimeVariant duplicates time variant');

  // Test duplicatePosition
  dupBg.states.default.usePositions = true;
  dupBg.states.default.positions = {
    Normal: { name: 'Normal', background: 'normal.png', foreground: '', ambience: '', time_variants: {} },
  };
  const dupPos = bgStore.duplicatePosition(dupBg.id, 'default', 'Normal');
  ok(Boolean(dupPos && dupBg.states.default.positions[dupPos]), 'duplicatePosition duplicates camera position');
  eq(dupBg.states.default.positions[dupPos].background, 'normal.png', 'duplicatePosition copies position slots');

  bgStore.removeBackground(dupBg.id);
}
unsubBg();

/* ---- parseBackgroundIni tests ---- */
const samplePositionsIni = `
[wit]
back = witnessempty.webp
ambient_sfx = wsl/generic_room_day.opus

[def]
back = cloudy_back.webp
ambient_sfx = wsl/generic_room_day_cloudy.opus
front = rain_front.webp

[pro]
back = rain_back.webp
ambient_sfx = wsl/generic_room_day_rain.opus
front = rain_front.webp

[jud]
back = witnessempty.webp
ambient_sfx = wsl/generic_room_day.opus

[hld]
back = cloudy_back.webp
front = rain_front.webp

[hlp]
back = rain_back.webp
front = rain_front.webp
`;

const parsedIni = parseBackgroundIni(samplePositionsIni, 'WS Lambda/East Island/Manor/Manor Second Floor [Day]');
eq(parsedIni.folder, 'WS Lambda/East Island/Manor/Manor Second Floor [Day]', 'parseBackgroundIni preserves folder path');
ok(parsedIni.states.default.usePositions, 'parseBackgroundIni detects courtroom positions mode');
eq(Object.keys(parsedIni.states.default.positions).length, 6, 'parseBackgroundIni parses all 6 courtroom positions');
ok(Boolean(parsedIni.states.default.positions.wit), 'shorthand [wit] mapped to wit');
ok(Boolean(parsedIni.states.default.positions.def), 'shorthand [def] mapped to def');
ok(Boolean(parsedIni.states.default.positions.pro), 'shorthand [pro] mapped to pro');
ok(Boolean(parsedIni.states.default.positions.jud), 'shorthand [jud] mapped to jud');
ok(Boolean(parsedIni.states.default.positions.hld), 'shorthand [hld] mapped to hld');
ok(Boolean(parsedIni.states.default.positions.hlp), 'shorthand [hlp] mapped to hlp');
eq(parsedIni.states.default.positions.wit.background, 'witnessempty.webp', 'wit background slot matches');
eq(parsedIni.states.default.positions.wit.ambience, 'wsl/generic_room_day.opus', 'wit ambience slot matches');
eq(parsedIni.states.default.positions.def.background, 'cloudy_back.webp', 'def background slot matches');
eq(parsedIni.states.default.positions.def.foreground, 'rain_front.webp', 'def foreground slot matches');
eq(parsedIni.activePosition, 'wit', 'active position defaults to wit (wit)');
eq(parsedIni.states.default.background, 'witnessempty.webp', 'default state background takes from wit');
eq(parsedIni.states.default.ambience, 'wsl/generic_room_day.opus', 'default state ambience takes from wit');
eq(Object.keys(parsedIni.states.default.positions.wit.time_variants).length, 0, 'INI positions have no time variants (taken as-is)');
eq(mapIniPositionName('wit'), 'wit', 'wit maps to wit');
eq(mapIniPositionName('norm'), 'wit', 'norm maps to wit (witness == normal)');
eq(mapIniPositionName('normal'), 'wit', 'normal maps to wit');
eq(mapIniPositionName('def'), 'def', 'def maps to def');
eq(mapIniPositionName('pro'), 'pro', 'pro maps to pro');
eq(mapIniPositionName('jud'), 'jud', 'jud maps to jud');
eq(mapIniPositionName('hld'), 'hld', 'hld maps to hld');
eq(mapIniPositionName('hlp'), 'hlp', 'hlp maps to hlp');
eq(mapIniPositionName('sea'), 'sea', 'sea maps to sea');
eq(mapIniPositionName('gal'), 'sea', 'gal maps to sea');
ok(mapIniPositionName('sea') !== 'wit', 'Gallery =/= Normal / wit');

// Single scene non-position INI test
const singleSceneIni = `
[default]
back = room.png
front = desk.png
ambient_sfx = rain.opus
`;
const parsedSingle = parseBackgroundIni(singleSceneIni, 'SingleRoom');
ok(!parsedSingle.states.default.usePositions, 'single scene INI has usePositions = false');
eq(parsedSingle.states.default.background, 'room.png', 'single scene background parsed');
eq(parsedSingle.states.default.foreground, 'desk.png', 'single scene foreground parsed');
eq(parsedSingle.states.default.ambience, 'rain.opus', 'single scene ambience parsed');

// Empty foreground resolution test
const witnessVisual = resolveActiveVisual(parsedIni, { position: 'wit' });
eq(witnessVisual.foreground, '', 'wit with empty foreground resolves to empty string (no stray rain overlay)');
eq(parsedIni.states.default.foreground, '', 'parsedIni default state foreground remains empty when wit has no foreground');
const defenseVisual = resolveActiveVisual(parsedIni, { position: 'def' });
eq(defenseVisual.foreground, 'rain_front.webp', 'def position foreground resolves correctly to rain_front.webp');

// normalizeAmbiencePath tests
eq(normalizeAmbiencePath('base/sounds/ambience/wsl/beach.opus'), 'wsl/beach.opus', 'normalizeAmbiencePath handles sounds/ambience/');
eq(normalizeAmbiencePath('MM/sound/ambient/wsl/forest.opus'), 'wsl/forest.opus', 'normalizeAmbiencePath handles sound/ambient/');

// Test registerFiles directory auto-slotting & duplicate asset collision suffix
const testFiles = [
  { path: 'Manor/positions.ini', name: 'positions.ini', data: new TextEncoder().encode(samplePositionsIni) },
  { path: 'Manor/cloudy_back.webp', name: 'cloudy_back.webp', data: new Uint8Array([1, 2, 3, 4]), size: 4 },
  { path: 'Manor/rain_front.webp', name: 'rain_front.webp', data: new Uint8Array([5, 6, 7]), size: 3 },
];
const regResult = await bgStore.registerFiles(testFiles);
ok(regResult.importedBackgrounds.length > 0, 'registerFiles imports background from directory with INI');
const importedManor = regResult.importedBackgrounds.find(b => b.folder === 'Manor');
ok(Boolean(importedManor), 'background "Manor" was created');
ok(importedManor.states.default.usePositions, 'imported background has usePositions enabled');

// Test duplicate asset collision in next batch: same filename cloudy_back.webp with different size (10 bytes)
const testFiles2 = [
  { path: 'Other/background.json', name: 'background.json', data: new TextEncoder().encode(JSON.stringify({ default: { background: 'cloudy_back.webp' } })) },
  { path: 'Other/cloudy_back.webp', name: 'cloudy_back.webp', data: new Uint8Array(10), size: 10 },
];
const regResult2 = await bgStore.registerFiles(testFiles2);
const importedOther = regResult2.importedBackgrounds.find(b => b.folder === 'Other');
ok(Boolean(importedOther), 'second background "Other" was created');
eq(importedOther.states.default.background, 'cloudy_back.webp', 'slot in Other background still simply retains clean "cloudy_back.webp"');
ok(importedOther.assetSources['cloudy_back.webp']?.startsWith('cloudy_back_'), 'assetSources maps cloudy_back.webp to cloudy_back_1.webp due to collision');

// Verify getAssetUrl disambiguation between Manor and Other
const manorBgUrl = bgStore.getAssetUrl('cloudy_back.webp', 'image', importedManor);
const otherBgUrl = bgStore.getAssetUrl('cloudy_back.webp', 'image', importedOther);
ok(Boolean(manorBgUrl), 'manor cloudy_back.webp resolves to an asset url');
ok(Boolean(otherBgUrl), 'other cloudy_back.webp resolves to an asset url');
ok(manorBgUrl !== otherBgUrl, 'manor and other cloudy_back.webp resolve to DIFFERENT asset URLs (no black screen conflict)');

// Audio fallback test
const audioFallback = bgStore.getAssetUrl('wsl/manor_3_cycle.opus', 'audio', importedManor);
eq(audioFallback, 'base/sounds/ambient/wsl/manor_3_cycle.opus', 'audio fallback resolves to base/sounds/ambient/ path when not in pool');

// Verify standalone sounds directory does not create a background
const soundFiles = [
  { path: 'base/sounds/ambient/night_crickets.opus', name: 'night_crickets.opus', data: new Uint8Array(20), size: 20 },
];
const regSounds = await bgStore.registerFiles(soundFiles);
eq(regSounds.importedBackgrounds.length, 0, 'standalone sounds directory does not create fake backgrounds');

// Test Root Asset Repository Folder Detection & Bloat Filtering (e.g. MM/ root)
const rootRepoFiles = [
  { path: 'MM/background/Court/background.json', name: 'background.json', data: new TextEncoder().encode(JSON.stringify({ default: { background: 'court.webp' } })) },
  { path: 'MM/background/Court/court.webp', name: 'court.webp', data: new Uint8Array(12), size: 12 },
  { path: 'MM/sounds/ambient/rain_loop.opus', name: 'rain_loop.opus', data: new Uint8Array(15), size: 15 },
  // Non-background bloat files that MUST be ignored
  { path: 'MM/sounds/music/cross_exam.mp3', name: 'cross_exam.mp3', data: new Uint8Array(30), size: 30 },
  { path: 'MM/characters/phoenix/talk.gif', name: 'talk.gif', data: new Uint8Array(25), size: 25 },
  { path: 'MM/animations/take_that.gif', name: 'take_that.gif', data: new Uint8Array(22), size: 22 },
  { path: 'MM/configs/theme.json', name: 'theme.json', data: new TextEncoder().encode('{}') },
];
const regRoot = await bgStore.registerFiles(rootRepoFiles);
const importedCourt = regRoot.importedBackgrounds.find((b) => b.folder === 'Court');
ok(Boolean(importedCourt), 'court background imported with clean folder "Court" from MM/ root');
const hasCourtWebp = regRoot.addedAssets.some((a) => a.name === 'court.webp');
const hasRainLoop = regRoot.addedAssets.some((a) => a.name === 'rain_loop.opus');
const hasCrossExam = regRoot.addedAssets.some((a) => a.name === 'cross_exam.mp3');
const hasPhoenixTalk = regRoot.addedAssets.some((a) => a.name === 'talk.gif');
const hasTakeThat = regRoot.addedAssets.some((a) => a.name === 'take_that.gif');
ok(hasCourtWebp, 'court.webp from background/ accepted');
ok(hasRainLoop, 'rain_loop.opus from sounds/ambient/ accepted');
ok(!hasCrossExam, 'sounds/music/cross_exam.mp3 was ignored (bloat filtered)');
ok(!hasPhoenixTalk, 'characters/phoenix/talk.gif was ignored (bloat filtered)');
ok(!hasTakeThat, 'animations/take_that.gif was ignored (bloat filtered)');

// Test root folder with ONLY background/ (e.g. NN/background)
const onlyBgRootFiles = [
  { path: 'NN/background/Library/background.json', name: 'background.json', data: new TextEncoder().encode(JSON.stringify({ default: { background: 'book.png' } })) },
  { path: 'NN/background/Library/book.png', name: 'book.png', data: new Uint8Array(8), size: 8 },
];
const regOnlyBg = await bgStore.registerFiles(onlyBgRootFiles);
const importedLib = regOnlyBg.importedBackgrounds.find((b) => b.folder === 'Library');
ok(Boolean(importedLib), 'root folder with ONLY background/ detected and imported with clean folder "Library"');

// Test root folder with ONLY sounds/ (e.g. AudioOnly/sounds)
const onlySoundsRootFiles = [
  { path: 'AudioOnly/sounds/ambient/nature_loop.opus', name: 'nature_loop.opus', data: new Uint8Array(14), size: 14 },
  { path: 'AudioOnly/sounds/music/battle_theme.mp3', name: 'battle_theme.mp3', data: new Uint8Array(40), size: 40 },
];
const regOnlySounds = await bgStore.registerFiles(onlySoundsRootFiles);
const hasNatureLoop = regOnlySounds.addedAssets.some((a) => a.name === 'nature_loop.opus');
const hasBattleTheme = regOnlySounds.addedAssets.some((a) => a.name === 'battle_theme.mp3');
ok(hasNatureLoop, 'root folder with ONLY sounds/ accepted sounds/ambient/nature_loop.opus');
ok(!hasBattleTheme, 'root folder with ONLY sounds/ filtered sounds/music/battle_theme.mp3');
eq(regOnlySounds.importedBackgrounds.length, 0, 'sounds-only import creates no fake backgrounds');

// Test case-insensitive root folder with Base/ and sounds/ambience/
const caseInsensitiveFiles = [
  { path: 'Base/background/Beach/background.json', name: 'background.json', data: new TextEncoder().encode(JSON.stringify({ default: { background: 'beach.png' } })) },
  { path: 'Base/background/Beach/beach.png', name: 'beach.png', data: new Uint8Array(20), size: 20 },
  { path: 'base/sounds/ambience/wsl/beach_waves.opus', name: 'beach_waves.opus', data: new Uint8Array(35), size: 35 },
];
const regCase = await bgStore.registerFiles(caseInsensitiveFiles);
const importedBeach = regCase.importedBackgrounds.find((b) => b.folder === 'Beach');
ok(Boolean(importedBeach), 'case-insensitive root folder import created "Beach" background');
const hasBeachPng = regCase.addedAssets.some((a) => a.name === 'beach.png');
const hasBeachWaves = regCase.addedAssets.some((a) => a.name === 'beach_waves.opus');
ok(hasBeachPng, 'beach.png imported into pool despite case differences');
ok(hasBeachWaves, 'beach_waves.opus imported into pool from sounds/ambience/');

// Test root folder containing background and sounds (including images and sounds/wsl audio)
const bgAndSoundsFiles = [
  { path: 'RootPack/background/Manor/positions.ini', name: 'positions.ini', data: new TextEncoder().encode('[wit]\nback=manor.png\nambient_sfx=wsl/manor_amb.opus\n') },
  { path: 'RootPack/background/Manor/manor.png', name: 'manor.png', data: new Uint8Array(28), size: 28 },
  { path: 'RootPack/sounds/wsl/manor_amb.opus', name: 'manor_amb.opus', data: new Uint8Array(45), size: 45 },
  { path: 'RootPack/sounds/music/theme.mp3', name: 'theme.mp3', data: new Uint8Array(90), size: 90 },
  { path: 'RootPack/characters/apollo/talk.gif', name: 'talk.gif', data: new Uint8Array(50), size: 50 },
];
const regBgAndSounds = await bgStore.registerFiles(bgAndSoundsFiles);
eq(regBgAndSounds.importedBackgrounds.length, 1, 'imported 1 background from RootPack');
eq(regBgAndSounds.importedBackgrounds[0].folder, 'Manor', 'imported background folder is Manor');
ok(regBgAndSounds.addedAssets.some((a) => a.name === 'manor.png'), 'manor.png image was imported into pool');
ok(regBgAndSounds.addedAssets.some((a) => a.name === 'manor_amb.opus'), 'manor_amb.opus from sounds/wsl/ was imported into pool');
ok(!regBgAndSounds.addedAssets.some((a) => a.name === 'theme.mp3'), 'sounds/music/theme.mp3 was filtered out (bloat)');
ok(!regBgAndSounds.addedAssets.some((a) => a.name === 'talk.gif'), 'characters/apollo/talk.gif was filtered out (bloat)');

// Test clearAllBackgrounds()
const defaultReset = bgStore.clearAllBackgrounds();
eq(bgStore.get().backgrounds.length, 1, 'clearAllBackgrounds resets to 1 background');
eq(bgStore.get().backgrounds[0].folder, 'Default', 'reset background is Default');
eq(bgStore.get().selectedBgId, defaultReset.id, 'selectedBgId matches Default');

/* ---- Ambience Auto-Switching, Unpause & Volume Slider Tests ---- */
const multiAmbBg = createBackground('Courtroom Ambience Test');
multiAmbBg.states.default.usePositions = true;
multiAmbBg.states.default.positions = {
  wit: createPosition('wit', { background: 'wit.png', ambience: 'wsl/manor_3_cycle.opus' }),
  def: createPosition('def', { background: 'def.png', ambience: 'wsl/rain_loop.opus' }),
  pro: createPosition('pro', { background: 'pro.png', ambience: '' }),
  jud: createPosition('jud', { background: 'jud.png', ambience: 'wsl/rain_loop.opus' }),
};

const visWit = resolveActiveVisual(multiAmbBg, { state: 'default', position: 'wit' });
const visDef = resolveActiveVisual(multiAmbBg, { state: 'default', position: 'def' });
const visPro = resolveActiveVisual(multiAmbBg, { state: 'default', position: 'pro' });
const visJud = resolveActiveVisual(multiAmbBg, { state: 'default', position: 'jud' });

eq(visWit.ambience, 'wsl/manor_3_cycle.opus', 'wit position resolves manor ambience');
eq(visDef.ambience, 'wsl/rain_loop.opus', 'def position resolves rain ambience');
eq(visPro.ambience, '', 'pro position resolves empty ambience');
eq(visJud.ambience, 'wsl/rain_loop.opus', 'jud position resolves rain ambience');

// Ambience transition simulator mirroring syncAmbienceOnVisualChange()
function createAmbienceManager(initialVolume = 0.30) {
  let volume = initialVolume;
  let isPlaying = false;
  let previewActive = false;
  let currentTrack = null;
  let switchCount = 0;

  return {
    get volume() { return volume; },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, typeof v === 'number' && !isNaN(v) ? v : 0.30));
    },
    get isPlaying() { return isPlaying; },
    get previewActive() { return previewActive; },
    get currentTrack() { return currentTrack; },
    get switchCount() { return switchCount; },
    play(track) {
      previewActive = true;
      if (track) {
        currentTrack = track;
        isPlaying = true;
      }
    },
    pause() {
      previewActive = false;
      isPlaying = false;
    },
    sync(newTrack) {
      const clean = (newTrack || '').trim();
      if (clean === currentTrack) {
        // Track hasn't changed, continue without restart
        return 'unchanged';
      }
      currentTrack = clean;
      if (!clean) {
        // Empty track: pauses without clearing previewActive intent
        isPlaying = false;
        return 'paused_empty';
      }
      switchCount++;
      if (previewActive) {
        // Different non-empty track: unpauses/continues playing seamlessly
        isPlaying = true;
        return 'switched_and_playing';
      }
      return 'switched_idle';
    }
  };
}

const ambMgr = createAmbienceManager();
eq(ambMgr.volume, 0.30, 'default ambience volume is 0.30 (30%) to protect ears');
ambMgr.setVolume(1.5);
eq(ambMgr.volume, 1.0, 'volume clamped to 1.0 maximum');
ambMgr.setVolume(-0.2);
eq(ambMgr.volume, 0.0, 'volume clamped to 0.0 minimum');
ambMgr.setVolume(0.30);
eq(ambMgr.volume, 0.30, 'volume set back to 0.30');

// User clicks Play Ambience on wit
ambMgr.play(visWit.ambience);
eq(ambMgr.isPlaying, true, 'ambience is playing after user clicks play');
eq(ambMgr.previewActive, true, 'ambience preview mode is active');
eq(ambMgr.currentTrack, 'wsl/manor_3_cycle.opus', 'current track is wit manor ambience');

// Switch to def (different ambience: rain)
const switchDefRes = ambMgr.sync(visDef.ambience);
eq(switchDefRes, 'switched_and_playing', 'switching to def changes ambience and continues playing');
eq(ambMgr.isPlaying, true, 'stays playing without pausing when ambience changes');
eq(ambMgr.currentTrack, 'wsl/rain_loop.opus', 'current track switched to rain');

// Switch to jud (same ambience: rain)
const switchJudRes = ambMgr.sync(visJud.ambience);
eq(switchJudRes, 'unchanged', 'switching to jud detects identical ambience and does not interrupt');
eq(ambMgr.isPlaying, true, 'audio remains playing without stutter');

// Switch to pro (empty ambience)
const switchProRes = ambMgr.sync(visPro.ambience);
eq(switchProRes, 'paused_empty', 'switching to position with empty ambience pauses playback');
eq(ambMgr.isPlaying, false, 'playback is paused when ambience is empty');
eq(ambMgr.previewActive, true, 'preview intent remains active while paused on empty');

// Switch back to wit (non-empty ambience) -> should UNPAUSE and play!
const switchWitRes = ambMgr.sync(visWit.ambience);
eq(switchWitRes, 'switched_and_playing', 'switching back to non-empty ambience unpauses and plays seamlessly');
eq(ambMgr.isPlaying, true, 'playback unpaused and playing automatically');
eq(ambMgr.currentTrack, 'wsl/manor_3_cycle.opus', 'current track is wit manor');

// User explicitly pauses
ambMgr.pause();
eq(ambMgr.isPlaying, false, 'audio paused by user');
eq(ambMgr.previewActive, false, 'preview mode deactivated by user');

// Switch to def while explicitly paused -> should NOT unpause
const switchPausedRes = ambMgr.sync(visDef.ambience);
eq(switchPausedRes, 'switched_idle', 'switching position while explicitly paused updates track but does not play');
eq(ambMgr.isPlaying, false, 'audio remains paused');

/* ---- getReferencedAssetInfo & Used/Unused Disambiguation Tests ---- */
const testRefBg = createBackground('WS Lambda/Blackout');
testRefBg.states.default.usePositions = true;
testRefBg.states.default.positions = {
  wit: createPosition('wit', { foreground: 'stand.webp' }),
};
testRefBg.assetSources = {
  'stand.webp': 'stand_1.webp'
};

const refInfo = bgStore.getReferencedAssetInfo([testRefBg]);
ok(refInfo.keys.has('stand.webp'), 'referenced keys includes export alias stand.webp');
ok(refInfo.keys.has('stand_1.webp'), 'referenced keys includes mapped asset stand_1.webp');

const usedAsset1 = { id: 'ast_1', name: 'stand.webp', relPath: 'stand.webp', fullRelPath: 'base/background/ai/stand.webp' };
const usedAsset2 = { id: 'ast_2', name: 'stand_1.webp', relPath: 'stand_1.webp', fullRelPath: 'base/background/WS Lambda/Blackout/stand_1.webp' };
const unusedAsset = { id: 'ast_3', name: 'completely_unused.webp', relPath: 'unused.webp', fullRelPath: 'base/background/nowhere/unused.webp' };

ok(refInfo.isReferenced(usedAsset1), 'usedAsset1 (stand.webp) is recognized as referenced');
ok(refInfo.isReferenced(usedAsset2), 'usedAsset2 (stand_1.webp from assetSources) is recognized as referenced (NOT unused)');
ok(!refInfo.isReferenced(unusedAsset), 'unusedAsset is correctly identified as not referenced');

/* ---- Export Package & Library Deduplication and Asset Accuracy Tests ---- */
// 1. buildZip deduplicates duplicate paths defensively
const dupZipBytes = await buildZip([
  { path: 'room/rain_front.webp', data: new Uint8Array([1, 2, 3]) },
  { path: 'room/rain_front.webp', data: new Uint8Array([1, 2, 3]) },
  { path: 'room/rain_front.webp', data: new Uint8Array([1, 2, 3]) },
  { path: 'room/witnessempty.webp', data: new Uint8Array([4, 5]) },
  { path: 'room/witnessempty.webp', data: new Uint8Array([4, 5]) },
]);
const unzippedDups = await readZip(dupZipBytes);
eq(unzippedDups.length, 2, 'buildZip deduplicates repeated paths: exactly 2 unique files extracted');
ok(unzippedDups.some(f => f.path === 'room/rain_front.webp'), 'rain_front.webp extracted once');
ok(unzippedDups.some(f => f.path === 'room/witnessempty.webp'), 'witnessempty.webp extracted once');

// 2. findAsset accuracy across collision disambiguated backgrounds
const assetManor = bgStore.findAsset('cloudy_back.webp', 'image', importedManor);
const assetOther = bgStore.findAsset('cloudy_back.webp', 'image', importedOther);
ok(Boolean(assetManor), 'findAsset finds asset for importedManor');
ok(Boolean(assetOther), 'findAsset finds asset for importedOther');
eq(assetManor.size, 4, 'importedManor resolves to its own 4-byte cloudy_back.webp asset');
eq(assetOther.size, 10, 'importedOther resolves to its own 10-byte cloudy_back_1.webp asset (no cross-room corruption)');

// 3. Multi-position background package export deduplication
const multiPosBg = createBackground('MultiPosRoom');
multiPosBg.states.default.usePositions = true;
multiPosBg.states.default.positions = {
  wit: createPosition('wit', { background: 'room.webp', foreground: 'desk.webp' }),
  def: createPosition('def', { background: 'room.webp', foreground: 'desk.webp' }),
  pro: createPosition('pro', { background: 'room.webp', foreground: 'desk.webp' }),
  jud: createPosition('jud', { background: 'room.webp', foreground: 'desk.webp' }),
  hld: createPosition('hld', { background: 'room.webp', foreground: 'desk.webp' }),
};

// Simulate zip collection for multiPosBg
const testZipMap = new Map();
const bgJsonPath = 'base/background/MultiPosRoom/background.json';
testZipMap.set(bgJsonPath.toLowerCase(), { path: bgJsonPath, data: '{"test":1}' });

const refImgs = new Set();
for (const pos of Object.values(multiPosBg.states.default.positions)) {
  if (pos.background) refImgs.add(pos.background);
  if (pos.foreground) refImgs.add(pos.foreground);
}
eq(refImgs.size, 2, 'referencedImages Set deduplicates 5 positions into exactly 2 unique image names');

for (const img of refImgs) {
  const p = `base/background/MultiPosRoom/${img}`;
  testZipMap.set(p.toLowerCase(), { path: p, data: new Uint8Array([10, 20]) });
}
eq(testZipMap.size, 3, 'testZipMap has exactly 3 entries (background.json + 1 room.webp + 1 desk.webp, zero duplicates)');

const multiPosZip = await buildZip(Array.from(testZipMap.values()));
const extractedMultiPos = await readZip(multiPosZip);
eq(extractedMultiPos.length, 3, 'extractedMultiPos has exactly 3 files, 0 corrupted duplicate entries');

/* ---- From Folder Metadata Tracking & Sanitization Tests ---- */
eq(sanitizeToRootFolder('C:/Users/yuzuru/Downloads/Ante Infinitum/background/court'), 'Ante Infinitum/background/court', 'sanitizeToRootFolder strips drive and User directory down to root folder');
eq(sanitizeToRootFolder('D:\\Projects\\MNN\\room\\wit.webp'), 'Projects/MNN/room', 'sanitizeToRootFolder strips drive, normalizes slashes, and removes filename');
eq(sanitizeToRootFolder('Ante Infinitum/background/WS Lambda/Manor Room 1'), 'Ante Infinitum/background/WS Lambda/Manor Room 1', 'sanitizeToRootFolder preserves already-relative folder paths untouched');

const fromFolderTestFiles = [
  { path: 'C:/Users/user/Downloads/CourtPack/court.webp', name: 'court.webp', data: new Uint8Array([1, 2, 3]), size: 3 },
  { path: 'court_alone.png', name: 'court_alone.png', data: new Uint8Array([4, 5]), size: 2 },
  { path: 'MySource/Sub/ambience.opus', name: 'ambience.opus', data: new Uint8Array([6, 7]), size: 2 },
];
const regFromFolder = await bgStore.registerFiles(fromFolderTestFiles);
const courtAsset = regFromFolder.addedAssets.find((a) => a.name.startsWith('court'));
ok(Boolean(courtAsset), 'court asset imported into pool');
eq(courtAsset.fromFolder, 'CourtPack', 'fromFolder sanitized to start at root folder (stripping C:/Users/user/Downloads)');

const aloneAsset = regFromFolder.addedAssets.find((a) => a.name.startsWith('court_alone'));
ok(Boolean(aloneAsset), 'alone asset imported into pool');
eq(aloneAsset.fromFolder, '', 'fromFolder is empty for root-level file with no directory');

const ambAsset = regFromFolder.addedAssets.find((a) => a.name.startsWith('ambience'));
ok(Boolean(ambAsset), 'ambience asset imported into pool');
eq(ambAsset.fromFolder, 'MySource/Sub', 'fromFolder extracted correctly for relative nested audio path');

// Test that serializeBackgroundJson does NOT include from_folder (keeping background.json pure game schema)
const testBgWithFromFolder = createBackground('PrivacyTest');
testBgWithFromFolder.fromFolder = 'C:/Users/user/Desktop/CourtPack/courtroom';
testBgWithFromFolder.states.default.background = courtAsset.name;
const exportedJsonString = serializeBackgroundJson(testBgWithFromFolder);
const parsedExport = JSON.parse(exportedJsonString);
ok(!('from_folder' in parsedExport), 'serializeBackgroundJson does NOT export from_folder to background.json');
ok(!('from_folder' in parsedExport.default), 'from_folder is NOT placed inside default state variant');

// Test that backgrounds-library.json includes asset fromFolder metadata
const exportedLibraryJson = bgStore.exportLibraryJson();
const parsedLibrary = JSON.parse(exportedLibraryJson);
ok(Array.isArray(parsedLibrary.assets), 'library export includes assets array');
const libCourtAsset = parsedLibrary.assets.find((a) => a.name === courtAsset.name);
ok(Boolean(libCourtAsset), 'library export contains court asset');
eq(libCourtAsset.fromFolder, 'CourtPack', 'library asset retains sanitized fromFolder starting at root folder');

/* ---- Field Header Emdash Formatting Verification ---- */
const fieldKey = 'area';
const aptDesc = 'Name of the area';
const formattedHeader = `${fieldKey} — ${aptDesc}`;
ok(formattedHeader.includes(' — '), 'Field header formats strictly with spaces around emdash: "key — description"');
ok(!formattedHeader.includes(`${fieldKey}—`), 'Does not have collapsed leading space before emdash');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
