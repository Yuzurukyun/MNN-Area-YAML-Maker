// Deterministic auto-arrange layout for the connection map.

import { NODE_W, NODE_H } from './fields.js';

export function autoArrange(P, opts = {}) {
  const areas = P.areas;
  const n = areas.length;
  if (!n) return;
  const hub = areas[0];
  const spacing = typeof opts === 'number' ? opts : opts.spacing != null ? opts.spacing : 1.0;
  const sortInsideGroup = !!opts.sortInsideGroup;
  const arrangeGroupsOnly = !!opts.arrangeGroupsOnly;
  const COL = NODE_W + Math.round(96 * spacing);
  const ROW = NODE_H + Math.round(76 * spacing);

  // 1. Identify groups and their member areas BEFORE moving anything
  const groups = Array.isArray(P.groups) ? P.groups : [];
  const groupMembersMap = new Map();
  const groupedAreaIds = new Set();
  const groupStartPos = new Map();

  groups.forEach((g) => {
    groupStartPos.set(g.id, { x: g.x, y: g.y, w: g.w || 340, h: g.h || 220 });
    const mems = areas.filter((a) => {
      const cx = a.x + NODE_W / 2;
      const cy = a.y + NODE_H / 2;
      return cx >= g.x && cx <= g.x + g.w && cy >= g.y && cy <= g.y + g.h;
    });
    // Keep members in stable project order
    mems.sort((p, q) => areas.indexOf(p) - areas.indexOf(q));
    groupMembersMap.set(g.id, mems);
    mems.forEach((a) => groupedAreaIds.add(a.id));
  });

  const hubInGroup = groupedAreaIds.has(hub.id);
  const X0 = hubInGroup ? 60 : 40 + COL + Math.round(70 * spacing);
  const MAXW = 2000;
  const TOP = 48;
  let cx = X0;
  let cy = TOP;
  let shelfH = 0;

  // 2. If groups exist, arrange each group and its member areas first
  if (groups.length > 0) {
    groups.forEach((g) => {
      const mems = groupMembersMap.get(g.id) || [];
      const oldPos = groupStartPos.get(g.id);

      let gw = g.w || 340;
      let gh = g.h || 220;

      let cols = 1;
      let innerGapX = Math.round(36 * spacing);
      let innerGapY = Math.round(28 * spacing);
      const padLeft = 28;
      const padTop = 44; // 24px header tab + padding
      const padRight = 28;
      const padBottom = 28;

      if (sortInsideGroup && mems.length) {
        cols = mems.length <= 3 ? Math.max(1, mems.length) : mems.length === 4 ? 2 : Math.min(4, Math.ceil(Math.sqrt(mems.length)));
        const rows = Math.ceil(mems.length / cols);
        gw = Math.max(340, padLeft + padRight + cols * NODE_W + (cols - 1) * innerGapX);
        gh = Math.max(220, padTop + padBottom + rows * NODE_H + (rows - 1) * innerGapY);
      }

      if (cx > X0 && cx + gw > X0 + MAXW) {
        cx = X0;
        cy += shelfH + Math.round(70 * spacing);
        shelfH = 0;
      }

      const newGx = Math.round(cx);
      const newGy = Math.round(cy);
      const dx = newGx - oldPos.x;
      const dy = newGy - oldPos.y;

      g.x = newGx;
      g.y = newGy;
      g.w = Math.round(gw);
      g.h = Math.round(gh);

      // Reposition rider images inside this group
      if (Array.isArray(P.images)) {
        P.images.forEach((im) => {
          const icx = im.x + im.w / 2;
          const icy = im.y + im.h / 2;
          if (icx >= oldPos.x && icx <= oldPos.x + oldPos.w && icy >= oldPos.y && icy <= oldPos.y + oldPos.h) {
            im.x += dx;
            im.y += dy;
          }
        });
      }

      // Position member areas inside the group box
      if (mems.length) {
        if (sortInsideGroup) {
          // Grid-sort inside group
          mems.forEach((a, i) => {
            const c = i % cols;
            const r = Math.floor(i / cols);
            a.x = Math.round(g.x + padLeft + c * (NODE_W + innerGapX));
            a.y = Math.round(g.y + padTop + r * (NODE_H + innerGapY));
          });
        } else {
          // Preserve custom internal layout & shape: shift members by group delta (dx, dy)
          mems.forEach((a) => {
            a.x = Math.round(a.x + dx);
            a.y = Math.round(a.y + dy);
          });
        }
      }

      shelfH = Math.max(shelfH, gh);
      cx += gw + Math.round(80 * spacing);
    });

    // Advance Y coordinate past all groups
    cy += shelfH + Math.round(80 * spacing);
    cx = X0;
    shelfH = 0;
  }

  // 3. Arrange ungrouped areas using connected-cluster algorithm
  if (!arrangeGroupsOnly) {
    const ungrouped = areas.slice(1).filter((a) => !groupedAreaIds.has(a.id));
    if (ungrouped.length > 0) {
      const ungroupedSet = new Set(ungrouped.map((a) => a.id));
      const adj = new Map(ungrouped.map((a) => [a.id, new Set()]));
      ungrouped.forEach((a) => {
        const L = a.links.reachable;
        if (L.mode !== 'list') return;
        L.targets.forEach((t) => {
          if (t === a.id || t === hub.id || !ungroupedSet.has(t)) return;
          adj.get(a.id).add(t);
          adj.get(t).add(a.id);
        });
      });

      const seen = new Set();
      const clusters = [];
      const specials = [];
      ungrouped.forEach((a) => {
        if (seen.has(a.id)) return;
        const comp = [];
        const stack = [a.id];
        seen.add(a.id);
        while (stack.length) {
          const id = stack.pop();
          comp.push(ungrouped.find((x) => x.id === id));
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
        grid(specials, X0, clusters.length ? clustersBottom + 130 : cy, Math.min(8, specials.length));
      }
      shelfH = Math.max(shelfH, specials.length ? Math.ceil(specials.length / 8) * ROW + 130 : 0);
    }
  }

  // 4. Position Hub on the left ONLY if it is not inside any group
  if (!hubInGroup && !arrangeGroupsOnly) {
    hub.x = 40;
    const totalContentBottom = cy + shelfH;
    hub.y = totalContentBottom > TOP + ROW
      ? Math.round(TOP + (totalContentBottom - TOP - ROW) / 2)
      : TOP;
  }
}
