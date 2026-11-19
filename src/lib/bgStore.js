// In-memory Asset Repository & Background Library Store
import {
  createBackground,
  createStateVariant,
  createPosition,
  createTimeVariant,
  serializeBackgroundJson,
  parseBackgroundJson,
  parseBackgroundIni,
  normalizeBgPath,
  normalizeAmbiencePath,
  hasTimeVariants,
  resolveActiveVisual,
  BUILTIN_BG_TEMPLATES,
  extractBgTemplateStructure,
  applyBgTemplate,
} from './bgSchema.js';
import { buildZip, readZip, downloadZipBlob } from './zip.js';
import {
  dbSaveAsset,
  dbSaveAssets,
  dbLoadAllAssets,
  dbDeleteAsset,
  dbDeleteAssets,
  dbClearAssets,
} from './assetDb.js';

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
const LS_TPL_KEY = 'areaMakerDemo.bgTemplates';

function loadInitialBgTemplates() {
  try {
    if (typeof localStorage !== 'undefined') {
      const rawTpl = localStorage.getItem(LS_TPL_KEY);
      if (rawTpl) {
        const arr = JSON.parse(rawTpl);
        if (Array.isArray(arr)) return arr;
      }
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.bgTemplates)) return p.bgTemplates;
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

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
        p.bgTemplates = bgTemplates;
        localStorage.setItem(LS_KEY, JSON.stringify(p));
      }
      localStorage.setItem(LS_TPL_KEY, JSON.stringify(bgTemplates));
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
let bgTemplates = loadInitialBgTemplates();
let selectedBgId = backgrounds[0]?.id || null;
let isMakerOpen = false;

/**
 * Ensures background folder path is unique, preventing duplicate path collisions.
 * Disambiguates with numeric suffix e.g. "subfolder/name 2".
 */
export function ensureUniqueBgFolder(folder, excludeId = null) {
  const norm = normalizeBgPath(folder) || 'NewBackground';
  const existingFolders = new Set(
    backgrounds
      .filter((b) => !excludeId || b.id !== excludeId)
      .map((b) => normalizeBgPath(b.folder).toLowerCase())
  );
  if (!existingFolders.has(norm.toLowerCase())) {
    return norm;
  }
  let base = norm;
  let counter = 2;
  const match = norm.match(/^(.*?)(?:[\s_]+copy)?(?:[\s_]+(\d+))?$/i);
  if (match) {
    base = (match[1] + (norm.includes('copy') ? ' copy' : '')).trim();
    if (match[2]) {
      counter = parseInt(match[2], 10) + 1;
    }
  }
  let candidate = `${base} ${counter}`;
  while (existingFolders.has(candidate.toLowerCase())) {
    counter++;
    candidate = `${base} ${counter}`;
  }
  return candidate;
}

// Load cached assets from IndexedDB in browser on startup
async function initAssetPoolFromDb() {
  if (typeof window === 'undefined') return;
  try {
    const records = await dbLoadAllAssets();
    if (records && records.length > 0) {
      let addedCount = 0;
      for (const rec of records) {
        if (!assetPool.some((a) => a.id === rec.id || (a.name === rec.name && a.size === rec.size))) {
          const blob = rec.data instanceof Blob ? rec.data : new Blob([rec.data], { type: getMimeType(rec.name) });
          const url = URL.createObjectURL(blob);
          assetPool.push({
            id: rec.id,
            name: rec.name,
            relPath: rec.relPath,
            fullRelPath: rec.fullRelPath || rec.relPath,
            type: rec.type,
            size: rec.size,
            lastModified: rec.lastModified,
            url,
            file: blob,
          });
          addedCount++;
        }
      }
      if (addedCount > 0) {
        notify();
      }
    }
  } catch (err) {
    console.warn('Error loading cached assets from IndexedDB:', err);
  }
}

if (typeof window !== 'undefined') {
  initAssetPoolFromDb();
}

function getStoreState() {
  return {
    assetPool,
    backgrounds,
    selectedBgId,
    isMakerOpen,
    activeBg: backgrounds.find((b) => b.id === selectedBgId) || backgrounds[0] || null,
    templates: [...BUILTIN_BG_TEMPLATES, ...bgTemplates],
    customTemplates: bgTemplates,
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
  getAllTemplates() {
    return [...BUILTIN_BG_TEMPLATES, ...bgTemplates];
  },
  saveTemplate(name, description = '') {
    const active = backgrounds.find((b) => b.id === selectedBgId);
    if (!active) return null;
    const tpl = {
      id: 'bgtpl_' + Math.random().toString(36).slice(2, 9),
      name: name.trim() || 'Template ' + (bgTemplates.length + 1),
      description: description.trim(),
      builtin: false,
      structure: extractBgTemplateStructure(active),
    };
    bgTemplates.push(tpl);
    notify();
    return tpl;
  },
  deleteTemplate(templateId) {
    bgTemplates = bgTemplates.filter((t) => t.id !== templateId);
    notify();
  },
  applyTemplate(bgId, template) {
    const bg = backgrounds.find((b) => b.id === bgId);
    if (!bg) return false;
    applyBgTemplate(bg, template);
    notify();
    return true;
  },
  openMaker(bgFolder = null) {
    isMakerOpen = true;
    if (bgFolder) {
      const norm = normalizeBgPath(bgFolder);
      const match = backgrounds.find((b) => b.folder === norm);
      if (match) {
        selectedBgId = match.id;
      } else {
        // Create new with this folder name, ensuring uniqueness
        const uniqueFolder = ensureUniqueBgFolder(norm);
        const newBg = createBackground(uniqueFolder);
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
    const uniqueFolder = ensureUniqueBgFolder(folder);
    const bg = createBackground(uniqueFolder);
    backgrounds.push(bg);
    selectedBgId = bg.id;
    notify();
    return bg;
  },
  duplicateBackground(id) {
    const orig = backgrounds.find((b) => b.id === id);
    if (!orig) return;
    const jsonStr = serializeBackgroundJson(orig);
    const uniqueFolder = ensureUniqueBgFolder(orig.folder + ' copy');
    const copy = parseBackgroundJson(jsonStr, uniqueFolder);
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

    const referencedImages = []; // Array<{ exportName, sourceName, folder }>
    const referencedAudios = []; // Array<{ exportName, sourceName }>

    for (const bg of backgrounds) {
      const folder = normalizeBgPath(bg.folder) || 'Background';
      const jsonStr = serializeBackgroundJson(bg);
      filesToZip.push({
        path: `base/background/${folder}/background.json`,
        data: jsonStr,
      });

      function collectAssets(obj) {
        if (!obj) return;
        if (obj.background) {
          const exportName = obj.background;
          const sourceName = bg.assetSources?.[exportName] || exportName;
          referencedImages.push({ exportName, sourceName, folder });
        }
        if (obj.foreground) {
          const exportName = obj.foreground;
          const sourceName = bg.assetSources?.[exportName] || exportName;
          referencedImages.push({ exportName, sourceName, folder });
        }
        if (obj.ambience) {
          const normAmb = normalizeAmbiencePath(obj.ambience);
          const exportName = normAmb;
          const ambBase = normAmb.split('/').pop();
          const sourceName = bg.assetSources?.[exportName] || bg.assetSources?.[ambBase] || exportName;
          referencedAudios.push({ exportName, sourceName });
        }
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
    for (const item of referencedImages) {
      if (!item.exportName) continue;
      const matched = assetPool.find((a) => a.type === 'image' && (a.name === item.sourceName || a.relPath === item.sourceName || a.name === item.exportName || a.relPath === item.exportName));
      if (matched && matched.file) {
        filesToZip.push({
          path: `base/background/${item.folder}/${item.exportName}`,
          data: matched.file,
        });
      }
    }

    for (const item of referencedAudios) {
      if (!item.exportName) continue;
      const audBase = item.exportName.split('/').pop();
      const matched = assetPool.find((a) => a.type === 'audio' && (a.relPath === item.sourceName || a.name === item.sourceName || a.name === item.sourceName.split('/').pop() || a.relPath === item.exportName || a.name === audBase));
      if (matched && matched.file) {
        filesToZip.push({
          path: `base/sounds/ambient/${item.exportName}`,
          data: matched.file,
        });
      }
    }

    const zipBytes = await buildZip(filesToZip);
    downloadZipBlob(zipBytes, filename);
  },

  async processExtractedZipFiles(extractedFiles) {
    return this.registerFiles(extractedFiles);
  },

  // Asset Pool & Universal Background Directory/ZIP Importer
  async registerFiles(files) {
    if (!files || files.length === 0) return { importedBackgrounds: [], addedAssets: [] };

    const decoder = new TextDecoder();
    const rawFileItems = [];

    // Helper: Normalize file list from either FileList, File[], or { path, data }[]
    const fileList = Array.from(files);

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const name = f.name || f.path || '';
      const isZip = name.endsWith('.zip') || f.type === 'application/zip' || f.type === 'application/x-zip-compressed';

      if (isZip) {
        try {
          let ab;
          if (f.arrayBuffer) {
            ab = await f.arrayBuffer();
          } else if (f.data) {
            ab = f.data.buffer || f.data;
          } else {
            ab = await new Response(f).arrayBuffer();
          }
          const extracted = await readZip(ab);
          const zipBaseName = name.split('/').pop().replace(/\.zip$/i, '').replace(/_/g, ' ');

          for (const ef of extracted) {
            let cleanP = ef.path.replace(/\\/g, '/').replace(/^\/+/, '');
            // If the files in zip were at root (no directory prefix), prefix with zip name
            if (!cleanP.includes('/')) {
              cleanP = `${zipBaseName}/${cleanP}`;
            }
            rawFileItems.push({
              path: cleanP,
              name: cleanP.split('/').pop(),
              data: ef.data,
              size: ef.data.length,
              type: getMimeType(cleanP.split('/').pop()),
              file: null,
            });
          }
        } catch (err) {
          console.error('Failed to unpack zip file:', name, err);
        }
      } else if (f.data instanceof Uint8Array || f.data instanceof ArrayBuffer) {
        // Already extracted object { path, data }
        const cleanP = (f.path || f.name || '').replace(/\\/g, '/').replace(/^\/+/, '');
        const filename = cleanP.split('/').pop();
        rawFileItems.push({
          path: cleanP,
          name: filename,
          data: f.data,
          size: f.data.length,
          type: getMimeType(filename),
          file: null,
        });
      } else {
        const fullRel = (f.webkitRelativePath || f.customRelativePath || f.name || '').replace(/\\/g, '/').replace(/^\/+/, '');
        const filename = f.name || fullRel.split('/').pop();
        rawFileItems.push({
          path: fullRel,
          name: filename,
          data: null,
          size: f.size || 0,
          type: f.type || getMimeType(filename),
          file: f,
        });
      }
    }

    if (rawFileItems.length === 0) return { importedBackgrounds: [], addedAssets: [] };

    // Separate library JSONs, directory configs (.json / .ini), and assets
    const libraryJsonFiles = [];
    const dirMap = new Map(); // folderPath -> { configs: [], assets: [] }

    function getCleanDir(fullPath) {
      let p = fullPath.replace(/^(\.\/)?(base\/)?background\//i, '').replace(/^(\.\/)?base\//i, '');
      const slash = p.lastIndexOf('/');
      if (slash === -1) return '';
      return p.slice(0, slash);
    }

    for (const item of rawFileItems) {
      const lower = item.name.toLowerCase();
      const isJson = lower.endsWith('.json');
      const isIni = lower.endsWith('.ini');
      const isImage = item.type.startsWith('image/') || /\.(png|webp|jpg|jpeg|gif|svg|avif)$/i.test(lower);
      const isAudio = item.type.startsWith('audio/') || /\.(opus|mp3|ogg|wav|m4a|flac)$/i.test(lower);

      if (isJson && (lower === 'backgrounds-library.json' || lower.includes('library'))) {
        libraryJsonFiles.push(item);
        continue;
      }

      const dir = getCleanDir(item.path);
      if (!dirMap.has(dir)) {
        dirMap.set(dir, { configs: [], assets: [] });
      }
      const group = dirMap.get(dir);

      if (isJson || isIni) {
        group.configs.push(item);
      } else if (isImage || isAudio) {
        group.assets.push(item);
      }
    }

    // Process library JSONs if present
    const newlyImportedBgs = [];
    for (const lj of libraryJsonFiles) {
      try {
        let text = '';
        if (lj.data) text = decoder.decode(lj.data);
        else if (lj.file) text = await lj.file.text();
        const raw = JSON.parse(text);
        if (Array.isArray(raw.backgrounds)) {
          this.loadBackgrounds(raw.backgrounds, { replace: false, notifyListeners: false });
        } else if (Array.isArray(raw)) {
          this.loadBackgrounds(raw, { replace: false, notifyListeners: false });
        }
      } catch (err) {
        console.warn('Failed to parse library json:', lj.name, err);
      }
    }

    const newlyAddedAssets = [];
    const poolNamesInBatch = new Set();

    // Helper: Register asset into pool, applying suffix counters (_1, _2) on collision with different files
    async function registerPoolAsset(item) {
      const origName = item.name;
      const lower = origName.toLowerCase();
      const isAudio = item.type.startsWith('audio/') || /\.(opus|mp3|ogg|wav|m4a|flac)$/i.test(lower);

      let cleanRel = origName;
      if (isAudio) {
        cleanRel = normalizeAmbiencePath(item.path);
      }

      // Check if identical asset already exists in pool
      const identical = assetPool.find((a) => a.name.toLowerCase() === origName.toLowerCase() && a.size === item.size);
      if (identical) {
        return { poolName: identical.name, origName, reused: true };
      }

      // If name collision with different content, generate suffix counter
      let candidate = origName;
      let counter = 1;
      const dotIdx = origName.lastIndexOf('.');
      const base = dotIdx !== -1 ? origName.slice(0, dotIdx) : origName;
      const ext = dotIdx !== -1 ? origName.slice(dotIdx) : '';

      while (
        assetPool.some((a) => a.name.toLowerCase() === candidate.toLowerCase()) ||
        poolNamesInBatch.has(candidate.toLowerCase())
      ) {
        candidate = `${base}_${counter}${ext}`;
        counter++;
      }

      poolNamesInBatch.add(candidate.toLowerCase());

      let blob = null;
      if (item.file) {
        blob = item.file;
      } else if (item.data) {
        blob = typeof Blob !== 'undefined' ? new Blob([item.data], { type: item.type }) : null;
      }
      const url = blob && typeof URL !== 'undefined' ? URL.createObjectURL(blob) : '';

      const entry = {
        id: 'ast_' + Math.random().toString(36).slice(2, 9),
        name: candidate,
        relPath: isAudio ? cleanRel : candidate,
        fullRelPath: item.path,
        type: isAudio ? 'audio' : 'image',
        size: item.size,
        lastModified: item.file?.lastModified || Date.now(),
        url,
        file: blob,
      };

      assetPool.push(entry);
      newlyAddedAssets.push(entry);
      return { poolName: candidate, origName, reused: false };
    }

    // Process each directory group
    for (const [dir, group] of dirMap.entries()) {
      const assetMap = new Map(); // origName -> poolName
      for (const astItem of group.assets) {
        const res = await registerPoolAsset(astItem);
        assetMap.set(res.origName, res.poolName);
      }

      let folderName = dir || 'Imported';
      folderName = normalizeBgPath(folderName);

      let bgCreated = null;

      // Detect .ini files or .json files
      const iniItem = group.configs.find((c) => c.name.toLowerCase().endsWith('.ini'));
      const jsonItem = group.configs.find((c) => c.name.toLowerCase().endsWith('.json'));

      if (iniItem) {
        try {
          let text = '';
          if (iniItem.data) text = decoder.decode(iniItem.data);
          else if (iniItem.file) text = await iniItem.file.text();
          bgCreated = parseBackgroundIni(text, folderName);
        } catch (err) {
          console.warn('Failed to parse INI in directory:', dir, err);
        }
      } else if (jsonItem) {
        try {
          let text = '';
          if (jsonItem.data) text = decoder.decode(jsonItem.data);
          else if (jsonItem.file) text = await jsonItem.file.text();
          const raw = JSON.parse(text);
          if (raw.states) {
            bgCreated = parseBackgroundJson(raw.states, folderName);
          } else if (typeof raw === 'object' && !Array.isArray(raw)) {
            bgCreated = parseBackgroundJson(raw, folderName);
          }
        } catch (err) {
          console.warn('Failed to parse JSON in directory:', dir, err);
        }
      } else if (group.assets.length > 0 && dir) {
        // Auto-create background from image/audio directory
        bgCreated = createBackground(folderName);
        const images = group.assets.filter((a) => a.type.startsWith('image/'));
        const audios = group.assets.filter((a) => a.type.startsWith('audio/'));

        let bgImg = '';
        let fgImg = '';
        for (const img of images) {
          const l = img.name.toLowerCase();
          if (!bgImg && (l.includes('back') || l.includes('bg'))) {
            bgImg = img.name;
          } else if (!fgImg && (l.includes('front') || l.includes('fg') || l.includes('desk') || l.includes('overlay'))) {
            fgImg = img.name;
          }
        }
        if (!bgImg && images.length > 0) bgImg = images[0].name;
        if (!fgImg && images.length > 1 && images[1].name !== bgImg) fgImg = images[1].name;

        bgCreated.states.default.background = bgImg;
        bgCreated.states.default.foreground = fgImg;
        if (audios.length > 0) {
          bgCreated.states.default.ambience = normalizeAmbiencePath(audios[0].path);
        }
      }

      if (bgCreated) {
        // Map pool aliases into assetSources so slots keep clean original names
        if (!bgCreated.assetSources) bgCreated.assetSources = {};
        for (const [origName, poolName] of assetMap.entries()) {
          if (origName !== poolName) {
            bgCreated.assetSources[origName] = poolName;
          }
        }

        // Auto-slot fallback: if st.background is empty but folder has images, assign first image
        const st = bgCreated.states?.default;
        if (st && !st.background && !st.usePositions && group.assets.length > 0) {
          const firstImg = group.assets.find((a) => a.type.startsWith('image/'));
          if (firstImg) st.background = firstImg.name;
        }

        newlyImportedBgs.push(bgCreated);
      }
    }

    if (newlyAddedAssets.length > 0) {
      dbSaveAssets(newlyAddedAssets);
    }

    if (newlyImportedBgs.length > 0) {
      // If current backgrounds has only an untouched placeholder 'Default' background, replace it cleanly
      if (
        backgrounds.length === 1 &&
        backgrounds[0].folder === 'Default' &&
        !backgrounds[0].states.default.background &&
        (!backgrounds[0].states.default.positions || Object.keys(backgrounds[0].states.default.positions).length === 0)
      ) {
        backgrounds = [];
      }

      this.loadBackgrounds(newlyImportedBgs, { replace: false, notifyListeners: false });
      // Switch active background to first newly imported background
      this.selectBg(newlyImportedBgs[0].id);
    }

    notify();

    return {
      importedBackgrounds: newlyImportedBgs,
      addedAssets: newlyAddedAssets,
    };
  },

  /**
   * Scans all backgrounds in the library and collects all referenced filenames.
   */
  getReferencedAssetNames(bgs = null) {
    const targetBgs = Array.isArray(bgs) ? bgs : backgrounds;
    const referenced = new Set();
    function collect(obj) {
      if (!obj) return;
      if (obj.background) referenced.add(obj.background.trim());
      if (obj.foreground) referenced.add(obj.foreground.trim());
      if (obj.ambience) {
        referenced.add(obj.ambience.trim());
        referenced.add(normalizeAmbiencePath(obj.ambience).trim());
        const soundFile = obj.ambience.split('/').pop()?.trim();
        if (soundFile) referenced.add(soundFile);
      }
    }
    for (const bg of targetBgs) {
      if (bg.assetSources) {
        for (const src of Object.values(bg.assetSources)) {
          if (src) {
            referenced.add(src.trim());
            const soundFile = src.split('/').pop()?.trim();
            if (soundFile) referenced.add(soundFile);
          }
        }
      }
      for (const st of Object.values(bg.states || {})) {
        collect(st);
        if (st.time_variants) {
          for (const tv of Object.values(st.time_variants)) collect(tv);
        }
        if (st.positions) {
          for (const pos of Object.values(st.positions)) {
            collect(pos);
            if (pos.time_variants) {
              for (const tv of Object.values(pos.time_variants)) collect(tv);
            }
          }
        }
      }
    }
    return referenced;
  },

  /**
   * Purges unreferenced media files from asset pool and IndexedDB cache.
   */
  async purgeUnusedAssets() {
    const referenced = this.getReferencedAssetNames();
    const toDeleteIds = [];
    const kept = [];

    for (const a of assetPool) {
      const isRef = referenced.has(a.name) || referenced.has(a.relPath) || referenced.has(a.fullRelPath);
      if (isRef) {
        kept.push(a);
      } else {
        toDeleteIds.push(a.id);
        if (a.url && typeof URL !== 'undefined' && URL.revokeObjectURL) {
          try { URL.revokeObjectURL(a.url); } catch {}
        }
      }
    }

    if (toDeleteIds.length > 0) {
      assetPool = kept;
      await dbDeleteAssets(toDeleteIds);
      notify();
    }
    return toDeleteIds.length;
  },

  /**
   * Clears all assets from pool and IndexedDB, and resets all background slot assignments
   * so backgrounds do not retain orphan purged assets.
   */
  async clearAllAssets(clearBackgroundSlots = true) {
    for (const a of assetPool) {
      if (a.url && typeof URL !== 'undefined' && URL.revokeObjectURL) {
        try { URL.revokeObjectURL(a.url); } catch {}
      }
    }
    assetPool = [];
    await dbClearAssets();

    if (clearBackgroundSlots) {
      for (const bg of backgrounds) {
        if (!bg || !bg.states) continue;
        bg.assetSources = {};
        for (const st of Object.values(bg.states)) {
          if (!st) continue;
          st.background = '';
          st.foreground = '';
          st.ambience = '';
          if (st.positions) {
            for (const pos of Object.values(st.positions)) {
              if (!pos) continue;
              pos.background = '';
              pos.foreground = '';
              pos.ambience = '';
              if (pos.time_variants) {
                for (const tv of Object.values(pos.time_variants)) {
                  if (!tv) continue;
                  tv.background = '';
                  tv.foreground = '';
                  tv.ambience = '';
                }
              }
            }
          }
          if (st.time_variants) {
            for (const tv of Object.values(st.time_variants)) {
              if (!tv) continue;
              tv.background = '';
              tv.foreground = '';
              tv.ambience = '';
            }
          }
        }
      }
    }

    notify();
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

    // Attach asset data if available in asset pool, mapping through bg.assetSources if present
    for (const imgName of referencedImages) {
      if (!imgName) continue;
      const sourceName = bg.assetSources?.[imgName] || imgName;
      const matched = assetPool.find((a) => a.type === 'image' && (a.name === sourceName || a.relPath === sourceName || a.name === imgName || a.relPath === imgName));
      if (matched && matched.file) {
        filesToZip.push({
          path: `base/background/${folder}/${imgName}`,
          data: matched.file,
        });
      }
    }

    for (const audName of referencedAudios) {
      if (!audName) continue;
      const audBase = audName.split('/').pop();
      const sourceName = bg.assetSources?.[audName] || bg.assetSources?.[audBase] || audName;
      const matched = assetPool.find((a) => a.type === 'audio' && (a.relPath === sourceName || a.name === sourceName || a.name === sourceName.split('/').pop() || a.relPath === audName || a.name === audBase));
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

  // Helper to find preview URL for an asset filename, resolving custom slot aliases if bg provided
  getAssetUrl(nameOrPath, type = 'image', bg = null) {
    if (!nameOrPath) return '';
    if (nameOrPath.startsWith('data:') || nameOrPath.startsWith('blob:') || nameOrPath.startsWith('http://') || nameOrPath.startsWith('https://')) {
      return nameOrPath;
    }
    const targetBg = bg || (backgrounds.find((b) => b.id === selectedBgId) || backgrounds[0]);
    let lookupTarget = nameOrPath;
    if (targetBg && targetBg.assetSources && targetBg.assetSources[nameOrPath]) {
      lookupTarget = targetBg.assetSources[nameOrPath];
    }
    const match = assetPool.find((a) => {
      if (type && a.type !== type) return false;
      return a.name === lookupTarget || a.relPath === lookupTarget || a.fullRelPath === lookupTarget || a.name === nameOrPath || a.relPath === nameOrPath;
    });
    return match ? match.url : '';
  },

  /**
   * Renames an asset globally across the asset pool and propagates the new name
   * to all background definitions and any matching area nodes.
   */
  async renameAsset(assetId, newName) {
    const cleanName = (newName || '').trim();
    if (!cleanName) return { success: false, error: 'Asset name cannot be empty.' };

    const asset = assetPool.find((a) => a.id === assetId);
    if (!asset) return { success: false, error: 'Asset not found in pool.' };

    const oldName = asset.name;
    if (oldName === cleanName) return { success: true };

    const collision = assetPool.find((a) => a.id !== assetId && a.name.toLowerCase() === cleanName.toLowerCase());
    if (collision) return { success: false, error: `An asset named "${cleanName}" already exists in the pool.` };

    asset.name = cleanName;
    asset.relPath = cleanName;
    if (asset.file && typeof File !== 'undefined') {
      try {
        asset.file = new File([asset.file], cleanName, { type: asset.file.type });
      } catch {}
    }

    // Propagate rename across all backgrounds
    for (const bg of backgrounds) {
      if (!bg || !bg.states) continue;
      if (bg.assetSources) {
        for (const [k, v] of Object.entries(bg.assetSources)) {
          if (v === oldName) bg.assetSources[k] = cleanName;
        }
      }
      function updateSlots(obj) {
        if (!obj) return;
        if (obj.background === oldName) obj.background = cleanName;
        if (obj.foreground === oldName) obj.foreground = cleanName;
        if (obj.ambience) {
          if (obj.ambience === oldName) {
            obj.ambience = cleanName;
          } else if (obj.ambience.endsWith('/' + oldName)) {
            const prefix = obj.ambience.slice(0, obj.ambience.lastIndexOf('/') + 1);
            obj.ambience = prefix + cleanName;
          }
        }
      }
      for (const st of Object.values(bg.states)) {
        updateSlots(st);
        if (st.time_variants) {
          for (const tv of Object.values(st.time_variants)) updateSlots(tv);
        }
        if (st.positions) {
          for (const pos of Object.values(st.positions)) {
            updateSlots(pos);
            if (pos.time_variants) {
              for (const tv of Object.values(pos.time_variants)) updateSlots(tv);
            }
          }
        }
      }
    }

    try {
      await dbSaveAssets([asset]);
    } catch (e) {
      console.warn('Failed to update renamed asset in IndexedDB:', e);
    }

    notify();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bg-asset-renamed', { detail: { oldName, newName: cleanName } }));
    }

    return { success: true, oldName, newName: cleanName };
  },

  /**
   * Deletes a single asset from the asset pool and IndexedDB cache.
   */
  async deleteAsset(assetId) {
    const asset = assetPool.find((a) => a.id === assetId);
    if (!asset) return false;
    if (asset.url && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      try { URL.revokeObjectURL(asset.url); } catch {}
    }
    assetPool = assetPool.filter((a) => a.id !== assetId);
    await dbDeleteAssets([assetId]);
    notify();
    return true;
  },

  /**
   * Duplicates an existing background with a unique folder path.
   */
  duplicateBackground(bgId) {
    const bg = backgrounds.find((b) => b.id === bgId);
    if (!bg) return null;
    const cloned = JSON.parse(JSON.stringify(bg));
    cloned.id = 'bg_' + Math.random().toString(36).slice(2, 9);
    cloned.folder = ensureUniqueBgFolder(`${bg.folder} Copy`);
    backgrounds.push(cloned);
    selectedBgId = cloned.id;
    notify();
    return cloned;
  },

  /**
   * Renames a background folder path with collision checks.
   */
  renameBackgroundFolder(bgId, newFolder) {
    const bg = backgrounds.find((b) => b.id === bgId);
    if (!bg) return { success: false, error: 'Background not found' };
    const clean = normalizeBgPath(newFolder);
    if (!clean) return { success: false, error: 'Folder path cannot be empty' };
    const oldFolder = bg.folder;
    if (oldFolder === clean) return { success: true };
    const unique = ensureUniqueBgFolder(clean, bgId);
    bg.folder = unique;
    notify();
    return { success: true, oldFolder, newFolder: unique };
  },

  /**
   * Duplicates a state variant within a background.
   */
  duplicateState(bgId, stKey) {
    const bg = backgrounds.find((b) => b.id === bgId);
    if (!bg || !bg.states || !bg.states[stKey]) return null;
    const baseState = bg.states[stKey];
    let candidate = `${stKey}_copy`;
    let counter = 2;
    while (bg.states[candidate]) {
      candidate = `${stKey}_copy${counter++}`;
    }
    bg.states[candidate] = JSON.parse(JSON.stringify(baseState));
    bg.activeState = candidate;
    notify();
    return candidate;
  },

  /**
   * Duplicates a time of day variant within a background.
   */
  duplicateTimeVariant(bgId, stKey, posKey, fromTodKey) {
    const bg = backgrounds.find((b) => b.id === bgId);
    if (!bg) return null;
    const st = bg.states?.[stKey];
    if (!st) return null;
    const targetObj = posKey && st.positions?.[posKey] ? st.positions[posKey] : st;
    if (!targetObj.time_variants || !targetObj.time_variants[fromTodKey]) return null;
    let candidate = `${fromTodKey}_copy`;
    let counter = 2;
    while (targetObj.time_variants[candidate]) {
      candidate = `${fromTodKey}_copy${counter++}`;
    }
    targetObj.time_variants[candidate] = JSON.parse(JSON.stringify(targetObj.time_variants[fromTodKey]));
    bg.activeTod = candidate;
    notify();
    return candidate;
  },

  /**
   * Duplicates a camera position within a state.
   */
  duplicatePosition(bgId, stKey, posKey) {
    const bg = backgrounds.find((b) => b.id === bgId);
    if (!bg) return null;
    const st = bg.states?.[stKey];
    if (!st || !st.positions || !st.positions[posKey]) return null;
    let candidate = `${posKey}_copy`;
    let counter = 2;
    while (st.positions[candidate]) {
      candidate = `${posKey}_copy${counter++}`;
    }
    const cloned = JSON.parse(JSON.stringify(st.positions[posKey]));
    cloned.name = candidate;
    st.positions[candidate] = cloned;
    bg.activePosition = candidate;
    notify();
    return candidate;
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

if (typeof window !== 'undefined') {
  window.__bgStore = bgStore;
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
