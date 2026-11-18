// MNN background.json data model, schema validator, parser & serializer.
// Backgrounds are stored under: base/background/<Subfolder>/<BgFolder>/
// Areas in areas.yaml reference: "<Subfolder>/<BgFolder>" (e.g. "Umamusume/Cafeteria")
// Ambience audio files reference relative to base/sounds/ambient/: (e.g. "wsl/inner_forest_day.opus")

/**
 * Normalizes a user-input or folder path:
 * Strips leading/trailing slashes, and removes leading "base/background/" or "background/" if present.
 */
export function normalizeBgPath(input) {
  if (!input || typeof input !== 'string') return '';
  let s = input.trim().replace(/\\/g, '/');
  // strip leading base/background/ or background/
  s = s.replace(/^(\.\/)?(base\/)?background\//i, '');
  // strip leading/trailing slashes
  s = s.replace(/^\/+/, '').replace(/\/+$/, '');
  return s;
}

/**
 * Normalizes an ambience sound path relative to sounds/ambient/
 */
export function normalizeAmbiencePath(input) {
  if (!input || typeof input !== 'string') return '';
  let s = input.trim().replace(/\\/g, '/');
  s = s.replace(/^(\.\/)?(base\/)?sounds\/ambient\//i, '');
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
    activePosition: 'Normal',
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
 */
export function serializeBackgroundJson(bg) {
  const obj = serializeBackgroundObject(bg);
  return JSON.stringify(obj, null, 2);
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

  return bg;
}

/**
 * Resolves the active visual assets (background, foreground, ambience) for a given state, position, and TOD.
 */
export function resolveActiveVisual(bg, { state = 'default', position = 'Normal', tod = 'day' } = {}) {
  if (!bg || !bg.states) return { background: '', foreground: '', ambience: '' };

  const st = bg.states[state] || bg.states.default;
  if (!st) return { background: '', foreground: '', ambience: '' };

  if (st.usePositions && st.positions) {
    const pos = st.positions[position] || Object.values(st.positions)[0];
    if (pos) {
      // Check if position has time variant
      const tv = pos.time_variants?.[tod];
      return {
        background: tv?.background || pos.background || st.background || '',
        foreground: tv?.foreground !== undefined ? tv.foreground : (pos.foreground || st.foreground || ''),
        ambience: tv?.ambience || pos.ambience || st.ambience || '',
      };
    }
  }

  // Direct time variant
  const tv = st.time_variants?.[tod];
  return {
    background: tv?.background || st.background || '',
    foreground: tv?.foreground !== undefined ? tv.foreground : (st.foreground || ''),
    ambience: tv?.ambience || st.ambience || '',
  };
}
