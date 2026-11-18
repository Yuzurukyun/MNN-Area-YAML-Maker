# Help — Area List YAML Maker

This editor lets you build and maintain a TsuMNN `areas.yaml` visually without fighting commas, quotes, or YAML indentation. Your project **autosaves** automatically in your browser.

## Workspace Layout

- **Header (Top):** **New ▾**, **Import ▾**, **Export ▾**, **Undo / Redo**, **Theme** (`Dark Terminal` / `Warm Light`), **Test mode**, **Templates**, and **Help**.
- **Area List (Left):** Every area in order. The number badge is its **Area ID** (`0` = Hub). Search by name or ID, add areas, merge another YAML/JSON file, or reorder with **↑ / ↓** or **Ctrl+drag**.
- **Connection Map (Center):** Visual node-and-edge editor for `Reachable`, `Visible`, and `Scream` links.
- **Inspector (Right):** All settings for the selected area, grouped by category and filterable by importance (`■` green Common, `■` amber Uncommon, `■` grey Rarely). Hover any field name for its official server description.

## Core Concepts

- **Area 0 is the Hub:** It cannot be deleted or moved off index `0`. New areas start linked to and from the Hub for convenience, and you can freely toggle any Hub link on or off per area.
- **Unique Names:** Areas reference one another by exact name. Duplicate names are highlighted in red and block YAML export until resolved.
- **Mandatory Fields:** Only `★ area` and `★ background` are required. Fields left at server defaults are automatically omitted when exporting `areas.yaml`.
- **YAML vs. JSON:** Export **YAML** for your TsuMNN server. Export **JSON** to save a full project backup including map positions, groups, reference images, layouts, and templates.

## Controls & Shortcuts

| Action | Shortcut / Gesture |
|---|---|
| Select area | Click node or list row |
| Multi-select | **Ctrl+click** / **Shift+click** in list or nodes, or **drag empty canvas** |
| Connect two areas | Drag from a node's **right-edge port** or **Shift+drag** between nodes |
| Edit link direction | Click any connection line to open its **Direction Card** |
| Pan map | **Middle-mouse drag**, **Space + drag**, or toggle **✋ Pan** |
| Toggle minimap radar | **M** (or click chevron on bottom-left radar) |
| Reset camera & zoom | **Home** or **0** (or toolbar **⟲ Reset**) |
| Center on selected area | **C** (or toolbar **⌖ Center**) |
| Jump & center on area | **Double-click** area row in left list |
| Reorder areas | Use **↑ / ↓**, drag, or click the **#Index dropdown** to jump position |
| Area summary | **Hover** any node on the map to view image & details |
| Zoom / Fit | **Mouse wheel** or bottom-right **− / % / + / Fit** (`F` key) |
| Rename on map | **Double-click** a node or group |
| Delete selected area(s) | **Delete / Backspace** (or **✕** in list) |
| Undo / Redo | **Ctrl+Z** / **Ctrl+Shift+Z** (or **Ctrl+Y**) |
| Context menu | **Right-click** canvas, node, group, or image |

## Links (`reachable_areas`, `visible_areas`, `scream_range`)

Each area has three link types, switched cleanly via the tabs above the map:

- **List of areas:** Hand-picked connections. In the sidebar, the checkbox controls whether *this* area lists the target; arrows show pair direction (`↔` two-way, `→` out only, `←` incoming only). Use **Make all ↔** to quickly mirror one-way list links.
- **ALL AREAS:** Reaches every other area. On `reachable_areas`, exports as `<ALL>` (hub included). On `visible_areas` and `scream_range`, exports as an explicit comma-separated list excluding the hub to match TsuMNN server rules. By default, `<ALL>` mesh lines are hidden on the map to avoid clutter — toggle **<ALL> mesh** in the toolbar if you want to see every line.
- **REACHABLE AREAS** *(Visible / Scream)*: Automatically mirrors the area's `reachable_areas` list (`<REACHABLE_AREAS>`). Drawn as faint dashed lines on those tabs; edit them on the **Reachable** tab.
- **No other areas** *(Scream)*: Server default (nobody outside hears `/scream`).

## Map Tools, Groups & Layouts

- **Minimap Radar:** Collapsible birds-eye radar in the bottom-left corner with real-time camera viewport box. Click or drag to jump camera across large maps. Press **M** to toggle.
- **Smart Route Finder (🧭 Route):** Finds the shortest walkable path between any two areas, displays turn-by-turn steps, highlights corridors with emerald neon on the map, and respects RP privacy rules (private rooms and lobbies cannot be used as public transit shortcuts).
- **Network Audit (🔍 Audit):** Scans your area network for true dead ends, one-way trips, disconnected areas, and rooms with no incoming corridors, respecting `<ALL>` exits and framing flags as informational design notices with instant **⌖ View** buttons.
- **Connection Line Styles:** Switch between Curved (smooth Bézier), Orthogonal (90° circuit), and Straight lines in the **⚙ Settings** cog.
- **Focus / Isolate:** **Focus** dims unrelated nodes around your selection. **Isolate** hides everything except your selected area and its direct neighbours (`Esc` exits).
- **Hide hub / Hide `<ALL>`:** Temporarily declutter the board without changing any data.
- **Groups:** Right-click the canvas → **Add group here**. Areas whose centers sit inside a group rectangle move with it. Right-click a group to **Select all areas in zone**, **Copy Zone YAML**, or change its color. **Sort IDs** reorders your area list so members of each group hold consecutive IDs (useful for `/zone_area`).
- **Layouts ▾:** Save snapshots of node positions, groups, and corkboard images so you can experiment safely.
- **Auto-arrange:** Deterministically arranges the Hub on the left, connected clusters in radial islands, and standalone areas underneath, then fits the view.

## Test Mode & Export Validation

- **▶ Test mode:** Walk through your areas like a player using live reachable exits, search exits by name or ID, and verify there are no unintended dead ends.
- **Export YAML:** Blocks export if required fields or duplicate names exist, and shows non-blocking **warnings** if any area has 0 exits, cannot be reached from the Hub, or has an out-of-range `afk_sendto`.

## Background.json Maker & Visual Asset Gallery

- **🖼 Backgrounds (Header & Inspector):** Visual maker for TsuMNN/MNN `background.json` files and folder packages.
- **State Variants & Positions:** Build states (`default`, `crowded`, `festive`) and courtroom/camera positions (`Normal`, `Witness`, `Prosecution`, `Defense`, `Judge`, `Juror`).
- **Time Variants:** Configure `day`, `evening`, `night` variations with background images, foreground overlays, and ambience audio.
- **Asset Pool Dock:** Drag-and-drop folders or batches of images (`.webp`, `.png`, `.jpg`) and audio (`.opus`, `.mp3`) into the pool to build backgrounds without re-uploading.
- **Live Stage Monitor:** Preview blended background and foreground overlays, test times of day, and listen to ambience audio loops in real time.
- **📦 Export Folder ZIP:** Exports a ready-to-use package containing `base/background/<folder>/background.json`, all images, and `base/sounds/ambient/` audio files.
