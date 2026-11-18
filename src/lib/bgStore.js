// In-memory Asset Repository & Background Library Store
import {
  createBackground,
  createStateVariant,
  createPosition,
  createTimeVariant,
  serializeBackgroundJson,
  parseBackgroundJson,
  normalizeBgPath,
  normalizeAmbiencePath,
  hasTimeVariants,
  resolveActiveVisual,
} from './bgSchema.js';
import { buildZip, readZip, downloadZipBlob } from './zip.js';

function getMimeType(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    case 'avif': return 'image/avif';
    case 'opus': return 'audio/ogg; codecs=opus';
    case 'ogg': return 'audio/ogg';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'm4a': return 'audio/mp4';
    case 'flac': return 'audio/flac';
    case 'json': return 'application/json';
    default: return 'application/octet-stream';
  }
}

const LS_KEY = 'areaMakerDemo';

function loadInitialBackgrounds() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.backgrounds) && p.backgrounds.length > 0) {
          return p.backgrounds.map((b) => createBackground(b.folder, b));
        }
      }
    }
  } catch {
    /* ignore */
  }
  return [
    createBackground('Umamusume/Cafeteria', {
      states: {
        default: {
          background: 'default.webp',
        },
        crowded: {
          background: 'crowded.webp',
        },
        festive: {
          background: 'festive.webp',
        },
      },
    }),
  ];
}

function saveToStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        p.backgrounds = backgrounds;
        localStorage.setItem(LS_KEY, JSON.stringify(p));
      }
    }
  } catch {
    /* ignore */
  }
}

// Reactive store pattern (matching state.js in project)
const listeners = new Set();
function notify() {
  saveToStorage();
  for (const fn of listeners) {
    try { fn(getStoreState()); } catch (e) { console.error(e); }
  }
}

// Initial state
let assetPool = []; // Array<{ id, name, relPath, type: 'image'|'audio', url, file, size }>
let backgrounds = loadInitialBackgrounds();
let selectedBgId = backgrounds[0]?.id || null;
let isMakerOpen = false;

function getStoreState() {
  return {
    assetPool,
    backgrounds,
    selectedBgId,
    isMakerOpen,
    activeBg: backgrounds.find((b) => b.id === selectedBgId) || backgrounds[0] || null,
  };
}

export const bgStore = {
  subscribe(fn) {
    listeners.add(fn);
    fn(getStoreState());
    return () => listeners.delete(fn);
  },
  get() {
    return getStoreState();
  },
  openMaker(bgFolder = null) {
    isMakerOpen = true;
    if (bgFolder) {
      const norm = normalizeBgPath(bgFolder);
      const match = backgrounds.find((b) => b.folder === norm);
      if (match) {
        selectedBgId = match.id;
      } else {
        // Create new with this folder name
        const newBg = createBackground(norm);
        backgrounds.push(newBg);
        selectedBgId = newBg.id;
      }
    }
    notify();
  },
  closeMaker() {
    isMakerOpen = false;
    notify();
  },
  selectBg(id) {
    selectedBgId = id;
    notify();
  },
  addBackground(folder = 'NewBackground') {
    const bg = createBackground(folder);
    backgrounds.push(bg);
    selectedBgId = bg.id;
    notify();
    return bg;
  },
  duplicateBackground(id) {
    const orig = backgrounds.find((b) => b.id === id);
    if (!orig) return;
    const jsonStr = serializeBackgroundJson(orig);
    const copy = parseBackgroundJson(jsonStr, orig.folder + '_copy');
    backgrounds.push(copy);
    selectedBgId = copy.id;
    notify();
  },
  removeBackground(id) {
    if (backgrounds.length <= 1) {
      // Keep at least one empty
      backgrounds = [createBackground('Default')];
      selectedBgId = backgrounds[0].id;
    } else {
      backgrounds = backgrounds.filter((b) => b.id !== id);
      if (selectedBgId === id) {
        selectedBgId = backgrounds[0].id;
      }
    }
    notify();
  },
  updateActiveBg(updater) {
    const idx = backgrounds.findIndex((b) => b.id === selectedBgId);
    if (idx === -1) return;
    backgrounds[idx] = updater({ ...backgrounds[idx] });
    notify();
  },

  // Backgrounds Library Management
  loadBackgrounds(bgList, { replace = false, notifyListeners = true } = {}) {
    if (!bgList) return [];
    const list = Array.isArray(bgList) ? bgList : [bgList];
    if (list.length === 0) return [];

    const processed = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      let bg;
      if (item.states && item.folder) {
        bg = createBackground(item.folder, item);
      } else if (item.states) {
        bg = parseBackgroundJson(item.states, item.folder || 'Imported');
      } else {
        try {
          bg = parseBackgroundJson(item, item.folder || 'Imported');
        } catch {
          continue;
        }
      }
      processed.push(bg);
    }

    if (processed.length === 0) return [];

    if (replace) {
      backgrounds = processed;
      selectedBgId = backgrounds[0]?.id || null;
    } else {
      for (const newBg of processed) {
        const norm = normalizeBgPath(newBg.folder).toLowerCase();
        const existingIdx = backgrounds.findIndex(
          (b) => b.id === newBg.id || normalizeBgPath(b.folder).toLowerCase() === norm
        );
        if (existingIdx !== -1) {
          backgrounds[existingIdx] = newBg;
          selectedBgId = newBg.id;
        } else {
          backgrounds.push(newBg);
          selectedBgId = newBg.id;
        }
      }
    }

    if (notifyListeners) {
      notify();
    }
    return processed;
  },

  exportLibraryJson() {
    return JSON.stringify({
      version: 1,
      type: 'mnn-backgrounds-library',
      backgrounds,
    }, null, 4);
  },

  downloadLibraryJson(filename = 'backgrounds-library.json') {
    const jsonStr = this.exportLibraryJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  },

  async exportAllZip(filename = 'mnn_backgrounds_library.zip') {
    const filesToZip = [];

    // Root library json
    filesToZip.push({
      path: 'backgrounds-library.json',
      data: this.exportLibraryJson(),
    });

    const referencedImages = new Map(); // imgName -> folder
    const referencedAudios = new Set();

    for (const bg of backgrounds) {
      const folder = normalizeBgPath(bg.folder) || 'Background';
      const jsonStr = serializeBackgroundJson(bg);
      filesToZip.push({
        path: `base/background/${folder}/background.json`,
        data: jsonStr,
      });

      function collectAssets(obj) {
        if (!obj) return;
        if (obj.background) referencedImages.set(obj.background, folder);
        if (obj.foreground) referencedImages.set(obj.foreground, folder);
        if (obj.ambience) referencedAudios.add(normalizeAmbiencePath(obj.ambience));
      }

      for (const st of Object.values(bg.states || {})) {
        collectAssets(st);
        if (st.time_variants) {
          for (const tv of Object.values(st.time_variants)) collectAssets(tv);
        }
        if (st.positions) {
          for (const pos of Object.values(st.positions)) {
            collectAssets(pos);
            if (pos.time_variants) {
              for (const tv of Object.values(pos.time_variants)) collectAssets(tv);
            }
          }
        }
      }
    }

    // Attach asset data if available in asset pool
    for (const [imgName, folder] of referencedImages.entries()) {
      if (!imgName) continue;
      const matched = assetPool.find((a) => a.type === 'image' && (a.name === imgName || a.relPath === imgName));
      if (matched && matched.file) {
        filesToZip.push({
          path: `base/background/${folder}/${imgName}`,
          data: matched.file,
        });
      }
    }

    for (const audName of referencedAudios) {
      if (!audName) continue;
      const matched = assetPool.find((a) => a.type === 'audio' && (a.relPath === audName || a.name === audName.split('/').pop()));
      if (matched && matched.file) {
        filesToZip.push({
          path: `base/sounds/ambient/${audName}`,
          data: matched.file,
        });
      }
    }

    const zipBytes = await buildZip(filesToZip);
    downloadZipBlob(zipBytes, filename);
  },

  async processExtractedZipFiles(extractedFiles) {
    if (!extractedFiles || !extractedFiles.length) return;
    const addedAssets = [];
    const jsonEntries = [];
    const decoder = new TextDecoder();

    for (const f of extractedFiles) {
      const cleanPath = f.path.replace(/\\/g, '/').replace(/^\/+/, '');
      const filename = cleanPath.split('/').pop();
      const mime = getMimeType(filename);
      const isImage = mime.startsWith('image/');
      const isAudio = mime.startsWith('audio/') || /\.(opus|mp3|ogg|wav|m4a|flac)$/i.test(filename);
      const isJson = filename.endsWith('.json');

      if (isJson) {
        jsonEntries.push({ path: cleanPath, data: f.data });
        continue;
      }

      if (!isImage && !isAudio) continue;

      let cleanRel = filename;
      if (isAudio) {
        cleanRel = normalizeAmbiencePath(cleanPath);
      }

      const existing = assetPool.find((a) => (a.name === filename || a.relPath === cleanRel) && a.size === f.data.length);
      if (!existing) {
        const blob = typeof Blob !== 'undefined' ? new Blob([f.data], { type: mime }) : null;
        const url = blob && typeof URL !== 'undefined' ? URL.createObjectURL(blob) : '';
        const entry = {
          id: 'ast_' + Math.random().toString(36).slice(2, 9),
          name: filename,
          relPath: cleanRel,
          fullRelPath: cleanPath,
          type: isAudio ? 'audio' : 'image',
          size: f.data.length,
          lastModified: Date.now(),
          url,
          file: blob,
        };
        assetPool.push(entry);
        addedAssets.push(entry);
      }
    }

    for (const jf of jsonEntries) {
      try {
        const text = decoder.decode(jf.data);
        const raw = JSON.parse(text);

        if (jf.path.endsWith('backgrounds-library.json') || Array.isArray(raw.backgrounds)) {
          this.loadBackgrounds(raw.backgrounds, { replace: false, notifyListeners: false });
        } else if (jf.path.endsWith('background.json') || raw.states) {
          let folder = 'Imported';
          const parts = jf.path.split('/');
          if (parts.length > 1) {
            folder = normalizeBgPath(parts.slice(0, -1).join('/'));
          }
          const importedBg = parseBackgroundJson(raw.states || raw, folder);
          this.loadBackgrounds([importedBg], { replace: false, notifyListeners: false });
        }
      } catch (err) {
        console.warn('Failed to parse json inside zip:', jf.path, err);
      }
    }

    notify();
  },

  // Asset Pool Management
  async registerFiles(files) {
    if (!files || files.length === 0) return;
    const added = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = (file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
      const isZip = file.name?.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
      const isAudio = file.type?.startsWith('audio/') || /\.(opus|mp3|ogg|wav|m4a|flac)$/i.test(file.name);
      const isImage = file.type?.startsWith('image/') || /\.(png|webp|jpg|jpeg|gif|svg|avif)$/i.test(file.name);
      const isJson = file.name?.endsWith('.json');

      if (isZip) {
        try {
          const ab = await file.arrayBuffer();
          const extractedFiles = await readZip(ab);
          await this.processExtractedZipFiles(extractedFiles);
        } catch (err) {
          console.error('Failed to unpack zip file:', err);
        }
        continue;
      }

      if (isJson) {
        try {
          const text = await file.text();
          const raw = JSON.parse(text);
          if (raw.type === 'mnn-backgrounds-library' || Array.isArray(raw.backgrounds)) {
            this.loadBackgrounds(raw.backgrounds, { replace: false });
          } else if (Array.isArray(raw)) {
            this.loadBackgrounds(raw, { replace: false });
          } else if (raw.states) {
            let folder = 'Imported';
            if (file.webkitRelativePath) {
              const parts = file.webkitRelativePath.split('/');
              if (parts.length > 1) {
                folder = normalizeBgPath(parts.slice(0, -1).join('/'));
              }
            } else if (file.name && !file.name.includes('background.json')) {
              folder = file.name.replace(/\.json$/i, '');
            }
            const importedBg = parseBackgroundJson(raw, folder);
            this.loadBackgrounds([importedBg], { replace: false });
          }
        } catch (err) {
          console.warn('Dropped JSON is not valid background definition:', err);
        }
        continue;
      }

      if (!isAudio && !isImage) continue;

      let cleanRel = relPath;
      if (isAudio) {
        cleanRel = normalizeAmbiencePath(relPath);
      } else {
        const parts = relPath.split('/');
        cleanRel = parts[parts.length - 1];
      }

      const existing = assetPool.find((a) => a.name === file.name && a.size === file.size);
      if (existing) continue;

      const url = typeof URL !== 'undefined' ? URL.createObjectURL(file) : '';
      const entry = {
        id: 'ast_' + Math.random().toString(36).slice(2, 9),
        name: file.name,
        relPath: cleanRel,
        fullRelPath: relPath,
        type: isAudio ? 'audio' : 'image',
        size: file.size,
        lastModified: file.lastModified,
        url,
        file,
      };

      assetPool.push(entry);
      added.push(entry);
    }

    if (added.length > 0) {
      notify();
    }
  },

  // Export Background Folder ZIP (includes background.json + used assets)
  async exportZip(bgId) {
    const bg = backgrounds.find((b) => b.id === bgId) || backgrounds[0];
    if (!bg) return;

    const folder = normalizeBgPath(bg.folder) || 'Background';
    const jsonStr = serializeBackgroundJson(bg);

    const filesToZip = [
      {
        path: `base/background/${folder}/background.json`,
        data: jsonStr,
      },
    ];

    // Find all referenced filenames in this background
    const referencedImages = new Set();
    const referencedAudios = new Set();

    function collectAssets(obj) {
      if (!obj) return;
      if (obj.background) referencedImages.add(obj.background);
      if (obj.foreground) referencedImages.add(obj.foreground);
      if (obj.ambience) referencedAudios.add(normalizeAmbiencePath(obj.ambience));
    }

    for (const st of Object.values(bg.states || {})) {
      collectAssets(st);
      if (st.time_variants) {
        for (const tv of Object.values(st.time_variants)) collectAssets(tv);
      }
      if (st.positions) {
        for (const pos of Object.values(st.positions)) {
          collectAssets(pos);
          if (pos.time_variants) {
            for (const tv of Object.values(pos.time_variants)) collectAssets(tv);
          }
        }
      }
    }

    // Attach asset data if available in asset pool
    for (const imgName of referencedImages) {
      if (!imgName) continue;
      const matched = assetPool.find((a) => a.type === 'image' && (a.name === imgName || a.relPath === imgName));
      if (matched && matched.file) {
        filesToZip.push({
          path: `base/background/${folder}/${imgName}`,
          data: matched.file,
        });
      }
    }

    for (const audName of referencedAudios) {
      if (!audName) continue;
      const matched = assetPool.find((a) => a.type === 'audio' && (a.relPath === audName || a.name === audName.split('/').pop()));
      if (matched && matched.file) {
        filesToZip.push({
          path: `base/sounds/ambient/${audName}`,
          data: matched.file,
        });
      }
    }

    const zipBytes = await buildZip(filesToZip);
    const downloadName = `${folder.replace(/[\/\\?%*:|"<>]/g, '_')}_package.zip`;
    downloadZipBlob(zipBytes, downloadName);
  },

  // Helper to find preview URL for an asset filename
  getAssetUrl(nameOrPath, type = 'image') {
    if (!nameOrPath) return '';
    if (nameOrPath.startsWith('data:') || nameOrPath.startsWith('blob:') || nameOrPath.startsWith('http://') || nameOrPath.startsWith('https://')) {
      return nameOrPath;
    }
    const match = assetPool.find((a) => {
      if (type && a.type !== type) return false;
      return a.name === nameOrPath || a.relPath === nameOrPath || a.fullRelPath === nameOrPath;
    });
    return match ? match.url : '';
  },
};

/**
 * Resolves the background scene image preview URL for a given background folder name.
 */
export function getAreaBgUrl(bgFolder, customStoreState) {
  if (!bgFolder || typeof bgFolder !== 'string') return '';
  if (bgFolder.startsWith('data:') || bgFolder.startsWith('blob:') || bgFolder.startsWith('http://') || bgFolder.startsWith('https://')) {
    return bgFolder;
  }
  const currentStore = customStoreState || getStoreState();
  const norm = normalizeBgPath(bgFolder).toLowerCase();
  const matched = (currentStore.backgrounds || []).find(
    (b) => b.folder.toLowerCase() === norm
  );
  if (matched) {
    const visual = resolveActiveVisual(matched, { state: 'default', tod: 'day' });
    if (visual && visual.background) {
      const url = bgStore.getAssetUrl(visual.background, 'image');
      if (url) return url;
    }
  }
  // Fallback: match by last segment filename in asset pool
  const last = bgFolder.split('/').pop();
  return bgStore.getAssetUrl(last, 'image');
}

/**
 * Resolves the visual image URL to display on the node card on the graph canvas.
 * If area.imageMode === 'scene', returns the resolved background scene URL if available.
 * Otherwise returns the custom node avatar (area.image).
 */
export function resolveNodeImageUrl(area, customStoreState) {
  if (!area) return '';
  const mode = area.imageMode || (area.image ? 'node' : '');
  if (mode === 'scene') {
    const sceneUrl = getAreaBgUrl(area.background, customStoreState);
    if (sceneUrl) return sceneUrl;
    return area.image || '';
  }
  return area.image || '';
}
