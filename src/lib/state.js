// Central app store: project persistence, undo/redo snapshots & transactions,
// theme preference (Dark Terminal / Warm Light), focus view state, and
// toast notifications / file & clipboard helpers.

import { writable } from 'svelte/store';
import * as M from './core.js';

const LS_KEY = 'areaMakerDemo';
const THEME_KEY = 'areamaker-theme';

function loadProject() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.areas) && p.areas.length) {
        p.areas.forEach(M.normaliseArea);
        return M.ensureProject(p);
      }
    }
  } catch {
    /* fall back to sample project */
  }
  const p = M.sampleProject();
  M.autoArrange(p);
  return M.ensureProject(p);
}

function save(p) {
  try {
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
  query: '',
  newAreaTemplate: 'builtin-yuzu',
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
}

export function enterFocusView(s) {
  const seeds = s.selectedIds.size ? [...s.selectedIds] : s.selectedId ? [s.selectedId] : [];
  if (!seeds.length) {
    s.focusViewIds = null;
    return false;
  }
  s.focusViewIds = M.neighbourhoodIds(s.project, seeds, s.activeLink);
  return true;
}

export function refocusView(s) {
  if (!s.focusViewIds) return;
  const seeds = s.selectedIds.size ? [...s.selectedIds] : s.selectedId ? [s.selectedId] : [];
  if (!seeds.length) return;
  s.focusViewIds = M.neighbourhoodIds(s.project, seeds, s.activeLink);
}

export function exitFocusView(s) {
  s.focusViewIds = null;
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
