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

/**
 * Computes an SVG path `d` attribute based on the chosen line style:
 * - 'curved': Smooth cubic bezier curve
 * - 'orthogonal': Stepped 90° blueprint/circuit lines
 * - 'straight': Direct linear connection
 */
export function edgePath(pts, style = 'curved') {
  const { x1, y1, x2, y2 } = pts;
  if (style === 'straight') {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (style === 'orthogonal') {
    if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }
    if (Math.abs(dx) >= Math.abs(dy) * 0.8) {
      const midX = x1 + dx / 2;
      return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
    } else {
      const midY = y1 + dy / 2;
      return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
    }
  }

  // Default: 'curved'
  const dist = Math.hypot(dx, dy);
  const curvature = Math.min(Math.max(dist * 0.35, 24), 160);
  if (Math.abs(dx) >= Math.abs(dy) * 0.7) {
    const cx1 = x1 + (dx >= 0 ? curvature : -curvature);
    const cx2 = x2 - (dx >= 0 ? curvature : -curvature);
    return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
  } else {
    const cy1 = y1 + (dy >= 0 ? curvature : -curvature);
    const cy2 = y2 - (dy >= 0 ? curvature : -curvature);
    return `M ${x1} ${y1} C ${x1} ${cy1}, ${x2} ${cy2}, ${x2} ${y2}`;
  }
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

/**
 * Calculates world-coordinate bounding box for the visible camera viewport with padding.
 * @param {{x: number, y: number, k: number}} view
 * @param {{w: number, h: number}} wrapBounds
 * @param {number} [buffer]
 * @returns {{minX: number, maxX: number, minY: number, maxY: number}|null}
 */
export function getViewportBox(view, wrapBounds, buffer = 280) {
  if (!view || !wrapBounds || !wrapBounds.w || !wrapBounds.h) return null;
  const k = Math.max(0.01, view.k || 1);
  const pad = Math.max(buffer, (buffer * 0.9) / k);
  return {
    minX: -view.x / k - pad,
    maxX: (wrapBounds.w - view.x) / k + pad,
    minY: -view.y / k - pad,
    maxY: (wrapBounds.h - view.y) / k + pad,
  };
}

/**
 * Checks whether an axis-aligned bounding box between node A and node B intersects the viewport box.
 * @param {{x: number, y: number}} A
 * @param {{x: number, y: number}} B
 * @param {{minX: number, maxX: number, minY: number, maxY: number}|null} box
 * @returns {boolean}
 */
export function isEdgeInViewport(A, B, box) {
  if (!box || !A || !B) return true;
  const minX = A.x < B.x ? A.x : B.x;
  const maxX = (A.x > B.x ? A.x : B.x) + NODE_W;
  if (maxX < box.minX || minX > box.maxX) return false;

  const minY = A.y < B.y ? A.y : B.y;
  const maxY = (A.y > B.y ? A.y : B.y) + NODE_H;
  if (maxY < box.minY || minY > box.maxY) return false;

  return true;
}

/**
 * Checks whether node A intersects the viewport box.
 * @param {{x: number, y: number}} A
 * @param {{minX: number, maxX: number, minY: number, maxY: number}|null} box
 * @returns {boolean}
 */
export function isNodeInViewport(A, box) {
  if (!box || !A) return true;
  if (A.x + NODE_W < box.minX || A.x > box.maxX) return false;
  if (A.y + NODE_H < box.minY || A.y > box.maxY) return false;
  return true;
}
