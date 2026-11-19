<script>
  import { onMount } from 'svelte';
  import { update, uiScale, undo, redo, selectOnly } from './lib/state.js';
  import * as M from './lib/core.js';
  import Header from './components/Header.svelte';
  import ToastHost from './components/ToastHost.svelte';
  import AreaList from './components/panels/AreaList.svelte';
  import Inspector from './components/panels/Inspector.svelte';
  import Graph from './components/graph/Graph.svelte';

  function onWinKey(e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((k === 'z' && e.shiftKey) || k === 'y') {
      e.preventDefault();
      redo();
    }
  }

  function addArea() {
    update((s) => {
      const last = s.project.areas[s.project.areas.length - 1];
      const a = M.addArea(s.project, {
        templateId: s.newAreaTemplate || null,
        bgPrefix: s.activeBgPrefix || null,
      });
      if (last) {
        a.x = last.x + 60;
        a.y = last.y + 90;
      }
      selectOnly(s, a.id);
    });
  }

  onMount(() => {
    const MIN_W = 1080;
    const MIN_H = 640;
    const appEl = document.getElementById('app');
    const fit = () => {
      const s = Math.min(1, window.innerWidth / MIN_W, window.innerHeight / MIN_H);
      uiScale.value = s;
      appEl.style.width = (s < 1 ? MIN_W : window.innerWidth) + 'px';
      appEl.style.height = (s < 1 ? MIN_H : window.innerHeight) + 'px';
      appEl.style.transform = 'translate(-50%, -50%)' + (s < 1 ? ' scale(' + s + ')' : '');
    };
    fit();
    window.addEventListener('resize', fit);

    let ui = {};
    try {
      ui = JSON.parse(localStorage.getItem('areamaker-ui') || '{}');
    } catch {
      /* ignore */
    }
    const L = document.getElementById('left');
    const R = document.getElementById('right');
    if (ui.leftW && L) L.style.width = ui.leftW + 'px';
    if (ui.rightW && R) R.style.width = ui.rightW + 'px';

    const save = () => {
      try {
        localStorage.setItem('areamaker-ui', JSON.stringify({ leftW: L.offsetWidth, rightW: R.offsetWidth }));
      } catch {
        /* ignore */
      }
    };
    const drag = (handle, el, sign, min, max) => {
      if (!handle || !el) return;
      handle.addEventListener('pointerdown', (evt) => {
        evt.preventDefault();
        const startX = evt.clientX;
        const startW = el.offsetWidth;
        const mv = (e2) => {
          el.style.width = Math.max(min, Math.min(max, startW + (sign * (e2.clientX - startX)) / uiScale.value)) + 'px';
        };
        const up = () => {
          window.removeEventListener('pointermove', mv);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          save();
        };
        window.addEventListener('pointermove', mv);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      });
    };
    drag(document.getElementById('resizeLeft'), L, 1, 200, 560);
    drag(document.getElementById('resizeRight'), R, -1, 260, 680);

    const onBgAssetRenamed = (e) => {
      const { oldName, newName } = e.detail || {};
      if (!oldName || !newName || oldName === newName) return;
      update((s) => {
        for (const a of s.project.areas || []) {
          if (a.background === oldName) {
            a.background = newName;
          } else if (a.background && a.background.endsWith('/' + oldName)) {
            const prefix = a.background.slice(0, a.background.lastIndexOf('/') + 1);
            a.background = prefix + newName;
          }
          if (a.background_tod && Array.isArray(a.background_tod)) {
            for (const row of a.background_tod) {
              if (row[1] === oldName) {
                row[1] = newName;
              } else if (row[1] && row[1].endsWith('/' + oldName)) {
                const prefix = row[1].slice(0, row[1].lastIndexOf('/') + 1);
                row[1] = prefix + newName;
              }
            }
          }
        }
        for (const img of s.project.images || []) {
          if (img.url === oldName) {
            img.url = newName;
          }
        }
      });
    };
    window.addEventListener('bg-asset-renamed', onBgAssetRenamed);

    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('bg-asset-renamed', onBgAssetRenamed);
    };
  });
</script>

<svelte:window on:keydown={onWinKey} />

<Header />

<main>
  <aside id="left">
    <AreaList onAddArea={addArea} />
    <div class="resizer" id="resizeLeft" title="Drag to resize sidebar"></div>
  </aside>

  <section id="centre">
    <Graph />
  </section>

  <aside id="right">
    <div class="resizer" id="resizeRight" title="Drag to resize sidebar"></div>
    <div class="pad" id="inspector"><Inspector /></div>
  </aside>
</main>

<ToastHost />
