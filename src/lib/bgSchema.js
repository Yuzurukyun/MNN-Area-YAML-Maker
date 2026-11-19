// MNN background.json data model, schema validator, parser & serializer.
// Backgrounds are stored under: base/background/<Subfolder>/<BgFolder>/
// Areas in areas.yaml reference: "<Subfolder>/<BgFolder>" (e.g. "Umamusume/Cafeteria")
// Ambience audio files reference relative to base/sounds/ambient/: (e.g. "wsl/inner_forest_day.opus")

/**
 * Normalizes a user-input or folder path:
 * Strips leading/trailing slashes, and removes leading root/background prefixes
 * (e.g. "base/background/", "MM/background/", "background/").
 */
export function normalizeBgPath(input) {
  if (!input || typeof input !== 'string') return '';
  let s = input.trim().replace(/\\/g, '/');
  // strip leading any-root/background/ or background/
  s = s.replace(/^(?:.*\/)?backgrounds?\//i, '');
  // strip leading ./, base/
  s = s.replace(/^(\.\/)?(base\/)?/i, '');
  // strip leading/trailing slashes
  s = s.replace(/^\/+/, '').replace(/\/+$/, '');
  return s;
}

/**
 * Normalizes an ambience sound path relative to sounds/ambient/
 * Handles root prefixes like "base/sounds/ambient/", "MM/sounds/ambient/", "sounds/ambient/", "sounds/ambience/", etc.
 */
export function normalizeAmbiencePath(input) {
  if (!input || typeof input !== 'string') return '';
  let s = input.trim().replace(/\\/g, '/');
  s = s.replace(/^(?:.*\/)?sounds?\/(?:ambient|ambience)\//i, '');
  s = s.replace(/^(\.\/)?(base\/)?(sounds?\/)?/i, '');
  s = s.replace(/^\/+/, '');
  return s;
}

/**
 * Creates a clean time_variant entry
 */
export function createTimeVariant(opts = {}) {
  return {
    background: opts.background || '',
    foreground: opts.foreground || '',
    ambience: opts.ambience || '',
  };
}

/**
 * Creates a position entry
 */
export function createPosition(name = 'Normal', opts = {}) {
  return {
    name,
    background: opts.background || '',
    foreground: opts.foreground || '',
    ambience: opts.ambience || '',
    time_variants: { ...(opts.time_variants || {}) },
  };
}

/**
 * Creates a state variant (e.g. 'default', 'crowded', 'festive')
 */
export function createStateVariant(name = 'default', opts = {}) {
  return {
    name,
    background: opts.background || '',
    foreground: opts.foreground || '',
    ambience: opts.ambience || '',
    usePositions: opts.usePositions ?? (opts.positions && Object.keys(opts.positions).length > 0 ? true : false),
    positions: { ...(opts.positions || {}) },
    time_variants: { ...(opts.time_variants || {}) },
  };
}

/**
 * Creates a full background definition
 */
export function createBackground(folder = 'NewBackground', opts = {}) {
  const normFolder = normalizeBgPath(folder) || 'NewBackground';
  const defaultState = opts.states?.default
    ? createStateVariant('default', opts.states.default)
    : createStateVariant('default', { background: opts.background || '' });

  const states = {
    default: defaultState,
  };

  if (opts.states) {
    for (const [stName, stData] of Object.entries(opts.states)) {
      if (stName !== 'default') {
        states[stName] = createStateVariant(stName, stData);
      }
    }
  }

  return {
    id: opts.id || 'bg_' + Math.random().toString(36).slice(2, 9),
    folder: normFolder,
    description: opts.description || '',
    states,
    activeState: 'default',
    activePosition: opts.activePosition || 'Witness',
    activeTod: 'day',
  };
}

/**
 * Serializes an internal Background definition into the MNN background.json object structure.
 */
export function serializeBackgroundObject(bg) {
  if (!bg || !bg.states) return { default: { background: '' } };

  const out = {};

  // Ensure 'default' is the first key
  const stateKeys = Object.keys(bg.states);
  if (!stateKeys.includes('default')) {
    stateKeys.unshift('default');
  } else {
    // move 'default' to start
    stateKeys.splice(stateKeys.indexOf('default'), 1);
    stateKeys.unshift('default');
  }

  for (const stKey of stateKeys) {
    const st = bg.states[stKey] || createStateVariant(stKey);
    const stObj = {};

    if (st.ambience) stObj.ambience = normalizeAmbiencePath(st.ambience);
    if (st.background) stObj.background = st.background;
    if (st.foreground !== undefined && st.foreground !== '') {
      stObj.foreground = st.foreground;
    } else if (st.usePositions) {
      // In complex positions example, foreground: "" is explicitly present
      stObj.foreground = '';
    }

    // Positions mode
    if (st.usePositions && st.positions && Object.keys(st.positions).length > 0) {
      const posOut = {};
      for (const [posKey, pos] of Object.entries(st.positions)) {
        const pObj = {};
        if (pos.ambience) pObj.ambience = normalizeAmbiencePath(pos.ambience);
        if (pos.background) pObj.background = pos.background;
        if (pos.foreground !== undefined) pObj.foreground = pos.foreground;

        if (pos.time_variants && Object.keys(pos.time_variants).length > 0) {
          const tvOut = {};
          for (const [tvKey, tv] of Object.entries(pos.time_variants)) {
            const tObj = {};
            if (tv.background) tObj.background = tv.background;
            if (tv.foreground) tObj.foreground = tv.foreground;
            if (tv.ambience) tObj.ambience = normalizeAmbiencePath(tv.ambience);
            if (Object.keys(tObj).length > 0) tvOut[tvKey] = tObj;
          }
          if (Object.keys(tvOut).length > 0) pObj.time_variants = tvOut;
        }
        posOut[posKey] = pObj;
      }
      stObj.positions = posOut;
    } else {
      // Direct time variants
      if (st.time_variants && Object.keys(st.time_variants).length > 0) {
        const tvOut = {};
        for (const [tvKey, tv] of Object.entries(st.time_variants)) {
          const tObj = {};
          if (tv.background) tObj.background = tv.background;
          if (tv.foreground) tObj.foreground = tv.foreground;
          if (tv.ambience) tObj.ambience = normalizeAmbiencePath(tv.ambience);
          if (Object.keys(tObj).length > 0) tvOut[tvKey] = tObj;
        }
        if (Object.keys(tvOut).length > 0) stObj.time_variants = tvOut;
      }
    }

    out[stKey] = stObj;
  }

  return out;
}

/**
 * Serializes internal Background definition into a formatted JSON string.
 * Supports configurable indent (number of spaces or '\t' tab, default = 4).
 */
export function serializeBackgroundJson(bg, indent = 4) {
  const obj = serializeBackgroundObject(bg);
  const ind = indent === 'tab' || indent === '\t' ? '\t' : (typeof indent === 'number' ? indent : 4);
  return JSON.stringify(obj, null, ind);
}

/**
 * Parses a raw background.json (string or object) into an internal Background structure.
 */
export function parseBackgroundJson(raw, folder = 'ImportedBackground') {
  let parsed;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Failed to parse background.json: ${e.message}`);
    }
  } else {
    parsed = raw;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid background.json: root must be an object of state variants.');
  }

  const bg = createBackground(folder);
  bg.states = {};

  for (const [stName, stData] of Object.entries(parsed)) {
    if (!stData || typeof stData !== 'object') continue;

    const hasPositions = Boolean(stData.positions && typeof stData.positions === 'object');
    const positions = {};

    if (hasPositions) {
      for (const [posName, posData] of Object.entries(stData.positions)) {
        if (!posData || typeof posData !== 'object') continue;
        const time_variants = {};
        if (posData.time_variants && typeof posData.time_variants === 'object') {
          for (const [tvName, tvData] of Object.entries(posData.time_variants)) {
            time_variants[tvName] = createTimeVariant({
              background: tvData?.background || '',
              foreground: tvData?.foreground || '',
              ambience: tvData?.ambience || '',
            });
          }
        }
        positions[posName] = createPosition(posName, {
          background: posData.background || '',
          foreground: posData.foreground || '',
          ambience: posData.ambience || '',
          time_variants,
        });
      }
    }

    const time_variants = {};
    if (stData.time_variants && typeof stData.time_variants === 'object') {
      for (const [tvName, tvData] of Object.entries(stData.time_variants)) {
        time_variants[tvName] = createTimeVariant({
          background: tvData?.background || '',
          foreground: tvData?.foreground || '',
          ambience: tvData?.ambience || '',
        });
      }
    }

    bg.states[stName] = createStateVariant(stName, {
      background: stData.background || '',
      foreground: stData.foreground || '',
      ambience: stData.ambience || '',
      usePositions: hasPositions,
      positions,
      time_variants,
    });
  }

  // Ensure default exists
  if (!bg.states.default) {
    bg.states.default = createStateVariant('default');
  }

  if (bg.states.default?.usePositions && bg.states.default.positions) {
    const posKeys = Object.keys(bg.states.default.positions);
    bg.activePosition = posKeys.includes('Witness')
      ? 'Witness'
      : posKeys.includes('Normal')
      ? 'Normal'
      : posKeys[0] || 'Witness';
  }

  return bg;
}

/**
 * Maps standard Ace Attorney Online / MNN shorthand position codes to human-friendly position names.
 */
export const INI_POSITION_MAP = {
  wit: 'Witness',
  witness: 'Witness',
  def: 'Defense',
  defense: 'Defense',
  pro: 'Prosecution',
  prosecution: 'Prosecution',
  jud: 'Judge',
  judge: 'Judge',
  hld: 'Counsel',
  hlp: 'Counsel Prosecution',
  jur: 'Jury',
  jury: 'Jury',
  sea: 'Gallery',
  gal: 'Gallery',
  gallery: 'Gallery',
  coun: 'Counsel',
  counsel: 'Counsel',
  norm: 'Witness',
  normal: 'Witness',
  helper: 'Counsel',
};

export function mapIniPositionName(rawCode) {
  if (!rawCode) return 'Witness';
  const clean = rawCode.trim().toLowerCase();
  if (INI_POSITION_MAP[clean]) return INI_POSITION_MAP[clean];
  return rawCode.trim().charAt(0).toUpperCase() + rawCode.trim().slice(1);
}

/**
 * Parses a background INI file (e.g. positions.ini) into an internal Background structure.
 * Supports position shorthands (wit, def, pro, jud, hld, hlp), slot properties (back, front, ambient_sfx),
 * and converts cleanly into a JSON-ready background object.
 */
export function parseBackgroundIni(iniText, folder = 'ImportedBackground') {
  if (typeof iniText !== 'string') {
    throw new Error('Invalid INI: input must be a string.');
  }

  const bg = createBackground(folder);
  const lines = iniText.split(/\r?\n/);

  let currentSection = '';
  const sections = {};

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    const secMatch = line.match(/^\[([^\]]+)\]$/);
    if (secMatch) {
      currentSection = secMatch[1].trim();
      if (!sections[currentSection]) sections[currentSection] = {};
      continue;
    }

    const eqIdx = line.indexOf('=');
    const colonIdx = line.indexOf(':');
    let splitIdx = -1;
    if (eqIdx !== -1 && colonIdx !== -1) {
      splitIdx = Math.min(eqIdx, colonIdx);
    } else if (eqIdx !== -1) {
      splitIdx = eqIdx;
    } else if (colonIdx !== -1) {
      splitIdx = colonIdx;
    }

    if (splitIdx !== -1) {
      const rawKey = line.slice(0, splitIdx).trim().toLowerCase();
      let rawVal = line.slice(splitIdx + 1).trim();
      const commentIdx = rawVal.search(/[;#]/);
      if (commentIdx !== -1) {
        rawVal = rawVal.slice(0, commentIdx).trim();
      }
      if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
        rawVal = rawVal.slice(1, -1).trim();
      }

      const sec = currentSection || '__root__';
      if (!sections[sec]) sections[sec] = {};
      sections[sec][rawKey] = rawVal;
    }
  }

  const secKeys = Object.keys(sections).filter((k) => k !== '__root__' && k.toLowerCase() !== 'default' && k.toLowerCase() !== 'base');
  const hasPositions = secKeys.length > 0;

  const positions = {};
  const rootSec = { ...(sections.__root__ || {}), ...(sections.default || {}), ...(sections.base || {}) };
  let defaultBg = rootSec.back || rootSec.background || rootSec.bg || rootSec.image || '';
  let defaultFg = rootSec.front || rootSec.foreground || rootSec.fg || rootSec.desk || rootSec.overlay || '';
  let defaultAmb = rootSec.ambient_sfx || rootSec.ambient || rootSec.ambience || rootSec.audio || rootSec.sound || '';

  if (hasPositions) {
    // In MNN / courtroom setups, the default angle is "wit" (Witness).
    // If [wit] (or [witness], [norm], [normal]) is defined, default scene slots take directly from it.
    const witKey = secKeys.find((k) => {
      const l = k.toLowerCase();
      return l === 'wit' || l === 'witness' || l === 'norm' || l === 'normal';
    });
    if (witKey) {
      const witData = sections[witKey];
      defaultBg = witData.back || witData.background || witData.bg || witData.image || defaultBg;
      defaultFg = witData.front || witData.foreground || witData.fg || witData.desk || witData.overlay || '';
      defaultAmb = witData.ambient_sfx || witData.ambient || witData.ambience || witData.audio || witData.sound || defaultAmb;
    }

    for (const secKey of secKeys) {
      const data = sections[secKey];
      const posName = mapIniPositionName(secKey);

      const bgImg = data.back || data.background || data.bg || data.image || '';
      const fgImg = data.front || data.foreground || data.fg || data.desk || data.overlay || '';
      const amb = data.ambient_sfx || data.ambient || data.ambience || data.audio || data.sound || '';

      // INI files never had time variants; data is taken strictly as-is
      positions[posName] = createPosition(posName, {
        background: bgImg,
        foreground: fgImg,
        ambience: amb,
        time_variants: {},
      });

      if (!witKey) {
        if (!defaultBg && bgImg) defaultBg = bgImg;
        if (!defaultFg && fgImg) defaultFg = fgImg;
        if (!defaultAmb && amb) defaultAmb = amb;
      }
    }
  }

  bg.states = {
    default: createStateVariant('default', {
      background: defaultBg,
      foreground: defaultFg,
      ambience: defaultAmb,
      usePositions: hasPositions,
      positions: hasPositions ? positions : {},
    }),
  };

  if (hasPositions) {
    const posKeys = Object.keys(positions);
    // The default MUST BE "Witness" (mapped from "wit")
    bg.activePosition = posKeys.includes('Witness') ? 'Witness' : posKeys[0] || 'Witness';
  } else {
    bg.activePosition = 'Witness';
  }

  return bg;
}

/**
 * Resolves the active visual assets (background, foreground, ambience) for a given state, position, and TOD.
 */
export function resolveActiveVisual(bg, { state = 'default', position = 'Witness', tod = 'day' } = {}) {
  if (!bg || !bg.states) return { background: '', foreground: '', ambience: '' };

  const st = bg.states[state] || bg.states.default;
  if (!st) return { background: '', foreground: '', ambience: '' };

  if (st.usePositions && st.positions) {
    const pos = (position && st.positions[position]) || st.positions.Witness || st.positions.Normal || Object.values(st.positions)[0];
    if (pos) {
      // Check if position has time variant
      const tv = pos.time_variants?.[tod];
      return {
        background: (tv?.background !== undefined && tv.background !== '')
          ? tv.background
          : (pos.background !== undefined && pos.background !== '' ? pos.background : (st.background || '')),
        foreground: (tv?.foreground !== undefined && tv.foreground !== '')
          ? tv.foreground
          : (pos.foreground !== undefined ? pos.foreground : (st.foreground || '')),
        ambience: (tv?.ambience !== undefined && tv.ambience !== '')
          ? tv.ambience
          : (pos.ambience !== undefined && pos.ambience !== '' ? pos.ambience : (st.ambience || '')),
      };
    }
  }

  // Direct time variant
  const tv = st.time_variants?.[tod];
  return {
    background: (tv?.background !== undefined && tv.background !== '') ? tv.background : (st.background || ''),
    foreground: (tv?.foreground !== undefined && tv.foreground !== '') ? tv.foreground : (st.foreground || ''),
    ambience: (tv?.ambience !== undefined && tv.ambience !== '') ? tv.ambience : (st.ambience || ''),
  };
}

/**
 * Checks whether a background definition specifically defines any non-empty time_variants.
 * Returns true only if actual time_variants with content exist in states or positions.
 */
export function hasTimeVariants(bg) {
  if (!bg || !bg.states || typeof bg.states !== 'object') return false;
  for (const st of Object.values(bg.states)) {
    if (!st || typeof st !== 'object') continue;
    if (st.time_variants && typeof st.time_variants === 'object') {
      const keys = Object.keys(st.time_variants);
      if (keys.length > 0) {
        const hasContent = Object.values(st.time_variants).some(
          (v) => v && typeof v === 'object' && Boolean(
            (v.background && String(v.background).trim()) ||
            (v.foreground && String(v.foreground).trim()) ||
            (v.ambience && String(v.ambience).trim())
          )
        );
        if (hasContent) return true;
      }
    }
    if (st.positions && typeof st.positions === 'object') {
      for (const pos of Object.values(st.positions)) {
        if (!pos || typeof pos !== 'object') continue;
        if (pos.time_variants && typeof pos.time_variants === 'object') {
          const keys = Object.keys(pos.time_variants);
          if (keys.length > 0) {
            const hasContent = Object.values(pos.time_variants).some(
              (v) => v && typeof v === 'object' && Boolean(
                (v.background && String(v.background).trim()) ||
                (v.foreground && String(v.foreground).trim()) ||
                (v.ambience && String(v.ambience).trim())
              )
            );
            if (hasContent) return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Built-in Background Templates (presets for courtroom positions, time-of-day cycles, and trial states)
 */
export const BUILTIN_BG_TEMPLATES = [
  {
    id: 'builtin-simple',
    name: 'Simple Single Scene',
    description: 'Clean single image with no states or time variants',
    builtin: true,
    structure: {
      usePositions: false,
      positions: {},
      time_variants: {},
      states: ['default'],
    },
  },
  {
    id: 'builtin-day-night',
    name: 'Day / Night Cycle',
    description: 'Standard 2-phase time-of-day variants (day, night)',
    builtin: true,
    structure: {
      usePositions: false,
      positions: {},
      time_variants: {
        day: { background: '', foreground: '', ambience: '' },
        night: { background: '', foreground: '', ambience: '' },
      },
      states: ['default'],
    },
  },
  {
    id: 'builtin-day-eve-night',
    name: 'Full Day Cycle (Day / Evening / Night)',
    description: 'Complete 3-phase time variants (day, evening, night)',
    builtin: true,
    structure: {
      usePositions: false,
      positions: {},
      time_variants: {
        day: { background: '', foreground: '', ambience: '' },
        evening: { background: '', foreground: '', ambience: '' },
        night: { background: '', foreground: '', ambience: '' },
      },
      states: ['default'],
    },
  },
  {
    id: 'builtin-courtroom-5',
    name: 'Courtroom (5 Positions)',
    description: 'Courtroom setup: Witness (default), Defense, Prosecution, Judge, Counsel',
    builtin: true,
    structure: {
      usePositions: true,
      positions: {
        Witness: { background: '', foreground: '', ambience: '', time_variants: {} },
        Defense: { background: '', foreground: '', ambience: '', time_variants: {} },
        Prosecution: { background: '', foreground: '', ambience: '', time_variants: {} },
        Judge: { background: '', foreground: '', ambience: '', time_variants: {} },
        Counsel: { background: '', foreground: '', ambience: '', time_variants: {} },
      },
      time_variants: {},
      states: ['default'],
    },
  },
  {
    id: 'builtin-courtroom-day-night',
    name: 'Courtroom + Day / Night Cycle',
    description: '5 courtroom positions with Day & Night time variants (Witness default)',
    builtin: true,
    structure: {
      usePositions: true,
      positions: {
        Witness: { background: '', foreground: '', ambience: '', time_variants: { day: {}, night: {} } },
        Defense: { background: '', foreground: '', ambience: '', time_variants: { day: {}, night: {} } },
        Prosecution: { background: '', foreground: '', ambience: '', time_variants: { day: {}, night: {} } },
        Judge: { background: '', foreground: '', ambience: '', time_variants: { day: {}, night: {} } },
        Counsel: { background: '', foreground: '', ambience: '', time_variants: { day: {}, night: {} } },
      },
      time_variants: {},
      states: ['default'],
    },
  },
  {
    id: 'builtin-trial-states',
    name: 'Class Trial Debate (4 States)',
    description: '4 state variants: default, debate, intermission, guilty',
    builtin: true,
    structure: {
      usePositions: false,
      positions: {},
      time_variants: {},
      states: ['default', 'debate', 'intermission', 'guilty'],
    },
  },
];

/**
 * Extracts a reusable template structure from an existing background.
 */
export function extractBgTemplateStructure(bg) {
  if (!bg) return { usePositions: false, positions: {}, time_variants: {}, states: ['default'] };

  const states = Object.keys(bg.states || {});
  if (!states.includes('default')) states.unshift('default');

  const activeSt = bg.states?.[bg.activeState] || bg.states?.default || {};
  const usePositions = Boolean(activeSt.usePositions);

  const positions = {};
  if (usePositions && activeSt.positions) {
    for (const [posKey, pos] of Object.entries(activeSt.positions)) {
      const tvKeys = Object.keys(pos.time_variants || {});
      const tvMap = {};
      tvKeys.forEach((k) => (tvMap[k] = {}));
      positions[posKey] = {
        background: '',
        foreground: '',
        ambience: '',
        time_variants: tvMap,
      };
    }
  }

  const time_variants = {};
  if (!usePositions && activeSt.time_variants) {
    for (const tvKey of Object.keys(activeSt.time_variants)) {
      time_variants[tvKey] = { background: '', foreground: '', ambience: '' };
    }
  }

  return {
    usePositions,
    positions,
    time_variants,
    states,
  };
}

/**
 * Applies a background template structure to a background object.
 * Preserves existing asset paths where slots/keys match.
 */
export function applyBgTemplate(bg, template) {
  if (!bg || !template) return bg;
  const struct = template.structure || template;

  // 1. Ensure states exist
  if (Array.isArray(struct.states)) {
    for (const stName of struct.states) {
      if (!bg.states[stName]) {
        bg.states[stName] = createStateVariant(stName);
      }
    }
  }

  // 2. Apply to each state (or active state)
  const targetStates = Object.keys(bg.states);
  for (const stKey of targetStates) {
    const st = bg.states[stKey];
    st.usePositions = Boolean(struct.usePositions);

    if (struct.usePositions) {
      if (!st.positions) st.positions = {};
      const tplPositions = struct.positions || {};
      for (const [posKey, posData] of Object.entries(tplPositions)) {
        if (!st.positions[posKey]) {
          st.positions[posKey] = createPosition(posKey);
        }
        if (posData.time_variants) {
          if (!st.positions[posKey].time_variants) st.positions[posKey].time_variants = {};
          for (const tvKey of Object.keys(posData.time_variants)) {
            if (!st.positions[posKey].time_variants[tvKey]) {
              st.positions[posKey].time_variants[tvKey] = createTimeVariant();
            }
          }
        }
      }
      if (!st.positions[bg.activePosition]) {
        bg.activePosition = st.positions.Witness ? 'Witness' : (Object.keys(st.positions)[0] || 'Witness');
      }
    } else {
      if (!st.time_variants) st.time_variants = {};
      const tplTv = struct.time_variants || {};
      for (const tvKey of Object.keys(tplTv)) {
        if (!st.time_variants[tvKey]) {
          st.time_variants[tvKey] = createTimeVariant();
        }
      }
      if (Object.keys(st.time_variants).length > 0) {
        if (!st.time_variants[bg.activeTod]) {
          bg.activeTod = Object.keys(st.time_variants)[0] || 'day';
        }
      }
    }
  }

  return bg;
}
