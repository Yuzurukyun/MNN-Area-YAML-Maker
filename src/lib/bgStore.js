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
} from './bgSchema.js';
import { buildZip, downloadZipBlob } from './zip.js';

// Reactive store pattern (matching state.js in project)
const listeners = new Set();
function notify() {
  for (const fn of listeners) {
    try { fn(getStoreState()); } catch (e) { console.error(e); }
  }
}

// Initial state
let assetPool = []; // Array<{ id, name, relPath, type: 'image'|'audio', url, file, size }>
let backgrounds = [
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
let selectedBgId = backgrounds[0].id;
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

  // Asset Pool Management
  registerFiles(files) {
    if (!files || files.length === 0) return;
    const added = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = (file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
      const isAudio = file.type.startsWith('audio/') || /\.(opus|mp3|ogg|wav|m4a|flac)$/i.test(file.name);
      const isImage = file.type.startsWith('image/') || /\.(png|webp|jpg|jpeg|gif|svg|avif)$/i.test(file.name);
      const isJson = file.name.endsWith('.json');

      if (isJson) {
        // Automatically check if it's a background.json
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const raw = JSON.parse(e.target.result);
            // Derive folder from path or name
            let folder = 'Imported';
            if (file.webkitRelativePath) {
              const parts = file.webkitRelativePath.split('/');
              if (parts.length > 1) {
                folder = parts.slice(0, -1).join('/');
                folder = normalizeBgPath(folder);
              }
            }
            const importedBg = parseBackgroundJson(raw, folder);
            backgrounds.push(importedBg);
            selectedBgId = importedBg.id;
            notify();
          } catch (err) {
            console.warn('Dropped JSON is not valid background.json:', err);
          }
        };
        reader.readAsText(file);
        continue;
      }

      if (!isAudio && !isImage) continue;

      // Extract cleaned relative filename
      let cleanRel = relPath;
      if (isAudio) {
        cleanRel = normalizeAmbiencePath(relPath);
      } else {
        // If image has a subfolder inside background, keep filename
        const parts = relPath.split('/');
        cleanRel = parts[parts.length - 1]; // filename
      }

      // Check if already in asset pool
      const existing = assetPool.find((a) => a.name === file.name && a.size === file.size);
      if (existing) continue;

      const url = URL.createObjectURL(file);
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
    const match = assetPool.find((a) => {
      if (type && a.type !== type) return false;
      return a.name === nameOrPath || a.relPath === nameOrPath || a.fullRelPath === nameOrPath;
    });
    return match ? match.url : '';
  },
};
