<script>
  import readme from '../../../HELP.md?raw';

  export let onClose;

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  }

  function md(src) {
    const out = [];
    let inCode = false;
    let code = [];
    let para = null;
    let list = null;
    let table = null;

    const flushPara = () => {
      if (para) {
        out.push('<p>' + inline(para.join(' ')) + '</p>');
        para = null;
      }
    };
    const flushList = () => {
      if (list) {
        out.push('<ul>' + list.map((it) => '<li>' + inline(it.join(' ')) + '</li>').join('') + '</ul>');
        list = null;
      }
    };
    const flushTable = () => {
      if (table && table.length) {
        const rows = table.filter((r) => !/^\|?[\s:-]+\|/.test(r));
        const parseRow = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
        const head = parseRow(rows[0]);
        const body = rows.slice(1).map(parseRow);
        let html = '<table><thead><tr>' + head.map((h) => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>';
        body.forEach((r) => {
          html += '<tr>' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>';
        });
        html += '</tbody></table>';
        out.push(html);
        table = null;
      }
    };
    const flushAll = () => {
      flushPara();
      flushList();
      flushTable();
    };

    for (const ln of src.split(/\r?\n/)) {
      const tr = ln.trim();
      if (tr.startsWith('```')) {
        if (inCode) {
          out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
          code = [];
          inCode = false;
        } else {
          flushAll();
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        code.push(ln);
        continue;
      }
      if (tr.startsWith('|') && tr.endsWith('|')) {
        flushPara();
        flushList();
        if (!table) table = [];
        table.push(tr);
        continue;
      } else {
        flushTable();
      }
      const h = tr.match(/^(#{1,3})\s+(.*)/);
      if (h) {
        flushAll();
        out.push('<h' + h[1].length + '>' + inline(h[2].trim()) + '</h' + h[1].length + '>');
        continue;
      }
      const li = ln.match(/^\s*(?:-|\d+\.)\s+(.*)/);
      if (li) {
        flushPara();
        if (!list) list = [];
        list.push([li[1].trim()]);
        continue;
      }
      if (!tr) {
        flushAll();
        continue;
      }
      if (list && /^\s+\S/.test(ln)) {
        list[list.length - 1].push(tr);
        continue;
      }
      flushList();
      if (!para) para = [];
      para.push(tr);
    }
    flushAll();
    return out.join('\n');
  }

  let scrimMouseDownTarget = null;
  $: html = md(readme);
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && onClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="modal-bg"
  on:mousedown={(e) => (scrimMouseDownTarget = e.target)}
  on:click={(e) => {
    if (scrimMouseDownTarget === e.currentTarget && e.target === e.currentTarget) onClose();
    scrimMouseDownTarget = null;
  }}
>
  <div class="modal help-card" on:mousedown|stopPropagation on:click|stopPropagation>
    <button class="modal-x" title="Close" on:click={onClose}>✕</button>
    <div class="help-body">{@html html}</div>
  </div>
</div>

<style>
  .help-card {
    width: min(780px, 94vw);
    max-height: 88vh;
    padding: 22px 26px;
  }
  .help-body {
    font-size: 13.5px;
    line-height: 1.58;
    color: var(--ink);
  }
  .help-body :global(h1) {
    font-size: 19px;
    margin: 0 24px 10px 0;
  }
  .help-body :global(h2) {
    font-size: 15px;
    margin: 20px 0 6px;
    color: var(--accent2);
  }
  .help-body :global(h3) {
    font-size: 13.5px;
    margin: 14px 0 4px;
  }
  .help-body :global(p) {
    margin: 6px 0;
  }
  .help-body :global(ul) {
    margin: 6px 0;
    padding-left: 20px;
  }
  .help-body :global(li) {
    margin: 4px 0;
  }
  .help-body :global(code) {
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0 5px;
    font-size: 12px;
  }
  .help-body :global(pre) {
    background: var(--panel2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 10px 12px;
    overflow: auto;
  }
  .help-body :global(pre code) {
    background: none;
    border: none;
    padding: 0;
  }
  .help-body :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 12px;
    font-size: 12.5px;
  }
  .help-body :global(th),
  .help-body :global(td) {
    border: 1px solid var(--line);
    padding: 6px 8px;
    text-align: left;
  }
  .help-body :global(th) {
    background: var(--panel2);
    color: var(--accent2);
  }
  .help-body :global(a) {
    color: var(--accent2);
  }
</style>
