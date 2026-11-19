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

## v2.0.4 — Header Branding, Area Counter Hierarchy & Extended Graph QoLs

### UI Polish & Extended Graph QoLs

- **Updated header brand (`src/components/Header.svelte`, `src/styles/chrome.css`, `index.html`):**
    - Renamed header title to **MNN Area List YAML Maker** (with the `Made by Yuzu` tooltip), removed the `TsuMNN` badge, and moved the blinking terminal cursor (`_`) onto the end of **YAML Maker**.
- **Prominent area counter (`src/components/panels/AreaList.svelte`, `src/styles/panels.css`):**
    - Enlarged the sidebar area count (`18px` accented count + `14px` bold `AREAS` label) so it stands out cleanly above the action buttons.
- **Smooth ease-in/out camera transitions (`src/components/graph/Graph.svelte`):**
    - Added cubic ease-in-out (`easeInOutCubic`) `requestAnimationFrame` interpolation across programmatic camera moves (`fitView`, `zoomReset`, camera reset, and center-on-node).
    - Gracefully halts animation upon user pointer input (`onSvgDown`, `onNodeDown`, `onWheel`, etc.) so controls never stutter or fight the user.
- **Camera Reset button & shortcuts (`src/components/graph/GraphToolbar.svelte`, `Graph.svelte`):**
    - Added **⟲ Reset** beside the ✋ Pan button on the graph toolbar to smoothly return zoom to 100% and view to default coordinates.
    - Bound to keyboard shortcuts `Home` and `0` (or `Numpad0`).
- **Center-on-node camera navigation (`src/components/graph/GraphToolbar.svelte`, `Graph.svelte`, `AreaList.svelte`, `src/lib/state.js`):**
    - Added **⌖ Center** toolbar button to smoothly reposition the camera over the selected area without altering the current zoom level.
    - Bound to shortcut `C`.
    - **Double-clicking** any area in the left sidebar `AreaList` smoothly flies the camera to that node on the map.
    - Added **Center on selected (C)** and **Reset view (Home / 0)** to the canvas context menu, and **Center camera here** to node right-click menus.

## v2.0.5 — Light Terminal Theme, Custom Node & Group Colors, Full Map Screenshots, Hover Summaries & Multi-Reordering

### Discord Embed & Open Graph Metadata

- **Rich Discord embed cards & Open Graph tags (`index.html`, `scripts/collect-builds.mjs`, `public/og-image.png`):**
    - Added complete Open Graph (`og:*`), Twitter Card (`summary_large_image`), and `<meta name="theme-color">` metadata to GitHub Pages.
    - Designed and generated a 1200×630 high-resolution branded preview banner (`og-image.png`) featuring the terminal prompt, `v2.0.5`, `Made by Yuzu`, and connected node-graph visuals with spatial grouping.
    - Embedded links in Discord now present a full rich card preview with title, description, large image banner, and Discord's accent border tinted to the UI's crimson accent (`#e0533c`).

### Theme Naming & Inspector Alignment Fixes

- **Renamed theme to "Light Terminal" (`Header.svelte`):** Matched terminology with `Dark Terminal`.
- **Inspector square indicator separation (`Field.svelte`, `Bool.svelte`, `panels.css`):**
    - Separated the group square indicator from the key label into dedicated flex columns (`.fline { display: flex; align-items: flex-start; gap: 7px; }`), preventing the square from breaking or wrapping awkwardly onto line 2.
    - Sized square to 12px with 2.5px rounded corners matching the text line height.
- **Node image preview section (`Inspector.svelte`):**
    - Renamed section to **Node Image** and removed descriptive text.
    - Container now fills the section width with downscaled natural aspect-ratio image display.

### Board Groups Colouring, Visibility, Auto-arrange Options & /zone Range Commands

- **Auto-arrange Custom Group Shape Preservation (`src/lib/arrange.js`, `GraphToolbar.svelte`, `SettingsModal.svelte`, `state.js`):**
    - **"Sort inside group" toggle (`sortInsideGroup`, default `false`):** When turned off (default), auto-arrange preserves the custom internal spatial shape, dimensions, and relative offsets of member nodes inside groups—translating the entire group container as a cohesive unit into clean shelf positions without disturbing manual layout. When turned on, member nodes are re-gridded sequentially inside the group container.
    - **"Fit view after arrange" toggle (`arrangeFitView`, default `true`):** Controls whether camera auto-zooms and centers smoothly after arranging.
    - **"Arrange groups only" toggle (`arrangeGroupsOnly`, default `false`):** Only repositions spatial group containers, leaving all loose / ungrouped areas untouched.
    - **Toolbar split-button & Settings modal (`GraphToolbar.svelte`, `SettingsModal.svelte`):** Added an interactive `[Auto-arrange] [▾]` split button directly on the canvas toolbar with quick toggle checkboxes and live hints, mirrored inside the Settings Cog modal.
    - **Hub node preservation:** Grouped nodes (including the Hub if inside a group) maintain group membership and relative position; ungrouped Hub cleanly anchors to canvas margin.
- **Group `/zone` range command copy blocks (`ContextMenu.svelte`, `Graph.svelte`):**
    - Right-clicking any spatial group now inspects its member area indices and provides two instant copy-paste code blocks:
        1. Just the range: `<lowest>, <highest>` (e.g. `4, 12`).
        2. The full command: `/zone <lowest>, <highest>` (e.g. `/zone 4, 12`).
    - **Consecutive detection & warning:** If group members do not form a consecutive range (e.g. `3, 6, 12, 13, 14, 15`), a warning notification and banner alert users to run **Sort IDs**, while still providing the scattered values and `/zone` command to copy anyway, alongside an instant `⚡ Auto-sort IDs into range…` action button.
- **Significantly increased group visibility (`base.css`, `GroupLayer.svelte`):**
    - Boosted dark theme group fill from invisible 1.5% to 5% with distinct `#525263` stroke; boosted light theme group fill to 18% with `#64748b` stroke.
- **Group custom colours (`GroupLayer.svelte`, `ContextMenu.svelte`, `Graph.svelte`):**
    - Right-clicking any spatial group now presents an interactive color swatch palette (Red, Orange, Amber, Green, Teal, Blue, Purple, Pink, Slate) plus custom color picker `🎨` and Reset.
    - Custom colors dynamically tint the group body, tab, and header label, and persist in JSON project exports.

### Extended Zoom Range & Node Double-Click Behaviors

- **Extended zoom in/out boundaries (`Graph.svelte`):**
    - Zoom bounds widened from `0.25× – 2.5×` to `0.08× – 4.0×` (over 3× farther zoom out for large 47+ area networks, and close-up zoom in for detailed inspection).
    - Dot grid background step is clamped to prevent excessive dot density on extreme zoom-out.
- **Dual double-click actions on area nodes (`NodeLayer.svelte`, `Graph.svelte`):**
    - Double-clicking the top name/title section opens the inline rename overlay.
    - Double-clicking anywhere else on the node card smooth-centers the camera on that node.

### Full Graph Screenshot / Map Visual Export

- **High-resolution map image snapshot (`Graph.svelte`, `GraphToolbar.svelte`, `Header.svelte`):**
    - Added one-click **📷 Snapshot** button in the graph toolbar and **Map image — high-res PNG visual…** in the `Export ▾` dropdown.
    - Computes bounding box of all visible nodes, lines, groups, and images (excluding hidden or non-focused nodes), embeds active theme styles and background, and exports a high-definition 2× PNG image (`MNN-Area-Map.png`) with clean fallback to SVG.

### Area List Dropdown Sizing & Sort IDs Confirmation Modal

- **Compact index dropdown width (`panels.css`):**
    - Constrained `.idx-select` to 34–50px so it fits 3 digits (`#47`, `#999`) without expanding across the row, keeping area names prominent.
- **Sort IDs confirmation modal (`Graph.svelte`, `GraphToolbar.svelte`):**
    - Replaced the armed-button toggle with a full confirmation modal explaining that group members will be assigned consecutive ID numbers, `afk_sendto` links will be safely remapped, Hub remains at ID 0, and allowing cancellation.

### Custom Node Colors & Image Icons

- **Persistent custom node colours (`src/lib/model.js`, `NodeLayer.svelte`, `Inspector.svelte`, `ContextMenu.svelte`):**
    - Added free-form node colouring via quick preset swatches in both the Inspector and right-click context menu.
    - Custom colors persist seamlessly across themes.
- **Node 1:1 image icons with automatic cropping (`src/lib/model.js`, `NodeLayer.svelte`, `Inspector.svelte`):**
    - Areas can have an image icon attached via file upload, cropped 1:1 on the node card.

### Node Hover Summary Popup

- **Interactive area summary card (`src/components/graph/NodeHoverCard.svelte`, `Graph.svelte`):**
    - Hovering any node on the canvas reveals a glassmorphic summary card displaying the full area name, #ID badge, fixed-size image preview, background/TOD count, link summaries, active flags, and description snippet.

### Area List Multi-Selection & Quick Index Reordering

- **Multi-select reordering (`src/lib/model.js`, `AreaList.svelte`):**
    - `Ctrl+click` / `Cmd+click` and `Shift+click` to select multiple areas at once; `↑` / `↓` moves all selected areas together.
- **Interactive index position dropdown (`AreaList.svelte`):**
    - Jump-reorder any area to another index position.

### Settings Cog & Canvas Customization

- **Settings modal (`src/components/modals/SettingsModal.svelte`, `Header.svelte`, `src/lib/state.js`, `src/styles/graph.css`):**
    - Auto-arrange node separation slider (`0.5×` to `2.5×`).
    - Connection line thickness slider (`1.0px` to `6.0px`).
    - Connection line neon glow slider (`0px` to `14px`).

## v2.0.6 — Minimap Radar, Smart Route Finder, Network Audit, Line Styles & Group Zone Actions

### Minimap / Radar HUD

- **Interactive miniature radar (`src/components/graph/Minimap.svelte`, `Graph.svelte`, `src/lib/state.js`):**
    - Added a floating birds-eye radar in the bottom-left corner with real-time camera viewport box.
    - Click or drag anywhere on the radar to smoothly glide the main camera to that region of the network.
    - Added a collapsible chevron toggle and keyboard shortcut `M` (`toggleMinimap`).
    - Added a toggle in the Settings Cog modal to enable or disable the minimap by default (`showMinimap`).

### Smart Route Finder

- **Turn-by-turn shortest path navigation (`src/lib/pathAudit.js`, `src/components/graph/RouteBar.svelte`, `Graph.svelte`, `EdgeLayer.svelte`, `src/styles/graph.css`):**
    - Added a floating tactical Route Finder bar toggled via the toolbar **🧭 Route** button or canvas right-click context menu (**Find route from here** / **Find route to here**).
    - Uses Dijkstra's algorithm to compute the shortest walkable path between any two rooms based on physical `reachable_areas` corridors.
    - **Strict physical exit resolution:** Strictly excludes global `<ALL>` reachability shortcuts (`mode === 'list'` required for walkable transit).
    - **RP privacy & lobby protection:** Prevents private rooms/dorms (`private_area: true`) and OOC lobbies (`lobby_area: true`) from being used as intermediate pass-through thoroughfares (they can only serve as starting points or final destinations).
    - **Turn-by-turn cards:** Displays step numbers, source/target `#ID` badges, role badges (`Hub`, `Private`, `Lobby`), and direction arrows.
    - **Visual route highlighting:** Active route connections illuminate on the map with a pulsating neon emerald glow (`.edge.route-active`).
    - Added **⌖ Frame route** to smoothly zoom and frame the active route, and **📋 Copy route** for clipboard sharing.

### Map Network Audit

- **Refined map network auditor (`src/lib/pathAudit.js`, `src/components/modals/AuditModal.svelte`, `Graph.svelte`, `GraphToolbar.svelte`):**
    - Added a one-click network audit tool opened via the **🔍 Audit** button in the canvas toolbar.
    - Accurately distinguishes between structural oversights and intentional RP design choices, strictly excluding `<ALL>` areas from being flagged as dead ends.
    - Categorizes notices into 4 clean tabs:
        - **Dead Ends:** Rooms entered from the network that have 0 outgoing exits (`<ALL>` areas are never flagged as dead ends).
        - **One-Way Trips:** Rooms that can be entered, but have no path leading back to the Hub or any `<ALL>` area.
        - **Completely Disconnected:** Isolated nodes with zero incoming and zero outgoing links.
        - **No Incoming Corridors:** Rooms with exits into the world, but zero incoming links from other rooms (entered via `<ALL>` or menu teleport).
    - Features a 620px expanded layout and instant **⌖ View** buttons beside each flagged room to smoothly center the camera on it for inspection.

### Connection Line Styles in Settings

- **Configurable edge paths (`src/components/modals/SettingsModal.svelte`, `src/lib/graphGeom.js`, `src/components/graph/EdgeLayer.svelte`, `src/lib/state.js`, `src/styles/graph.css`):**
    - Added a **Line Style** selector to the Settings Cog with 3 styles:
        - **Curved (Smooth cubic Bézier):** Flowing organic connection paths.
        - **Orthogonal (90° Circuit / Manhattanesque):** Crisp architectural right-angle wiring.
        - **Straight (Direct):** Classic direct edge lines.
    - Added an interactive live SVG preview showing the chosen line style directly inside the settings modal.
    - Enforced `fill="none"` and `fill: none !important;` on all SVG `<path>` elements, preventing dark/black polygon fills.

### Group Zone Statistics & Bulk Actions

- **Zone area counts & bulk tools (`src/components/graph/GroupLayer.svelte`, `src/components/graph/Graph.svelte`):**
    - Spatial group tabs now display dynamic member count badges (e.g. `[Zone · 8 areas]`).
    - Added **Select all areas in zone** to the group context menu, allowing one-click multi-selection of all member cards for bulk repositioning, inspector review, or deletion.
    - Added **Copy Zone YAML** to the group context menu to copy only the member areas of that spatial zone formatted as valid YAML.

## v2.1.0-dev — Visual Background.json Maker, Multi-Asset Pool, Stage Monitor & Folder Zip Export

### Visual Background.json Maker

- **Dedicated visual builder (`src/components/modals/BackgroundMakerModal.svelte`, `src/lib/bgSchema.js`, `src/lib/bgStore.js`):**
    - Added a dedicated 3-column workspace accessible via the header **🖼 Backgrounds** button, the **Export ▾** menu, or directly from the Inspector beside the `background` input field.
    - **Unified 3-Part Proportional Path Strip:** Relocated the background path bar to its own full-width horizontal strip directly beneath the header, divided into 3 dedicated sections:
        1. Fixed Root Badge: `> base/background/`.
        2. Directory Path Input: Takes ~70% of available width with auto-truncation for long series subfolders (`text-overflow: ellipsis`), and houses the `▾ Folders` shortcut dropdown.
        3. Background / File Name Input: Takes ~30% of available width, highlighted in accent orange.
        - Includes a `📋 Copy` button on the far right and a small monospace full-path label directly beneath the inputs displaying the complete computed server asset path (`FULL PATH: base/background/<subfolder>/<room>/background.json`).
    - **Folder inheritance on creation:** Clicking **+ New** automatically creates the new background inside the currently active series folder.
    - **State Variants:** Supports the mandatory `default` state plus custom states (`crowded`, `festive`, `rainy`, etc.) with tab-based editing and state deletion.
    - **Courtroom & Camera Positions:** Toggleable position mode supporting standard court camera angles (`Normal`, `Witness`, `Prosecution`, `Defense`, `Judge`, `Juror`) or custom position tags.
    - **Asset Slots:** Dedicated drag-and-drop slots for Background Image (`★ background`), Foreground Overlay filter/desk (`foreground`), and Ambience Audio (`ambience`, relative to `base/sounds/ambient/`).
    - **Time of Day Variants (`time_variants`):** Visual rows for `day`, `evening`, `night`, and custom times of day with individual background, foreground, and ambience slots.
    - **Dual view & configurable indentation:** Instant toggling between the **Visual Builder** and **Live background.json** formatted code inspector, featuring an indent selector (dropdown + number input) with default `4 spaces`, `2 spaces`, `3 spaces`, `8 spaces`, `Tabs (\t)`, and `Compact (0)`.
    - **One-click area assignment:** **✓ Apply to Area #ID** sets the edited background folder directly onto the currently selected area.

### Background Folder Templates & Streamlined Area Creation

- **Template Background Patterns (`src/lib/model.js`, `src/components/modals/TemplatesModal.svelte`):**
    - Added `Background Folder Prefix / Pattern` (`bg_prefix`) support to area templates. Custom templates can specify a series path (e.g. `topic/topic/topic/topic/` or `series/room_{name}`), so newly created areas using the template automatically receive `<prefix>/<area_name>` as their background.
    - Templates Modal allows setting or picking any existing series prefix with 1 click, and exports/imports template background prefixes in `area-templates.json`.
- **Session BG Prefix Bar (`src/components/panels/AreaList.svelte`, `src/lib/state.js`, `src/App.svelte`, `src/components/graph/Graph.svelte`):**
    - Added an active `BG Prefix` field in the Area List toolbar right beneath `Template:` with a dropdown of all series folders detected across the project.
    - Creating areas anywhere (via `＋ Add Area` button, map double-click, or context menu) automatically applies the active prefix + area name without needing to duplicate areas or retype repetitive folder prefixes.
- **Inspector Quick Prefix Stamping (`src/components/panels/Inspector.svelte`):**
    - Added a 1-click `⚡ <prefix><area>` button and `▾ Pick prefix…` dropdown in the Inspector's `background:` row, allowing instant application of any series folder to an existing or renamed area.
    - Added `<datalist>` auto-completion to the `background` input with all project folder combinations.

### Interactive Live Stage Monitor & Aspect Ratio Controls

- **Real-time visual composite preview & letterboxing (`BackgroundMakerModal.svelte`, `src/components/panels/Inspector.svelte`):**
    - Live canvas displaying composite layer blending (Background image + layered Foreground filter/desk overlay).
    - **Letterboxed display with black bars:** Defaults to `16:9` resolution with pure black bars (`#000000`, `object-fit: contain`) so visuals match target aspect ratio without cropping or distortion.
    - **Selectable aspect ratio presets:** Quick dropdown with `16:9 (Default)`, `4:3`, `21:9`, `1:1`, and `Auto` (automatically adopts natural loaded image dimensions).
    - **Custom aspect ratio editing:** Dual-input numeric editors (`[ W ] : [ H ]`) allowing direct editing of either dimension on the fly.
    - **Letterbox vs Cover toggle:** 1-click toggle between `◼ Letterbox` (full contained view with black bars) and `⛶ Cover` (viewport fill).
    - Inspector background scene preview updated to `object-fit: contain` with black bars for unified consistency.
    - Interactive testing controls: Switch between time-of-day variants (`☀ Day`, `🌆 Evening`, `🌙 Night`), positions, and states to preview visual changes live.
    - Built-in ambience audio player with Play/Pause button and loop playback for dropped sound files.

### In-Memory Asset Repository Pool & Multi-Upload

- **Drag-and-drop asset dock (`src/lib/bgStore.js`, `BackgroundMakerModal.svelte`):**
    - Allows dropping entire folders (via `webkitdirectory`) or multiple files (`.webp`, `.png`, `.jpg`, `.opus`, `.mp3`) at once to populate an in-memory asset library without repetitive upload cycles.
    - Filter assets by `All`, `Images`, and `Audio` with live search.
    - Drag any thumbnail from the pool directly onto any background, foreground, or ambience slot in the builder.
    - 100% privacy-safe: all files are handled in-memory via ObjectURLs with zero OS absolute paths (`C:\...`) persisted or leaked.

### Zero-Dependency ZIP Package Exporter & Reader

- **Standard client-side ZIP builder & parser (`src/lib/zip.js`):**
    - Built a pure vanilla JavaScript ZIP archive generator and reader supporting UTF-8 filenames, CRC-32 checksums, standard uncompressed STORE packaging, and DEFLATE decompression via native `DecompressionStream`.
    - **📦 Export Folder ZIP:** Exports a ready-to-use MNN server package containing `base/background/<folder>/background.json`, all referenced images, and `base/sounds/ambient/<soundPath>` audio files.
    - **📦 Export All Backgrounds (ZIP):** Comprehensive package bundling the root `backgrounds-library.json`, all background folders with their respective `background.json` files, and referenced artwork/ambience tracks.
    - **Zero-dependency unzipper (`readZip`):** Directly unpacks `.zip` archives in memory, extracting images, ambience audio, and JSON definitions into the library and asset pool with zero external dependencies.
    - **💾 Download JSON / 📋 Copy JSON:** Fast clipboard copy or single `.json` file download.

### Background Progress Persistence & Collaborative Sharing

- **Full Project Save / Load Sync (`areas-project.json`, `src/components/Header.svelte`, `src/lib/model.js`):**
    - `areas-project.json` (via `Export ▾ -> JSON — save project backup`) now bundles all configured `background.json` definitions.
    - When collaborators import `areas-project.json` (via `Import ▾ -> JSON — a saved project file…`), all backgrounds are automatically restored into `bgStore` with a comprehensive toast notification showing both area and background counts.
- **Zero-loss `localStorage` Autosave (`src/lib/bgStore.js`, `src/lib/state.js`):**
    - Background configurations automatically persist in browser `localStorage` under `areaMakerDemo.backgrounds`. Refreshing or reopening the app restores all background definitions seamlessly without data loss.
- **Dedicated Library Sharing & Import Tools (`BackgroundMakerModal.svelte`, `src/lib/bgStore.js`):**
    - Added **📚 Library ▾** dropdown in the modal header:
        - `💾 Export Library (JSON)`: downloads standalone `backgrounds-library.json` containing all background definitions.
        - `📦 Export All (ZIP)`: downloads full package archive containing all backgrounds and asset files.
        - `📥 Import JSON / ZIP…`: opens file picker to load single background files, library collections, project files, or zip packages.
    - Added **📥 Import** button in the Navigator sidebar header next to `+ New`.
    - **Modal-wide Drag & Drop:** Dropping any `.json` or `.zip` file anywhere onto the Background Maker modal highlights the window and automatically registers assets and loads backgrounds with feedback.

### Inspector & Node Hover Integration

- **Inspector background tools (`src/components/panels/Inspector.svelte`, `src/components/graph/NodeLayer.svelte`, `src/lib/bgStore.js`):**
    - Added a library picker dropdown under `background:` to quickly assign any defined background to an area.
    - Added a direct **🖼 Maker…** button to open the editor pre-focused on that area's background.
    - **Synchronized Node Avatar & Visual Preview Toggle:** Toggling **Icon** vs **Scene** under `Visual Preview` in the Inspector now updates the area node card's avatar on the map canvas in real time. Choosing **Scene** displays the resolved background scene visual asset directly on the node card, while choosing **Icon** displays the custom uploaded icon.
    - Strict `background_tod` detection (`hasTimeVariants`): Displays the green badge (`✓ Handled by <folder>/background.json — separate bg_tod is optional`) ONLY when `background.json` specifically defines non-empty `time_variants` (in states or positions); otherwise completely ignored and hidden.
- **Node hover summaries (`src/components/graph/NodeHoverCard.svelte`):**
    - Displays background scene asset previews when hovering nodes on the canvas that don't have custom node icons, and respects `imageMode: 'scene'`.

### Asset Cache, Audit Rework, Export Consistency & Collision Safety

- **IndexedDB Media Asset Cache (`src/lib/assetDb.js`, `src/lib/bgStore.js`):**
    - Implemented a zero-dependency native IndexedDB storage engine (`area_maker_assets_db`, object store `assets`) storing raw binary Blobs directly without Base64 memory inflation.
    - Imported images and ambience audio files are automatically cached in IndexedDB upon registration and re-hydrated into the `assetPool` on page load, persisting user assets across reloads without hitting the browser's ~5MB `localStorage` limit.
    - Graceful fallback in non-browser or disabled environments.
- **Consistent Export & Import Terminology (`src/components/Header.svelte`, `BackgroundMakerModal.svelte`, `ExportModal.svelte`):**
    - Standardized naming across the top navigation bar and modal menus to clearly distinguish server configs, project saves, and asset packages:
        - Header Export: `YAML — server config (areas.yaml)…`, `JSON — project backup (areas-project.json)`, `ZIP — background packages & assets (.zip)…`, `PNG — high-res map canvas image…`.
        - Header Import: `YAML — import server config (areas.yaml)…`, `JSON — import project backup (areas-project.json)…`, `ZIP / JSON — import backgrounds & assets…`.
        - Background Maker Actions: `💾 Export JSON`, `📦 Export Package (.zip)`, and `📚 Library ▾` menu with `💾 Export Library Backup (.json)`, `📦 Export All Backgrounds & Assets (.zip)`, `📥 Import Package or JSON (.json, .zip)…`, and `🧹 Purge Unused Assets`.
- **Map Network Audit Rework (`src/components/modals/AuditModal.svelte`):**
    - Expanded modal width to `min(840px, 96vw)` for a spacious, comfortable inspection view.
    - Decoupled category filter tabs and search into dedicated rows:
        - Row 1: Full-width category pill tabs (`All Issues [N]`, `🛑 Dead Ends [N]`, `🚪 One-Way Trips [N]`, `🏝️ Disconnected [N]`, `🚶 No Way In [N]`) with `white-space: nowrap; flex: 0 0 auto; flex-wrap: wrap;` so category titles never truncate with `...` under any resolution.
        - Row 2: Dedicated search toolbar with live matching count summary (`Matching: X of Y`) and instant clear (`✕`) button.
    - Added a `⌖ View Node` button on every notice row to center the camera on the affected node directly.
- **Strict Duplicate Path Collision Prevention (`src/lib/bgStore.js`, `BackgroundMakerModal.svelte`):**
    - Added `ensureUniqueBgFolder(folder, excludeId)` to prevent duplicate background folder collisions.
    - Live reactive warning (`isDuplicatePath`) highlights duplicate inputs and renders an animated badge (`⚠️ Duplicate Path`) plus hint alert if two backgrounds share the same path.
    - Automatic disambiguation on blur, creation, duplication, or export (e.g. `subfolder/name` → `subfolder/name 2`).
- **Used vs Unused Asset Filter & Purge (`src/lib/bgStore.js`, `BackgroundMakerModal.svelte`):**
    - Added `Used` and `Unused` filter pills in the Asset Repository Pool dock with real-time reference tracking (`getReferencedAssetNames`).
    - Added 1-click `🧹 Purge Unused Assets` action in both the dock bar and the Library menu to delete unreferenced media from memory and IndexedDB.
- **Direct Asset Drag-and-Drop to Canvas Nodes (`src/components/graph/NodeLayer.svelte`, `src/styles/graph.css`):**
    - Enabled HTML5 drag-and-drop on map canvas nodes: dragging an image card from the Asset Pool dock directly onto a node sets its custom node icon (`ar.image`) and switches mode to `node`.
    - Supports dropping OS image files directly from the desktop onto any canvas node with automatic client-side thumbnail scaling.
    - Added visual drag-over feedback with dashed glowing accent outline (`.node.drag-over`).

### UI Streamlining, Progressive Disclosure & Micro-Animations

- **Long Label Auto-Scrolling (`src/lib/autoscroll.js`, `SettingsModal.svelte`, `AreaList.svelte`, `Inspector.svelte`, `AuditModal.svelte`, `BackgroundMakerModal.svelte`):**
    - Created lightweight Svelte action `use:autoscroll` that detects overflowing labels (`scrollWidth > clientWidth + 1`) and smoothly scrolls text back and forth on hover with gentle pauses at boundaries.
    - Added a user preference in `SettingsModal.svelte`: `Autoscroll long labels when not focused` (`autoscrollLongLabels: false` by default). When enabled, overflowing labels scroll continuously even without hover.
    - Attached to area names in `AreaList.svelte`, area header in `Inspector.svelte`, audit report chips in `AuditModal.svelte`, and folder/file paths in `BackgroundMakerModal.svelte`. Music player remains strictly untouched.
- **Compact Link Mode & View Filter Dropdowns (`src/components/graph/GraphToolbar.svelte`):**
    - Replaced the 3 wide link tabs (`Reachable`, `Visible`, `Scream`) with a streamlined `[ 🔗 Reachable ▾ ]` dropdown menu showing descriptive role labels and active checkmarks.
    - Clustered the 5 visibility checkboxes (`Focus mode`, `Isolate selection`, `Hide hub node`, `Hide <ALL> areas`, `<ALL> mesh connections`) into a single `👁 View ▾` dropdown equipped with a dynamic active-filter counter badge (`1`..`5`).
    - Removed `📷 Snapshot` from `GraphToolbar.svelte` to keep canvas toolbar focused exclusively on navigation, layouts, and diagnostics.
- **Standalone Header Camera Snapshot Button (`src/components/Header.svelte`, `src/styles/chrome.css`):**
    - Relocated map canvas snapshot export to a standalone camera emoji button (`📷`) situated directly beside `Export ▾` in the main top header bar.
    - Removed `PNG — high-res map canvas image…` from the `Export ▾` dropdown menu so the camera button serves as the single clear, accessible snapshot action.
- **Inspector Progressive Disclosure (`src/components/panels/Inspector.svelte`, `src/styles/panels.css`):**
    - Added a segmented tier selector: `[ ⚡ Essentials ]` vs `[ 🛠️ Full Server Spec ]`.
    - In `⚡ Essentials` (default), advanced server spec sections (`Access & locks`, `Behaviour`, `Permissions`) are hidden unless an area has modified non-default values (`accessMod > 0 || behMod > 0 || permMod > 0`), keeping the inspector uncluttered for standard corridor mapping.
    - Added a collapsible chevron toggle for `Visual Preview` (`previewOpen`).
- **Foldable Asset Pool Dock & Micro-Animations (`BackgroundMakerModal.svelte`, `src/styles/base.css`, `src/styles/panels.css`):**
    - Added a `▼` / `▲` collapse toggle button on the bottom Asset Repository Pool dock in Background Maker, collapsing the strip to expand vertical builder workspace.
    - Added tactile `:active { transform: scale(0.975) translateY(0.5px); }` button micro-animations across all UI buttons.
    - Smooth chevron rotation on preview collapse toggles and dragover slot highlights.
- **Background Templates & Dedicated Variant Modals (`src/lib/bgSchema.js`, `src/lib/bgStore.js`, `BackgroundMakerModal.svelte`):**
    - **Safe Row Delete Action:** Moved the variant delete `✕` button to the far right end of `.tod-row-card` separated from the variant badge, completely eliminating accidental deletions when selecting rows.
    - **Add Time of Day Variant Modal:** Replaced hardcoded `+ Day`, `+ Evening`, `+ Night`, `+ Custom` buttons with a single `+ Time Variant` action that opens a modal with a dropdown populated with standard presets (`day`, `evening`, `night`, `morning`, `dawn`, `dusk`, `midnight`) plus any existing keys across the library/server.
    - **Add State Variant Modal:** Replaced browser `prompt()` with a dedicated `+ State` modal featuring suggested state presets (`crowded`, `festive`, `rainy`, `damaged`, `ruined`, `empty`, `dim`, `night`, `clean`) plus library states, with an initial slot clone source picker.
    - **Full Background Templates System:** Implemented reusable background structural templates mirroring area templates (`BUILTIN_BG_TEMPLATES`, `applyBgTemplate`, `extractBgTemplateStructure`):
        - 6 Built-in Presets: *Simple Single Scene*, *Day / Night Cycle* (2 variants), *Full Day Cycle* (Day / Evening / Night), *Courtroom (5 Positions)*, *Courtroom + Day / Night Cycle* (5 positions × 2 time variants), and *Class Trial Debate* (4 states).
        - Added `📋 Templates ▾` dropdown in the builder bar for 1-click application of any template.
        - Added **Manage & Save Templates** dialog to inspect presets, save the active background structure as a custom reusable template, and manage custom templates.

### Real-Time Purge Reactivity & Purge Dropdown QoL

- **Real-Time Purge Unused Reactivity (`src/lib/bgStore.js`, `src/components/modals/BackgroundMakerModal.svelte`):**
    - Fixed reactivity bug where deleting backgrounds did not immediately mark their unreferenced assets as unused until closing and reopening the modal.
    - Updated `bgStore.getReferencedAssetNames(bgs = null)` to accept the reactive `backgrounds` list as an argument, and bound `$: referencedAssetNames = bgStore.getReferencedAssetNames(backgrounds);` so Svelte recalculates referenced assets instantly whenever backgrounds or states are added, modified, or deleted.
- **Purge Dropdown Menu (`BackgroundMakerModal.svelte`, `src/styles/chrome.css`):**
    - Converted the single purge button in the Asset Repository Pool dock into a clean `[ 🧹 Purge ▾ ]` dropdown opening upwards (`bottom: calc(100% + 6px)`).
    - Includes two dedicated actions:
        - `🧹 Purge Unused (N)`: Disabled when `unusedAssetCount === 0`.
        - `🗑 Purge All (N)`: Destructive purge option to completely clear all assets from memory and IndexedDB.
    - Added the same two options under the modal header's `📚 Library ▾` menu.
- **Dedicated Purge Confirmation Modals (`BackgroundMakerModal.svelte`):**
    - Replaced generic browser `confirm()` popups with a custom styled confirmation modal (`.purge-confirm-dialog`).
    - Surfaces clear explanations of what will be purged, distinguishing between safe unused asset cleanup and destructive full pool purges (`⚠️ Destructive Action` badge).

### Slot Type Safety, Duplicate Prevention & Import Disambiguation

- **Ghost Duplicate Asset Creation Fix (`BackgroundMakerModal.svelte`):**
    - Fixed issue where dragging an asset card from the pool dock into a slot caused Chromium's native `<img>` dragging to synthesize a temporary file with a UUID filename, which bubbled up to `onModalDrop` and registered as a duplicate asset in the pool.
    - Added `draggable="false"` on all thumbnail `<img>` elements and called `e.stopPropagation()` on slot drops.
    - Added explicit guard in `onModalDrop` and `onPoolDrop` to ignore internal asset drags (`application/x-area-maker-asset`), ensuring asset cards dropped onto slots or modal background never re-import as new files.
- **Strict Slot Type Enforcement (`BackgroundMakerModal.svelte`):**
    - Disallowed audio files from being slotted into image slots (`background`, `foreground`, and TOD `background`/`foreground`). Any attempt to drop or assign audio to an image slot is strictly blocked with an explanatory warning toast (`⚠️ Audio files cannot be assigned to image slots.`).
    - Disallowed image files from being slotted into ambience audio slots (`ambience` and TOD `ambience`). Any attempt to drop or assign an image to ambience is strictly blocked with an explanatory warning toast (`⚠️ Image files cannot be assigned to Ambience Audio.`).
    - Added interactive drag-over visual cues: dragging valid assets over slots displays a glowing accent border (`.drag-target-valid`), while dragging mismatched assets displays a red dashed border and a forbidden cursor (`.drag-target-invalid` with `dropEffect = 'none'`).
- **Batch Import vs Single-Slot Drop Separation (`BackgroundMakerModal.svelte`):**
    - Fixed issue where dragging multiple files from desktop to import them accidentally slotted the first file into whichever slot the cursor was over.
    - Dropping multiple files (`files.length > 1`) anywhere over slot cards now cleanly imports all files into the Asset Repository Pool without assigning them to any individual slot.
    - Dropping a single file directly onto a slot card registers it into the pool and assigns it only if its file type matches the slot type.
- **Slot Quick-Pickers & Mini-Slot Clear Actions (`BackgroundMakerModal.svelte`):**
    - Added quick-pick dropdowns (`▾ Pick image…`, `▾ Pick overlay…`, `▾ Pick audio…`) on empty slot card headers, allowing users to assign assets directly with a single click without requiring drag-and-drop.
    - Added clear `✕` buttons on Time of Day mini-slots (`.mslot-clear-btn`), enabling users to clear individual TOD slot overrides back to base without deleting the entire time variant.
- **Two-Line Slot Header Typography & Subtitle Formatting (`BackgroundMakerModal.svelte`):**
    - Replaced the single-line cluttered slot titles with a structured two-line layout:
        - **Background Image:** Title `Background Image` with dimmed secondary descriptor `Scene backdrop`.
        - **Foreground:** Title `Foreground` with dimmed secondary descriptor `Filter / Desk`.
        - **Ambience:** Title `Ambience` with dimmed secondary descriptor `base/sounds/ambient`.
    - Styled slot descriptions with smaller, dimmed monospace font tokens (`var(--dim)`, 9.5px) matching the app's inspector and toolbar design language, with `white-space: nowrap` and ellipsis preventing wrapping alongside quick-pick dropdowns.

### Slot Type Safety, Duplicate Prevention & Import Disambiguation

- **Ghost Duplicate Asset Creation Fix (`BackgroundMakerModal.svelte`):**
    - Fixed issue where dragging an asset card from the pool dock into a slot caused Chromium's native `<img>` dragging to synthesize a temporary file with a UUID filename, which bubbled up to `onModalDrop` and registered as a duplicate asset in the pool.
    - Added `draggable="false"` on all thumbnail `<img>` elements and called `e.stopPropagation()` on slot drops.
    - Added explicit guard in `onModalDrop` and `onPoolDrop` to ignore internal asset drags (`application/x-area-maker-asset`), ensuring asset cards dropped onto slots or modal background never re-import as new files.
- **Strict Slot Type Enforcement (`BackgroundMakerModal.svelte`):**
    - Disallowed audio files from being slotted into image slots (`background`, `foreground`, and TOD `background`/`foreground`). Any attempt to drop or assign audio to an image slot is strictly blocked with an explanatory warning toast (`⚠️ Audio files cannot be assigned to image slots.`).
    - Disallowed image files from being slotted into ambience audio slots (`ambience` and TOD `ambience`). Any attempt to drop or assign an image to ambience is strictly blocked with an explanatory warning toast (`⚠️ Image files cannot be assigned to Ambience Audio.`).
    - Added interactive drag-over visual cues: dragging valid assets over slots displays a glowing accent border (`.drag-target-valid`), while dragging mismatched assets displays a red dashed border and a forbidden cursor (`.drag-target-invalid` with `dropEffect = 'none'`).
- **Batch Import vs Single-Slot Drop Separation (`BackgroundMakerModal.svelte`):**
    - Fixed issue where dragging multiple files from desktop to import them accidentally slotted the first file into whichever slot the cursor was over.
    - Dropping multiple files (`files.length > 1`) anywhere over slot cards now cleanly imports all files into the Asset Repository Pool without assigning them to any individual slot.
    - Dropping a single file directly onto a slot card registers it into the pool and assigns it only if its file type matches the slot type.
- **Slot Quick-Pickers & Mini-Slot Clear Actions (`BackgroundMakerModal.svelte`):**
    - Added quick-pick dropdowns (`▾ Pick image…`, `▾ Pick overlay…`, `▾ Pick audio…`) on empty slot card headers, allowing users to assign assets directly with a single click without requiring drag-and-drop.
    - Added clear `✕` buttons on Time of Day mini-slots (`.mslot-clear-btn`), enabling users to clear individual TOD slot overrides back to base without deleting the entire time variant.

### Background Maker Header Restructure, Purge Reset, Global/Local Asset Renaming & Context Menus

- **Purge All Slot Clearing & Dead Reference Elimination (`src/lib/bgStore.js`, `BackgroundMakerModal.svelte`):**
    - Fixed issue where clicking **Purge All** emptied the Asset Repository Pool but left backgrounds, states, positions, and time variants holding onto dead/orphan filenames (`st.background`, `st.foreground`, `st.ambience`).
    - `bgStore.clearAllAssets(clearBackgroundSlots = true)` now resets all assigned slot filenames across all backgrounds, states, positions, and time variants to `''`, clears all slot aliases (`bg.assetSources = {}`), and updates the Live Stage Monitor to clean `No image assigned` fallback in real time.
- **Two-Row Header Layout & Blinking Caret (`BackgroundMakerModal.svelte`):**
    - Removed the gray badge box `<span class="maker-subtag">MNN SCENE ASSET BUILDER</span>`.
    - Transformed the header into a clean two-row layout:
        - **Row 1 (`.maker-title-row`):** Full-width header title `// BACKGROUND.JSON MAKER_` with terminal blinking cursor (`.cursor` animated with `cursor-blink` keyframes), plus the modal close `✕` button on the far right.
        - **Row 2 (`.maker-toolbar-row`):** Dedicated toolbar row below the title hosting `✓ Apply to Area #N` on the left and `Import…`, `Copy JSON`, `Export JSON`, `Export Package (.zip)`, `Library ▾`, `Templates ▾` on the right, completely resolving header crowding.
- **Global Asset Renaming with Instant Propagation (`src/lib/bgStore.js`, `src/App.svelte`, `BackgroundMakerModal.svelte`):**
    - Added global asset renaming function `bgStore.renameAsset(assetId, newName)` accessible from the Asset Repository Pool cards context menu.
    - Automatically updates the asset file and filename in the asset pool and IndexedDB cache, propagates the new name across all backgrounds, states, positions, time variants, and `assetSources` maps in the library, and dispatches a `bg-asset-renamed` event.
    - `App.svelte` listens for `bg-asset-renamed` and synchronizes all area node backgrounds (`area.background`, `area.background_tod`, and canvas image overlays) across the active project graph in real time.
- **Per-Background Slot Export Filename Aliases (`src/lib/bgStore.js`, `BackgroundMakerModal.svelte`):**
    - Added local slot override renaming function via the pencil icon `✏️` on slot headers and right-click context menu (**Rename Export Filename…**).
    - Allows users to customize the exported filename written into `background.json` and package ZIP for that specific background (e.g. exporting `IMG_098.png` as `courtroom_day.png`) without modifying the original asset in the pool.
    - Preserves source-to-export mapping via `bg.assetSources[exportName] = originalPoolAssetName`.
    - Renders an `alias of [original_name]` indicator tag beneath the slot filename and an amber dot indicator `●` on Time of Day mini-slots.
    - Slot context menu includes **Reset Export Filename (Reset to Asset Name)** to revert aliases back to the pool asset name.
    - `bgStore.exportZip` and `bgStore.exportAllZip` read `bg.assetSources` and bundle assets directly under their customized slot names in the ZIP packages.
    - `bgStore.getReferencedAssetNames` recognizes source assets mapped in `assetSources` as used so aliased assets are never accidentally purged.
- **Right-Click Context Menu System & Lightbox Previewer (`BackgroundMakerModal.svelte`):**
    - Added rich floating context menus (`.bg-ctx-menu`) across Background JSON Maker surfaces:
        - **Asset Pool Cards:** Rename Asset (Global), Inspect Asset Preview, Assign as Background, Assign as Foreground, Assign as Ambience (disabled for images), Copy Filename, Copy Server Path, Delete from Pool.
        - **Primary Slot Cards & TOD Mini-Slots:** Rename Export Filename…, Reset to Asset Name, Inspect Asset Preview, Copy Filename, Copy Server Path, Clear Slot.
        - **Left Sidebar Backgrounds:** Duplicate Background, Rename Folder Path…, Export JSON, Export Package (.zip), Delete Background.
        - **State Variant Tabs:** Duplicate State, Rename State…, Delete State.
        - **Time of Day Variant Rows:** Duplicate Time Variant, Rename Time Variant Key…, Clear All Overrides (Reset to Base), Delete Time Variant.
        - **Live Stage Monitor:** Switch Fit Mode (Contain / Cover), Inspect Stage Image Preview, Copy Live Visual Config JSON.
    - Added full-screen Lightbox asset preview modal (`.inspect-lightbox`) opened via context menu or double-clicking any slot or pool card, displaying full-resolution images or playing audio with scrub controls and file metadata.

### Scrim Drag-Out Protection, Slot Double-Click Renaming & Lightbox In-Line Dual Renaming

- **Universal Scrim Drag-Out Protection Across All Modals (`src/components/modals/*.svelte`):**
    - Fixed issue where selecting or dragging text inside input fields or textareas (e.g. rename inputs, JSON inspectors, settings sliders, or template names) and releasing the mouse button outside the dialog card triggered an accidental backdrop click event that closed the modal.
    - Added backdrop drag-out protection tracking `scrimMouseDownTarget === e.currentTarget && e.target === e.currentTarget` alongside `on:mousedown|stopPropagation` on modal cards across all modals (`BackgroundMakerModal`, `AuditModal`, `ExportModal`, `SettingsModal`, `TemplatesModal`, `ConfirmModal`, `HelpModal`, and `TestMode`).
    - Modals now only close when a user explicitly initiates and completes a click directly on the backdrop scrim, never from dragging text selection out of inputs.
- **Single-Click Slot Label to Rename (`BackgroundMakerModal.svelte`):**
    - Single-clicking the filename label on any slot card (Background Image, Foreground, Ambience) or Time of Day mini-slot immediately opens the Rename Export Filename modal (since single-clicking the thumbnail specifically opens the Lightbox preview, single-clicking the text label provides direct, effortless access to renaming).
    - Added `.clickable-rename` with hover color highlighting and dotted underline cues for intuitive discoverability alongside the pencil icon `✏️`.
- **Single-Click Lightbox Preview & In-Line Dual Renaming (`BackgroundMakerModal.svelte`):**
    - Single-clicking slot thumbnails or Asset Repository Pool cards directly opens the full-screen Lightbox asset inspector (with internal drag-detection flag `assetDragOccurred` ensuring drag-to-slot functionality remains completely uninterrupted).
    - Double-clicking asset cards in the pool directly triggers the Global Asset Rename modal.
    - Replaced the static Lightbox header with two in-line input boxes placed strictly in-line with the `[IMAGE]` / `[AUDIO]` tag badge:
        - `GLOBAL:` Renames the asset in the pool globally across all backgrounds, states, time variants, and active project nodes in real time.
        - `EXPORT:` Customizes the export filename alias written into `background.json` and ZIP export for the active background without altering the global asset.
    - Unified vertical height (`height: 26px`) and flex-center alignment across `.lightbox-badge`, `.lightbox-input-box`, and close button `✕`, achieving 0.00px vertical offset for a clean, cyber-themed header bar.
- **Backgrounds Sidebar Header Restructure (`BackgroundMakerModal.svelte`):**
    - Restructured the left navigator header (`.nav-head`) into a clean two-row vertical layout:
        - **Row 1 (`.nav-head-title-row`):** Full-width title `BACKGROUNDS ({count})` with bold uppercase styling, completely eliminating awkward wrapping of the title or count onto multiple lines.
        - **Row 2 (`.nav-head-actions`):** Dedicated button row below the title structured as a 2-column grid (`1fr 1fr`) hosting `[ ＋ New ]` and `[ 📥 Import ]` side-by-side with balanced padding.

### Courtroom Camera Positions Modal, Template Presets & Context Menu

- **Add Camera Position Modal (`BackgroundMakerModal.svelte`):**
    - Replaced the legacy browser `prompt()` dialog and redundant quick-add preset pill strip (`Normal Witness Prosecution Defense Judge`) with a dedicated **🎥 Add Camera Position** modal (`showAddPositionModal`).
    - Position preset dropdown populated dynamically with:
        - **Standard Courtroom Presets:** `Normal`, `Witness`, `Prosecution`, `Defense`, `Judge`, `Counsel`, `Gallery`, `Jury`, `Bench`, `Wide`.
        - **Template Positions:** Positions extracted directly from built-in templates (`builtin-courtroom-5`, `builtin-courtroom-day-night`) and custom background templates saved in the library (`tpl.structure.positions`).
        - **Existing in Library:** Any camera positions defined across other backgrounds and states in the project.
    - Automatically pre-selects the first available preset that does not already exist on the active state (e.g. defaulting to `Witness` when `Normal` is active).
    - Custom text input with live duplicate detection warning (`⚠ Camera position "{name}" already exists on this state.`).
    - **Initial slots copy options:** Allows copying from the active position, another existing position, base state slots, or starting with blank slots.
    - Checkbox option to copy Time of Day variants from the source position into the new camera position.
    - Equipped with universal scrim drag-out protection (`onScrimMouseDown` / `handleScrimClose`) and Escape key dismissal.
- **Import Positions from Background Template:**
    - Integrated a direct **"OR IMPORT FROM TEMPLATE"** section in the Add Camera Position modal (`importPositionsFromTemplate(tpl)`).
    - Allows one-click bulk import of all camera angles configured in a template (e.g. importing all 5 positions from `Courtroom (5 Positions)`) without wiping existing positions or overwriting configured assets.
- **Position Tabs Context Menu & Duplicate/Rename/Clear/Delete Actions (`BackgroundMakerModal.svelte`, `src/lib/bgStore.js`):**
    - Added right-click context menu (`.bg-ctx-menu`) on position tabs with full feature-parity to State and Time of Day variants:
        - **Duplicate Position (`bgStore.duplicatePosition`):** Clones the camera position, its slot assets, and all nested time variants with auto-incrementing `_copy` naming.
        - **Rename Position…:** Opens the modal rename dialog with validation against duplicate position keys.
        - **Clear Slot Overrides:** Resets background, foreground, and ambience slots on the position back to empty.
        - **Delete Position:** Removes the camera angle and automatically shifts the active position to the first remaining angle; protected with warning when only one position remains.
- **Clean Position Bar & Manage Strip (`BackgroundMakerModal.svelte`):**
    - Replaced the redundant preset pills with a dedicated `+ Position` button in `.pos-tabs`.
    - Added `.pos-manage-strip` displaying active camera position feedback (`Camera position: Normal (Right-click tab for options)`) and an inline Delete position button when multiple positions exist.

### Universal Directory & INI Import Engine, Recursive Drag-Drop & Duplicate Asset Slot Preservation

- **Legacy MNN / Ace Attorney Online `.ini` Background Parser (`src/lib/bgSchema.js`):**
    - Added complete INI background parser `parseBackgroundIni(iniText, folderName)` enabling backwards compatibility for legacy MNN / Ace Attorney Online background directories (e.g. `positions.ini` or `*.ini`).
    - Maps shorthand section names (`[wit]` -> Witness, `[def]` -> Defense, `[pro]` -> Prosecution, `[jud]` -> Judge, `[hld]` -> Counsel, `[hlp]` -> Counsel Prosecution, `[jur]` -> Jury, `[sea]`/`[gal]` -> Gallery, `[norm]` -> Witness).
    - Sets `Witness` (`wit`) as the default courtroom position across all camera positions, active tab selection, and base state fallback slots (`Gallery =/= Normal`, with `witness == normal`).
    - Takes `.ini` data strictly as-is: INI definitions do not support time variants, so sections are parsed directly without time-variant guesswork (`time_variants: {}`).
    - Maps slot properties (`back`/`background`/`bg`/`image` -> background, `front`/`foreground`/`fg`/`desk`/`overlay` -> foreground, `ambient_sfx`/`ambient`/`ambience`/`audio`/`sound` -> ambience).
    - Imports legacy INI folders cleanly and converts them directly into modern, standard `background.json` structures upon export.
- **Universal Directory & ZIP Import Engine (`src/lib/bgStore.js`):**
    - Unified file, folder, and archive processing into an intelligent directory tree walker.
    - Recursively processes directories and ZIP archives, grouping files by directory and stripping leading `background/`, `base/background/`, or `base/` prefixes.
    - Automatically discovers `.ini` (e.g. `positions.ini`) and `.json` (e.g. `background.json`) config files within each folder to construct backgrounds.
    - If a folder contains images/audio without a config file, automatically synthesizes a background and auto-slots backdrop, desk/overlay, and ambience audio files based on naming heuristics.
    - Replaces placeholder blank `Default` background automatically when importing real backgrounds and auto-selects the first newly imported background.
- **Duplicate Asset Collision Suffixing with Clean Slot Preservation (`src/lib/bgStore.js`, `BackgroundMakerModal.svelte`):**
    - When importing assets that share an existing filename in the global Asset Repository Pool with different content or size, the pool asset is automatically disambiguated with a counter suffix (`name_1.ext`, `name_2.ext`).
    - The background's slot continues to use the clean, original name (`name.ext`) for clean exports, automatically recording the mapping in `bg.assetSources[cleanName] = disambiguatedPoolName`.
    - When exporting JSON or ZIP packages, files are written under their clean slot names without pool suffixes.
- **Recursive Drag-and-Drop & Two-Option Import Dropdown (`BackgroundMakerModal.svelte`):**
    - Upgraded drag-and-drop handler with `getAllFilesFromDataTransfer` utilizing `webkitGetAsEntry()` and recursive `readEntries()` to seamlessly traverse dropped folders and nested directory structures in modern browsers.
    - Replaced single import button with an intelligent dropdown menu available in both the top toolbar and the Backgrounds sidebar:
        - **📁 Import Directory / Folder…**: Selects and recursively traverses any folder structure from disk.
        - **📦 Import ZIP, INI, or JSON File…**: Imports archive packages, legacy `.ini` definitions, or modern `background.json` files.
    - Updated file inputs to accept `.zip,.ini,.json`.

### Verification

- `npm test` ([tests/core.test.mjs](tests/core.test.mjs)): **239 passed, 0 failed** (all assertions covering INI parsing, courtroom position mapping with Witness default, single scene INI, taking INI data as-is without time variants, duplicate asset collision suffixing with slot alias preservation, camera position duplication, slot clearing on purge, and state duplication).
- `npm run build:both`: rebuilt `export/yuzu_area_maker.html` (5199 KB), `export/yuzu_area_maker_nomusic.html` (545 KB), and `docs/index.html` (545 KB) with 0 warnings and 0 errors.
- Live browser CDP tests verified:
    - **Legacy INI Import & Witness Default:** Imported `Manor_Second_Floor_[Day].zip` containing `positions.ini` and scene images; background appeared immediately in sidebar as `Manor Second Floor [Day]`, became the active selection, and selected `Witness` as default active position ([verified_ini_imported_bg_list.png](file:///C:/Users/user/.gemini/antigravity/brain/3189314c-7a18-42e5-ab0c-aba948813dfc/verified_ini_imported_bg_list.png)).
    - **Courtroom Positions & Auto-Slotting:** Courtroom positions toggle enabled automatically with 6 camera positions (`Witness`, `Defense`, `Prosecution`, `Judge`, `Counsel`, `Counsel Prosecution`). `Witness` auto-slotted `witnessempty.webp` and ambience `wsl/generic_room_day.opus`; `Defense` auto-slotted `cloudy_back.webp` and `rain_front.webp` ([verified_ini_courtroom_positions_and_slots.png](file:///C:/Users/user/.gemini/antigravity/brain/3189314c-7a18-42e5-ab0c-aba948813dfc/verified_ini_courtroom_positions_and_slots.png)).
    - **Two-Option Import Dropdowns:** Clicking `📥 Import ▾` in sidebar header displays the styled popup menu with `📁 Import Folder…` and `📦 Import ZIP / File…` ([verified_import_dropdown_options.png](file:///C:/Users/user/.gemini/antigravity/brain/3189314c-7a18-42e5-ab0c-aba948813dfc/verified_import_dropdown_options.png)).
    - **Duplicate Asset Suffixing & Alias Mapping:** Importing duplicate assets with differing file contents assigns pool suffix `cloudy_back_1.webp` while retaining clean slot name and registering `bg.assetSources`.
    - **Backgrounds Sidebar Header Layout:** `BACKGROUNDS ({count})` title renders cleanly on top row while `[ ＋ New ]` and `[ 📥 Import ▾ ]` form a balanced 2-column grid below it ([verified_sidebar_header_two_row.png](file:///C:/Users/user/.gemini/antigravity/brain/3189314c-7a18-42e5-ab0c-aba948813dfc/verified_sidebar_header_two_row.png)).
    - **Universal Scrim Drag-Out Protection:** Selecting text inside rename input and dragging mouse completely outside dialog card onto backdrop before releasing mouseup does NOT dismiss the dialog; direct backdrop clicks still close cleanly ([verified_single_click_rename_dialog.png](file:///C:/Users/user/.gemini/antigravity/brain/3189314c-7a18-42e5-ab0c-aba948813dfc/verified_single_click_rename_dialog.png), [verified_rename_position_modal.png](file:///C:/Users/user/.gemini/antigravity/brain/3189314c-7a18-42e5-ab0c-aba948813dfc/verified_rename_position_modal.png)).
    - **Single-Click Slot Label to Rename:** Single-clicking slot filename labels on Background, Foreground, Ambience, and TOD mini-slots immediately opens the Rename Export Filename dialog with value pre-filled ([verified_single_click_rename_dialog.png](file:///C:/Users/user/.gemini/antigravity/brain/3189314c-7a18-42e5-ab0c-aba948813dfc/verified_single_click_rename_dialog.png)).
    - **Single-Click Lightbox Preview & In-Line Dual Renaming:** Single-clicking slot thumbnails or pool asset cards opens the Lightbox asset inspector smoothly with `GLOBAL:` and `EXPORT:` input boxes vertically centered with 0.00px offset ([verified_lightbox_dual_inline_rename.png](file:///C:/Users/user/.gemini/antigravity/brain/3189314c-7a18-42e5-ab0c-aba948813dfc/verified_lightbox_dual_inline_rename.png)).
    - **Add Camera Position Modal & Context Menu:** Clicking `+ Position` opens the dedicated `🎥 Add Camera Position` modal with presets from standard courtroom angles, templates, and library ([verified_add_position_modal.png](file:///C:/Users/user/.gemini/antigravity/brain/3189314c-7a18-42e5-ab0c-aba948813dfc/verified_add_position_modal.png), [verified_position_context_menu.png](file:///C:/Users/user/.gemini/antigravity/brain/3189314c-7a18-42e5-ab0c-aba948813dfc/verified_position_context_menu.png)).
    - Music player left completely untouched.
    - Verified strictly on branch `v2.1.0-dev`.
