<script>
  // Connection map coordinator: camera (pan/zoom/fit), pointer gestures,
  // right-click menus, inline rename, saved layouts, and corkboard images.
  import {
    state,
    update,
    selectOnly,
    clearSelection,
    uiScale,
    enterFocusView,
    exitFocusView,
    refocusView,
    beginTransaction,
    commitTransaction,
    notify,
  } from '../../lib/state.js';
  import * as M from '../../lib/core.js';
  import { clamp } from '../../lib/util.js';
  import { pairCardPos } from '../../lib/graphGeom.js';
  import GraphToolbar from './GraphToolbar.svelte';
  import GraphHud from './GraphHud.svelte';
  import EdgeLayer from './EdgeLayer.svelte';
  import NodeLayer from './NodeLayer.svelte';
  import TagLayer from './TagLayer.svelte';
  import DirectionCard from './DirectionCard.svelte';
  import GroupLayer from './GroupLayer.svelte';
  import ImageLayer from './ImageLayer.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import RenameOverlay from './RenameOverlay.svelte';

  const NW = M.NODE_W;
  const NH = M.NODE_H;

  let svgElRef;
  let wrapEl;
  let view = { x: 30, y: 20, k: 1 };
  let drag = null;
  let tempTo = null;
  let band = null;
  let popPos = { left: 0, top: 0 };
  let selectionGrouped = false;
  let hideHub = false;
  let hideAll = false;
  let showAllMesh = false;
  let panTool = false;
  let spaceHeld = false;
  let menu = null;
  let editing = null;
  let imageFile;
  let imageAt = null;

  $: P = $state.project;
  $: lt = $state.activeLink;
  $: pairs = M.pairEdges(P, lt);
  $: hubId = P.areas.length ? P.areas[0].id : null;
  $: focusIds = $state.focusViewIds;
  $: inFocus = !!focusIds;

  $: hiddenIds = (() => {
    const s = new Set();
    if (hideHub && hubId) s.add(hubId);
    if (hideAll) {
      P.areas.forEach((a, i) => {
        if (i !== 0 && a.links[lt]?.mode === 'all') s.add(a.id);
      });
    }
    return s;
  })();

  $: shownPairs = pairs.filter(
    (p) =>
      !hiddenIds.has(p.x) &&
      !hiddenIds.has(p.y) &&
      (!inFocus || (focusIds.has(p.x) && focusIds.has(p.y))),
  );

  function ghostPair(se, proj) {
    const A = proj.areas.find((a) => a.id === se.x);
    const B = proj.areas.find((a) => a.id === se.y);
    return A && B
      ? { x: se.x, y: se.y, xy: false, yx: false, dxy: false, dyx: false, derived: false, allOnly: false, ghost: true }
      : null;
  }

  $: selPair = $state.selectedEdge
    ? pairs.find((p) => p.x === $state.selectedEdge.x && p.y === $state.selectedEdge.y) ||
      ghostPair($state.selectedEdge, P)
    : null;

  $: displayPairs =
    selPair &&
    selPair.ghost &&
    !hiddenIds.has(selPair.x) &&
    !hiddenIds.has(selPair.y) &&
    (!inFocus || (focusIds.has(selPair.x) && focusIds.has(selPair.y)))
      ? [...shownPairs, selPair]
      : shownPairs;

  $: focusOn = $state.focus && !!$state.selectedId;
  $: neighbours = (() => {
    const s = new Set([$state.selectedId]);
    if (focusOn) {
      pairs.forEach((p) => {
        if (p.x === $state.selectedId) s.add(p.y);
        if (p.y === $state.selectedId) s.add(p.x);
      });
    }
    return s;
  })();

  $: allAreas = P.areas.filter((a) => a.links[lt]?.mode === 'all');
  $: shownAllAreas = allAreas.filter((a) => !hiddenIds.has(a.id));
  $: pill =
    shownAllAreas.length && !hideAll
      ? {
          x: Math.max(...P.areas.map((a) => a.x)) + NW + 90,
          y: P.areas.reduce((sum, a) => sum + a.y, 0) / P.areas.length,
        }
      : null;
  $: dups = M.dupNames(P);
  $: byId = (id) => P.areas.find((a) => a.id === id);

  $: if (selPair) {
    const bounds = wrapEl ? { w: wrapEl.clientWidth, h: wrapEl.clientHeight } : null;
    popPos = pairCardPos(byId, selPair, view, bounds);
  }

  function toggleFocus(e) {
    if (!e.target.checked) {
      update((s) => exitFocusView(s), { skipHistory: true });
      return;
    }
    if (!$state.selectedId && !$state.selectedIds.size) {
      e.target.checked = false;
      notify('Select an area first to isolate its neighbourhood.', 'info');
      return;
    }
    update((s) => enterFocusView(s), { skipHistory: true });
  }

  function isTypingTarget(el) {
    return el && el.closest && el.closest('input, textarea, select, [contenteditable="true"]');
  }

  function onWinKey(e) {
    if (isTypingTarget(e.target)) return;
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      spaceHeld = true;
    } else if (e.key === 'Escape') {
      if (menu) { menu = null; return; }
      if ($state.selectedEdge) { update((s) => (s.selectedEdge = null), { skipHistory: true }); return; }
      if ($state.focusViewIds) update((s) => exitFocusView(s), { skipHistory: true });
    } else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
      fitView();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && !editing) {
      const deletable = [...$state.selectedIds].filter((id) => id !== hubId);
      if (deletable.length) {
        update((s) => {
          deletable.forEach((id) => M.deleteArea(s.project, id));
          selectOnly(s, s.project.areas[0].id);
        });
        notify(`Deleted ${deletable.length} area(s). Ctrl+Z to undo.`, 'info');
      }
    }
  }

  function onWinKeyUp(e) {
    if (e.code === 'Space') spaceHeld = false;
  }

  function onWinDown() {
    if (menu) menu = null;
  }

  function toWorld(e) {
    const r = svgElRef.getBoundingClientRect();
    const s = uiScale.value;
    return {
      x: ((e.clientX - r.left) / s - view.x) / view.k,
      y: ((e.clientY - r.top) / s - view.y) / view.k,
    };
  }

  function toWrap(e) {
    const r = wrapEl.getBoundingClientRect();
    const s = uiScale.value;
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  }

  function nodeAt(w) {
    return P.areas.find(
      (a) => !hiddenIds.has(a.id) && w.x >= a.x && w.x <= a.x + NW && w.y >= a.y && w.y <= a.y + NH,
    );
  }

  /* ================= camera helpers ================= */
  function zoomBy(factor) {
    if (!wrapEl) return;
    const cx = wrapEl.clientWidth / 2;
    const cy = wrapEl.clientHeight / 2;
    const before = { x: (cx - view.x) / view.k, y: (cy - view.y) / view.k };
    const k = clamp(view.k * factor, 0.25, 2.5);
    view = { k, x: cx - before.x * k, y: cy - before.y * k };
  }

  function zoomReset() {
    if (!wrapEl) return;
    const cx = wrapEl.clientWidth / 2;
    const cy = wrapEl.clientHeight / 2;
    const before = { x: (cx - view.x) / view.k, y: (cy - view.y) / view.k };
    view = { k: 1, x: cx - before.x, y: cy - before.y };
  }

  function fitView() {
    if (!wrapEl) return;
    const visible = P.areas.filter((a) => !hiddenIds.has(a.id) && (!inFocus || focusIds.has(a.id)));
    if (!visible.length) return;
    const minX = Math.min(...visible.map((a) => a.x)) - 40;
    const minY = Math.min(...visible.map((a) => a.y)) - 40;
    const maxX = Math.max(...visible.map((a) => a.x + NW)) + 40;
    const maxY = Math.max(...visible.map((a) => a.y + NH)) + 40;
    const bw = Math.max(100, maxX - minX);
    const bh = Math.max(100, maxY - minY);
    const vw = wrapEl.clientWidth;
    const vh = wrapEl.clientHeight;
    const k = clamp(Math.min(vw / bw, vh / bh), 0.25, 1.5);
    view = {
      k,
      x: (vw - bw * k) / 2 - minX * k,
      y: (vh - bh * k) / 2 - minY * k,
    };
  }

  /* ================= shared area actions ================= */
  function addAreaAt(w) {
    update((s) => {
      const a = M.addArea(s.project, {
        templateId: s.newAreaTemplate || null,
        x: Math.round(w.x - NW / 2),
        y: Math.round(w.y - NH / 2),
      });
      selectOnly(s, a.id);
      refocusView(s);
    });
  }

  function deleteAreaFlow(id) {
    if (id === hubId) return;
    update((s) => {
      M.deleteArea(s.project, id);
      s.selectedIds.delete(id);
      if (s.selectedId === id || !s.project.areas.some((x) => x.id === s.selectedId)) {
        s.selectedId = s.project.areas[0].id;
      }
      if (!s.selectedIds.size) s.selectedIds.add(s.selectedId);
      s.selectedEdge = null;
    });
  }

  function duplicateFlow(id) {
    update((s) => {
      const copy = M.duplicateArea(s.project, id);
      if (copy) selectOnly(s, copy.id);
    });
  }

  function addGroupAt(w) {
    update((s) => {
      const n = s.project.groups.length + 1;
      s.project.groups.push({
        id: M.uid(),
        name: 'Group ' + n,
        x: Math.round(w.x - 240),
        y: Math.round(w.y - 165),
        w: 480,
        h: 330,
      });
    });
  }

  function deleteGroup(id) {
    update((s) => {
      s.project.groups = s.project.groups.filter((g) => g.id !== id);
    });
  }

  function pickImageAt(w) {
    imageAt = w;
    if (imageFile) imageFile.click();
  }

  function onImageFile(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f || !imageAt) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const w = 340;
        const h = Math.max(40, Math.round((w * img.naturalHeight) / img.naturalWidth));
        const at = imageAt;
        update((s) => {
          s.project.images.push({
            id: M.uid(),
            name: f.name,
            src: reader.result,
            x: Math.round(at.x),
            y: Math.round(at.y),
            w,
            h,
          });
        });
        imageAt = null;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  }

  function deleteImage(id) {
    update((s) => {
      s.project.images = s.project.images.filter((im) => im.id !== id);
    });
  }

  function saveLayout(name) {
    const finalName = M.strip(name) || 'Layout ' + (P.layouts.length + 1);
    update((s) => {
      s.project.layouts.push({
        id: M.uid(),
        name: finalName,
        positions: Object.fromEntries(s.project.areas.map((a) => [a.id, [a.x, a.y]])),
        groups: JSON.parse(JSON.stringify(s.project.groups)),
        images: JSON.parse(JSON.stringify(s.project.images)),
      });
    });
    notify(`Saved layout "${finalName}".`, 'ok');
  }

  function applyLayout(l) {
    update((s) => {
      s.project.areas.forEach((a) => {
        const pos = l.positions[a.id];
        if (pos) {
          a.x = pos[0];
          a.y = pos[1];
        }
      });
      s.project.groups = JSON.parse(JSON.stringify(l.groups || []));
      s.project.images = JSON.parse(JSON.stringify(l.images || []));
    });
    notify(`Applied layout "${l.name}".`, 'info');
  }

  function deleteLayout(id) {
    update((s) => {
      s.project.layouts = s.project.layouts.filter((l) => l.id !== id);
    });
  }

  function sortByGroup() {
    update((s) => M.sortAreasByGroups(s.project));
    notify('Sorted area IDs by board groups.', 'ok');
  }

  /* ================= inline rename ================= */
  function startRename(kind, target) {
    editing = { kind, id: target.id };
  }

  function commitRename(value) {
    if (!editing) return;
    const ed = editing;
    editing = null;
    const v = M.strip(value);
    if (!v) return;
    update((s) => {
      if (ed.kind === 'area') {
        const a = s.project.areas.find((x) => x.id === ed.id);
        if (a) a.area = v;
      } else {
        const g = s.project.groups.find((x) => x.id === ed.id);
        if (g) g.name = v;
      }
    });
  }

  $: editingTarget = editing
    ? editing.kind === 'area'
      ? byId(editing.id)
      : P.groups.find((g) => g.id === editing.id)
    : null;
  $: renameStyle = editingTarget
    ? `left:${editingTarget.x * view.k + view.x}px;top:${editingTarget.y * view.k + view.y}px;width:${(editing.kind === 'area' ? NW : 220) * view.k}px`
    : '';

  // Spacious, dim world-locked dot grid: scales with zoom (64px at 100%,
  // larger when zoomed in, smaller when zoomed out) and moves with pan.
  $: dotStep = 64 * view.k;
  $: gridStyle = `background-size:${dotStep.toFixed(2)}px ${dotStep.toFixed(2)}px;background-position:${view.x.toFixed(2)}px ${view.y.toFixed(2)}px;`;

  /* ================= right-click menus ================= */
  function openMenu(e, items) {
    e.preventDefault();
    e.stopPropagation();
    const p = toWrap(e);
    const maxX = wrapEl ? Math.max(10, wrapEl.clientWidth - 205) : p.x;
    const maxY = wrapEl ? Math.max(10, wrapEl.clientHeight - items.length * 32 - 20) : p.y;
    menu = { x: clamp(p.x, 8, maxX), y: clamp(p.y, 8, maxY), items };
  }

  function onCanvasMenu(e) {
    const w = toWorld(e);
    openMenu(e, [
      { label: 'Add area here', run: () => addAreaAt(w) },
      { label: 'Add group here', run: () => addGroupAt(w) },
      { label: 'Add image…', run: () => pickImageAt(w) },
      { label: 'Fit all in view', run: fitView },
      { label: 'Auto-arrange map', run: arrange },
    ]);
  }

  function onNodeMenu(e, a) {
    update((s) => selectOnly(s, a.id), { skipHistory: true });
    openMenu(e, [
      { label: 'Rename', run: () => startRename('area', a) },
      { label: 'Duplicate', run: () => duplicateFlow(a.id) },
      { label: 'Isolate neighbourhood', run: () => update((s) => { selectOnly(s, a.id); enterFocusView(s); }, { skipHistory: true }) },
      {
        label: a.id === hubId ? 'Delete (hub — locked)' : 'Delete',
        danger: true,
        disabled: a.id === hubId,
        run: () => deleteAreaFlow(a.id),
      },
    ]);
  }

  function onGroupMenu(e, g) {
    openMenu(e, [
      { label: 'Rename group', run: () => startRename('group', g) },
      { label: 'Delete group', danger: true, run: () => deleteGroup(g.id) },
    ]);
  }

  function onImageMenu(e, im) {
    openMenu(e, [
      {
        label: 'Bring to front',
        run: () =>
          update((s) => {
            const i = s.project.images.findIndex((x) => x.id === im.id);
            if (i >= 0) {
              const [it] = s.project.images.splice(i, 1);
              s.project.images.push(it);
            }
          }),
      },
      { label: 'Delete image', danger: true, run: () => deleteImage(im.id) },
    ]);
  }

  /* ================= pointer gestures ================= */
  function attachWindowDrag() {
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function detachWindowDrag() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }

  function startPan(e) {
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    attachWindowDrag();
  }

  function onPortDown(e, a) {
    if (e.button !== 0) return;
    menu = null;
    drag = { kind: 'connect', id: a.id };
    tempTo = toWorld(e);
    attachWindowDrag();
  }

  function onNodeDown(e, a) {
    if (e.button === 1 || (e.button === 0 && (panTool || spaceHeld))) {
      e.preventDefault();
      e.stopPropagation();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();
    menu = null;
    const w = toWorld(e);
    if (e.shiftKey) {
      drag = { kind: 'maybeConnect', id: a.id, startW: w };
    } else {
      const keepGroup = selectionGrouped && $state.selectedIds.has(a.id);
      update(
        (s) => {
          s.selectedEdge = null;
          if (e.ctrlKey || e.metaKey) s.selectedIds.add(a.id);
          else if (!keepGroup) s.selectedIds = new Set([a.id]);
          s.selectedId = a.id;
          refocusView(s);
        },
        { skipHistory: true },
      );
      selectionGrouped = $state.selectedIds.size > 1 && (keepGroup || e.ctrlKey || e.metaKey);
      const starts = {};
      $state.selectedIds.forEach((id) => {
        const n = byId(id);
        if (n) starts[id] = { x: n.x, y: n.y };
      });
      beginTransaction();
      drag = { kind: 'node', startW: w, starts };
    }
    attachWindowDrag();
  }

  function onGroupDown(e, g, mode) {
    if (e.button === 1 || (e.button === 0 && (panTool || spaceHeld))) {
      e.preventDefault();
      e.stopPropagation();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();
    menu = null;
    const w = toWorld(e);
    const members = mode === 'move' ? M.groupMembers(P, g) : [];
    const riders =
      mode === 'move'
        ? P.images.filter((im) => {
            const cx = im.x + im.w / 2;
            const cy = im.y + im.h / 2;
            return cx >= g.x && cx <= g.x + g.w && cy >= g.y && cy <= g.y + g.h;
          })
        : [];
    beginTransaction();
    drag = {
      kind: 'group',
      id: g.id,
      mode,
      startW: w,
      gStart: { x: g.x, y: g.y, w: g.w, h: g.h },
      starts: Object.fromEntries(members.map((a) => [a.id, { x: a.x, y: a.y }])),
      imgStarts: Object.fromEntries(riders.map((im) => [im.id, { x: im.x, y: im.y }])),
    };
    attachWindowDrag();
  }

  function onImageDown(e, im, mode) {
    if (e.button === 1 || (e.button === 0 && (panTool || spaceHeld))) {
      e.preventDefault();
      e.stopPropagation();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();
    menu = null;
    beginTransaction();
    drag = { kind: 'image', id: im.id, mode, startW: toWorld(e), start: { x: im.x, y: im.y, w: im.w, h: im.h } };
    attachWindowDrag();
  }

  function onSvgDown(e) {
    if (e.button === 1 || (e.button === 0 && (panTool || spaceHeld))) {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    if (e.target === svgElRef) {
      update((s) => (s.selectedEdge = null), { skipHistory: true });
      const w = toWorld(e);
      drag = { kind: 'band', startW: w, curW: w };
      band = { x: w.x, y: w.y, w: 0, h: 0 };
      attachWindowDrag();
    }
  }

  function onMove(e) {
    if (!drag) return;
    const w = toWorld(e);
    if (drag.kind === 'pan') {
      const s = uiScale.value;
      view = { ...view, x: drag.vx + (e.clientX - drag.sx) / s, y: drag.vy + (e.clientY - drag.sy) / s };
    } else if (drag.kind === 'node') {
      const dx = w.x - drag.startW.x;
      const dy = w.y - drag.startW.y;
      update((s) => {
        Object.entries(drag.starts).forEach(([id, st]) => {
          const n = s.project.areas.find((x) => x.id === id);
          if (n) {
            n.x = Math.round(st.x + dx);
            n.y = Math.round(st.y + dy);
          }
        });
      });
    } else if (drag.kind === 'group') {
      const dx = w.x - drag.startW.x;
      const dy = w.y - drag.startW.y;
      update((s) => {
        const g = s.project.groups.find((x) => x.id === drag.id);
        if (!g) return;
        if (drag.mode === 'move') {
          g.x = Math.round(drag.gStart.x + dx);
          g.y = Math.round(drag.gStart.y + dy);
          Object.entries(drag.starts).forEach(([id, st]) => {
            const n = s.project.areas.find((x) => x.id === id);
            if (n) {
              n.x = Math.round(st.x + dx);
              n.y = Math.round(st.y + dy);
            }
          });
          Object.entries(drag.imgStarts || {}).forEach(([id, st]) => {
            const im = s.project.images.find((x) => x.id === id);
            if (im) {
              im.x = Math.round(st.x + dx);
              im.y = Math.round(st.y + dy);
            }
          });
        } else {
          g.w = Math.round(Math.max(240, drag.gStart.w + dx));
          g.h = Math.round(Math.max(160, drag.gStart.h + dy));
        }
      });
    } else if (drag.kind === 'image') {
      const dx = w.x - drag.startW.x;
      const dy = w.y - drag.startW.y;
      update((s) => {
        const im = s.project.images.find((x) => x.id === drag.id);
        if (!im) return;
        if (drag.mode === 'move') {
          im.x = Math.round(drag.start.x + dx);
          im.y = Math.round(drag.start.y + dy);
        } else {
          im.w = Math.round(Math.max(60, drag.start.w + dx));
          im.h = Math.max(24, Math.round(im.w * (drag.start.h / drag.start.w)));
        }
      });
    } else if (drag.kind === 'band') {
      drag.curW = w;
      band = {
        x: Math.min(w.x, drag.startW.x),
        y: Math.min(w.y, drag.startW.y),
        w: Math.abs(w.x - drag.startW.x),
        h: Math.abs(w.y - drag.startW.y),
      };
    } else if (drag.kind === 'maybeConnect') {
      if (Math.hypot(w.x - drag.startW.x, w.y - drag.startW.y) > 6) {
        drag = { kind: 'connect', id: drag.id };
        tempTo = w;
      }
    } else if (drag.kind === 'connect') {
      tempTo = w;
    }
  }

  function onUp(e) {
    detachWindowDrag();
    if (!drag) return;
    const d = drag;
    drag = null;

    if (d.kind === 'maybeConnect') {
      selectionGrouped = false;
      update((s) => selectOnly(s, d.id), { skipHistory: true });
    } else if (d.kind === 'band') {
      const x1 = Math.min(d.startW.x, d.curW.x);
      const x2 = Math.max(d.startW.x, d.curW.x);
      const y1 = Math.min(d.startW.y, d.curW.y);
      const y2 = Math.max(d.startW.y, d.curW.y);
      band = null;
      if (x2 - x1 > 4 || y2 - y1 > 4) {
        update(
          (s) => {
            const inside = s.project.areas.filter(
              (a) => !hiddenIds.has(a.id) && a.x + NW / 2 >= x1 && a.x + NW / 2 <= x2 && a.y + NH / 2 >= y1 && a.y + NH / 2 <= y2,
            );
            if (inside.length) {
              s.selectedIds = new Set(inside.map((a) => a.id));
              s.selectedId = inside[0].id;
              s.selectedEdge = null;
              selectionGrouped = inside.length > 1;
            } else {
              selectionGrouped = false;
              clearSelection(s);
            }
          },
          { skipHistory: true },
        );
      } else if ($state.selectedId || $state.selectedIds.size || $state.selectedEdge) {
        selectionGrouped = false;
        update((s) => clearSelection(s), { skipHistory: true });
      }
    } else if (d.kind === 'connect') {
      const w = toWorld(e);
      const target = nodeAt(w);
      tempTo = null;
      if (target && target.id !== d.id) {
        const srcArea = byId(d.id);
        const srcMode = srcArea?.links[lt]?.mode;
        const dstMode = target.links[lt]?.mode;
        if (srcMode === 'reachable' && dstMode === 'reachable') {
          notify('Both areas follow Reachable here — switch one to List or edit on the Reachable tab.', 'warn');
        } else {
          selectionGrouped = false;
          update((s) => {
            M.setDir(s.project, s.activeLink, { x: d.id, y: target.id }, 'both');
            selectOnly(s, d.id);
          });
        }
      }
    }
    commitTransaction();
  }

  function onWheel(e) {
    e.preventDefault();
    const r = svgElRef.getBoundingClientRect();
    const mx = (e.clientX - r.left) / uiScale.value;
    const my = (e.clientY - r.top) / uiScale.value;
    const before = { x: (mx - view.x) / view.k, y: (my - view.y) / view.k };
    const k = clamp(view.k * (e.deltaY < 0 ? 1.1 : 0.9), 0.25, 2.5);
    view = { k, x: mx - before.x * k, y: my - before.y * k };
  }

  function pickEdge(e, p) {
    if (e.button !== 0) return;
    e.stopPropagation();
    update((s) => (s.selectedEdge = { x: p.x, y: p.y }), { skipHistory: true });
  }

  function toggleSide(fromId, toId, on) {
    update((s) => M.setSide(s.project, s.activeLink, fromId, toId, on));
  }

  function arrange() {
    update((s) => M.autoArrange(s.project));
    fitView();
  }

  function setTab(t) {
    update(
      (s) => {
        s.activeLink = t;
        s.selectedEdge = null;
        if (s.focusViewIds) refocusView(s);
      },
      { skipHistory: true },
    );
  }
</script>

<GraphToolbar
  {lt}
  {hideHub}
  {hideAll}
  {showAllMesh}
  {panTool}
  {inFocus}
  layouts={P.layouts}
  onSetTab={setTab}
  onToggleHideHub={(v) => (hideHub = v)}
  onToggleHideAll={(v) => (hideAll = v)}
  onToggleAllMesh={(v) => (showAllMesh = v)}
  onTogglePanTool={() => (panTool = !panTool)}
  onToggleFocus={toggleFocus}
  onSaveLayout={saveLayout}
  onApplyLayout={applyLayout}
  onDeleteLayout={deleteLayout}
  onSortByGroup={sortByGroup}
  onArrange={arrange}
/>

<svelte:window on:keydown={onWinKey} on:keyup={onWinKeyUp} on:pointerdown={onWinDown} />

<div id="graphWrap" class:pan-mode={panTool || spaceHeld} style={gridStyle} bind:this={wrapEl}>
  {#if inFocus}
    <button class="focus-exit" on:click={() => update((s) => exitFocusView(s), { skipHistory: true })}>
      ✕ Show everything (Esc)
    </button>
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    id="svg"
    bind:this={svgElRef}
    on:mousedown={(e) => { if (e.button === 1) e.preventDefault(); }}
    on:pointerdown={onSvgDown}
    on:wheel={onWheel}
    on:contextmenu={onCanvasMenu}
  >
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="var(--edge-both)"></path>
      </marker>
      <marker id="arrowSel" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="var(--edge-sel)"></path>
      </marker>
      <marker id="arrowRed" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="var(--edge-oneway)"></path>
      </marker>
      <marker id="arrowAmber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="var(--edge-oneway-in)"></path>
      </marker>
    </defs>

    <g transform="translate({view.x},{view.y}) scale({view.k})">
      <GroupLayer
        groups={P.groups}
        {onGroupDown}
        {onGroupMenu}
        onGroupDblClick={(e, g) => { e.stopPropagation(); startRename('group', g); }}
      />
      <ImageLayer images={P.images} {onImageDown} {onImageMenu} />
      <EdgeLayer
        pairs={displayPairs}
        {byId}
        selectedId={$state.selectedId}
        selectedEdge={$state.selectedEdge}
        {focusOn}
        allAreas={shownAllAreas}
        {pill}
        {inFocus}
        {showAllMesh}
        {drag}
        {tempTo}
        {band}
        onPickEdge={pickEdge}
      />
      <NodeLayer
        {P}
        {lt}
        {pill}
        {inFocus}
        {hiddenIds}
        {focusIds}
        selectedId={$state.selectedId}
        selectedIds={$state.selectedIds}
        {dups}
        {neighbours}
        {focusOn}
        {onNodeDown}
        {onPortDown}
        {onNodeMenu}
        onNodeDblClick={(e, a) => { e.stopPropagation(); startRename('area', a); }}
      />
      <TagLayer pairs={displayPairs} {byId} selectedId={$state.selectedId} {showAllMesh} {inFocus} />
    </g>
  </svg>

  {#if selPair}
    <DirectionCard
      pair={selPair}
      {byId}
      {lt}
      pos={popPos}
      onToggle={toggleSide}
      onClose={() => update((s) => (s.selectedEdge = null), { skipHistory: true })}
    />
  {/if}

  {#if menu}
    <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => (menu = null)} />
  {/if}

  {#if editing && editingTarget}
    <RenameOverlay
      value={editing.kind === 'area' ? editingTarget.area : editingTarget.name}
      styleText={renameStyle}
      onCommit={commitRename}
      onCancel={() => (editing = null)}
    />
  {/if}

  <GraphHud
    zoom={view.k}
    onZoomIn={() => zoomBy(1.18)}
    onZoomOut={() => zoomBy(1 / 1.18)}
    onZoomReset={zoomReset}
    onFit={fitView}
  />

  <input type="file" accept="image/*" hidden bind:this={imageFile} on:change={onImageFile} />
</div>

<style>
  #graphWrap {
    position: relative;
  }
  .focus-exit {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 15;
    background: var(--panel2);
    border: 1px solid var(--accent);
    color: var(--accent2);
    border-radius: 999px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
    box-shadow: 0 6px 18px var(--shadow);
  }
  .focus-exit:hover {
    background: var(--sel);
  }
</style>
