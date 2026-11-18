// Deterministic auto-arrange layout for the connection map.

import { NODE_W, NODE_H } from './fields.js';

export function autoArrange(P, opts = {}) {
  const areas = P.areas;
  const n = areas.length;
  if (!n) return;
  const hub = areas[0];
  const spacing = typeof opts === 'number' ? opts : opts.spacing != null ? opts.spacing : 1.0;
  const COL = NODE_W + Math.round(96 * spacing);
  const ROW = NODE_H + Math.round(76 * spacing);

  const adj = new Map(areas.map((a) => [a.id, new Set()]));
  areas.forEach((a) => {
    if (a.id === hub.id) return;
    const L = a.links.reachable;
    if (L.mode !== 'list') return;
    L.targets.forEach((t) => {
      if (t === a.id || t === hub.id || !adj.has(t)) return;
      adj.get(a.id).add(t);
      adj.get(t).add(a.id);
    });
  });

  const seen = new Set();
  const clusters = [];
  const specials = [];
  areas.slice(1).forEach((a) => {
    if (seen.has(a.id)) return;
    const comp = [];
    const stack = [a.id];
    seen.add(a.id);
    while (stack.length) {
      const id = stack.pop();
      comp.push(areas.find((x) => x.id === id));
      adj.get(id).forEach((m) => {
        if (!seen.has(m)) {
          seen.add(m);
          stack.push(m);
        }
      });
    }
    comp.sort((p, q) => areas.indexOf(p) - areas.indexOf(q));
    if (comp.length > 1) clusters.push(comp);
    else specials.push(comp[0]);
  });

  clusters.sort((c, d) => d.length - c.length || areas.indexOf(c[0]) - areas.indexOf(d[0]));
  specials.sort((p, q) => areas.indexOf(p) - areas.indexOf(q));

  const grid = (group, x0, y0, cols) => {
    group.forEach((a, i) => {
      a.x = Math.round(x0 + (i % cols) * COL);
      a.y = Math.round(y0 + Math.floor(i / cols) * ROW);
    });
    return Math.ceil(group.length / cols) * ROW;
  };

  // Aspect-aware radial layout:
  // Nodes are wide rectangles (204 x 70), so rings use a gentle horizontal ellipse
  // (rx = 1.18 * R, ry = 0.92 * R) and stagger odd rings by half a step so
  // outer-ring nodes sit cleanly between inner-ring spokes.
  const radial = (comp) => {
    const byDeg = [...comp].sort(
      (p, q) => adj.get(q.id).size - adj.get(p.id).size || areas.indexOf(p) - areas.indexOf(q),
    );
    const centre = byDeg[0];
    const order = [centre];
    const vis = new Set([centre.id]);
    const queue = [centre.id];
    while (queue.length) {
      const id = queue.shift();
      const nbrs = [...adj.get(id)].sort((u, v) => adj.get(v).size - adj.get(u).size);
      nbrs.forEach((m) => {
        if (vis.has(m)) return;
        vis.add(m);
        order.push(comp.find((x) => x.id === m));
        queue.push(m);
      });
    }
    comp.forEach((a) => {
      if (!vis.has(a.id)) order.push(a);
    });

    const pos = new Map([[centre.id, { dx: 0, dy: 0 }]]);
    let idx = 1;
    let ring = 1;
    let maxRx = 0;
    let maxRy = 0;
    while (idx < order.length) {
      const cap = 6 * ring;
      const inRing = order.slice(idx, idx + cap);
      const R = Math.max(Math.round(305 * ring * spacing), Math.ceil((inRing.length * (NODE_W + Math.round(104 * spacing))) / (2 * Math.PI)));
      const rx = Math.round(R * 1.16);
      const ry = Math.round(R * 0.92);
      maxRx = Math.max(maxRx, rx);
      maxRy = Math.max(maxRy, ry);
      const stepDeg = 360 / inRing.length;
      const offsetDeg = ring % 2 === 0 ? stepDeg / 2 : 0;
      inRing.forEach((a, i) => {
        const ang = ((-90 + i * stepDeg + offsetDeg) * Math.PI) / 180;
        pos.set(a.id, { dx: Math.cos(ang) * rx, dy: Math.sin(ang) * ry });
      });
      idx += inRing.length;
      ring++;
    }
    return {
      pos,
      halfW: maxRx + NODE_W / 2 + Math.round(64 * spacing),
      halfH: maxRy + NODE_H / 2 + Math.round(56 * spacing),
    };
  };

  const X0 = 40 + COL + Math.round(70 * spacing);
  const MAXW = 1900;
  const TOP = 48;
  let cx = X0;
  let cy = TOP;
  let shelfH = 0;

  clusters.forEach((comp) => {
    const { pos, halfW, halfH } = radial(comp);
    const w = halfW * 2;
    const h = halfH * 2;
    if (cx > X0 && cx + w > X0 + MAXW) {
      cx = X0;
      cy += shelfH + 170;
      shelfH = 0;
    }
    const ccx = cx + halfW;
    const ccy = cy + halfH;
    comp.forEach((a) => {
      const p = pos.get(a.id);
      a.x = Math.round(ccx + p.dx - NODE_W / 2);
      a.y = Math.round(ccy + p.dy - NODE_H / 2);
    });
    shelfH = Math.max(shelfH, h);
    cx += w + 190;
  });

  const clustersBottom = cy + shelfH;
  if (specials.length) {
    grid(specials, X0, clusters.length ? clustersBottom + 130 : TOP, Math.min(8, specials.length));
  }
  hub.x = 40;
  hub.y = clusters.length ? Math.round(TOP + Math.max(0, (clustersBottom - TOP - ROW) / 2)) : TOP;
}
