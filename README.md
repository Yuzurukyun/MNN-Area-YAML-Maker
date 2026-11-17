# Area List YAML Maker — TsuMNN

A visual node-map editor for **TsuMNN `areas.yaml`** configuration files. Build and arrange rooms on an interactive graph, wire one-way or two-way connections, configure permissions and behaviours, walk exits in **Test Mode**, and export a valid `areas.yaml` without fighting YAML indentation or comma escaping.

Everything runs **100% locally in your browser** with automatic `localStorage` saving — nothing is uploaded anywhere.

---

## Features

- **Interactive Node Map:** Pan (`Middle-drag`, `Space + drag`, or **✋ Pan**), zoom, fit-to-screen (`F`), box-select, drag-connect via hover ports or `Shift + drag`, click any edge to toggle directions (`↔` / `→` / `←`), group areas into spatial zones, pin reference images, and auto-arrange clusters.
- **Reachable, Visible & Scream Links:** Switch cleanly between `reachable_areas`, `visible_areas`, and `scream_range`, supporting explicit lists, `<ALL>`, and `<REACHABLE_AREAS>`.
- **Smart YAML Import & Export:** Handles PyYAML wrapped lines, quoted tokens, block/flow lists, block scalars, and mid-name apostrophes; surfaces import notes and non-blocking export warnings (dead ends, unreachable rooms, out-of-range `afk_sendto`); omits empty/default keys cleanly.
- **Templates & Presets:** Includes **Yuzu's RP Defaults**, **Private Area**, **Lobby Area**, **Server defaults**, plus custom JSON-shareable templates and `background_tod` presets.
- **Test Mode:** Walk through your map from the player's perspective using live reachable exits.
- **Two Themes:** Switch anytime between **Dark Terminal** (ULTRAKILL-inspired) and **Warm Paper** (low-glare light mode) from the header.
- **Bundled Examples:** Load **WSL (47 areas)** or the **Classic sample (8 areas)** right from **New ▾ → Example project**.

---

## Using the App

### Online (GitHub Pages)

The compiled no-music web app is published in `docs/index.html` and can be hosted directly via **GitHub Pages** (**Settings → Pages → Deploy from a branch → `main` → `/docs`** — or via **GitHub Actions** using `.github/workflows/deploy.yml`).

Live URL (once Pages is enabled): **`https://yuzurukyun.github.io/MNN-Area-YAML-Maker/`**

### Offline Single-File HTML

You can also open `export/yuzu_area_maker_nomusic.html` (or a local `export/yuzu_area_maker.html` build) directly from disk in any browser.

- **JSON (`.json`)** is your project save file (preserves map positions, groups, images, layouts, and custom templates).
- **YAML (`areas.yaml`)** is the finished config file for your TsuMNN server.

Inside the app, click **? Help** for the full user guide (loaded from [HELP.md](HELP.md)). For version history, see [CHANGELOGS.md](CHANGELOGS.md).

---

## Development & Building

Requires **Node.js 20+**.

```bash
npm install           # install dependencies once
npm test              # run unit tests (66 checks across YAML, links, layout, geometry)
npm run dev           # start Vite dev server with hot reload
npm run build         # build dist/index.html (includes local music if present)
npm run build:nomusic # build dist-nomusic/index.html (no music, ~212 KB)
npm run build:both    # build both flavours and copy them to export/
```

Both builds use `vite-plugin-singlefile` to inline all JavaScript, CSS, and assets into a single self-contained HTML file. When the optional local audio track is absent (such as on fresh GitHub clones or CI), builds automatically fall back to the no-music configuration.

---

## Project Architecture

```text
src/
├── App.svelte                   # Main 3-pane shell, resizable sidebars, Undo/Redo shortcuts
├── main.js                      # Mount point & stylesheet imports
├── assets/
│   └── wsl_ch3.yaml             # Bundled 47-area example project
├── styles/
│   ├── base.css                 # Dark Terminal & Warm Paper tokens, custom controls, motion
│   ├── chrome.css               # Header, brand emblem, theme picker, dropdowns, modals, resizers
│   ├── panels.css               # Left/right sidebars, area list, inspector fields & toggles
│   └── graph.css                # Dot-matrix canvas, vignette, SVG nodes, edges & ports
├── lib/
│   ├── core.js                  # Barrel re-exporting all framework-free core modules
│   ├── util.js                  # String trimming, clamp, collision-safe uid/syncUid
│   ├── fields.js                # TsuMNN schema: defaults, descriptions, importance groups, templates
│   ├── model.js                 # Area CRUD, validation errors/warnings, templates, groups, merge
│   ├── links.js                 # Mode resolution, canonical pair edges, directional mutations
│   ├── yaml.js                  # Quote/list/block-aware YAML parser (with report) & exporter
│   ├── arrange.js               # Deterministic hub-and-ellipse-cluster auto-arrange layout
│   ├── graphGeom.js             # Node-boundary edge clipping & popover viewport clamping
│   ├── nodeLabels.js            # Truncated node card labels & status tags
│   └── state.js                 # Store, autosave, theme state, undo/redo transactions, toasts
└── components/
    ├── Header.svelte            # New (with examples) / Import / Export, Undo/Redo, Theme picker
    ├── MusicPlayer.svelte       # Optional looping local audio player (hidden in no-music builds)
    ├── ToastHost.svelte         # Non-blocking notification stack
    ├── panels/                  # AreaList, Inspector, LinkEditor, Field, Bool
    ├── graph/                   # Graph, GraphToolbar, GraphHud, layers, DirectionCard, ContextMenu
    └── modals/                  # ExportModal, TestMode, TemplatesModal, ConfirmModal, HelpModal
```

---

## Credits

- **Concept, Design & Direction:** **Yuzuru**
- **TsuMNN Format:** Built for the TsuMNN / Attorney Online `areas.yaml` server specification
- **Optional Local Background Track:** _"Lakeside Songbook"_ (`5-S: I Only Say Morning`, ULTRAKILL OST) by **Heaven Pierce Her (Hakita)** — [YouTube](https://www.youtube.com/watch?v=lRe66IHrKt4) _(excluded from the GitHub repository; supported locally via `src/assets/i-only-say-morning.opus`)_
- **Built With:** [Svelte](https://svelte.dev/), [Vite](https://vite.dev/), and [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)

---

## Disclaimer

This application was developed with **AI-assisted coding** — designed, directed, and tested by a human, with implementation written in collaboration with AI assistants.
