// Text labels drawn inside each map node, truncated cleanly to fit.

import { strip, drifted } from './core.js';

function fit(s, max) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function titleText(a, idx, hasImg = false) {
  return fit(`#${idx} ${a.area}`, hasImg ? 16 : 24);
}

export function bgText(a, hasImg = false) {
  return fit(a.background || 'No background', hasImg ? 18 : 29);
}

export function tagText(P, a, idx, dups, activeLink = 'reachable', hasImg = false) {
  const tags = [];
  if (idx === 0) tags.push('HUB');
  if (a.links?.[activeLink]?.mode === 'all') tags.push('<ALL>');
  if (a.lobby_area) tags.push('lobby');
  if (a.private_area) tags.push('private');
  if (dups.has(strip(a.area))) tags.push('⚠ dup');
  if (drifted(P, a)) tags.push('⚠ tpl');
  return fit(tags.join(' · '), hasImg ? 20 : 32);
}
