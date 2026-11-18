// Smart pathfinding & map audit for TsuMNN / MNN area networks.
// Only explicit list passages are treated as physical walkable paths.
// <ALL> is strictly excluded (including on hubs, lobbies, and private areas).

/**
 * Returns strictly explicit, walkable outgoing exits for an area.
 * <ALL> mode is never expanded because it represents global/special reachability,
 * not a physical walkable passage.
 */
export function walkableExits(P, a) {
  if (!a || !a.links || !a.links.reachable) return [];
  const L = a.links.reachable;
  if (L.mode !== 'list') return [];
  const validIds = new Set(P.areas.map((x) => x.id));
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

/**
 * Finds the shortest walkable path between two areas using Breadth-First Search (BFS).
 * Strictly traverses explicit list passages; ignores <ALL>, and excludes private/lobby
 * areas from being used as intermediate transit hallways.
 * @param {object} P - The project object with areas array
 * @param {string} fromId - Starting area ID
 * @param {string} toId - Destination area ID
 * @returns {{ found: boolean, path: string[], stepCount: number, error?: string }}
 */
export function findShortestPath(P, fromId, toId) {
  if (!P || !P.areas || !P.areas.length) {
    return { found: false, path: [], stepCount: 0, error: 'No areas in project' };
  }
  const byId = new Map(P.areas.map((a) => [a.id, a]));
  if (!byId.has(fromId) || !byId.has(toId)) {
    return { found: false, path: [], stepCount: 0, error: 'Start or target area not found' };
  }
  if (fromId === toId) {
    return { found: true, path: [fromId], stepCount: 0 };
  }

  const queue = [fromId];
  const parent = new Map([[fromId, null]]);
  let found = false;

  while (queue.length > 0) {
    const currId = queue.shift();
    const currArea = byId.get(currId);
    if (!currArea) continue;

    // Do not traverse through intermediate private or lobby areas
    if ((currArea.private_area || currArea.lobby_area) && currId !== fromId && currId !== toId) {
      continue;
    }

    const exits = walkableExits(P, currArea);
    for (const nextId of exits) {
      if (!parent.has(nextId)) {
        parent.set(nextId, currId);
        if (nextId === toId) {
          found = true;
          break;
        }
        queue.push(nextId);
      }
    }
    if (found) break;
  }

  if (!found) {
    return { found: false, path: [], stepCount: 0 };
  }

  // Reconstruct path
  const path = [];
  let step = toId;
  while (step !== null) {
    path.unshift(step);
    step = parent.get(step);
  }
  return { found: true, path, stepCount: path.length - 1 };
}

/**
 * Audits the map network for connectivity patterns and potential oversights:
 * - Disconnected: Areas with 0 incoming and 0 outgoing connections (completely isolated nodes)
 * - Dead Ends: Areas that can be entered, but have 0 outgoing exits (players cannot leave).
 *              Areas with <ALL> mode are strictly excluded because they can exit everywhere.
 * - One-Way Trips: Areas that can be entered, but have no path back to the Hub or any <ALL> area.
 * - No Incoming: Areas with 0 incoming links (only accessible via menu teleport or <ALL>).
 * @param {object} P - The project object
 * @returns {{ hub: object|null, disconnected: object[], deadEnds: object[], oneWayTrips: object[], noIncoming: object[], islands: object[] }}
 */
export function auditMap(P) {
  if (!P || !P.areas || !P.areas.length) {
    return { hub: null, disconnected: [], deadEnds: [], oneWayTrips: [], noIncoming: [], islands: [] };
  }

  const hub = P.areas[0];
  const byId = new Map(P.areas.map((a) => [a.id, a]));
  const isAllMode = (a) => a?.links?.reachable?.mode === 'all';
  const validIds = new Set(P.areas.map((x) => x.id));

  const outgoing = new Map();
  const incoming = new Map();

  P.areas.forEach((a) => {
    const L = a.links?.reachable;
    const exits = [];
    if (L && L.mode === 'list') {
      for (const t of L.targets || []) {
        if (t !== a.id && validIds.has(t)) exits.push(t);
      }
    }
    outgoing.set(a.id, exits);
    if (!incoming.has(a.id)) incoming.set(a.id, []);
    exits.forEach((t) => {
      if (!incoming.has(t)) incoming.set(t, []);
      incoming.get(t).push(a.id);
    });
  });

  const allModeIds = new Set(P.areas.filter(isAllMode).map((a) => a.id));

  // 1. Completely Disconnected: 0 outgoing, 0 incoming, NOT <ALL>
  const disconnected = P.areas.filter((a) => {
    if (isAllMode(a)) return false;
    const outs = outgoing.get(a.id) || [];
    const ins = incoming.get(a.id) || [];
    return outs.length === 0 && ins.length === 0;
  });

  // 2. True Dead Ends: 0 outgoing exits, BUT has incoming, NOT <ALL>
  const deadEnds = P.areas.filter((a) => {
    if (isAllMode(a)) return false;
    const outs = outgoing.get(a.id) || [];
    const ins = incoming.get(a.id) || [];
    return outs.length === 0 && ins.length > 0;
  });

  // 3. One-Way Trips: Can enter, has exits, but can NEVER reach Hub or any <ALL> area
  const canReachSafety = (startId) => {
    if (startId === hub.id || allModeIds.has(startId)) return true;
    const visited = new Set([startId]);
    const q = [startId];
    while (q.length > 0) {
      const curr = q.shift();
      for (const nxt of outgoing.get(curr) || []) {
        if (nxt === hub.id || allModeIds.has(nxt)) return true;
        if (!visited.has(nxt)) {
          visited.add(nxt);
          q.push(nxt);
        }
      }
    }
    return false;
  };

  const oneWayTrips = P.areas.filter((a) => {
    if (isAllMode(a) || a.id === hub.id) return false;
    const outs = outgoing.get(a.id) || [];
    const ins = incoming.get(a.id) || [];
    // Must have outgoing exits (otherwise it's classified under dead ends)
    if (outs.length === 0) return false;
    // Must have incoming connections (people can enter it)
    if (ins.length === 0) return false;
    return !canReachSafety(a.id);
  });

  // 4. No Incoming Connections: has exits, but 0 incoming links from other rooms
  const noIncoming = P.areas.filter((a) => {
    if (a.id === hub.id || isAllMode(a)) return false;
    const outs = outgoing.get(a.id) || [];
    const ins = incoming.get(a.id) || [];
    return ins.length === 0 && outs.length > 0;
  });

  return {
    hub,
    disconnected,
    deadEnds,
    oneWayTrips,
    noIncoming,
    islands: [...disconnected, ...noIncoming],
  };
}
