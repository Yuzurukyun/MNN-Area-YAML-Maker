# Help — Area List YAML & Background.json Maker

This editor lets you visually build, arrange, and maintain TsuMNN `areas.yaml` map topologies and modern `background.json` courtroom/area packages without fighting commas, quotes, or YAML indentation. Your project **autosaves** automatically in your browser.

---

## Workspace Layout

- **Header (Top):** **New ▾**, **Import ▾**, **Export ▾**, **Camera Snapshot (📷)**, **Undo / Redo**, **Theme** (`Dark Terminal` / `Warm Light`), **▶ Test mode**, **Templates**, **🖼 Backgrounds**, and **? Help**.
- **Area List (Left):** Every area in order. The number badge is its **Area ID** (`0` = Hub). Search by name or ID, set active `BG Prefix`, add areas, merge another YAML/JSON file, or reorder with **↑ / ↓** or **Ctrl+drag**.
- **Connection Map (Center):** Visual node-and-edge editor for `Reachable`, `Visible`, and `Scream` links with smart route finder and topology audit.
- **Inspector (Right):** All settings for the selected area, grouped by category and filterable by importance (`■` green Common, `■` amber Uncommon, `■` grey Rarely), plus quick background prefix stamping. Hover any field name for its official server description.

---

## Core Concepts

- **Area 0 is the Hub:** It cannot be deleted or moved off index `0`. New areas start linked to and from the Hub for convenience, and you can freely toggle any Hub link on or off per area.
- **Unique Names:** Areas reference one another by exact name. Duplicate names are highlighted in red and block YAML export until resolved.
- **Mandatory Fields:** Only `★ area` and `★ background` are required. Fields left at server defaults are automatically omitted when exporting `areas.yaml`.
- **YAML vs. JSON:** Export **YAML** for your TsuMNN server. Export **JSON** to save a full project backup including map positions, groups, reference images, layouts, and templates.

---

## Controls & Shortcuts

### Connection Map & Canvas
| Action | Shortcut / Gesture |
|---|---|
| Select area | Click node or list row |
| Multi-select | **Ctrl+click** / **Shift+click** in list or nodes, or **drag empty canvas** |
| Connect two areas | Drag from a node's **right-edge port** or **Shift+drag** between nodes |
| Edit link direction | Click any connection line to open its **Direction Card** |
| Pan map | **Middle-mouse drag**, **Space + drag**, or toggle **✋ Pan** |
| Toggle minimap radar | **M** (or click chevron on bottom-left radar) |
| Reset camera & zoom | **Home** or **0** (or toolbar **↺ Reset**) |
| Center on selected area | **C** (or toolbar **⌖ Center**) |
| Jump & center on area | **Double-click** area row in left list |
| Reorder areas | Use **↑ / ↓**, drag, or click the **#Index dropdown** to jump position |
| Area summary | **Hover** any node on the map to view image & details |
| Zoom / Fit | **Mouse wheel** or bottom-right **− / % / + / Fit** (`F` key) |
| Rename on map | **Double-click** a node or group |
| Delete selected area(s) | **Delete / Backspace** (or **✕** in list) |
| Undo / Redo | **Ctrl+Z** / **Ctrl+Shift+Z** (or **Ctrl+Y**) |
| Context menu | **Right-click** canvas, node, group, or image |

### Background.json Maker
| Action | Shortcut / Gesture |
|---|---|
| Open Background Maker | Header **🖼 Backgrounds**, or Inspector **🖼 Maker…** |
| Close modal | **Esc** or click top-right **✕** |
| Select background | Click any background row in the left sidebar |
| Add new background | Click **+ New** (inherits current active series folder) |
| Context options | **Right-click** any background or pool asset card |
| Quick asset rename | **Double-click** any asset card in the bottom pool dock |
| Asset Lightbox | Click any slot thumbnail or pool asset card to view & inspect |
| Fullscreen Stage Monitor | Click the **Live Stage Monitor** viewport to open fullscreen popup |
| Delete position/variant | Click the right-hand **✕** button on position/TOD cards |

---

## Links (`reachable_areas`, `visible_areas`, `scream_range`)

Each area has three link types, switched cleanly via the dropdown above the map:

- **List of areas:** Hand-picked connections. In the sidebar, the checkbox controls whether *this* area lists the target; arrows show pair direction (`↔` two-way, `→` out only, `←` incoming only). Use **Make all ↔** to quickly mirror one-way list links.
- **ALL AREAS:** Reaches every other area. On `reachable_areas`, exports as `<ALL>` (hub included). On `visible_areas` and `scream_range`, exports as an explicit comma-separated list excluding the hub to match TsuMNN server rules. By default, `<ALL>` mesh lines are hidden on the map to avoid clutter — toggle **<ALL> mesh** in the toolbar if you want to see every line.
- **REACHABLE AREAS** *(Visible / Scream)*: Automatically mirrors the area's `reachable_areas` list (`<REACHABLE_AREAS>`). Drawn as faint dashed lines on those tabs; edit them on the **Reachable** tab.
- **No other areas** *(Scream)*: Server default (nobody outside hears `/scream`).

---

## Map Tools, Groups & Layouts

- **Minimap Radar:** Collapsible birds-eye radar in the bottom-left corner with real-time camera viewport box. Click or drag to jump camera across large maps. Press **M** to toggle.
- **Smart Route Finder (🧭 Route):** Finds the shortest walkable path between any two areas, displays turn-by-turn steps, highlights corridors with emerald neon on the map, and respects RP privacy rules (private rooms and lobbies cannot be used as public transit shortcuts).
- **Network Audit (🔍 Audit):** Scans your area network for true dead ends, one-way trips, disconnected areas, and rooms with no incoming corridors, respecting `<ALL>` exits and framing flags as informational design notices with instant **⌖ View** buttons.
- **Connection Line Styles:** Switch between Curved (smooth Bézier), Orthogonal (90° circuit), and Straight lines in the **⚙ Settings** cog.
- **Focus / Isolate:** **Focus** dims unrelated nodes around your selection. **Isolate** hides everything except your selected area and its direct neighbours (`Esc` exits).
- **Hide hub / Hide `<ALL>`:** Temporarily declutter the board without changing any data.
- **Groups:** Right-click the canvas → **Add group here**. Areas whose centers sit inside a group rectangle move with it. Right-click a group to **Select all areas in zone**, **Copy Zone YAML**, or change its color. **Sort IDs** reorders your area list so members of each group hold consecutive IDs (useful for `/zone_area`).
- **Layouts ▾:** Save snapshots of node positions, groups, and corkboard images so you can experiment safely.
- **Auto-arrange ▾:** Deterministically arranges the Hub on the left, connected clusters in radial islands, and standalone areas underneath, then fits the view. Click the dropdown to configure group sorting options (`Sort nodes inside groups`, `Only arrange top-level groups`) and trigger `▶ Run Auto-arrange`.

---

## Test Mode & Export Validation

- **▶ Test mode:** Walk through your areas like a player using live reachable exits, search exits by name or ID, and verify there are no unintended dead ends.
- **Export YAML:** Blocks export if required fields or duplicate names exist, and shows non-blocking **warnings** if any area has 0 exits, cannot be reached from the Hub, or has an out-of-range `afk_sendto`.

---

## Background.json Maker & INI Converter

Access via the top header **🖼 Backgrounds** button or from the Inspector's `background:` row.

### Courtroom & Camera Positions
MNN uses exact lowercase identifiers for courtroom camera angles. The editor standardizes on these codes to guarantee 100% parity with legacy `positions.ini` files and the official MNN client:

| Code | Role | Description |
|---|---|---|
| **`wit`** | Witness | Authoritative default courtroom angle. Always created as default. |
| **`def`** | Defense | Defense counsel podium angle. |
| **`pro`** | Prosecution | Prosecution counsel podium angle. |
| **`jud`** | Judge | High judge bench angle. |
| **`hld`** | Co-Counsel Defense | Assistant / helper defense counsel angle. |
| **`hlp`** | Co-Counsel Prosecution | Assistant / helper prosecution angle. |
| **`jur`** | Jury | Juror box / debate podium angle. |
| **`sea`** | Gallery | Seating gallery / audience courtroom view. |

- **Right-Click Tab Options:** Right-click any position tab to rename, clone, or delete.
- **Templates ▾:** Apply pre-configured templates (e.g. *Courtroom (5 Positions)*, *Class Trial Debate*, *Full Day Cycle*) with 1 click.

### State & Time-of-Day Variants
- **States:** Build alternate scene states (`crowded`, `festive`, `rainy`, `blackout`) alongside the base `default` state.
- **Time Variants (`time_variants`):** Configure `day`, `evening`, and `night` visual layers with distinct backdrops, desk overlays, and ambient audio loops.

### Universal Directory & INI Importer
- **Import Folder / ZIP:** Drag and drop an entire courtroom folder (containing `positions.ini` or `background.json`) or a ZIP package into the modal.
- **Auto-Conversion:** The engine automatically parses INI sections, resolves image desk overlays, normalizes ambience audio paths (`base/sounds/ambient/`), and creates fully formatted background nodes.
- **Root Asset Repository Importer:** Dragging a full server root asset directory imports backgrounds and ambient tracks while automatically filtering non-background asset folders (`characters/`, `music/`, etc.).

### Asset Repository Dock & Inspector
- **Asset Pool (Bottom Dock):** Drag-and-drop images (`.webp`, `.png`, `.jpg`) and audio (`.opus`, `.mp3`, `.ogg`) into the pool to build backgrounds without re-uploading.
- **Repository Asset Inspector:** Click any asset card to open the horizontal split inspector:
  - **Left Side:** Letterboxed high-res preview canvas, file path, source folder origin, dimensions, and total usage count.
  - **Right Side:** Global asset rename input (propagates across all background nodes simultaneously) and comprehensive **Usages Table** showing background name, camera position, slot badge, export alias, and a **Go to ↗** jump button.
  - **Source Folder Tracking:** For unused assets or assets imported from PC folder trees, the inspector displays where the asset originated from. Paths are sanitized to start at the root project folder (never exposing private PC directories) and are preserved in JSON project backups.

### Live Stage Monitor & Ambience Audio Player
- **Interactive Composite Monitor:** Real-time preview of combined background backdrop and foreground desk overlay.
- **Letterbox vs Cover:** Select presets (`16:9`, `4:3`, `1:1`, custom) with pure black bars (`#000000`) or toggle viewport fill.
- **Fullscreen Preview:** Click the Stage Monitor canvas to expand into a high-res inspection modal.
- **Ambience Volume Slider:** Adjust audio playback volume (`0.0`–`1.0`, default `0.30` to protect your ears). Seamlessly switches tracks when selecting different positions or states without halting playback.

### Server-Ready ZIP Export
- **Export Package (.zip):** Bundles `base/background/<Subfolder>/<Room>/background.json`, referenced backdrops, desk overlays, and `base/sounds/ambient/` audio files.
- **Automatic Deduplication:** Guarantees each asset is written exactly once in the ZIP archive, preventing duplicate path corruption.
- **Live Progress Overlay:** Animated modal overlay displays compression and export status during large multi-megabyte package exports.
