// Pure geometry for the connection map: node centres, rectangle-border
// intersection for edges (so arrowheads never hide underneath node cards),
// direction card anchor points, and viewport clamping.

import { NODE_W, NODE_H } from './fields.js';
import { clamp } from './util.js';

export const centreOf = (a) => ({ x: a.x + NODE_W / 2, y: a.y + NODE_H / 2 });

// Compute the boundary intersection point along the ray from `from` centre
// toward `to` centre, stopping `pad` px outside the box boundary.
function boxEdgePoint(boxCenter, targetCenter, pad = 0) {
  const dx = targetCenter.x - boxCenter.x;
  const dy = targetCenter.y - boxCenter.y;
  if (dx === 0 && dy === 0) return boxCenter;
  const hw = NODE_W / 2 + pad;
  const hh = NODE_H / 2 + pad;
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: boxCenter.x + dx * s, y: boxCenter.y + dy * s };
}

// Compute edge endpoints clipped cleanly to node boundaries so directional
// arrowheads are 100% visible outside the target node.
export function edgeEndpoints(fromNode, toNode) {
  const c1 = centreOf(fromNode);
  const c2 = centreOf(toNode);
  const dist = Math.hypot(c2.x - c1.x, c2.y - c1.y);
  if (dist < 4) return { x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y };
  const p1 = boxEdgePoint(c1, c2, 1);
  const p2 = boxEdgePoint(c2, c1, 4);
  // If nodes overlap so closely that the clipped segment flips backwards, fall back to centres
  if ((p2.x - p1.x) * (c2.x - c1.x) + (p2.y - p1.y) * (c2.y - c1.y) <= 0) {
    return { x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y };
  }
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

export function edgeMidpoint(A, B) {
  const { x1, y1, x2, y2 } = edgeEndpoints(A, B);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

export function pairCardPos(byId, pair, view, bounds) {
  const A = byId(pair.x);
  const B = byId(pair.y);
  if (!A || !B) return { left: 0, top: 0 };
  const ca = centreOf(A);
  const cb = centreOf(B);
  let left = ((ca.x + cb.x) / 2) * view.k + view.x;
  let top = ((ca.y + cb.y) / 2) * view.k + view.y;
  if (bounds) {
    left = clamp(left, 145, Math.max(155, bounds.w - 145));
    top = clamp(top, 20, Math.max(40, bounds.h - 170));
  }
  return { left, top };
}
