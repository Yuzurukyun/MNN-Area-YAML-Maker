# MNN Area List YAML Maker

> Visual node-graph editor and asset compiler for **TsuMNN / Attorney Online `areas.yaml`** and **`background.json`** configurations.

Build and arrange multi-room worlds on an interactive canvas, wire one-way and two-way corridors, configure server permissions and locks, test exits interactively, and export pristine `areas.yaml` configs and `background.json` packages without fighting YAML indentation, quoting rules, or missing assets.

Runs **100% locally in your browser** with instant `localStorage` autosave — zero server uploads, completely private, and works offline out-of-the-box.

---

## What You Can Do With This Editor

Besides installing or building the project, this tool serves as a complete visual IDE for server map creators, courtroom builders, and event hosts:

### 1. Visual Area Topology & Link Wiring
- **Interactive Room Map:** Pan, zoom, box-select, and arrange rooms across a world-locked dot-matrix canvas with smooth camera transitions and minimap radar.
- **Directional Links:** Connect areas with one-way (`→` / `←`) or bidirectional (`↔`) paths simply by dragging from edge ports or clicking connection lines.
- **Link Types:** Switch between `reachable_areas` (walkable corridors), `visible_areas` (chat view), and `scream_range` (`/scream` distance), with support for explicit room lists, `<ALL>`, and `<REACHABLE_AREAS>`.
- **Smart Route Finder (🧭 Route):** Trace shortest walkable paths between any two areas with turn-by-turn guidance, respecting RP privacy boundaries (private areas and lobbies cannot be used as transit shortcuts).
- **Topology Audit (🔍 Audit):** Automatically detects dead ends, one-way traps, disconnected islands, and rooms with no incoming entrances, complete with one-click **⌖ View** focus.
- **Spatial Zones & Groups:** Draw color-coded zone rectangles on the map to group areas (e.g. *District Courthouse*, *Manor Grounds*), move entire complexes together, and reorder IDs for `/zone_area` scripting.

### 2. Built-in Background.json Maker & INI Converter
- **Visual Scene Builder:** Open **🖼 Backgrounds** to design, edit, and package TsuMNN/MNN `background.json` files directly within the workspace.
- **Courtroom & Camera Positions:** Full support for multi-angle courtroom setups (**Witness**, **Defense**, **Prosecution**, **Judge**, **Counsel**, **Counsel Prosecution**, **Gallery**) with Witness as the authoritative default.
- **Time of Day & State Variants:** Configure `day`, `evening`, and `night` visual variations, plus state overlays (`default`, `crowded`, `festive`, `blackout`) with seamless preview switching.
- **Legacy INI Import & Auto-Conversion:** Drag-and-drop legacy `positions.ini` folders; the engine automatically maps sections, positions, backdrops, desk overlays, and ambient SFX, converting them directly into modern `background.json` files.
- **Asset Repository Dock & Usage Tracker:** Bottom dock provides instant drag-and-drop asset assignment, deduplication with clean alias retention, global asset renaming, and a dedicated **Usage Inspector** showing exactly which background nodes and slots use any image or audio loop.
- **Live Stage Monitor & Ambience Player:** Real-time preview with custom aspect ratios (`16:9`, `4:3`, custom) and an integrated audio player to audition ambient audio loops (`.opus`, `.mp3`, `.ogg`) before exporting.
- **One-Click Package Export:** Export a complete, server-ready ZIP package structured with `base/background/<Subfolder>/<Room>/background.json`, backdrops, desk overlays, and `base/sounds/ambient/` sound files.

### 3. Server Schema Validation & Live Testing
- **40+ Server Fields:** Categorized by importance (Common, Uncommon, Rarely) with field-level descriptions from the official TsuMNN server specification.
- **Templates & RP Presets:** Quickly apply or create reusable room presets (**Yuzu's RP Defaults**, **Private Area**, **Lobby Area**, **Server Defaults**).
- **Interactive Player Test Mode (▶ Test mode):** Step into the map from a player's perspective, navigate through exits, search destinations, and verify room flows before deploying to your server.
- **Diagnostic Export Warnings:** Live YAML linter flags duplicate area names, dead ends (0 exits), unreachable areas, and out-of-range `afk_sendto` values while omitting empty or default fields cleanly.

---

## Comprehensive Guides & Documentation

For in-depth user instructions, keyboard shortcuts, and full architectural logs, refer to the included guides:

* **[HELP.md](HELP.md)** — **Full User & Feature Guide:**
  - Workspace layout breakdown (Header, Area List, Connection Map, Inspector, Stage Monitor).
  - Complete keyboard shortcuts table (camera navigation, multi-selection, quick ports, pan toggles).
  - Deep-dive into link types, `<ALL>` mesh rules, and server export semantics.
  - Spatial grouping, route finding, and network auditing procedures.
  - Detailed background maker walkthrough and courtroom camera position workflows.
  *(Also accessible directly inside the app by clicking **? Help** in the top header).*

* **[CHANGELOGS.md](CHANGELOGS.md)** — **Version History & Technical Logs:**
  - Complete version-by-version release history from v1.0.0 through v2.1.0.
  - Architectural overhauls, parser improvements, and UI design revisions.
  - Granular bug fix records, root-cause investigations, and automated test suite verification logs.

---

## Using the Application

### 1. Online (GitHub Pages)
The web application is hosted directly via GitHub Pages:
- **Live URL:** **[https://yuzurukyun.github.io/MNN-Area-YAML-Maker/](https://yuzurukyun.github.io/MNN-Area-YAML-Maker/)**

### 2. Offline Single-File HTML Distribution
The entire application builds into a **single, self-contained HTML file** with all scripts, styles, and assets bundled inline:
- Open `export/yuzu_area_maker_nomusic.html` (or `export/yuzu_area_maker.html`) in any modern web browser (Chrome, Edge, Firefox, Safari).
- Requires **no local server**, **no Node.js runtime**, and **no internet connection** once downloaded.

### 3. File Formats Used
| Format | Extension | Purpose |
|---|---|---|
| **Project Save** | `.json` | Full editor save file containing area data, map coordinates, zone groups, layout snapshots, corkboard images, and custom templates. |
| **Server Config** | `areas.yaml` | The clean, production-ready area definition file deployed to your TsuMNN server. |
| **Background Config** | `background.json` | Modern MNN courtroom/area background definition with states, positions, and time variants. |
| **Legacy Config** | `positions.ini` | Legacy courtroom position INI imported for automatic conversion to `background.json`. |
| **Background Package**| `.zip` | Complete archive containing room definitions, backdrop images, desk overlays, and ambient audio loops. |

---

## Development & Testing

Requires **Node.js 20+**.

```bash
# Install dependencies
npm install

# Run comprehensive test suite (297 unit tests covering YAML, INI, geometry, and store)
npm test

# Start local Vite development server with hot-module reload
npm run dev

# Build standard single-file distribution (includes optional local soundtrack if present)
npm run build

# Build lightweight no-music single-file distribution (~565 KB)
npm run build:nomusic

# Build both distributions and synchronize to export/ and docs/
npm run build:both
```

---

## Workspace Structure

```text
├── docs/                        # GitHub Pages distribution (index.html, og-image.png)
├── export/                      # Self-contained single-file HTML builds (nomusic & full)
├── scripts/                     # Build collectors, OG image generator, and utilities
├── tests/                       # Unit tests (tests/core.test.mjs — 265 assertions)
├── src/
│   ├── App.svelte               # Main 3-pane shell, resize dividers, global shortcuts
│   ├── main.js                  # Application entry point
│   ├── assets/                  # Bundled example YAMLs (wsl_ch3.yaml) and default assets
│   ├── styles/                  # Modular CSS design system (base, chrome, panels, graph)
│   ├── lib/
│   │   ├── core.js              # Core module re-exports
│   │   ├── yaml.js              # Robust YAML parser (with diagnostic reports) and serializer
│   │   ├── bgSchema.js          # MNN background.json / positions.ini parser, validator & resolver
│   │   ├── bgStore.js           # Background library, universal file importer & asset pool store
│   │   ├── assetDb.js           # Client-side IndexedDB asset persistence
│   │   ├── model.js             # Area CRUD, validation, template application, and merging
│   │   ├── links.js             # Link modes, pair resolution, and directional mutation
│   │   ├── arrange.js           # Deterministic cluster and radial graph auto-arrange layout
│   │   ├── graphGeom.js         # SVG perimeter edge clipping & popover clamping
│   │   ├── fields.js            # TsuMNN server schema definitions and templates
│   │   └── state.js             # Project store, undo/redo history, themes, and notifications
│   └── components/
│       ├── Header.svelte        # Navigation, new/import/export dropdowns, theme picker
│       ├── panels/              # AreaList, Inspector, LinkEditor, Field controls
│       ├── graph/               # Canvas, SVG layers, Radar, RouteFinder, NetworkAudit, Toolbar
│       └── modals/              # BackgroundMaker, TestMode, Templates, Export, Help
├── HELP.md                      # Detailed user manual and controls reference
├── CHANGELOGS.md                # Comprehensive release notes and technical logs
└── README.md                    # Project overview and quickstart documentation
```

---

## Credits & License

- **Concept, Design & Direction:** **Yuzuru**
- **TsuMNN / Attorney Online:** Built specifically for the Attorney Online / TsuMNN server community.
- **Optional Local Background Track:** *"Lakeside Songbook"* (`5-S: I Only Say Morning`, ULTRAKILL OST) by **Heaven Pierce Her (Hakita)** — [YouTube](https://www.youtube.com/watch?v=lRe66IHrKt4) *(supported locally via `src/assets/i-only-say-morning.opus`)*.
- **Built With:** [Svelte](https://svelte.dev/), [Vite](https://vite.dev/), and [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile).

---

## Disclaimer

This application was developed with **AI-assisted coding** — designed, directed, and rigorously tested by a human (**Yuzuru**), with implementation written in collaboration with AI assistants.
