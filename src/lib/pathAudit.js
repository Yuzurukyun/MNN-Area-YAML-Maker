// Smart pathfinding & map audit for TsuMNN / MNN area networks.
// Uses effectiveIds(P, a, 'reachable') to respect modes (list, ALL, none).

import { effectiveIds } from './links.js';

/**
 * Finds the shortest walkable path between two areas using Breadth-First Search (BFS).
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

    const exits = effectiveIds(P, currArea, 'reachable');
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
 * Audits the map network for connectivity issues:
 * - Islands: Areas completely unreachable from the Hub (Area 0)
 * - Dead Ends: Areas with 0 exits (nowhere to go)
 * - One-Way Traps: Areas reachable from the Hub that have NO path back to the Hub
 * @param {object} P - The project object
 * @returns {{ islands: object[], deadEnds: object[], oneWayTraps: object[], hub: object|null }}
 */
export function auditMap(P) {
  if (!P || !P.areas || !P.areas.length) {
    return { islands: [], deadEnds: [], oneWayTraps: [], hub: null };
  }

  const hub = P.areas[0];
  const byId = new Map(P.areas.map((a) => [a.id, a]));
  const outgoing = new Map();
  const incoming = new Map();

  P.areas.forEach((a) => {
    const exits = effectiveIds(P, a, 'reachable');
    outgoing.set(a.id, exits);
    if (!incoming.has(a.id)) incoming.set(a.id, []);
    exits.forEach((targetId) => {
      if (!incoming.has(targetId)) incoming.set(targetId, []);
      incoming.get(targetId).push(a.id);
    });
  });

  // 1. Forward reachability from Hub (find islands)
  const reachableFromHub = new Set([hub.id]);
  const fwdQueue = [hub.id];
  while (fwdQueue.length > 0) {
    const curr = fwdQueue.shift();
    for (const nxt of outgoing.get(curr) || []) {
      if (!reachableFromHub.has(nxt)) {
        reachableFromHub.add(nxt);
        fwdQueue.push(nxt);
      }
    }
  }

  const islands = P.areas.filter((a) => a.id !== hub.id && !reachableFromHub.has(a.id));

  // 2. Dead ends: Areas with 0 outgoing exits
  const deadEnds = P.areas.filter((a) => (outgoing.get(a.id) || []).length === 0);

  // 3. Backward reachability to Hub (find one-way traps)
  // An area is a trap if you can walk there from Hub, but can NEVER walk back to Hub
  const canReachHub = new Set([hub.id]);
  const revQueue = [hub.id];
  while (revQueue.length > 0) {
    const curr = revQueue.shift();
    for (const prev of incoming.get(curr) || []) {
      if (!canReachHub.has(prev)) {
        canReachHub.add(prev);
        revQueue.push(prev);
      }
    }
  }

  const oneWayTraps = P.areas.filter(
    (a) => a.id !== hub.id && reachableFromHub.has(a.id) && !canReachHub.has(a.id)
  );

  return {
    hub,
    islands,
    deadEnds,
    oneWayTraps,
  };
}
