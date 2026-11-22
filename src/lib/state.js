// Central app store: project persistence, undo/redo snapshots & transactions,
// theme preference (Dark Terminal / Warm Light), focus view state, and
// toast notifications / file & clipboard helpers.

import { writable } from 'svelte/store';
import * as M from './core.js';
import { bgStore } from './bgStore.js';

const LS_KEY = 'areaMakerDemo';
const THEME_KEY = 'areamaker-theme';

function loadProject() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.areas) && p.areas.length) {
        p.areas.forEach(M.normaliseArea);
        const ensured = M.ensureProject(p);
        ensured.backgrounds = bgStore.get().backgrounds;
        return ensured;
      }
    }
  } catch {
    /* fall back to sample project */
  }
  const p = M.sampleProject();
  M.autoArrange(p);
  const ensured = M.ensureProject(p);
  ensured.backgrounds = bgStore.get().backgrounds;
  return ensured;
}

function save(p) {
  try {
    if (p) {
      p.backgrounds = bgStore.get().backgrounds;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked */
  }
}

const project = loadProject();
save(project);

export const state = writable({
  project,
  selectedId: project.areas[0].id,
  selectedIds: new Set([project.areas[0].id]),
  activeLink: 'reachable',
  selectedEdge: null,
  focusViewIds: null,
  fieldFilter: 'all',
  focus: true,
  isolateSelection: false,
  query: '',
  newAreaTemplate: 'builtin-yuzu',
  activeBgPrefix: '',
});

/* ================= theme preference ================= */
function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* ignore */
  }
  return 'dark';
}

function applyThemeToDom(mode) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = mode;
  }
}

const initialTheme = loadTheme();
applyThemeToDom(initialTheme);

export const theme = writable(initialTheme);
export function setTheme(mode) {
  const next = mode === 'light' ? 'light' : 'dark';
  applyThemeToDom(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
  }
  theme.set(next);
}

/* ================= editor & canvas settings ================= */
const SETTINGS_KEY = 'areamaker-settings';
export const DEFAULT_SETTINGS = {
  arrangeSeparation: 1.0,  // multiplier, default 1.0
  edgeThickness: 1.6,      // px, default 1.6
  edgeGlow: 0,             // px, default 0
  edgeStyle: 'curved',     // 'curved' | 'orthogonal' | 'straight'
  showMinimap: true,       // bool, default true
  showAllPill: false,      // bool, default false (floating <ALL> target pill on canvas)
  sortInsideGroup: false,  // bool, default false (preserves custom internal group layout & shape)
  arrangeFitView: true,    // bool, default true (auto-fits camera after arrange)
  arrangeGroupsOnly: false,// bool, default false (only move groups, leaving loose areas untouched)
  autoscrollLongLabels: false, // bool, default false ("autoscroll long labels when not focused")
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    /* fallback to default */
  }
  return { ...DEFAULT_SETTINGS };
}

export function applySettingsToDom(cfg) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--edge-thickness', (cfg.edgeThickness || 1.6) + 'px');
    root.style.setProperty('--edge-glow', (cfg.edgeGlow || 0) + 'px');
  }
}

const initialSettings = loadSettings();
applySettingsToDom(initialSettings);

export const settings = writable(initialSettings);

export function updateSettings(fn) {
  settings.update((curr) => {
    const next = { ...curr };
    fn(next);
    applySettingsToDom(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return next;
  });
}

/* ================= toast notifications ================= */
export const toasts = writable([]);
let toastId = 1;

export function notify(message, kind = 'info', duration = 3400) {
  const id = toastId++;
  toasts.update((list) => [...list.slice(-3), { id, message, kind }]);
  if (duration > 0) {
    setTimeout(() => {
      toasts.update((list) => list.filter((t) => t.id !== id));
    }, duration);
  }
  return id;
}

export function dismissToast(id) {
  toasts.update((list) => list.filter((t) => t.id !== id));
}

export const uiScale = { value: 1 };

/* ================= mutations + undo / redo ================= */
const HISTORY_CAP = 80;
let undoStack = [];
let redoStack = [];
let txnSnapshot = null;
export const historyState = writable({ canUndo: false, canRedo: false });

function syncHistory() {
  historyState.set({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
}

function pushUndo(snapshot) {
  undoStack.push(snapshot);
  if (undoStack.length > HISTORY_CAP) undoStack.shift();
  redoStack = [];
  syncHistory();
}

export function update(fn, opts) {
  state.update((s) => {
    if (txnSnapshot !== null) {
      fn(s);
      s.project = { ...s.project };
      return { ...s };
    }
    const before = JSON.stringify(s.project);
    fn(s);
    if (JSON.stringify(s.project) !== before && (!opts || !opts.skipHistory)) {
      pushUndo(before);
    }
    save(s.project);
    s.project = { ...s.project };
    return { ...s };
  });
}

export function beginTransaction() {
  if (txnSnapshot !== null) return;
  state.update((s) => {
    txnSnapshot = JSON.stringify(s.project);
    return s;
  });
}

export function commitTransaction() {
  if (txnSnapshot === null) return;
  const snap = txnSnapshot;
  txnSnapshot = null;
  state.update((s) => {
    if (JSON.stringify(s.project) !== snap) pushUndo(snap);
    save(s.project);
    return s;
  });
}

export function clearHistory() {
  undoStack = [];
  redoStack = [];
  txnSnapshot = null;
  syncHistory();
}

function pruneViewState(s) {
  M.ensureProject(s.project);
  const ids = new Set(s.project.areas.map((a) => a.id));
  if (s.selectedId && !ids.has(s.selectedId)) s.selectedId = s.project.areas[0].id;
  s.selectedIds = new Set([...s.selectedIds].filter((id) => ids.has(id)));
  if (s.selectedId && !s.selectedIds.size) s.selectedIds.add(s.selectedId);
  s.selectedEdge = null;
  s.focusViewIds = null;
}

export function undo() {
  if (!undoStack.length) return;
  state.update((s) => {
    redoStack.push(JSON.stringify(s.project));
    s.project = JSON.parse(undoStack.pop());
    pruneViewState(s);
    save(s.project);
    return { ...s };
  });
  syncHistory();
}

export function redo() {
  if (!redoStack.length) return;
  state.update((s) => {
    undoStack.push(JSON.stringify(s.project));
    s.project = JSON.parse(redoStack.pop());
    pruneViewState(s);
    save(s.project);
    return { ...s };
  });
  syncHistory();
}

export function selectOnly(s, id) {
  s.selectedId = id;
  s.selectedIds = new Set([id]);
  s.selectedEdge = null;
}

export function clearSelection(s) {
  s.selectedId = null;
  s.selectedIds = new Set();
  s.selectedEdge = null;
  s.focusViewIds = null;
}

export function enterFocusView(s) {
  s.isolateSelection = true;
  const seeds = s.selectedIds.size ? [...s.selectedIds] : s.selectedId ? [s.selectedId] : [];
  if (!seeds.length) {
    s.focusViewIds = null;
    return false;
  }
  s.focusViewIds = M.neighbourhoodIds(s.project, seeds, s.activeLink);
  return true;
}

export function refocusView(s) {
  if (!s.isolateSelection && !s.focusViewIds) return;
  const seeds = s.selectedIds.size ? [...s.selectedIds] : s.selectedId ? [s.selectedId] : [];
  if (!seeds.length) {
    s.focusViewIds = null;
    return;
  }
  s.focusViewIds = M.neighbourhoodIds(s.project, seeds, s.activeLink);
}

export function exitFocusView(s) {
  s.isolateSelection = false;
  s.focusViewIds = null;
}

/* ================= graph view & layout controls ================= */
export const graphView = writable({
  hideHub: false,
  hideAll: false,
  showAllMesh: false,
  panTool: false,
  routeActive: false,
  auditModalOpen: false,
});

export function saveLayout(name) {
  let finalName = '';
  update((s) => {
    finalName = M.strip(name) || 'Layout ' + ((s.project.layouts?.length || 0) + 1);
    if (!Array.isArray(s.project.layouts)) s.project.layouts = [];
    s.project.layouts.push({
      id: M.uid(),
      name: finalName,
      positions: Object.fromEntries(s.project.areas.map((a) => [a.id, [a.x, a.y]])),
      groups: JSON.parse(JSON.stringify(s.project.groups || [])),
      images: JSON.parse(JSON.stringify(s.project.images || [])),
    });
  });
  notify(`Saved layout "${finalName}".`, 'ok');
}

export function applyLayout(l) {
  if (!l || !l.positions) return;
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

export function deleteLayout(id) {
  update((s) => {
    if (Array.isArray(s.project.layouts)) {
      s.project.layouts = s.project.layouts.filter((l) => l.id !== id);
    }
  });
}

export function sortByGroup() {
  update((s) => M.sortAreasByGroups(s.project));
  notify('Sorted area IDs by board groups.', 'ok');
}

export function duplicateSelectedArea() {
  update((s) => {
    if (!s.selectedId) return;
    const copy = M.duplicateArea(s.project, s.selectedId);
    if (copy) {
      s.selectedId = copy.id;
      s.selectedIds = new Set([copy.id]);
      s.selectedEdge = null;
    }
  });
}

export function deleteSelectedArea() {
  update((s) => {
    if (!s.selectedId) return;
    const id = s.selectedId;
    if (s.project.areas[0] && s.project.areas[0].id === id) {
      notify('Area 0 is the hub — it cannot be deleted.', 'warn');
      return;
    }
    M.deleteArea(s.project, id);
    s.selectedIds.delete(id);
    if (s.selectedId === id || !s.project.areas.some((x) => x.id === s.selectedId)) {
      s.selectedId = s.project.areas[0].id;
    }
    if (!s.selectedIds.size) s.selectedIds.add(s.selectedId);
    s.selectedEdge = null;
  });
}

/* ================= camera command bus ================= */
export const cameraCommand = writable(null);

export function centerCameraOn(nodeId) {
  cameraCommand.set({ type: 'center', id: nodeId, ts: Date.now() });
}

export function resetCamera() {
  cameraCommand.set({ type: 'reset', ts: Date.now() });
}

export function fitCamera() {
  cameraCommand.set({ type: 'fit', ts: Date.now() });
}

export function download(name, text, type) {
  const blob = new Blob([text], { type: type || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Clipboard copy that also works on `file://` origins where navigator.clipboard may reject.
export async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to legacy textarea fallback */
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}
