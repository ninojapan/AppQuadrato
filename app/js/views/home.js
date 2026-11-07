// Home: tutte le tessere, disposte in modo da stare tutte sullo schermo.
import { state, sortTessere, cardStatus, cardLabel, setSettings, isAdmin } from '../store.js';
import { h, icon, clear, segmented, emptyState } from '../ui.js';
import { fmtEuro, hashHue, debounce } from '../util.js';
import { openOrder } from './order.js';
import { navigate } from '../app.js';
import { openCardForm } from './cards.js';

export function renderHome(main) {
  let query = '';
  const grid = h('div', { class: 'tiles' });
  const count = h('span', { class: 'count-pill' });

  const search = h('input', {
    class: 'search-input', type: 'search', placeholder: 'Cerca nominativo…', autocomplete: 'off', autocapitalize: 'characters',
    oninput: debounce((e) => { query = e.target.value.trim().toUpperCase(); draw(); }, 80),
  });
  const clearBtn = h('button', { class: 'search-clear', 'aria-label': 'Svuota ricerca', onclick: () => { search.value = ''; query = ''; draw(); } }, icon('x', 18));

  const toolbar = h('div', { class: 'toolbar home-toolbar' },
    h('div', { class: 'search' }, icon('search', 20), search, clearBtn),
    segmented([
      { value: 'alpha', label: 'A–Z' },
      { value: 'grado', label: 'Grado' },
    ], state.settings.sortMode || 'alpha', (v) => { state.settings.sortMode = v; setSettings({ sortMode: v }); draw(); }),
    h('div', { class: 'legend' },
      h('span', { class: 'lg ok' }, 'Credito'),
      h('span', { class: 'lg low' }, 'Basso'),
      h('span', { class: 'lg debt' }, 'Debito'),
      h('span', { class: 'lg blocked' }, 'Bloccata')),
    count);

  const wrap = h('div', { class: 'tiles-wrap' }, grid);
  main.append(h('section', { class: 'view home' }, toolbar, wrap));

  function visible() {
    const list = sortTessere(state.tessere);
    if (!query) return list;
    return list.filter((t) => `${t.grado} ${t.cognome} ${t.nome}`.includes(query) || cardLabel(t).includes(query));
  }

  function draw() {
    const list = visible();
    count.textContent = `${list.length} ${list.length === 1 ? 'tessera' : 'tessere'}`;
    clear(grid);
    if (!state.tessere.length) {
      grid.classList.add('is-empty');
      grid.append(emptyState('card', 'Nessuna tessera registrata',
        isAdmin() ? 'Aggiungi le tessere degli ufficiali per iniziare.' : 'Accedere come amministratore per registrare le tessere.',
        isAdmin() ? h('button', { class: 'btn primary', onclick: () => { navigate('tessere'); openCardForm(); } }, icon('plus', 18), 'Nuova tessera') : null));
      return;
    }
    if (!list.length) {
      grid.classList.add('is-empty');
      grid.append(emptyState('search', 'Nessun risultato', `Nessuna tessera corrisponde a “${query}”.`));
      return;
    }
    grid.classList.remove('is-empty');
    const showBal = state.settings.showBalance !== false;
    const frag = document.createDocumentFragment();
    for (const t of list) {
      const st = cardStatus(t);
      const name = `${t.cognome}${t.nome ? ` ${t.nome[0]}.` : ''}`;
      frag.append(h('button', {
        class: `tile st-${st}`,
        style: { '--hue': String(hashHue(t.grado || '-')) },
        onclick: () => openOrder(t.id, draw),
      },
      h('span', { class: 'tile-grado' }, t.grado || ' '),
      h('span', { class: 'tile-name' }, name),
      showBal ? h('span', { class: 'tile-saldo' }, st === 'blocked' ? icon('lock', 14) : null, fmtEuro(t.saldo)) : null));
    }
    grid.append(frag);
    fit(list);
  }

  // Calcola colonne e dimensione dei caratteri per mostrare tutte le tessere senza scorrere.
  function fit(list = visible()) {
    const n = list.length;
    if (!n) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    if (!W || !H) return;
    const gap = W > 900 ? 10 : 8;
    const lines = state.settings.showBalance !== false ? 3.35 : 2.4;
    const longest = Math.min(24, Math.max(10, ...list.map((t) => t.cognome.length + 3)));
    let best = null;
    for (let cols = 1; cols <= 16; cols++) {
      const w = (W - gap * (cols - 1)) / cols;
      const rows = Math.ceil(n / cols);
      const hAvail = (H - gap * (rows - 1)) / rows;
      const fs = Math.min(w / (longest * 0.66 + 2.2), hAvail / lines, 30);
      if (!best || fs > best.fs) best = { cols, fs, hAvail };
    }
    const MIN_FS = 13;
    let { cols, fs } = best;
    let tileH;
    if (fs < MIN_FS) {
      fs = MIN_FS;
      cols = Math.max(1, Math.floor((W + gap) / (fs * (longest * 0.66 + 2.2) + gap)));
      tileH = fs * lines;
      wrap.classList.add('scroll');
    } else {
      tileH = Math.min(best.hAvail, fs * lines * 1.25);
      wrap.classList.remove('scroll');
    }
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.style.gap = `${gap}px`;
    grid.style.setProperty('--fs', `${fs.toFixed(1)}px`);
    grid.style.setProperty('--tile-h', `${Math.floor(tileH)}px`);
  }

  const ro = new ResizeObserver(debounce(() => fit(), 50));
  ro.observe(wrap);
  draw();
  return () => ro.disconnect();
}
