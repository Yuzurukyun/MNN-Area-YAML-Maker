<script>
  // Connection map coordinator: camera (pan/zoom/fit/recenter), pointer gestures,
  // right-click menus, inline rename, saved layouts, and corkboard images.
  import { onMount, onDestroy } from 'svelte';
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
    cameraCommand,
    settings,
    graphView,
  } from '../../lib/state.js';
  import * as M from '../../lib/core.js';
  import { clamp } from '../../lib/util.js';
  import { pairCardPos } from '../../lib/graphGeom.js';
  import GraphHud from './GraphHud.svelte';
  import EdgeLayer from './EdgeLayer.svelte';
  import NodeLayer from './NodeLayer.svelte';
  import TagLayer from './TagLayer.svelte';
  import DirectionCard from './DirectionCard.svelte';
  import GroupLayer from './GroupLayer.svelte';
  import ImageLayer from './ImageLayer.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import RenameOverlay from './RenameOverlay.svelte';
  import NodeHoverCard from './NodeHoverCard.svelte';
  import Minimap from './Minimap.svelte';
  import RouteBar from './RouteBar.svelte';
  import AuditModal from '../modals/AuditModal.svelte';
  import ConfirmModal from '../modals/ConfirmModal.svelte';

  const COLOR_PALETTE = [
    ['#ef4444', 'Red'],
    ['#f97316', 'Orange'],
    ['#f59e0b', 'Amber'],
    ['#10b981', 'Green'],
    ['#06b6d4', 'Teal'],
    ['#3b82f6', 'Blue'],
    ['#8b5cf6', 'Purple'],
    ['#ec4899', 'Pink'],
    ['#64748b', 'Slate'],
  ];

  const NW = M.NODE_W;
  const NH = M.NODE_H;

  let sortConfirmOpen = false;
  let auditModalOpen = false;
  let routeActive = false;
  let routeFromId = null;
  let routeToId = null;
  let activeRoutePath = [];

  $: activeRouteEdgeSet = (() => {
    if (!routeActive || !activeRoutePath || activeRoutePath.length < 2) return null;
    const s = new Set();
    for (let i = 0; i < activeRoutePath.length - 1; i++) {
      const u = activeRoutePath[i];
      const v = activeRoutePath[i + 1];
      s.add(u + '->' + v);
      s.add(v + '->' + u);
    }
    return s;
  })();

  let svgElRef;
  let wrapEl;
  $: wrapBounds = wrapEl
    ? { w: wrapEl.clientWidth || 800, h: wrapEl.clientHeight || 600 }
    : { w: 800, h: 600 };
  let view = { x: 30, y: 20, k: 1 };
  let drag = null;
  let tempTo = null;
  let band = null;
  let popPos = { left: 0, top: 0 };
  let selectionGrouped = false;
  $: hideHub = $graphView.hideHub;
  $: hideAll = $graphView.hideAll;
  $: showAllMesh = $graphView.showAllMesh;
  $: panTool = $graphView.panTool;
  let spaceHeld = false;
  let menu = null;
  let editing = null;
  let imageFile;
  let imageAt = null;
  let nodeImageFile;
  let nodeImageTarget = null;
  let hoveredArea = null;
  let hoverPos = { left: 0, top: 0 };
  let hoverTimer = null;

  $: routeActive = $graphView.routeActive;

  $: P = $state.project;
  $: lt = $state.activeLink;
  $: areaMap = new Map(P.areas.map((a) => [a.id, a]));
  $: byId = (id) => areaMap.get(id);

  let pairs = [];
  let lastP = null;
  let lastLt = null;

  $: if (P !== lastP || lt !== lastLt) {
    if (!drag || (drag.kind !== 'node' && drag.kind !== 'group' && drag.kind !== 'image')) {
      pairs = M.pairEdges(P, lt);
      lastP = P;
      lastLt = lt;
    }
  }
  $: hubId = P.areas.length ? P.areas[0].id : null;
  $: isolateActive = Boolean(
    $state.isolateSelection && ($state.selectedId || ($state.selectedIds && $state.selectedIds.size > 0))
  );
  $: focusIds = isolateActive
    ? M.neighbourhoodIds(P, $state.selectedIds && $state.selectedIds.size ? [...$state.selectedIds] : [$state.selectedId], lt)
    : ($state.focusViewIds || null);
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
    const A = byId(se.x);
    const B = byId(se.y);
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

  $: visibleEdgePairs = showAllMesh
    ? displayPairs
    : displayPairs.filter(
        (p) => !p.allOnly || (inFocus && ($state.selectedId === p.x || $state.selectedId === p.y))
      );

  $: activeTagPairs = $state.selectedId
    ? displayPairs.filter(
        (p) =>
          (p.x === $state.selectedId || p.y === $state.selectedId) &&
          !p.derived &&
          !p.ghost &&
          (!p.allOnly || showAllMesh || inFocus)
      )
    : [];

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
    $settings.showAllPill && shownAllAreas.length && !hideAll
      ? {
          x: Math.max(...P.areas.map((a) => a.x)) + NW + 90,
          y: P.areas.reduce((sum, a) => sum + a.y, 0) / P.areas.length,
        }
      : null;
  $: dups = M.dupNames(P);

  $: if (selPair) {
    const bounds = wrapEl ? { w: wrapEl.clientWidth, h: wrapEl.clientHeight } : null;
    popPos = pairCardPos(byId, selPair, view, bounds);
  }

  function toggleFocus(e) {
    const on = e.target.checked;
    update((s) => {
      s.isolateSelection = on;
      if (!on) s.focusViewIds = null;
    }, { skipHistory: true });
    notify(on ? 'Isolate selection enabled.' : 'Isolate selection disabled.', 'info');
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
      if (routeActive) { routeActive = false; activeRoutePath = []; return; }
      if ($state.selectedEdge) { update((s) => (s.selectedEdge = null), { skipHistory: true }); return; }
      if (inFocus || $state.focusViewIds || $state.isolateSelection) {
        update((s) => exitFocusView(s), { skipHistory: true });
        return;
      }
    } else if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey && !editing) {
      e.preventDefault();
      updateSettings((s) => (s.showMinimap = !s.showMinimap));
      notify($settings.showMinimap ? 'Minimap radar enabled.' : 'Minimap radar hidden.', 'info');
    } else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      fitView();
    } else if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      centerOnSelectedSmooth();
    } else if (e.key === 'Home' || ((e.key === '0' || e.code === 'Numpad0') && !e.ctrlKey && !e.metaKey && !e.altKey)) {
      e.preventDefault();
      resetCameraSmooth();
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

  /* ================= camera animation & helpers ================= */
  let animFrameId = null;

  function cancelCameraAnim() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  onDestroy(() => {
    cancelCameraAnim();
    if (dragRafId) {
      cancelAnimationFrame(dragRafId);
      dragRafId = null;
    }
  });

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function animateViewTo(targetX, targetY, targetK, duration = 320) {
    cancelCameraAnim();
    if (!wrapEl) return;
    const startX = view.x;
    const startY = view.y;
    const startK = view.k;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dk = targetK - startK;

    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(dk) < 0.005) {
      view = { x: targetX, y: targetY, k: targetK };
      return;
    }

    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = easeInOutCubic(progress);

      view = {
        x: startX + dx * ease,
        y: startY + dy * ease,
        k: startK + dk * ease,
      };

      if (progress < 1) {
        animFrameId = requestAnimationFrame(step);
      } else {
        animFrameId = null;
      }
    }

    animFrameId = requestAnimationFrame(step);
  }

  function zoomBy(factor) {
    if (!wrapEl) return;
    const cx = wrapEl.clientWidth / 2;
    const cy = wrapEl.clientHeight / 2;
    const before = { x: (cx - view.x) / view.k, y: (cy - view.y) / view.k };
    const k = clamp(view.k * factor, 0.08, 4.0);
    animateViewTo(cx - before.x * k, cy - before.y * k, k, 180);
  }

  function zoomReset() {
    if (!wrapEl) return;
    const cx = wrapEl.clientWidth / 2;
    const cy = wrapEl.clientHeight / 2;
    const before = { x: (cx - view.x) / view.k, y: (cy - view.y) / view.k };
    animateViewTo(cx - before.x, cy - before.y, 1, 260);
  }

  function resetCameraSmooth() {
    if (!wrapEl) return;
    animateViewTo(30, 20, 1, 320);
  }

  function centerOnNode(id, smooth = true) {
    if (!wrapEl) return;
    const targetId = id || $state.selectedId || (P.areas[0] ? P.areas[0].id : null);
    if (!targetId) {
      notify('No area to center on.', 'info');
      return;
    }
    const a = byId(targetId);
    if (!a) return;
    const cx = a.x + NW / 2;
    const cy = a.y + NH / 2;
    const vw = wrapEl.clientWidth;
    const vh = wrapEl.clientHeight;
    const targetX = vw / 2 - cx * view.k;
    const targetY = vh / 2 - cy * view.k;

    if (smooth) {
      animateViewTo(targetX, targetY, view.k, 300);
    } else {
      cancelCameraAnim();
      view = { ...view, x: targetX, y: targetY };
    }
  }

  function centerOnSelectedSmooth() {
    if (!$state.selectedId) {
      if (P.areas.length) {
        update((s) => selectOnly(s, P.areas[0].id), { skipHistory: true });
        centerOnNode(P.areas[0].id, true);
      } else {
        notify('Select an area first to center on it.', 'info');
      }
      return;
    }
    centerOnNode($state.selectedId, true);
  }

  function panToWorld(worldX, worldY, instant = false) {
    if (!wrapEl) return;
    const vw = wrapEl.clientWidth || 800;
    const vh = wrapEl.clientHeight || 600;
    const targetX = vw / 2 - worldX * view.k;
    const targetY = vh / 2 - worldY * view.k;
    if (instant) {
      cancelCameraAnim();
      view = { ...view, x: targetX, y: targetY };
    } else {
      animateViewTo(targetX, targetY, view.k, 260);
    }
  }

  function fitView(smooth = true) {
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
    const k = clamp(Math.min(vw / bw, vh / bh), 0.08, 2.0);
    const targetX = (vw - bw * k) / 2 - minX * k;
    const targetY = (vh - bh * k) / 2 - minY * k;
    if (smooth) {
      animateViewTo(targetX, targetY, k, 340);
    } else {
      cancelCameraAnim();
      view = { k, x: targetX, y: targetY };
    }
  }

  function frameRouteAreas(areaIds) {
    if (!wrapEl || !areaIds || !areaIds.length) return;
    const areasInRoute = areaIds.map(byId).filter(Boolean);
    if (!areasInRoute.length) return;
    const minX = Math.min(...areasInRoute.map((a) => a.x)) - 60;
    const minY = Math.min(...areasInRoute.map((a) => a.y)) - 60;
    const maxX = Math.max(...areasInRoute.map((a) => a.x + NW)) + 60;
    const maxY = Math.max(...areasInRoute.map((a) => a.y + NH)) + 60;
    const bw = Math.max(100, maxX - minX);
    const bh = Math.max(100, maxY - minY);
    const vw = wrapEl.clientWidth;
    const vh = wrapEl.clientHeight;
    const k = clamp(Math.min((vw - 80) / bw, (vh - 80) / bh), 0.15, 1.8);
    const targetX = (vw - bw * k) / 2 - minX * k;
    const targetY = (vh - bh * k) / 2 - minY * k;
    animateViewTo(targetX, targetY, k, 320);
  }

  let lastCmdTs = 0;
  $: if ($cameraCommand && $cameraCommand.ts !== lastCmdTs) {
    lastCmdTs = $cameraCommand.ts;
    if ($cameraCommand.type === 'center') {
      centerOnNode($cameraCommand.id, true);
    } else if ($cameraCommand.type === 'reset') {
      resetCameraSmooth();
    } else if ($cameraCommand.type === 'fit') {
      fitView(true);
    }
  }

  onMount(() => {
    window.addEventListener('export-graph-screenshot', exportMapVisual);
    return () => {
      window.removeEventListener('export-graph-screenshot', exportMapVisual);
    };
  });

  function exportMapVisual() {
    if (!svgElRef || !P.areas.length) {
      notify('No map content to export.', 'info');
      return;
    }

    const visibleAreas = P.areas.filter((a) => !hiddenIds.has(a.id) && (!inFocus || focusIds.has(a.id)));
    if (!visibleAreas.length) {
      notify('No visible areas to capture.', 'info');
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    visibleAreas.forEach((a) => {
      minX = Math.min(minX, a.x);
      minY = Math.min(minY, a.y);
      maxX = Math.max(maxX, a.x + NW);
      maxY = Math.max(maxY, a.y + NH);
    });

    (P.groups || []).forEach((g) => {
      const hasMember = visibleAreas.some((a) => a.x >= g.x && a.x <= g.x + g.w && a.y >= g.y && a.y <= g.y + g.h);
      if (hasMember) {
        minX = Math.min(minX, g.x);
        minY = Math.min(minY, g.y);
        maxX = Math.max(maxX, g.x + g.w);
        maxY = Math.max(maxY, g.y + g.h);
      }
    });

    (P.images || []).forEach((im) => {
      minX = Math.min(minX, im.x);
      minY = Math.min(minY, im.y);
      maxX = Math.max(maxX, im.x + im.w);
      maxY = Math.max(maxY, im.y + im.h);
    });

    const pad = 64;
    const cropX = Math.round(minX - pad);
    const cropY = Math.round(minY - pad);
    const cropW = Math.max(300, Math.round(maxX - minX + pad * 2));
    const cropH = Math.max(200, Math.round(maxY - minY + pad * 2));

    const clone = svgElRef.cloneNode(true);
    clone.setAttribute('width', cropW);
    clone.setAttribute('height', cropH);
    clone.setAttribute('viewBox', `0 0 ${cropW} ${cropH}`);

    const worldGroup = clone.querySelector('g[transform]');
    if (worldGroup) {
      worldGroup.setAttribute('transform', `translate(${-cropX}, ${-cropY})`);
    }

    clone.querySelectorAll('.node-port, .band-select, .temp-edge, .group-resize, .img-hdl, .title-hitbox').forEach((el) => el.remove());

    const compRoot = window.getComputedStyle(document.documentElement);
    const compBody = window.getComputedStyle(document.body);
    const themeBg = compBody.backgroundColor || compRoot.getPropertyValue('--bg').trim() || '#0d0d12';

    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', themeBg);
    clone.insertBefore(bgRect, clone.firstChild);

    let cssText = '';
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          cssText += rule.cssText + '\n';
        }
      } catch (_) {}
    }

    const varList = [
      '--bg', '--panel', '--panel2', '--node-bg', '--node-border', '--text',
      '--text-strong', '--dim', '--line', '--line2', '--accent', '--accent2',
      '--edge-both', '--edge-oneway', '--edge-oneway-in', '--edge-sel',
      '--group-fill', '--group-stroke', '--font-mono', '--radius', '--danger', '--ok'
    ];
    let resolvedVars = ':root, svg {\n';
    varList.forEach((v) => {
      const val = compRoot.getPropertyValue(v).trim();
      if (val) resolvedVars += `  ${v}: ${val};\n`;
    });
    resolvedVars += '}\n';

    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = resolvedVars + '\n' + cssText;
    clone.insertBefore(styleEl, clone.firstChild);

    const svgStr = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(svgBlob);

    const fallbackDownloadSvg = () => {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'MNN-Area-Map.svg';
      a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      notify('Exported map visual to MNN-Area-Map.svg', 'ok');
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = cropW * scale;
        canvas.height = cropH * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(blobUrl);

        canvas.toBlob((blob) => {
          if (blob) {
            const pngUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = 'MNN-Area-Map.png';
            a.click();
            setTimeout(() => URL.revokeObjectURL(pngUrl), 1500);
            notify(`Exported map screenshot (${cropW}×${cropH} px) to MNN-Area-Map.png`, 'ok');
          } else {
            fallbackDownloadSvg();
          }
        }, 'image/png');
      } catch (_) {
        fallbackDownloadSvg();
      }
    };
    img.onerror = () => {
      fallbackDownloadSvg();
    };
    img.src = blobUrl;
  }

  /* ================= shared area actions ================= */
  function addAreaAt(w) {
    update((s) => {
      const a = M.addArea(s.project, {
        templateId: s.newAreaTemplate || null,
        bgPrefix: s.activeBgPrefix || null,
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

  function pickNodeImage(a) {
    nodeImageTarget = a.id;
    if (nodeImageFile) nodeImageFile.click();
  }

  function onNodeImageFile(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f || !nodeImageTarget) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 512;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > max || h > max) {
          if (w > h) { h = Math.round((h * max) / w); w = max; }
          else { w = Math.round((w * max) / h); h = max; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL(f.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88);
        update((s) => {
          const target = s.project.areas.find((x) => x.id === nodeImageTarget);
          if (target) target.image = dataUrl;
        });
        notify('Attached node icon.', 'ok');
        nodeImageTarget = null;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  }

  function handleNodeEnter(e, a) {
    if (drag || menu) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (drag || menu || !wrapEl) return;
      const nx = a.x * view.k + view.x;
      const ny = a.y * view.k + view.y;
      const nw = NW * view.k;
      const vw = wrapEl.clientWidth;
      const vh = wrapEl.clientHeight;
      const cardW = 265;
      let left = nx + nw + 12;
      if (left + cardW > vw) {
        left = nx - cardW - 12;
      }
      if (left < 10) {
        left = Math.max(10, Math.min(vw - cardW - 10, nx));
      }
      let top = Math.max(10, Math.min(vh - 290, ny));
      hoverPos = { left: Math.round(left), top: Math.round(top) };
      hoveredArea = a;
    }, 150);
  }

  function handleNodeLeave(e, a) {
    clearTimeout(hoverTimer);
    hoveredArea = null;
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
  $: dotStep = Math.max(16, 64 * view.k);
  $: gridStyle = `background-size:${dotStep.toFixed(2)}px ${dotStep.toFixed(2)}px;background-position:${view.x.toFixed(2)}px ${view.y.toFixed(2)}px;`;

  /* ================= right-click menus ================= */
  function openMenu(e, items) {
    e.preventDefault();
    e.stopPropagation();
    const p = toWrap(e);
    const estH = items.reduce((acc, it) => acc + (it.type === 'zone' ? 150 : it.type === 'swatches' ? 56 : 32), 30);
    const maxX = wrapEl ? Math.max(10, wrapEl.clientWidth - 270) : p.x;
    const maxY = wrapEl ? Math.max(10, wrapEl.clientHeight - estH) : p.y;
    menu = { x: clamp(p.x, 8, maxX), y: clamp(p.y, 8, maxY), items };
  }

  function onCanvasMenu(e) {
    const w = toWorld(e);
    openMenu(e, [
      { label: 'Add area here', run: () => addAreaAt(w) },
      { label: 'Add group here', run: () => addGroupAt(w) },
      { label: 'Add image…', run: () => pickImageAt(w) },
      { label: 'Center on selected (C)', run: centerOnSelectedSmooth },
      { label: 'Reset view (Home / 0)', run: resetCameraSmooth },
      { label: 'Fit all in view (F)', run: fitView },
      { label: 'Auto-arrange map', run: arrange },
    ]);
  }

  function onNodeMenu(e, a) {
    update((s) => {
      if (!s.selectedIds || !s.selectedIds.has(a.id)) {
        selectOnly(s, a.id);
      }
    }, { skipHistory: true });
    const count = $state.selectedIds && $state.selectedIds.has(a.id) ? $state.selectedIds.size : 1;
    openMenu(e, [
      {
        type: 'swatches',
        label: count > 1 ? `Node colour (${count} selected)` : 'Node colour',
        current: a.color || '',
        colors: COLOR_PALETTE,
        onSelect: (c) => {
          update((s) => {
            const targetIds = s.selectedIds && s.selectedIds.has(a.id) && s.selectedIds.size > 1
              ? s.selectedIds
              : new Set([a.id]);
            s.project.areas.forEach((ar) => {
              if (targetIds.has(ar.id)) ar.color = c;
            });
          });
          notify(c ? `Changed colour for ${count} area${count > 1 ? 's' : ''}.` : `Reset colour for ${count} area${count > 1 ? 's' : ''}.`, 'ok');
        },
      },
      { label: 'Center camera here (C)', run: () => centerOnNode(a.id, true) },
      {
        label: 'Find route from here…',
        run: () => {
          routeFromId = a.id;
          routeActive = true;
          notify(`Route Finder: start set to "${a.area}".`, 'info');
        },
      },
      {
        label: 'Find route to here…',
        run: () => {
          routeToId = a.id;
          routeActive = true;
          notify(`Route Finder: destination set to "${a.area}".`, 'info');
        },
      },
      { label: 'Attach node image…', run: () => pickNodeImage(a) },
      ...(a.image ? [{ label: 'Remove node image', run: () => update((s) => { const x = s.project.areas.find(ar => ar.id === a.id); if (x) x.image = ''; notify('Removed node image.', 'info'); }) }] : []),
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
    const members = M.groupMembers(P, g);
    const indices = members
      .map((a) => P.areas.indexOf(a))
      .filter((idx) => idx >= 0)
      .sort((a, b) => a - b);

    const hasAreas = indices.length > 0;
    let isRange = false;
    let val1 = '';
    let val2 = '';

    if (hasAreas) {
      const min = indices[0];
      const max = indices[indices.length - 1];
      isRange = indices.length === (max - min + 1) && indices.every((val, i) => val === min + i);

      if (isRange) {
        val1 = `${min}, ${max}`;
        val2 = `/zone ${min}, ${max}`;
      } else {
        val1 = indices.join(', ');
        val2 = `/zone ${indices.join(', ')}`;
        notify(
          `Area IDs in "${g.name}" are not consecutive (${indices.join(', ')}). Run "Sort IDs" in the toolbar to turn them into a clean range.`,
          'warn',
          6000
        );
      }
    }

    openMenu(e, [
      {
        type: 'zone',
        group: g,
        hasAreas,
        isRange,
        count: indices.length,
        val1,
        val2,
        onSortIds: () => (sortConfirmOpen = true),
      },
      {
        type: 'swatches',
        label: 'Group colour',
        current: g.color || '',
        colors: COLOR_PALETTE,
        onSelect: (c) => {
          update((s) => {
            const gr = s.project.groups.find((x) => x.id === g.id);
            if (gr) gr.color = c;
          });
          notify(c ? 'Changed group colour.' : 'Reset group colour.', 'ok');
        },
      },
      { label: 'Rename group', run: () => startRename('group', g) },
      ...(hasAreas
        ? [
            {
              label: `Select all areas in zone (${indices.length})`,
              run: () => {
                selection.set(new Set(members.map((m) => m.id)));
                selected.set(members[0].id);
                notify(`Selected ${indices.length} areas in "${g.name}".`, 'ok');
              },
            },
            {
              label: `Copy Zone YAML (${indices.length} areas)`,
              run: async () => {
                const zoneYaml = M.exportYaml({ areas: members, groups: [] });
                const ok = await copyText(zoneYaml);
                if (ok) {
                  notify(`Copied YAML snippet for "${g.name}" (${indices.length} areas).`, 'ok');
                } else {
                  notify('Failed to copy to clipboard.', 'error');
                }
              },
            },
          ]
        : []),
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
    cancelCameraAnim();
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
    cancelCameraAnim();
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
          if (e.ctrlKey || e.metaKey) s.selectedIds = new Set([...s.selectedIds, a.id]);
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
    cancelCameraAnim();
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
    cancelCameraAnim();
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
    cancelCameraAnim();
    if (e.button === 1 || (e.button === 0 && (panTool || spaceHeld))) {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    if (e.target === svgElRef || e.target === wrapEl) {
      update((s) => (s.selectedEdge = null), { skipHistory: true });
      const w = toWorld(e);
      drag = { kind: 'band', startW: w, curW: w };
      band = { x: w.x, y: w.y, w: 0, h: 0 };
      attachWindowDrag();
    }
  }

  let dragRafId = null;
  let pendingDragEvent = null;

  function flushPendingDrag() {
    if (dragRafId) {
      cancelAnimationFrame(dragRafId);
      dragRafId = null;
    }
    if (pendingDragEvent && drag) {
      applyDragMove(pendingDragEvent);
      pendingDragEvent = null;
    }
  }

  function applyDragMove(e) {
    if (!drag) return;
    const w = toWorld(e);
    if (drag.kind === 'node') {
      const dx = w.x - drag.startW.x;
      const dy = w.y - drag.startW.y;
      update((s) => {
        const nodeMap = new Map(s.project.areas.map((x) => [x.id, x]));
        Object.entries(drag.starts).forEach(([id, st]) => {
          const n = nodeMap.get(id);
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
          const nodeMap = new Map(s.project.areas.map((x) => [x.id, x]));
          Object.entries(drag.starts).forEach(([id, st]) => {
            const n = nodeMap.get(id);
            if (n) {
              n.x = Math.round(st.x + dx);
              n.y = Math.round(st.y + dy);
            }
          });
          const imgMap = new Map((s.project.images || []).map((x) => [x.id, x]));
          Object.entries(drag.imgStarts || {}).forEach(([id, st]) => {
            const im = imgMap.get(id);
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
    }
  }

  function onMove(e) {
    if (!drag) return;
    if (drag.kind === 'pan') {
      const s = uiScale.value;
      view = { ...view, x: drag.vx + (e.clientX - drag.sx) / s, y: drag.vy + (e.clientY - drag.sy) / s };
      return;
    }
    if (drag.kind === 'band') {
      const w = toWorld(e);
      drag.curW = w;
      band = {
        x: Math.min(w.x, drag.startW.x),
        y: Math.min(w.y, drag.startW.y),
        w: Math.abs(w.x - drag.startW.x),
        h: Math.abs(w.y - drag.startW.y),
      };
      return;
    }
    if (drag.kind === 'maybeConnect') {
      const w = toWorld(e);
      if (Math.hypot(w.x - drag.startW.x, w.y - drag.startW.y) > 6) {
        drag = { kind: 'connect', id: drag.id };
        tempTo = w;
      }
      return;
    }
    if (drag.kind === 'connect') {
      tempTo = toWorld(e);
      return;
    }

    pendingDragEvent = e;
    if (!dragRafId) {
      dragRafId = requestAnimationFrame(() => {
        dragRafId = null;
        if (pendingDragEvent && drag) {
          const ev = pendingDragEvent;
          pendingDragEvent = null;
          applyDragMove(ev);
        }
      });
    }
  }

  function onUp(e) {
    detachWindowDrag();
    flushPendingDrag();
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
      } else if ($state.selectedId || $state.selectedIds.size || $state.selectedEdge || $state.focusViewIds) {
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
    cancelCameraAnim();
    e.preventDefault();
    const r = svgElRef.getBoundingClientRect();
    const mx = (e.clientX - r.left) / uiScale.value;
    const my = (e.clientY - r.top) / uiScale.value;
    const before = { x: (mx - view.x) / view.k, y: (my - view.y) / view.k };
    const k = clamp(view.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.08, 4.0);
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
    update((s) =>
      M.autoArrange(s.project, {
        spacing: $settings.arrangeSeparation,
        sortInsideGroup: $settings.sortInsideGroup,
        arrangeGroupsOnly: $settings.arrangeGroupsOnly,
      })
    );
    if ($settings.arrangeFitView) {
      fitView();
    }
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

<svelte:window on:keydown={onWinKey} on:keyup={onWinKeyUp} on:pointerdown={onWinDown} />

<div id="graphWrap" class:pan-mode={panTool || spaceHeld} style={gridStyle} bind:this={wrapEl}>
  {#if routeActive}
    <RouteBar
      project={P}
      bind:fromId={routeFromId}
      bind:toId={routeToId}
      on:routeChange={(e) => { activeRoutePath = e.detail.path || []; }}
      on:close={() => { routeActive = false; activeRoutePath = []; }}
      onStepClick={(id) => centerOnNode(id, true)}
      onFrameRoute={frameRouteAreas}
    />
  {/if}

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
      <marker id="arrowRoute" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#10b981"></path>
      </marker>
    </defs>

    <g transform="translate({view.x},{view.y}) scale({view.k})">
      <GroupLayer
        groups={P.groups}
        areas={P.areas}
        {onGroupDown}
        {onGroupMenu}
        onGroupDblClick={(e, g) => { e.stopPropagation(); startRename('group', g); }}
      />
      <ImageLayer images={P.images} {onImageDown} {onImageMenu} />
      <EdgeLayer
        pairs={visibleEdgePairs}
        {byId}
        selectedId={$state.selectedId}
        selectedIds={$state.selectedIds}
        selectedEdge={$state.selectedEdge}
        {focusOn}
        allAreas={shownAllAreas}
        {pill}
        {inFocus}
        {focusIds}
        {showAllMesh}
        {drag}
        {tempTo}
        {band}
        onPickEdge={pickEdge}
        edgeStyle={$settings.edgeStyle || 'curved'}
        routeEdgeSet={activeRouteEdgeSet}
        {view}
        {wrapBounds}
        hideLinesUnlessFocused={$settings.hideLinesUnlessFocused}
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
        onNodeDblClick={(e, a) => { e.stopPropagation(); centerOnNode(a.id, true); }}
        onTitleDblClick={(e, a) => { e.stopPropagation(); startRename('area', a); }}
        onNodeEnter={handleNodeEnter}
        onNodeLeave={handleNodeLeave}
        {view}
        {wrapBounds}
      />
      <TagLayer pairs={activeTagPairs} {byId} selectedId={$state.selectedId} {showAllMesh} {inFocus} />
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

  {#if hoveredArea && !drag && !menu}
    <NodeHoverCard
      area={hoveredArea}
      idx={P.areas.indexOf(hoveredArea)}
      pos={hoverPos}
      {dups}
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

  <Minimap
    areas={P.areas}
    groups={P.groups}
    {view}
    bounds={wrapBounds}
    onPanTo={panToWorld}
  />

  <GraphHud
    zoom={view.k}
    onZoomIn={() => zoomBy(1.18)}
    onZoomOut={() => zoomBy(1 / 1.18)}
    onZoomReset={zoomReset}
    onFit={fitView}
  />

  <input type="file" accept="image/*" hidden bind:this={imageFile} on:change={onImageFile} />
  <input type="file" accept="image/*" hidden bind:this={nodeImageFile} on:change={onNodeImageFile} />

  {#if sortConfirmOpen}
    <ConfirmModal
      title="Reorder Area IDs by Groups?"
      body={`This will reorder the area list in your project so that areas enclosed in each spatial board group are assigned consecutive ID numbers (e.g. #1–#5 for Group 1, #6–#10 for Group 2).

• Area 0 (Hub) remains at ID 0.
• Areas outside of groups will follow afterwards.
• Any afk_sendto targets are automatically remapped to their new positions.
• All connection lines and links are preserved.`}
      confirmLabel="Reorder Area IDs"
      onConfirm={() => {
        sortConfirmOpen = false;
        sortByGroup();
      }}
      onCancel={() => (sortConfirmOpen = false)}
    />
  {/if}

  {#if auditModalOpen}
    <AuditModal
      project={P}
      on:close={() => (auditModalOpen = false)}
      onFocusArea={(id) => {
        update((s) => selectOnly(s, id), { skipHistory: true });
        centerOnNode(id, true);
      }}
    />
  {/if}
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
