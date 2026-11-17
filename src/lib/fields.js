// Field definitions for the areas.yaml format: node dimensions, boolean
// fields with server defaults, official descriptions, importance groups,
// and built-in templates. Pure data — nothing here mutates a project.

export const NODE_W = 204;
export const NODE_H = 70; // three text lines: title, background, tags

export const BOOL_FIELDS = [
  // [key, container, default, label]
  ['bglock', 'access', false, 'bglock — nobody can lock the background'],
  ['locking_allowed', 'access', false, 'locking_allowed — nobody can lock the area'],
  ['lobby_area', 'access', false, 'lobby_area — mark as lobby'],
  ['private_area', 'access', false, 'private_area — mark as private'],
  ['change_reachability_allowed', 'access', true, 'change_reachability_allowed — anyone may /unilock or /bilock'],
  ['has_lights', 'behaviour', true, 'has_lights — lights can be turned off'],
  ['environment_indoors', 'behaviour', false, 'environment_indoors — whether the weather effect can be applied'],
  ['bullet', 'perm', true, 'bullet — anyone may use bullets/shouts'],
  ['cbg_allowed', 'perm', false, 'cbg_allowed — anyone may set a custom background'],
  ['global_allowed', 'perm', true, 'global_allowed — anyone may use /g'],
  ['iniswap_allowed', 'perm', false, 'iniswap_allowed — IC while iniswapped'],
  ['song_switch_allowed', 'perm', false, 'song_switch_allowed — anyone may /play'],
  ['rollp_allowed', 'perm', true, 'rollp_allowed — anyone may /rollp'],
  ['rp_getarea_allowed', 'perm', true, 'rp_getarea_allowed — anyone may /getarea'],
  ['rp_getareas_allowed', 'perm', true, 'rp_getareas_allowed — anyone may /getareas'],
  ['gm_iclock_allowed', 'perm', true, 'gm_iclock_allowed — GMs may /iclock'],
];

export const BOOL_DEFAULT = Object.fromEntries(BOOL_FIELDS.map(([k, , d]) => [k, d]));

// Non-boolean extra keys under Behaviour (omitted on export when at default).
export const EXTRA_KEYS = [
  ['weather', '', 'Sets a default weather for the area.'],
  ['investigation', '', 'Investigation data — placeholder (possibly a base64 JSON string).'],
  ['map_visual', 'None', 'Map transition visual, shown to show the area movement.'],
];

// Official descriptions from the TsuMNN sample areas.yaml header — shown on hover.
export const DESC = {
  area: 'Name of the area.',
  background: 'Default background of the area.',
  background_tod: 'Backgrounds per time of day.',
  default_description: 'Output of /look in the area if no custom description is in place via /look_set.',
  afk_delay: 'If a positive number, the number of seconds that must pass to mark an inactive player as AFK and kick them to afk_sendto. If 0, no such AFK kicks take place.',
  afk_sendto: 'The ID of the area to kick an AFK player to.',
  bglock: 'If false, only moderators can lock the area background; if true, no one can lock it.',
  bullet: 'If false, only GM+ can send IC messages with bullets/shouts. If true, no such restriction is imposed.',
  cbg_allowed: "If false, only GM+ can set the area's background to one not in the hub's list. If true, no such restriction is imposed.",
  change_reachability_allowed: 'If false, only GM+ may /unilock or /bilock passages affecting this area. If true, no such restriction is imposed.',
  gm_iclock_allowed: 'If false, only CM+ may /iclock the area. If true, GMs may also /iclock.',
  iniswap_allowed: 'If true, everyone can send IC messages while iniswapped/iniedited; if false, no one can send IC messages while iniswapped/iniedited.',
  global_allowed: 'If false, only CM+ may use /g in the area. If true, anyone can use it.',
  has_lights: 'If false, the area cannot have its lights turned off via /light or similar. If true, no such restriction is imposed.',
  lobby_area: "If true, the area is marked as lobby (which disallows non-GMs+ from sneaking or /knock'ing from or to the area).",
  locking_allowed: 'If false, everyone can lock the area; if true, no one can lock it.',
  private_area: 'If true, the area is marked as private (which disallows everyone from sneaking and GMs+ reading /whisper messages).',
  reachable_areas: 'If <ALL>, a passage will be created from this area to every other area. If it is a comma-separated list of areas (by name), a passage will be created from this area only to the listed areas.',
  restricted_chars: 'If a list of folder names, it prevents non-GMs using said characters from joining the area.',
  rollp_allowed: 'If false, only GM+ may /rollp. If true, everyone can /rollp.',
  rp_getarea_allowed: 'If false, only GM+ can /getarea and similar. If true, no such restriction is imposed.',
  rp_getareas_allowed: 'If false, only GM+ can /getareas and similar. If true, no such restriction is imposed.',
  scream_range: 'If <ALL>, all areas can receive a /scream message sent from this area. If <REACHABLE_AREAS>, all areas defined in reachable_areas can receive a /scream message sent from this area. If it is a comma-separated list of areas (by name), only said areas can receive /scream messages.',
  song_switch_allowed: 'If false, only GM+ can do /play. If true, no such restriction is imposed.',
  visible_areas: "If <ALL>, a passage will be set as visible (but not necessarily reachable) from this area to every other area. If <REACHABLE_AREAS>, the procedure will be done to exactly all areas described in the area's reachable_areas key. If it is a comma-separated list of areas (by name), the procedure will be done to the listed areas.",
  weather: 'Sets a default weather for the area.',
  environment_indoors: 'Whether the weather effect can be applied.',
  investigation: 'Investigation data — placeholder (possibly a base64 JSON string).',
  map_visual: 'Map transition visual, shown to show the area movement.',
};

export const BUILTIN_TOD_PRESETS = [{ name: 'Day / Night', keys: ['day', 'night'] }];

export const TEMPLATE_FIELDS = BOOL_FIELDS.map((f) => f[0]).concat(['afk_delay', 'weather', 'investigation', 'map_visual']);

export function serverDefaultValues() {
  const v = {};
  TEMPLATE_FIELDS.forEach((k) => {
    if (k === 'afk_delay') v[k] = 0;
    else if (k === 'weather' || k === 'investigation') v[k] = '';
    else if (k === 'map_visual') v[k] = 'None';
    else v[k] = BOOL_DEFAULT[k];
  });
  return v;
}

export const BUILTIN_TEMPLATES = [
  {
    id: 'builtin-yuzu',
    name: "Yuzu's RP Defaults",
    builtin: true,
    include: [...TEMPLATE_FIELDS],
    values: Object.assign(serverDefaultValues(), {
      locking_allowed: true,
      rp_getareas_allowed: false,
      cbg_allowed: true,
      iniswap_allowed: true,
      song_switch_allowed: true,
    }),
  },
  {
    id: 'builtin-private',
    name: 'Private Area',
    builtin: true,
    include: [...TEMPLATE_FIELDS],
    values: Object.assign(serverDefaultValues(), {
      private_area: true,
      lobby_area: false,
      locking_allowed: false,
      rp_getareas_allowed: false,
      cbg_allowed: true,
      iniswap_allowed: true,
      song_switch_allowed: true,
    }),
  },
  {
    id: 'builtin-lobby',
    name: 'Lobby Area',
    builtin: true,
    include: [...TEMPLATE_FIELDS],
    values: Object.assign(serverDefaultValues(), {
      lobby_area: true,
      private_area: false,
      locking_allowed: true,
      bglock: true,
      cbg_allowed: false,
      change_reachability_allowed: false,
      iniswap_allowed: true,
      song_switch_allowed: false,
    }),
  },
  {
    id: 'builtin-server',
    name: 'Server defaults',
    builtin: true,
    include: [...TEMPLATE_FIELDS],
    values: serverDefaultValues(),
  },
];

export function allTemplates(P) {
  return BUILTIN_TEMPLATES.concat(P.templates || []);
}

export const FIELD_GROUP = {
  area: 'common',
  background: 'common',
  background_tod: 'common',
  reachable_areas: 'common',
  scream_range: 'common',
  default_description: 'common',
  weather: 'uncommon',
  environment_indoors: 'uncommon',
  investigation: 'uncommon',
  map_visual: 'uncommon',
  bullet: 'uncommon',
  locking_allowed: 'uncommon',
  lobby_area: 'uncommon',
  private_area: 'uncommon',
  rp_getarea_allowed: 'uncommon',
  rp_getareas_allowed: 'uncommon',
  visible_areas: 'uncommon',
  afk_delay: 'rarely',
  afk_sendto: 'rarely',
  bglock: 'rarely',
  cbg_allowed: 'rarely',
  change_reachability_allowed: 'rarely',
  rollp_allowed: 'rarely',
  gm_iclock_allowed: 'rarely',
  iniswap_allowed: 'rarely',
  global_allowed: 'rarely',
  has_lights: 'rarely',
  restricted_chars: 'rarely',
  song_switch_allowed: 'rarely',
};

export const GROUP_SYM = { common: '■', uncommon: '■', rarely: '■' };
export const GROUP_LABEL = { common: 'Common', uncommon: 'Uncommon', rarely: 'Rarely' };
export const GROUP_RANK = { common: 0, uncommon: 1, rarely: 2 };

export function capFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export const SHORT_DESC = {
  area: 'Name of the area',
  background: 'Default background of the area',
  background_tod: 'Backgrounds per time of day',
  default_description: 'What /look shows by default',
  reachable_areas: 'Areas you can walk to from here',
  visible_areas: 'Areas visible from here, without necessarily being able to walk there',
  scream_range: 'Areas that can hear a /scream from here',
  restricted_chars: 'Characters that cannot join this area',
  afk_delay: 'Seconds idle before an AFK kick (0 = off)',
  afk_sendto: 'Area an AFK player is kicked to',
  weather: 'Default weather for the area',
  environment_indoors: 'Whether the weather effect can be applied',
  investigation: 'Investigation data (placeholder)',
  map_visual: 'Map transition visual for area movement',
};

export const LINK_TYPES = {
  reachable: {
    label: 'Reachable',
    modes: [
      ['list', 'List of areas'],
      ['all', 'ALL AREAS'],
    ],
    def: 'all',
  },
  visible: {
    label: 'Visible',
    modes: [
      ['reachable', 'REACHABLE AREAS'],
      ['all', 'ALL AREAS'],
      ['list', 'List of areas'],
    ],
    def: 'reachable',
  },
  scream: {
    label: 'Scream range',
    modes: [
      ['none', 'No other areas'],
      ['all', 'ALL AREAS'],
      ['reachable', 'REACHABLE AREAS'],
      ['list', 'List of areas'],
    ],
    def: 'none',
  },
};
