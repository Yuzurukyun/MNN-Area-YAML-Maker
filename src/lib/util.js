// Small shared helpers used across core and UI modules.

export const strip = (s) => (s == null ? '' : String(s)).trim();

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

let uidCounter = 1;

export const uid = () => 'a' + uidCounter++;

export function resetUid() {
  uidCounter = 1;
}

// Advance uidCounter past every existing `a<num>` ID in a project so
// adding or merging items after reload/import never collides with Area 0
// or any existing ID. Also repairs missing/duplicate IDs on areas.
export function syncUid(project) {
  let max = 0;
  const bump = (id) => {
    if (typeof id !== 'string') return;
    const m = /^a(\d+)$/.exec(id);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  };
  if (project) {
    (project.areas || []).forEach((a) => bump(a?.id));
    (project.groups || []).forEach((g) => bump(g?.id));
    (project.images || []).forEach((im) => bump(im?.id));
    (project.layouts || []).forEach((l) => bump(l?.id));
  }
  if (max >= uidCounter) uidCounter = max + 1;
}
