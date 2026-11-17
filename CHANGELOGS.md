# Changelog

## v1.0.0 — Started

## v1.0.1 — and hated it, so we refactored.

## v2.0.0 — Full Refactor, Graph & Import/Export Overhaul, and Warm Light Theme

### Architecture & Code Cleanup

- **Removed 12 orphaned pre-refactor files** (`src/app.css`, legacy top-level `src/components/*.svelte` duplicates, and `src/components/graph/EdgePopover.svelte`) so only the active modular structure under `src/lib/`, `src/styles/`, and `src/components/{panels,graph,modals}/` remains.
- **Prevented ID collisions (`src/lib/util.js`):** Added `syncUid(project)` to advance the ID counter past existing IDs whenever loading from `localStorage`, importing JSON, or merging files—preventing newly added areas from colliding with Area 0 (`a1`).
- **Removed duplicate schema field (`src/lib/fields.js`):** Consolidated `environment_indoors` into `BOOL_FIELDS` instead of duplicating it in `EXTRA_KEYS`.
- **Rewrote documentation:** Updated [README.md](README.md) and [HELP.md](HELP.md) to accurately reflect the refactored file layout, format rules, controls, and shortcuts.

### `reachable_areas`, Links & Data Integrity

- **Eliminated forced Hub mutation (`src/components/panels/Inspector.svelte`, `src/lib/links.js`, `src/components/panels/LinkEditor.svelte`):** Removed the reactive hook that silently injected Area 0 into `reachable_areas` on area selection, along with the Hub lock in `setSide()` and `DirectionCard`. New areas still default to linking with the Hub on creation, while any list-mode link (including Hub links) can now be toggled freely.
- **Aligned `<ALL>` semantics (`src/lib/links.js`, `src/components/panels/LinkEditor.svelte`):** Matched UI previews and graph resolution to export rules (`reachable` `<ALL>` includes the Hub; `visible` and `scream` `ALL AREAS` exclude the Hub).
- **Link editor QoL (`src/components/panels/LinkEditor.svelte`):** Added **Make all ↔** to quickly mirror one-way links in list mode, plus `Enter` to add the top area search match.
- **Cleanup on area deletion (`src/lib/model.js`):** Stripped deleted area IDs from `links[lt].also` retention lists in addition to `targets`, and bounds-checked `afk_sendto` remapping during merges.

### YAML / JSON Import & Export

- **Robust YAML parser with diagnostics (`src/lib/yaml.js`):** Added `parseYamlWithReport(text)` returning `{ areas, warnings, errors }`:
    - Properly unwraps quoted special tokens (`"<ALL>"`, `"<REACHABLE_AREAS>"`) and quoted comma-separated strings (`"Room A, Room B"`).
    - Adds support for YAML block sequences (`- item`), inline flow arrays (`[A, B]`), literal/folded block scalars (`|` / `>`), top-level `areas:` wrappers, `---`/`...` markers, tab indentation, and inline `#` comments outside quotes.
    - Falls back to case-insensitive area name matching with warnings instead of silently dropping targets, and warns on unknown targets, duplicate area names, or out-of-range `afk_sendto`.
- **Safer YAML export (`src/lib/yaml.js`, `src/lib/model.js`, `src/components/modals/ExportModal.svelte`):**
    - Exports explicit empty lists (`reachable_areas: ""`, `visible_areas: ""`) instead of blank YAML `null` values.
    - Fixes `yamlScalar()` quoting for strings containing `#`, `\`, `"`, and YAML keywords (`yes`, `no`, `on`, `off`, etc.).
    - Adds non-blocking `exportWarnings(P)` in the export preview to flag unreachable areas, dead ends (0 exits), out-of-range `afk_sendto`, and incomplete `background_tod` rows.
    - Adds a `file://`-compatible clipboard fallback (`copyText()` in `src/lib/state.js`).
- **Import UX (`src/components/Header.svelte`, `src/components/panels/AreaList.svelte`):** YAML imports now run `autoArrange` automatically instead of overlapping nodes randomly, surface parse warnings in the confirmation dialog, and display error/success feedback via toasts.

### Graph Map Overhaul

- **Visible one-way arrowheads (`src/lib/graphGeom.js`, `src/components/graph/EdgeLayer.svelte`):** Added `edgeEndpoints()` to clip lines to node box perimeters (`NODE_W × NODE_H`) so arrowheads sit cleanly outside target cards instead of hiding underneath them.
- **Reduced `<ALL>` clutter (`src/components/graph/EdgeLayer.svelte`, `src/components/graph/GraphToolbar.svelte`):** `<ALL>` mesh lines are hidden by default and replaced with `<ALL>` node tags and the `ALL AREAS` pill; toggle **<ALL> mesh** in the toolbar to inspect every generated edge.
- **Better navigation & interaction (`src/components/graph/Graph.svelte`, `NodeLayer.svelte`, `GraphHud.svelte`):**
    - Added hover quick-connect ports on nodes (alternative to `Shift+drag`).
    - Added **✋ Pan** tool toggle, `Space + drag` panning, and a bottom-right zoom HUD (`−` / `%` / `+` / `Fit` and `F` key).
    - Added `Delete`/`Backspace` shortcut for selected non-hub areas, `Escape` dismissal across modals/cards/menus, and viewport clamping for `ContextMenu` and `DirectionCard`.
    - Switched active drags to `window` pointer listeners with `pointercancel` cleanup so drags cannot get stuck.

### UI Design, Light Theme & Quality of Life

- **Header Theme Dropdown & Warm Light Palette (`src/styles/base.css`, `src/components/Header.svelte`, `src/lib/state.js`):** Added a **Theme** selector in the header switching between **Dark Terminal** and **Warm Light** (warm sand/ivory surfaces `#efebe2` / `#f5f2ea` / `#fcfaf5`, charcoal ink `#272420`, muted terracotta accent `#b63e28`, and high-contrast semantic tones across all UI panels and SVG layers), persisted in `localStorage`.
- **Toast notifications (`src/components/ToastHost.svelte`):** Added non-blocking status toasts for clipboard copies, imports/merges, layouts, and warnings.
- **Sidebar improvements (`src/components/panels/AreaList.svelte`, `src/components/panels/Inspector.svelte`):** Added `↑` / `↓` reorder buttons, `#ID` matching in area search, live typing updates in Inspector inputs, and Escape/scrim dismissal across all modals.

### Verification

- Expanded [tests/core.test.mjs](tests/core.test.mjs) to **53 passing checks** covering YAML quoting/lists/block scalars, `syncUid`, empty-list round trips, `exportWarnings`, `edgeEndpoints` clipping, and link resolution.
- Rebuilt single-file bundles via `npm run build:both` (`export/yuzu_area_maker.html` and `export/yuzu_area_maker_nomusic.html`).

## v2.0.1 — PyYAML Multi-line List Fix, Bidirectional Hub Arrows & Full-Height Resizer

### Bug Fixes

- **Wrapped unquoted YAML lists, mid-name apostrophes & PyYAML escapes (`src/lib/yaml.js`):**
    - Updated `readScalar()` to fold deeper-indented continuation lines for unquoted plain scalars and flow arrays (fixing `reachable_areas:` lists wrapped across lines by PyYAML, such as in `wsl_ch3.yaml`).
    - Updated `unquote()` to decode YAML `\xHH` / `\uHHHH` / `\UHHHHHHHH` escapes and backslash line-joining (`\`) instead of falling back when `JSON.parse()` fails.
    - Updated `splitList()` so quotes (`'` / `"`) only start quoted items at the beginning of an item rather than mid-word apostrophes (fixing area names like `Yak's Cauldron` and `Participant 1's Showcase Area` in `BREATHLESS.yaml` and `HHDI.yaml`).
    - Updated `yamlScalar()` to quote YAML document markers (`---` and `...`) when used as area names or field values.
- **Accurate bidirectional Inspector arrows for `<ALL>` hubs (`src/components/panels/LinkEditor.svelte`, `src/lib/state.js`):**
    - Updated `entriesFor()` to resolve incoming coverage (`isIn`) via `effectiveIds()` for displayed rows so `<ALL>` areas (like the Hub) listed by an area display `↔` instead of `→`, without flooding lists with unrelated `<ALL>` areas.
    - Reset `pickerFor` and `query` when switching selected areas, and shallow-cloned `s.project` in `update()` so Svelte always propagates nested link edits reliably.
- **Full-height right sidebar resize handle (`src/styles/panels.css`):**
    - Moved `overflow-y: auto` from `#right` onto the inner `#inspector` flex child so `#resizeRight` stays anchored across the full height of the sidebar regardless of scroll position.

### Verification

- Expanded [tests/core.test.mjs](tests/core.test.mjs) to **58 passed, 0 failed** (covering wrapped unquoted `reachable_areas`, `\xHH` / line-joining, mid-word apostrophes in list items, and `...` quoting) and verified cleanly against `wsl_ch3.yaml` (47 areas), `BREATHLESS.yaml` (27 areas), and `HHDI.yaml` (10 areas) with 0 errors and 0 warnings.
- Rebuilt single-file bundles via `npm run build:both` (`export/yuzu_area_maker.html` and `export/yuzu_area_maker_nomusic.html`).

## v2.0.2 — ULTRAKILL-Terminal UI Polish, New Templates, Focus Dimming & Tooltips

### UI & Design Polish
- **Commercial ULTRAKILL-Terminal refinement (`src/styles/{base,chrome,panels,graph}.css`, `Header.svelte`, `GraphToolbar.svelte`, `NodeLayer.svelte`, `Inspector.svelte`):**
  - Added a `>_` terminal brand emblem in the header, crisp group dividers, segmented link-type tabs, and `tabular-nums` alignment across IDs and numeric values.
  - Replaced the background lines with a spacious, dimmed, world-locked dot pattern (`64px` spacing at 100% zoom, `src/components/graph/Graph.svelte`, `src/styles/graph.css`) that pans with the camera and scales directly with zoom, plus soft drop shadows, focus glow, and left accent stripes on nodes and sidebar items.
  - Improved radial cluster layout spacing and aspect-ratio balance (`src/lib/arrange.js`) with staggered odd/even rings and wider clearance for node cards.
  - Added live `N modified` pills to collapsible `Access & locks`, `Behaviour`, and `Permissions` headers in the Inspector.
- **Focus mode dimming (`NodeLayer.svelte`, `EdgeLayer.svelte`):** Tuned unfocused node opacity to `0.17` and unfocused edge opacity to `0.07` for crisp contrast without losing context.
- **Universal hover hints:** Added descriptive `title` tooltips across buttons, labels, dropdowns, toggles, inputs, and badges in the header, sidebars, graph toolbar, direction card, and modals.
- **Clearer `background_tod` label (`Inspector.svelte`):** Changed the placeholder from `key (e.g. day)` to `time of day (e.g. day)`.

### Templates & Export Cleanliness
- **New built-in templates (`src/lib/fields.js`):**
  - Renamed `Yuzu's default` to **`Yuzu's RP Defaults`**.
  - Added **`Private Area`** (`private_area: true`, `locking_allowed: false`, RP-friendly defaults).
  - Added **`Lobby Area`** (`lobby_area: true`, `locking_allowed: true`, `bglock: true`, `cbg_allowed: false`, `change_reachability_allowed: false`, `song_switch_allowed: false`).
- **Stricter default/empty omission (`src/lib/yaml.js`):**
  - Non-mandatory empty or default values (`default_description`, empty `scream_range` lists, empty `restricted_chars`, `afk_delay: 0`, `afk_sendto: 0`, default booleans/extra keys) are omitted on YAML export so the server uses its own defaults cleanly.

### Verification
- Expanded [tests/core.test.mjs](tests/core.test.mjs) to **63 passed, 0 failed**.
- Rebuilt single-file bundles via `npm run build:both` (`export/yuzu_area_maker.html` and `export/yuzu_area_maker_nomusic.html`).

## v2.0.3 — Full ULTRAKILL-Terminal & Warm Paper UI Polish

### Visual & Design System Overhaul
- **Unified theme palette & custom-drawn controls (`src/styles/base.css`):**
  - Refined both **Dark Terminal** (cool layered near-blacks `#0a0a0d`/`#0e0e12`/`#15151b` with ULTRAKILL blood-red `#ec4a32` accents) and **Warm Paper** (`#f1ede4`/`#f8f5ee`/`#fffdf8` ivory surfaces with espresso `#2a2622` ink and terracotta `#c4432b` accents).
  - Replaced native browser checkboxes, select arrows, and range sliders with custom-styled terminal squares (with animated checkmarks), clean CSS chevrons, and crisp thumb sliders, plus `:focus-visible` accessibility rings and `prefers-reduced-motion` support.
- **Chrome & brand framing (`src/styles/chrome.css`, `src/components/Header.svelte`):**
  - Added the header top accent power strip, animated blinking `>_` terminal brand badge (`Area List YAML Maker`), `//` terminal prefixes on modal & card headings, top red accent notches on modals, and hairline hover glow on sidebar resize dividers.
  - Scoped `.modal .tpl-row` so the left sidebar's template selector stays clean without an extra bottom border.
- **Sidebars & inspector polish (`src/styles/panels.css`, `Inspector.svelte`, `AreaList.svelte`, `LinkEditor.svelte`):**
  - Added an Inspector header card displaying the active `#ID` badge, template assignment, and inline `Show fields` filter.
  - Added rotating `▸` chevrons, crisp left accent borders, and hover highlights on collapsible sections and boolean toggle cards.
- **Graph canvas & floating overlays (`src/styles/graph.css`, `Graph.svelte`, `NodeLayer.svelte`, `GraphHud.svelte`, `DirectionCard.svelte`, `ContextMenu.svelte`, `ToastHost.svelte`):**
  - Added a subtle atmospheric `--vignette` inset shadow over the dynamic dot-matrix canvas, hover border highlights and focus shadows on SVG node cards, glassmorphic floating zoom/legend HUD pills, and matching `--radius-lg` + accent framing on popovers, menus, and toasts.
  - Clicking empty space (or box-selecting an empty region) on the graph now clears the active node/edge selection so Focus dimming resets cleanly (`clearSelection` in `src/lib/state.js`).

- **Example Project selector (`src/components/Header.svelte`, `src/assets/wsl_ch3.yaml`):**
  - Expanded **New ▾ → Example project** into a two-option picker: **WSL Chapter 3 (47 areas)** (`wsl_ch3.yaml`, bundled inline) and **Classic sample (8 areas)**.

### Verification
- `npm test` ([tests/core.test.mjs](tests/core.test.mjs)): **66 passed, 0 failed**.
- `npm run build:both`: rebuilt `export/yuzu_area_maker.html` and `export/yuzu_area_maker_nomusic.html`.
