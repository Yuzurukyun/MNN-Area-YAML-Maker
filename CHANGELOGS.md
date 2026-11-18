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
    - **Relative path normalization:** Automatically strips `base/background/` or `background/` prefixes so folders cleanly map to MNN conventions (e.g. `Umamusume/Cafeteria`).
    - **State Variants:** Supports the mandatory `default` state plus custom states (`crowded`, `festive`, `rainy`, etc.) with tab-based editing and state deletion.
    - **Courtroom & Camera Positions:** Toggleable position mode supporting standard court camera angles (`Normal`, `Witness`, `Prosecution`, `Defense`, `Judge`, `Juror`) or custom position tags.
    - **Asset Slots:** Dedicated drag-and-drop slots for Background Image (`★ background`), Foreground Overlay filter/desk (`foreground`), and Ambience Audio (`ambience`, relative to `base/sounds/ambient/`).
    - **Time of Day Variants (`time_variants`):** Visual rows for `day`, `evening`, `night`, and custom times of day with individual background, foreground, and ambience slots.
    - **Dual view & configurable indentation:** Instant toggling between the **Visual Builder** and **Live background.json** formatted code inspector, featuring an indent selector (dropdown + number input) with default `4 spaces`, `2 spaces`, `3 spaces`, `8 spaces`, `Tabs (\t)`, and `Compact (0)`.
    - **One-click area assignment:** **✓ Apply to Area #ID** sets the edited background folder directly onto the currently selected area.

### Interactive Live Stage Monitor

- **Real-time visual composite preview (`BackgroundMakerModal.svelte`):**
    - Live canvas displaying composite layer blending (Background image + layered Foreground filter/desk overlay).
    - Interactive testing controls: Switch between time-of-day variants (`☀ Day`, `🌆 Evening`, `🌙 Night`), positions, and states to preview visual changes live.
    - Built-in ambience audio player with Play/Pause button and loop playback for dropped sound files.

### In-Memory Asset Repository Pool & Multi-Upload

- **Drag-and-drop asset dock (`src/lib/bgStore.js`, `BackgroundMakerModal.svelte`):**
    - Allows dropping entire folders (via `webkitdirectory`) or multiple files (`.webp`, `.png`, `.jpg`, `.opus`, `.mp3`) at once to populate an in-memory asset library without repetitive upload cycles.
    - Filter assets by `All`, `Images`, and `Audio` with live search.
    - Drag any thumbnail from the pool directly onto any background, foreground, or ambience slot in the builder.
    - 100% privacy-safe: all files are handled in-memory via ObjectURLs with zero OS absolute paths (`C:\...`) persisted or leaked.

### Zero-Dependency ZIP Package Exporter

- **Standard client-side ZIP builder (`src/lib/zip.js`):**
    - Built a pure vanilla JavaScript ZIP archive generator supporting UTF-8 filenames, CRC-32 checksums, and standard uncompressed STORE packaging.
    - **📦 Export Folder ZIP:** Exports a ready-to-use MNN server package containing `base/background/<folder>/background.json`, all referenced images, and `base/sounds/ambient/<soundPath>` audio files.
    - **💾 Download JSON / 📋 Copy JSON:** Fast clipboard copy or `.json` file download.

### Inspector & Node Hover Integration

- **Inspector background tools (`src/components/panels/Inspector.svelte`):**
    - Added a library picker dropdown under `background:` to quickly assign any defined background to an area.
    - Added a direct **🖼 Maker…** button to open the editor pre-focused on that area's background.
    - Added **Node Icon** vs **Background Scene** preview toggle, allowing inspection of either the cropped 1:1 node avatar or the full background visual asset.
    - Automatic `background_tod` detection: Displays a green badge (`✓ Handled by background.json`) when an area's background already defines internal time variants.
- **Node hover summaries (`src/components/graph/NodeHoverCard.svelte`):**
    - Displays background scene asset previews when hovering nodes on the canvas that don't have custom node icons.

### Verification

- `npm test` ([tests/core.test.mjs](tests/core.test.mjs)): **133 passed, 0 failed**.
- `npm run build:both`: rebuilt `export/yuzu_area_maker.html`, `export/yuzu_area_maker_nomusic.html`, and `docs/index.html`.
