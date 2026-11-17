// Reading and writing TsuMNN areas.yaml:
// - Export omits keys equal to server defaults, escapes commas in lists,
//   quotes unsafe YAML scalars, and writes explicit "" for empty lists.
// - Import handles comma-separated strings, quoted values/lists, flow arrays
//   ([A, B]), YAML block lists (- A), block scalars (| / >), multi-line quoted
//   strings, inline comments, and reports unresolved target names or issues.

import { strip } from './util.js';
import { BOOL_FIELDS, EXTRA_KEYS } from './fields.js';
import { allExceptHubNames } from './links.js';
import { blankArea } from './model.js';

export const escName = (n) => strip(n).replace(/, /g, ',\\ ').replace(/,(?!\\)/g, '\\,');

export function decodeDesc(s) {
  let t = String(s == null ? '' : s);
  t = t.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  t = t.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  t = t.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '');
  t = t.replace(/\\\s*\\\s*/g, ' ');
  t = t.replace(/\s\\\s/g, ' ').replace(/\\\s/g, ' ').replace(/\s\\/g, ' ');
  return t;
}

export function yamlScalar(s) {
  s = strip(s);
  if (s === '') return '""';
  if (
    /:\s|#|\n|\r|\\|"/.test(s) ||
    /^[-?:,\[\]{}#&*!|>'"%@`<]/.test(s) ||
    /^(true|false|yes|no|on|off|null|~|---|\.\.\.|-?\d+(\.\d+)?)$/i.test(s)
  ) {
    return JSON.stringify(s);
  }
  return s;
}

export const LINK_YAML_KEY = {
  reachable: 'reachable_areas',
  visible: 'visible_areas',
  scream: 'scream_range',
};

export function linkToYaml(P, a, lt) {
  const L = a.links[lt];
  if (lt === 'visible' && L.mode === 'reachable') return null; // server default
  if (lt === 'scream' && L.mode === 'none') return null; // server default
  if (L.mode === 'all') {
    if (lt === 'reachable') return '<ALL>';
    const names = allExceptHubNames(P, a).map(escName).join(', ');
    if (!names) return lt === 'scream' ? null : '""';
    return names;
  }
  if (L.mode === 'reachable') return '<REACHABLE_AREAS>';
  if (L.mode === 'none') return null;
  const joined = (L.targets || [])
    .map((id) => {
      const t = P.areas.find((x) => x.id === id);
      return t ? escName(t.area) : '';
    })
    .filter(Boolean)
    .join(', ');
  if (!joined && lt === 'scream') return null; // empty scream list behaves like server default (none)
  return joined || '""';
}

export function exportYaml(P) {
  const lines = [];
  P.areas.forEach((a) => {
    lines.push('- area: ' + yamlScalar(a.area));
    lines.push('  background: ' + yamlScalar(a.background));
    const tod = (a.tod || []).map(([k, v]) => [strip(k), strip(v)]).filter(([k, v]) => k && v);
    if (tod.length) {
      lines.push('  background_tod:');
      tod.forEach(([k, v]) => lines.push('    ' + yamlScalar(k) + ': ' + yamlScalar(v)));
    }
    BOOL_FIELDS.forEach(([k, , d]) => {
      if (a[k] !== d) lines.push('  ' + k + ': ' + a[k]);
    });
    if (a.afk_delay > 0) lines.push('  afk_delay: ' + a.afk_delay);
    if (a.afk_sendto > 0) lines.push('  afk_sendto: ' + a.afk_sendto);
    EXTRA_KEYS.forEach(([k, def]) => {
      const v = strip(a[k]);
      if (v && v !== def) lines.push('  ' + k + ': ' + yamlScalar(v));
    });
    if (strip(a.default_description)) lines.push('  default_description: ' + yamlScalar(a.default_description));
    ['reachable', 'visible', 'scream'].forEach((lt) => {
      const v = linkToYaml(P, a, lt);
      if (v !== null) lines.push('  ' + LINK_YAML_KEY[lt] + ': ' + v);
    });
    const chars = (a.restricted_chars || []).map(strip).filter(Boolean);
    if (chars.length) {
      lines.push('  restricted_chars: ' + chars.map(escName).join(', '));
    }
    lines.push('');
  });
  return lines.join('\n');
}

/* ================= YAML import ================= */

export function unquote(s) {
  s = strip(s);
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    const inner = s.slice(1, -1);
    return inner.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[nrt\\/"' ]|\r?\n\s*)/g, (m, esc) => {
      if (esc === 'n') return '\n';
      if (esc === 'r') return '\r';
      if (esc === 't') return '\t';
      if (esc === '\\') return '\\';
      if (esc === '"') return '"';
      if (esc === "'") return "'";
      if (esc === '/') return '/';
      if (esc === ' ') return ' ';
      if (esc.startsWith('\n') || esc.startsWith('\r')) return '';
      if (esc.startsWith('x') || esc.startsWith('u') || esc.startsWith('U')) {
        return String.fromCodePoint(parseInt(esc.slice(1), 16));
      }
      return m;
    });
  }
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

// Find the index where a quoted string starting at index 0 closes, or -1 if unclosed.
function closingQuoteIndex(v) {
  const q = v[0];
  if (q !== '"' && q !== "'") return -1;
  for (let i = 1; i < v.length; i++) {
    if (q === '"' && v[i] === '\\') {
      i++;
      continue;
    }
    if (v[i] === q) {
      if (q === "'" && v[i + 1] === "'") {
        i++;
        continue;
      }
      return i;
    }
  }
  return -1;
}

export function quoteClosed(v) {
  const q = v[0];
  if (q !== '"' && q !== "'") return true;
  return closingQuoteIndex(v) >= 0;
}

// Strip a trailing inline `# comment` only when it sits outside any quotes and is
// preceded by whitespace (matching YAML's inline comment rule).
function stripInlineComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q === '"') {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === '"') q = null;
    } else if (q === "'") {
      if (c === "'") {
        if (line[i + 1] === "'") i++;
        else q = null;
      }
    } else if (c === '"' || c === "'") {
      q = c;
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

// Unwrap a value only if the ENTIRE string is encapsulated by one single quote pair.
function unwrapWholeString(v) {
  v = strip(v);
  if ((v.startsWith('"') || v.startsWith("'")) && closingQuoteIndex(v) === v.length - 1) {
    return unquote(v);
  }
  return v;
}

export function splitList(v) {
  v = unwrapWholeString(v);
  if (!v || v === '[]' || v === '~' || /^null$/i.test(v)) return [];
  if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1);
  const parts = [];
  let cur = '';
  let q = null;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (q === '"') {
      cur += c;
      if (c === '\\' && i + 1 < v.length) cur += v[++i];
      else if (c === '"') q = null;
    } else if (q === "'") {
      cur += c;
      if (c === "'") {
        if (v[i + 1] === "'") cur += v[++i];
        else q = null;
      }
    } else if ((c === '"' || c === "'") && cur.trim() === '') {
      q = c;
      cur += c;
    } else if (c === '\\' && i + 1 < v.length) {
      cur += c + v[++i];
    } else if (c === ',' && v[i + 1] === '\\' && v[i + 2] === ' ') {
      cur += ',\\ ';
      i += 2;
    } else if (c === ',') {
      parts.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  parts.push(cur);
  return parts
    .map((s) => unquote(s).replace(/,\\ /g, ', ').replace(/\\,/g, ','))
    .map(strip)
    .filter(Boolean);
}

const indentOf = (line) => {
  let n = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ' ') n++;
    else if (line[i] === '\t') n += 2;
    else break;
  }
  return n;
};

export function parseYamlWithReport(text) {
  const warnings = [];
  const errors = [];
  if (!text || !strip(text)) {
    return { areas: [], warnings, errors: ['The YAML input is empty.'] };
  }

  const LIST_KEYS = new Set(['reachable_areas', 'visible_areas', 'scream_range', 'restricted_chars']);
  const rawAreas = [];
  let cur = null;
  let subMode = null; // 'tod' | 'list'
  let subKey = null;
  let subIndent = 0;
  let areaDashIndent = null;

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

  const readScalar = (first, startIdx, baseIndent) => {
    const raw = strip(first);
    if (raw === '|' || raw === '|-' || raw === '|+' || raw === '>' || raw === '>-' || raw === '>+') {
      const folded = raw.startsWith('>');
      const block = [];
      let used = 0;
      let blockIndent = null;
      while (startIdx + used + 1 < lines.length) {
        const nxt = lines[startIdx + used + 1];
        if (!strip(nxt)) {
          block.push('');
          used++;
          continue;
        }
        const ind = indentOf(nxt);
        if (ind <= baseIndent) break;
        if (blockIndent === null) blockIndent = ind;
        block.push(nxt.slice(Math.min(blockIndent, nxt.length)));
        used++;
      }
      while (block.length && block[block.length - 1] === '') block.pop();
      const out = folded ? block.join('\n').replace(/([^\n])\n([^\n])/g, '$1 $2') : block.join('\n');
      return { v: out, used, wasBlock: true };
    }

    let v = raw;
    let used = 0;
    if ((v.startsWith('"') || v.startsWith("'")) && !quoteClosed(v)) {
      const doubleQ = v.startsWith('"');
      while (startIdx + used + 1 < lines.length) {
        const nxt = lines[startIdx + used + 1];
        used++;
        if (strip(nxt) === '') {
          v += '\n';
        } else if (doubleQ && /(?<!\\)\\$/.test(v)) {
          // YAML double-quoted trailing backslash joins the next line without inserting an extra space
          v = v.slice(0, -1) + strip(nxt);
        } else {
          v += (v.endsWith('\n') ? '' : ' ') + strip(nxt);
        }
        if (quoteClosed(v)) break;
      }
    } else if (v !== '' && !v.startsWith('"') && !v.startsWith("'")) {
      // Unquoted plain scalars (or flow arrays) can wrap onto deeper-indented continuation lines
      const flowOpen = v.startsWith('[') && !v.endsWith(']');
      while (startIdx + used + 1 < lines.length) {
        const nxtRaw = stripInlineComment(lines[startIdx + used + 1]);
        const nxtTrim = strip(nxtRaw);
        if (!nxtTrim) {
          // Look ahead: a blank line only stays inside a plain scalar if followed by another indented continuation
          let peek = startIdx + used + 2;
          while (peek < lines.length && !strip(lines[peek])) peek++;
          if (peek >= lines.length) break;
          const peekRaw = stripInlineComment(lines[peek]);
          const peekTrim = strip(peekRaw);
          if (
            indentOf(peekRaw) <= baseIndent ||
            peekTrim.startsWith('- ') ||
            peekTrim === '-' ||
            /^[a-zA-Z0-9_.-]+:(?:\s|$)/.test(peekTrim)
          ) {
            break;
          }
          used++;
          v += '\n';
          continue;
        }
        const nxtInd = indentOf(nxtRaw);
        if (nxtInd <= baseIndent) break;
        if (!flowOpen && (nxtTrim.startsWith('- ') || nxtTrim === '-' || /^[a-zA-Z0-9_.-]+:(?:\s|$)/.test(nxtTrim))) {
          break;
        }
        used++;
        v += (v.endsWith('\n') ? '' : ' ') + nxtTrim;
        if (flowOpen && nxtTrim.endsWith(']')) break;
      }
    }
    return { v, used, wasBlock: false };
  };

  for (let li = 0; li < lines.length; li++) {
    const cleaned = stripInlineComment(lines[li]);
    const trimmed = strip(cleaned);
    if (!trimmed || trimmed === '---' || trimmed === '...') continue;

    const indent = indentOf(cleaned);
    const body = trimmed;

    // Optional top-level `areas:` wrapper
    if (!cur && indent === 0 && /^areas:\s*$/.test(body)) continue;

    // A YAML sequence item `- ...`
    if (body.startsWith('- ') || body === '-') {
      if (subMode === 'list' && cur && indent >= subIndent) {
        const item = unquote(body.slice(1));
        if (item) {
          if (!Array.isArray(cur[subKey])) cur[subKey] = [];
          cur[subKey].push(item);
        }
        continue;
      }
      if (areaDashIndent === null || indent <= areaDashIndent) {
        areaDashIndent = indent;
        cur = { tod: [] };
        rawAreas.push(cur);
        subMode = null;
        subKey = null;
        const rest = strip(body.slice(1));
        const ci = rest.indexOf(':');
        if (ci >= 0) {
          const k0 = strip(rest.slice(0, ci));
          const { v, used, wasBlock } = readScalar(rest.slice(ci + 1), li, indent);
          li += used;
          cur[k0] = LIST_KEYS.has(k0) ? strip(v) : wasBlock ? v : unquote(v);
        }
        continue;
      }
    }

    if (!cur) continue;

    if (subMode === 'tod' && indent >= subIndent) {
      const ci = body.indexOf(':');
      if (ci >= 0) {
        const tk = unquote(body.slice(0, ci));
        const { v, used, wasBlock } = readScalar(body.slice(ci + 1), li, indent);
        li += used;
        cur.tod.push([tk, wasBlock ? v : unquote(v)]);
        continue;
      }
    }

    const ci = body.indexOf(':');
    if (ci < 0) continue;
    subMode = null;
    subKey = null;

    const key = unquote(body.slice(0, ci));
    const { v: rawVal, used, wasBlock } = readScalar(body.slice(ci + 1), li, indent);
    li += used;

    if (key === 'background_tod' && strip(rawVal) === '') {
      subMode = 'tod';
      subIndent = indent + 1;
      cur.tod = [];
      continue;
    }

    if (LIST_KEYS.has(key) && strip(rawVal) === '') {
      subMode = 'list';
      subKey = key;
      subIndent = Math.max(indent, (areaDashIndent ?? 0) + 1);
      cur[key] = [];
      continue;
    }

    cur[key] = LIST_KEYS.has(key) ? strip(rawVal) : wasBlock ? rawVal : unquote(rawVal);
  }

  if (!rawAreas.length) {
    return { areas: [], warnings, errors: ['No areas were found in this YAML file.'] };
  }

  const areas = rawAreas.map((r) => {
    const a = blankArea(strip(r.area || 'Unnamed'));
    a.background = strip(r.background || '');
    a.default_description = strip(decodeDesc(r.default_description || ''));
    a.tod = (r.tod || []).map(([k, v]) => [strip(k), strip(v)]);
    BOOL_FIELDS.forEach(([k]) => {
      if (r[k] !== undefined) a[k] = String(r[k]).toLowerCase() === 'true';
    });
    if (r.afk_delay !== undefined) a.afk_delay = Math.max(0, parseInt(r.afk_delay) || 0);
    if (r.afk_sendto !== undefined) a.afk_sendto = Math.max(0, parseInt(r.afk_sendto) || 0);
    ['weather', 'investigation', 'map_visual'].forEach((k) => {
      if (r[k] !== undefined) a[k] = strip(r[k]);
    });
    if (Array.isArray(r.restricted_chars)) a.restricted_chars = r.restricted_chars.map(strip).filter(Boolean);
    else if (r.restricted_chars) a.restricted_chars = splitList(r.restricted_chars);
    a._rawLinks = { reachable: r.reachable_areas, visible: r.visible_areas, scream: r.scream_range };
    return a;
  });

  const exactMap = new Map();
  const lowerMap = new Map();
  areas.forEach((a) => {
    const key = strip(a.area);
    if (exactMap.has(key)) {
      warnings.push(`Duplicate area name "${key}" found in YAML — links targeting it may resolve ambiguously.`);
    } else {
      exactMap.set(key, a);
    }
    const low = key.toLowerCase();
    if (!lowerMap.has(low)) lowerMap.set(low, a);
  });

  const resolveName = (rawName, sourceArea, lt) => {
    const n = strip(rawName);
    if (!n) return null;
    if (exactMap.has(n)) return exactMap.get(n).id;
    const ci = lowerMap.get(n.toLowerCase());
    if (ci) {
      warnings.push(`Area "${sourceArea}" (${LINK_YAML_KEY[lt]}): matched "${n}" to "${ci.area}" ignoring letter case.`);
      return ci.id;
    }
    warnings.push(`Area "${sourceArea}" (${LINK_YAML_KEY[lt]}): unknown target area "${n}" was skipped.`);
    return null;
  };

  areas.forEach((a, idx) => {
    if (a.afk_sendto >= areas.length) {
      warnings.push(`Area #${idx} "${a.area}": afk_sendto=${a.afk_sendto} is out of range (0–${areas.length - 1}).`);
    }
    if (a._rawLinks.reachable === undefined) a.links.reachable = { mode: 'all', targets: [] };
    if (a._rawLinks.scream === undefined) a.links.scream = { mode: 'none', targets: [] };

    Object.keys(a._rawLinks).forEach((lt) => {
      const raw = a._rawLinks[lt];
      if (raw === undefined) return;
      if (Array.isArray(raw)) {
        a.links[lt] = {
          mode: 'list',
          targets: raw.map((n) => resolveName(n, a.area, lt)).filter(Boolean),
        };
        return;
      }
      const v = unwrapWholeString(raw);
      if (v === '<ALL>') {
        a.links[lt] = { mode: 'all', targets: [] };
      } else if (v === '<REACHABLE_AREAS>') {
        a.links[lt] = { mode: 'reachable', targets: [] };
      } else if (v === '' || v === '[]' || v === '~' || /^null$/i.test(v)) {
        a.links[lt] = { mode: lt === 'scream' ? 'none' : 'list', targets: [] };
      } else {
        a.links[lt] = {
          mode: 'list',
          targets: splitList(raw).map((n) => resolveName(n, a.area, lt)).filter(Boolean),
        };
      }
    });
    delete a._rawLinks;
  });

  return { areas, warnings, errors };
}

export function parseYaml(text) {
  return parseYamlWithReport(text).areas;
}
