// Project & area model: creation, normalization, validation, duplication,
// reordering, deletion, templates, spatial groups, and merging imports.

import { strip, uid, resetUid, syncUid } from './util.js';
import { BOOL_FIELDS, NODE_W, NODE_H, allTemplates } from './fields.js';
import { effectiveIds } from './links.js';

export function blankArea(name) {
  const a = {
    id: uid(),
    area: name || 'New Area',
    background: '',
    background_variant: '',
    default_description: '',
    tod: [],
    afk_delay: 0,
    afk_sendto: 0,
    templateId: null,
    x: Math.round(80 + Math.random() * 420),
    y: Math.round(60 + Math.random() * 300),
    links: {
      reachable: { mode: 'list', targets: [] },
      visible: { mode: 'reachable', targets: [] },
      scream: { mode: 'reachable', targets: [] },
    },
    restricted_chars: [],
    color: '',
    image: '',
    imageMode: 'node',
  };
  BOOL_FIELDS.forEach(([k, , d]) => (a[k] = d));
  a.weather = '';
  a.investigation = '';
  a.map_visual = 'None';
  return a;
}

export function normaliseArea(a) {
  const b = blankArea(a?.area || 'Area');
  Object.keys(b).forEach((k) => {
    if (a[k] === undefined) a[k] = b[k];
  });
  if (!a.id) a.id = uid();
  if (!Array.isArray(a.tod)) a.tod = [];
  if (!Array.isArray(a.restricted_chars)) a.restricted_chars = [];
  if (!a.links || typeof a.links !== 'object') a.links = b.links;
  ['reachable', 'visible', 'scream'].forEach((lt) => {
    const def = b.links[lt];
    const L = a.links[lt];
    if (!L || typeof L !== 'object') {
      a.links[lt] = { ...def, targets: [] };
      return;
    }
    if (!L.mode) L.mode = def.mode;
    if (!Array.isArray(L.targets)) L.targets = [];
    if (L.also !== undefined && !Array.isArray(L.also)) delete L.also;
  });
  if (typeof a.afk_delay !== 'number' || Number.isNaN(a.afk_delay)) a.afk_delay = Math.max(0, parseInt(a.afk_delay) || 0);
  if (typeof a.afk_sendto !== 'number' || Number.isNaN(a.afk_sendto)) a.afk_sendto = Math.max(0, parseInt(a.afk_sendto) || 0);
  return a;
}

export function mk(name, bg, over) {
  const a = blankArea(name);
  a.background = bg;
  Object.assign(a, over || {});
  return a;
}

export function sampleProject() {
  resetUid();
  const BG = 'Class Trial Debate Room V3-1_HD';
  const areas = [
    mk('Basement', BG, { bglock: true, iniswap_allowed: true, lobby_area: true, default_description: 'The basement and default area.' }),
    mk('Class Trial Room 1', BG, {
      locking_allowed: true,
      iniswap_allowed: true,
      global_allowed: false,
      rp_getarea_allowed: false,
      gm_iclock_allowed: false,
      afk_delay: 5,
      private_area: true,
      cbg_allowed: true,
      default_description: 'A class trial room that does not like Shuichi.',
      restricted_chars: ['Shuichi Saihara_HD'],
    }),
    mk('Class Trial Room, 2', BG, {
      iniswap_allowed: true,
      change_reachability_allowed: false,
      rp_getareas_allowed: false,
      afk_delay: 10,
      afk_sendto: 3,
      song_switch_allowed: true,
      bullet: false,
      default_description: 'A class trial room that does not like bullets.',
      restricted_chars: ['Kaede Akamatsu_HD', 'Monokuma_HD'],
    }),
    mk('Class Trial Room 3', BG, {
      locking_allowed: true,
      iniswap_allowed: true,
      afk_delay: 5,
      afk_sendto: 1,
      lobby_area: true,
      private_area: true,
      has_lights: false,
      song_switch_allowed: true,
      cbg_allowed: true,
      tod: [
        ['day', 'Class Trial Debate Room DR1-1_HD'],
        ['night', 'Class Trial Debate Room DR1-2_HD'],
      ],
    }),
    mk('Test 1', BG, { iniswap_allowed: true }),
    mk('Test 2', BG, { iniswap_allowed: true }),
    mk('Test 3', BG, { iniswap_allowed: true }),
    mk('Test 4', BG, { iniswap_allowed: true }),
  ];
  const byName = (n) => areas.find((a) => a.area === n);
  const setLinks = (n, r, v, s) => {
    const a = byName(n);
    if (r) a.links.reachable = r;
    if (v) a.links.visible = v;
    if (s) a.links.scream = s;
  };
  const L = (names) => ({ mode: 'list', targets: names.map((n) => byName(n).id) });
  setLinks('Basement', L(['Class Trial Room 1', 'Class Trial Room 3', 'Test 1', 'Test 2', 'Test 3', 'Test 4']), null, L(['Class Trial Room 1']));
  setLinks('Class Trial Room 1', L(['Class Trial Room, 2', 'Basement']), L(['Class Trial Room, 2', 'Test 3']), L(['Basement']));
  setLinks('Class Trial Room, 2', { mode: 'all', targets: [] }, null, { mode: 'all', targets: [] });
  setLinks('Class Trial Room 3', L(['Class Trial Room 3']), null, null);
  ['Test 1', 'Test 2', 'Test 3', 'Test 4'].forEach((n) => setLinks(n, { mode: 'all', targets: [] }, null, null));
  return ensureProject({ areas, templates: [], todPresets: [] });
}

export function blankProject() {
  resetUid();
  const hub = blankArea('Hub');
  hub.x = 120;
  hub.y = 120;
  return { areas: [hub], templates: [], todPresets: [], groups: [], layouts: [], images: [], backgrounds: [] };
}

export function ensureProject(p) {
  if (!Array.isArray(p.areas)) p.areas = [];
  if (!Array.isArray(p.templates)) p.templates = [];
  if (!Array.isArray(p.todPresets)) p.todPresets = [];
  if (!Array.isArray(p.groups)) p.groups = [];
  if (!Array.isArray(p.layouts)) p.layouts = [];
  if (!Array.isArray(p.images)) p.images = [];
  if (!Array.isArray(p.backgrounds)) p.backgrounds = [];
  syncUid(p);
  return p;
}

export function remapAfk(P, idsBefore) {
  P.areas.forEach((b) => {
    if (b.afk_sendto > 0) {
      const targetId = idsBefore[b.afk_sendto];
      const ni = targetId ? P.areas.findIndex((x) => x.id === targetId) : -1;
      b.afk_sendto = ni >= 0 ? ni : 0;
    }
  });
}

export function duplicateArea(P, id) {
  const src = P.areas.find((a) => a.id === id);
  if (!src) return null;
  syncUid(P);
  const idsBefore = P.areas.map((x) => x.id);
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid();
  const taken = new Set(P.areas.map((a) => strip(a.area)));
  let name = strip(src.area) + ' copy';
  for (let n = 2; taken.has(name); n++) name = strip(src.area) + ' copy ' + n;
  copy.area = name;
  copy.x = src.x + 36;
  copy.y = src.y + 36;
  const at = P.areas.indexOf(src);
  P.areas.splice(at + 1, 0, copy);
  remapAfk(P, idsBefore);
  return copy;
}

export function resolveBgPattern(pattern, areaName = '', isPrefix = false) {
  if (!pattern || typeof pattern !== 'string') return '';
  let p = pattern.trim().replace(/\\/g, '/');
  p = p.replace(/^(\.\/)?(base\/)?background\//i, '');
  p = p.replace(/^\/+/, '');
  if (!p) return '';

  const cleanName = typeof areaName === 'string' ? areaName.trim() : '';

  if (p.includes('{name}')) {
    return p.replace(/\{name\}/g, cleanName);
  }
  if (p.includes('{area}')) {
    return p.replace(/\{area\}/g, cleanName);
  }
  if (p.endsWith('/')) {
    return `${p}${cleanName}`;
  }
  if (isPrefix) {
    return cleanName ? `${p}/${cleanName}` : `${p}/`;
  }
  return p;
}

export function addArea(P, opts = {}) {
  syncUid(P);
  const taken = new Set(P.areas.map((a) => strip(a.area)));
  let defaultName = opts.name || 'Area ' + (P.areas.length + 1);
  if (!opts.name && taken.has(defaultName)) {
    for (let n = P.areas.length + 2; taken.has(defaultName); n++) defaultName = 'Area ' + n;
  }
  const a = blankArea(defaultName);
  if (opts.templateId) {
    const tpl = templateById(P, opts.templateId);
    if (tpl) applyTemplate(a, tpl);
  }
  if (opts.bgPrefix) {
    a.background = resolveBgPattern(opts.bgPrefix, a.area, true);
  } else if (!a.background && opts.bgPattern) {
    a.background = resolveBgPattern(opts.bgPattern, a.area);
  }
  if (P.areas.length) {
    const hub = P.areas[0];
    a.links.reachable = { mode: 'list', targets: [hub.id] };
    if (hub.links.reachable.mode === 'list' && !hub.links.reachable.targets.includes(a.id)) {
      hub.links.reachable.targets.push(a.id);
    }
  }
  if (opts.x !== undefined) {
    a.x = opts.x;
    a.y = opts.y;
  }
  P.areas.push(a);
  return a;
}

export function groupOfArea(P, a) {
  const cx = a.x + NODE_W / 2;
  const cy = a.y + NODE_H / 2;
  return (P.groups || []).find((g) => cx >= g.x && cx <= g.x + g.w && cy >= g.y && cy <= g.y + g.h) || null;
}

export function groupMembers(P, g) {
  return P.areas.filter((a) => groupOfArea(P, a) === g);
}

export function sortAreasByGroups(P) {
  if (!P.areas.length) return;
  const idsBefore = P.areas.map((x) => x.id);
  const hub = P.areas[0];
  const placed = new Set([hub.id]);
  const out = [hub];
  (P.groups || []).forEach((g) => {
    groupMembers(P, g).forEach((a) => {
      if (!placed.has(a.id)) {
        placed.add(a.id);
        out.push(a);
      }
    });
  });
  P.areas.forEach((a) => {
    if (!placed.has(a.id)) {
      placed.add(a.id);
      out.push(a);
    }
  });
  P.areas = out;
  remapAfk(P, idsBefore);
}

export function dupNames(P) {
  const counts = {};
  P.areas.forEach((a) => {
    const n = strip(a.area);
    if (n) counts[n] = (counts[n] || 0) + 1;
  });
  return new Set(Object.keys(counts).filter((n) => counts[n] > 1));
}

export function exportErrors(P) {
  const errs = [];
  const dups = dupNames(P);
  P.areas.forEach((a, i) => {
    const name = strip(a.area);
    if (!name) errs.push(`Area #${i} has no name — every area needs one.`);
    else if (dups.has(name)) errs.push(`Area #${i} is named "${name}", which is already taken — names must be unique.`);
    if (!strip(a.background)) errs.push(`Area #${i}${name ? ` ("${name}")` : ''} has no background — that field is mandatory.`);
  });
  return errs;
}

// Non-blocking diagnostics surfaced in Export preview to catch subtle layout/link mistakes.
export function exportWarnings(P) {
  const warns = [];
  if (!P.areas.length) return warns;

  // Reachability BFS from the hub (area 0)
  const byId = new Map(P.areas.map((a) => [a.id, a]));
  const reachedFromHub = new Set([P.areas[0].id]);
  const queue = [P.areas[0].id];
  while (queue.length) {
    const cur = byId.get(queue.shift());
    if (!cur) continue;
    for (const nextId of effectiveIds(P, cur, 'reachable')) {
      if (!reachedFromHub.has(nextId)) {
        reachedFromHub.add(nextId);
        queue.push(nextId);
      }
    }
  }

  P.areas.forEach((a, i) => {
    const label = `#${i} "${strip(a.area) || 'Unnamed'}"`;
    if (P.areas.length > 1 && effectiveIds(P, a, 'reachable').length === 0) {
      warns.push(`${label} has no reachable exits (players inside cannot walk out).`);
    }
    if (i > 0 && !reachedFromHub.has(a.id)) {
      warns.push(`${label} cannot be reached from the hub (${P.areas[0].area}) via walkable paths.`);
    }
    if (a.afk_sendto < 0 || a.afk_sendto >= P.areas.length) {
      warns.push(`${label} has afk_sendto=${a.afk_sendto}, which is outside the area ID range (0–${P.areas.length - 1}).`);
    }
    const emptyTod = (a.tod || []).some(([k, v]) => (strip(k) && !strip(v)) || (!strip(k) && strip(v)));
    if (emptyTod) {
      warns.push(`${label} has an incomplete background_tod row (it will be skipped on export).`);
    }
  });
  return warns;
}

export function reorderArea(P, from, to) {
  if (from === to || from < 1 || to < 1 || from >= P.areas.length || to >= P.areas.length) return;
  const idsBefore = P.areas.map((x) => x.id);
  const [item] = P.areas.splice(from, 1);
  P.areas.splice(to, 0, item);
  remapAfk(P, idsBefore);
}

export function reorderAreas(P, indices, targetIndex) {
  const valid = [...new Set(indices)].filter((i) => i > 0 && i < P.areas.length).sort((a, b) => a - b);
  if (!valid.length) return;
  const target = Math.max(1, Math.min(P.areas.length - 1, targetIndex));
  const idsBefore = P.areas.map((x) => x.id);
  const selected = valid.map((i) => P.areas[i]);
  const selSet = new Set(selected.map((a) => a.id));
  const rest = P.areas.filter((a) => !selSet.has(a.id));
  rest.splice(target, 0, ...selected);
  P.areas = rest;
  remapAfk(P, idsBefore);
}

export function moveAreasDelta(P, indices, delta) {
  if (!delta) return;
  const valid = [...new Set(indices)].filter((i) => i > 0 && i < P.areas.length).sort((a, b) => a - b);
  if (!valid.length) return;
  if (delta < 0) {
    if (valid[0] <= 1) return;
    const idsBefore = P.areas.map((x) => x.id);
    for (let i = 0; i < valid.length; i++) {
      const idx = valid[i];
      const [item] = P.areas.splice(idx, 1);
      P.areas.splice(idx - 1, 0, item);
      valid[i] = idx - 1;
    }
    remapAfk(P, idsBefore);
  } else {
    if (valid[valid.length - 1] >= P.areas.length - 1) return;
    const idsBefore = P.areas.map((x) => x.id);
    for (let i = valid.length - 1; i >= 0; i--) {
      const idx = valid[i];
      const [item] = P.areas.splice(idx, 1);
      P.areas.splice(idx + 1, 0, item);
      valid[i] = idx + 1;
    }
    remapAfk(P, idsBefore);
  }
}

export function deleteArea(P, id) {
  if (P.areas.length && id === P.areas[0].id) return;
  if (P.areas.length <= 1) return;
  const idsBefore = P.areas.map((x) => x.id);
  P.areas = P.areas.filter((x) => x.id !== id);
  P.areas.forEach((x) => {
    Object.keys(x.links).forEach((lt) => {
      x.links[lt].targets = (x.links[lt].targets || []).filter((t) => t !== id);
      if (Array.isArray(x.links[lt].also)) {
        x.links[lt].also = x.links[lt].also.filter((t) => t !== id);
      }
    });
  });
  remapAfk(P, idsBefore);
}

export function templateById(P, id) {
  return allTemplates(P).find((t) => t.id === id);
}

export function applyTemplate(area, tpl) {
  if (!tpl) return;
  (tpl.include || []).forEach((k) => {
    if (tpl.values && tpl.values[k] !== undefined) {
      area[k] = tpl.values[k];
    }
  });
  area.templateId = tpl.id;
  if (tpl.bg_pattern) {
    area.background = resolveBgPattern(tpl.bg_pattern, area.area);
  } else if (tpl.bg_prefix) {
    area.background = resolveBgPattern(tpl.bg_prefix, area.area, true);
  }
}

export function drifted(P, area) {
  if (!area.templateId) return false;
  const tpl = templateById(P, area.templateId);
  if (!tpl) return false;
  return tpl.include.some((k) => area[k] !== tpl.values[k]);
}

export function syncToTemplate(P, area) {
  const tpl = templateById(P, area.templateId);
  if (tpl) applyTemplate(area, tpl);
}

export function mergeAreas(P, imported) {
  if (!imported || !imported.length) return;
  syncUid(P);
  const norm = imported.map((src) => normaliseArea(JSON.parse(JSON.stringify(src))));
  const byImpId = new Map(norm.map((x) => [x.id, x.area]));
  const staged = norm.map((a) => {
    const names = {};
    Object.keys(a.links).forEach((lt) => {
      names[lt] = (a.links[lt].targets || []).map((tid) => byImpId.get(tid)).filter(Boolean);
    });
    return { a, names };
  });

  const base = P.areas.length;
  const maxY = P.areas.length ? Math.max(...P.areas.map((x) => x.y)) + NODE_H + 50 : 60;
  staged.forEach((s, i) => {
    s.a.id = uid();
    s.a.templateId = null;
    s.a.x = 60 + (i % 5) * (NODE_W + 40);
    s.a.y = maxY + Math.floor(i / 5) * (NODE_H + 44);
  });

  const newTotal = base + staged.length;
  staged.forEach((s) => {
    Object.keys(s.a.links).forEach((lt) => {
      if (s.a.links[lt].mode !== 'list') return;
      s.a.links[lt].targets = s.names[lt]
        .map((n) => {
          const inNew = staged.find((z) => z.a.area === n);
          if (inNew) return inNew.a.id;
          const ex = P.areas.find((x) => x.area === n);
          return ex ? ex.id : null;
        })
        .filter(Boolean);
    });
    if (s.a.afk_sendto > 0) {
      const remapped = base + s.a.afk_sendto;
      s.a.afk_sendto = remapped < newTotal ? remapped : 0;
    }
    P.areas.push(s.a);
  });
}
