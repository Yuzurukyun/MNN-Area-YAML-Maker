// Link maths: resolving link modes (list / ALL AREAS / REACHABLE AREAS / none),
// generating edges and canonical pairs for the map, and applying direction edits
// without silently overriding mode-based sides or trapping hub connections.

export function allExceptHubIds(P, a) {
  const hubId = P.areas.length ? P.areas[0].id : null;
  return P.areas.filter((x) => x.id !== a.id && (a.id === hubId || x.id !== hubId)).map((x) => x.id);
}

export function allExceptHubNames(P, a) {
  const byId = new Map(P.areas.map((x) => [x.id, x.area]));
  return allExceptHubIds(P, a).map((id) => byId.get(id)).filter(Boolean);
}

export function effectiveIds(P, a, lt) {
  if (!a || !a.links || !a.links[lt]) return [];
  const L = a.links[lt];
  const validIds = new Set(P.areas.map((x) => x.id));
  if (L.mode === 'list') {
    const seen = new Set();
    const out = [];
    for (const t of L.targets || []) {
      if (t !== a.id && validIds.has(t) && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out;
  }
  if (L.mode === 'all') {
    // Reachable <ALL> covers every area including the hub; visible/scream
    // export without the hub (server workaround) unless a IS the hub.
    return lt === 'reachable'
      ? P.areas.filter((x) => x.id !== a.id).map((x) => x.id)
      : allExceptHubIds(P, a);
  }
  if (L.mode === 'reachable' && lt !== 'reachable') {
    return effectiveIds(P, a, 'reachable');
  }
  return [];
}

export function effectiveNames(P, a, lt) {
  const byId = new Map(P.areas.map((x) => [x.id, x.area]));
  return effectiveIds(P, a, lt).map((id) => byId.get(id) || '').filter(Boolean);
}

// One-hop neighbourhood from `seeds` for the given link type (`reachable` by default).
export function neighbourhoodIds(P, seeds, lt = 'reachable') {
  const valid = new Set(P.areas.map((a) => a.id));
  const seedSet = new Set((seeds || []).filter((id) => valid.has(id)));
  const out = new Set(seedSet);
  P.areas.forEach((a) => {
    const eff = effectiveIds(P, a, lt);
    if (seedSet.has(a.id)) eff.forEach((t) => out.add(t));
    else if (eff.some((t) => seedSet.has(t))) out.add(a.id);
  });
  return out;
}

export function directedEdges(P, lt) {
  const valid = new Set(P.areas.map((x) => x.id));
  const out = [];
  P.areas.forEach((a) => {
    const L = a.links?.[lt];
    if (!L) return;
    if (L.mode === 'list') {
      const seen = new Set();
      (L.targets || []).forEach((t) => {
        if (t !== a.id && valid.has(t) && !seen.has(t)) {
          seen.add(t);
          out.push({ from: a.id, to: t, derived: false, fromAll: false });
        }
      });
    } else if (L.mode === 'all') {
      effectiveIds(P, a, lt).forEach((t) => {
        out.push({ from: a.id, to: t, derived: false, fromAll: true });
      });
    } else if (L.mode === 'reachable' && lt !== 'reachable') {
      const rMode = a.links.reachable?.mode;
      effectiveIds(P, a, 'reachable').forEach((t) => {
        if (t !== a.id) {
          out.push({ from: a.id, to: t, derived: true, fromAll: rMode === 'all' });
        }
      });
    }
  });
  return out;
}

export function pairEdges(P, lt) {
  const order = new Map(P.areas.map((a, i) => [a.id, i]));
  const map = new Map();
  directedEdges(P, lt).forEach((e) => {
    const lo = order.get(e.from) <= order.get(e.to) ? e.from : e.to;
    const hi = lo === e.from ? e.to : e.from;
    const key = lo + '|' + hi;
    if (!map.has(key)) {
      map.set(key, { x: lo, y: hi, xy: false, yx: false, dxy: false, dyx: false, axy: false, ayx: false });
    }
    const p = map.get(key);
    if (e.from === lo) {
      p.xy = true;
      p.dxy = e.derived;
      p.axy = e.fromAll;
    } else {
      p.yx = true;
      p.dyx = e.derived;
      p.ayx = e.fromAll;
    }
  });
  return [...map.values()].map((p) => ({
    ...p,
    derived: (!p.xy || p.dxy) && (!p.yx || p.dyx),
    allOnly: (!p.xy || p.axy) && (!p.yx || p.ayx),
  }));
}

// Switch one side of a link on or off. Mode-based sides (ALL AREAS or
// follows-reachable) are never destructively rewritten into lists.
// Any explicit list side—including links to the hub—can be freely toggled.
export function setSide(P, lt, fromId, toId, on) {
  if (fromId === toId) return;
  const from = P.areas.find((a) => a.id === fromId);
  if (!from) return;
  const L = from.links[lt];
  if (on) {
    if (L.mode === 'list') {
      if (!L.targets.includes(toId)) L.targets.push(toId);
    } else if (L.mode === 'none') {
      L.mode = 'list';
      L.targets = [toId];
    }
  } else if (L.mode === 'list') {
    L.targets = L.targets.filter((t) => t !== toId);
  }
}

export function setDir(P, lt, p, dir) {
  if (dir === 'both') {
    setSide(P, lt, p.x, p.y, true);
    setSide(P, lt, p.y, p.x, true);
  } else if (dir === 'ab') {
    setSide(P, lt, p.x, p.y, true);
    setSide(P, lt, p.y, p.x, false);
  } else if (dir === 'ba') {
    setSide(P, lt, p.y, p.x, true);
    setSide(P, lt, p.x, p.y, false);
  } else if (dir === 'del') {
    setSide(P, lt, p.x, p.y, false);
    setSide(P, lt, p.y, p.x, false);
  }
}

// Mirror a link toggle onto the opposite area when adding/toggling in list mode.
export function mirrorLink(P, lt, fromId, toId, on) {
  if (fromId === toId) return;
  const target = P.areas.find((a) => a.id === toId);
  if (!target) return;
  const L = target.links[lt];
  if (on) {
    if (L.mode === 'list') {
      if (!L.targets.includes(fromId)) L.targets.push(fromId);
    } else if (L.mode === 'none') {
      L.mode = 'list';
      L.targets = [fromId];
    }
  } else if (L.mode === 'list') {
    L.targets = L.targets.filter((t) => t !== fromId);
  }
}
