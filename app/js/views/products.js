// Gestione prodotti (solo amministratore): prezzo, foto, magazzino, inventario.
import {
  state, saveProdotto, deleteProdotto, caricoStock, inventario, findProdotto, sortProdotti,
} from '../store.js';
import { h, icon, clear, openModal, field, confirmDialog, toast, showError, switchInput, emptyState } from '../ui.js';
import { fmtEuro, parseEuro, resizeImage } from '../util.js';
import { productVisual } from './order.js';

let redraw = null;

export function renderProducts(main) {
  const body = h('div', { class: 'prod-admin-grid' });
  const stats = h('div', { class: 'toolbar-stats' });
  main.append(h('section', { class: 'view products' },
    h('div', { class: 'view-head' },
      h('h1', null, icon('box', 26), 'Prodotti'),
      stats,
      h('button', { class: 'btn primary', onclick: () => openProductForm() }, icon('plus', 18), 'Nuovo prodotto')),
    body));

  function draw() {
    const list = sortProdotti(state.prodotti);
    const withStock = list.filter((p) => p.gestioneStock);
    const valore = withStock.reduce((s, p) => s + p.stock * p.prezzo, 0);
    stats.replaceChildren(
      h('span', null, h('b', null, list.length), ' prodotti'),
      h('span', null, h('b', null, withStock.length), ' con magazzino'),
      h('span', { class: 'ok' }, 'Valore rimanenze ', h('b', null, fmtEuro(valore))));
    clear(body);
    if (!list.length) {
      body.append(emptyState('box', 'Nessun prodotto', 'Aggiungi i prodotti in vendita con il loro prezzo.',
        h('button', { class: 'btn primary', onclick: () => openProductForm() }, icon('plus', 18), 'Nuovo prodotto')));
      return;
    }
    for (const p of list) {
      body.append(h('div', { class: `prod-admin ${p.attivo ? '' : 'inactive'}` },
        productVisual(p, 'pa-img'),
        h('div', { class: 'pa-info' },
          h('div', { class: 'pa-name' }, p.nome, p.attivo ? null : h('span', { class: 'tag' }, 'Nascosto')),
          h('div', { class: 'pa-price' }, fmtEuro(p.prezzo)),
          p.gestioneStock
            ? h('div', { class: `pa-stock ${p.stock === 0 ? 'zero' : p.stock <= 5 ? 'warn' : ''}` }, icon('stack', 16), `In magazzino: `, h('b', null, p.stock))
            : h('div', { class: 'pa-stock muted' }, 'Senza gestione quantità')),
        h('div', { class: 'pa-actions' },
          p.gestioneStock ? h('button', { class: 'btn success sm', onclick: () => openCarico(p.id, draw) }, icon('plus', 16), 'Carico') : null,
          p.gestioneStock ? h('button', { class: 'btn ghost sm', onclick: () => openInventario(p.id, draw) }, icon('clipboard', 16), 'Inventario') : null,
          h('button', { class: 'icon-btn', title: 'Modifica', onclick: () => openProductForm(p.id) }, icon('edit', 20)),
          h('button', { class: 'icon-btn danger', title: 'Elimina', onclick: () => remove(p) }, icon('trash', 20)))));
    }
  }

  async function remove(p) {
    if (await confirmDialog(`Eliminare il prodotto “${p.nome}”?`, {
      ok: 'Elimina', danger: true,
      detail: 'I movimenti già registrati restano nello storico. Per toglierlo solo dalla cassa, modificarlo e disattivare “Visibile in cassa”.',
    })) {
      try { await deleteProdotto(p.id); toast('Prodotto eliminato'); draw(); } catch (err) { showError(err); }
    }
  }

  redraw = draw;
  draw();
  return () => { redraw = null; };
}

export function openProductForm(id) {
  const p = id ? findProdotto(id) : null;
  let foto = p?.foto || null;
  let gestione = p ? !!p.gestioneStock : false;
  let attivo = p ? p.attivo !== false : true;

  const nome = h('input', { type: 'text', value: p?.nome || '', autocomplete: 'off', autofocus: !p, placeholder: 'Es. Caffè' });
  const prezzo = h('input', { type: 'text', inputmode: 'decimal', value: p ? (p.prezzo / 100).toFixed(2).replace('.', ',') : '', placeholder: '0,50', autocomplete: 'off' });
  const posizione = h('input', { type: 'number', inputmode: 'numeric', value: String(p?.posizione ?? 100), min: 0, step: 1 });
  const stock = h('input', { type: 'number', inputmode: 'numeric', value: '0', min: 0, step: 1 });

  const fotoBox = h('div', { class: 'photo-box' });
  const fileIn = h('input', {
    type: 'file', accept: 'image/*', hidden: true,
    onchange: async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try { foto = await resizeImage(f, 480); drawFoto(); } catch (err) { showError(err); }
      e.target.value = '';
    },
  });
  function drawFoto() {
    fotoBox.replaceChildren(
      productVisual({ nome: nome.value || '?', foto }, 'photo-preview'),
      h('div', { class: 'photo-actions' },
        h('button', { type: 'button', class: 'btn ghost sm', onclick: () => fileIn.click() }, icon('camera', 18), foto ? 'Cambia foto' : 'Aggiungi foto'),
        foto ? h('button', { type: 'button', class: 'btn ghost sm danger-text', onclick: () => { foto = null; drawFoto(); } }, icon('trash', 18), 'Rimuovi') : null,
        h('span', { class: 'small muted' }, 'Facoltativa. Si può scattare con la fotocamera del tablet.')),
      fileIn);
  }
  nome.addEventListener('input', () => { if (!foto) drawFoto(); });
  drawFoto();

  const stockRow = h('div', { class: 'stock-row' }, field('Quantità iniziale in magazzino', stock, 'Es. numero di cialde disponibili.'));
  const syncStock = () => { stockRow.hidden = !gestione || !!p; };
  syncStock();

  const save = async () => {
    try {
      const c = parseEuro(prezzo.value);
      if (Number.isNaN(c)) throw new Error('Prezzo non valido');
      await saveProdotto({
        id: p?.id, nome: nome.value, prezzo: c, foto, gestioneStock: gestione,
        stockIniziale: parseInt(stock.value, 10) || 0, posizione: parseInt(posizione.value, 10), attivo,
      });
      toast(p ? 'Prodotto aggiornato' : 'Prodotto registrato', { type: 'success' });
      m.close();
      redraw && redraw();
    } catch (err) { showError(err); }
  };

  const m = openModal({
    title: p ? 'Modifica prodotto' : 'Nuovo prodotto',
    content: h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); save(); } },
      h('div', { class: 'grid-2' }, field('Nome prodotto', nome), field('Prezzo di vendita €', prezzo)),
      fotoBox,
      h('label', { class: 'switch-row' },
        h('div', null, h('b', null, 'Gestione quantità (magazzino)'),
          h('div', { class: 'small muted' }, 'Per prodotti a unità, es. cialde del caffè: controlla le rimanenze e blocca la vendita quando finiscono.')),
        switchInput(gestione, (v) => { gestione = v; syncStock(); })),
      stockRow,
      p && p.gestioneStock ? h('p', { class: 'small muted' }, `In magazzino: ${p.stock}. Per modificare la quantità usare “Carico” o “Inventario”.`) : null,
      h('label', { class: 'switch-row' },
        h('div', null, h('b', null, 'Visibile in cassa'), h('div', { class: 'small muted' }, 'Se disattivato il prodotto non compare tra quelli acquistabili.')),
        switchInput(attivo, (v) => { attivo = v; })),
      field('Posizione nell\'elenco', posizione, 'Numeri più bassi compaiono prima (es. 1 per il caffè).'),
      h('button', { type: 'submit', hidden: true })),
    footer: [
      h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Annulla'),
      h('button', { class: 'btn primary', onclick: save }, icon('check', 18), 'Salva'),
    ],
  });
}

export function openCarico(prodottoId, onDone) {
  const p = findProdotto(prodottoId);
  if (!p) return;
  let qta = 0;
  const input = h('input', { class: 'amount-input', type: 'number', inputmode: 'numeric', min: 1, step: 1, placeholder: '0', autofocus: true });
  const note = h('input', { type: 'text', placeholder: 'Es. acquisto del 12/03', autocomplete: 'off' });
  const preview = h('div', { class: 'credit-preview' });
  const okBtn = h('button', { class: 'btn success lg', onclick: () => save() });
  const refresh = () => {
    qta = parseInt(input.value, 10) || 0;
    preview.replaceChildren(
      h('div', null, h('span', { class: 'muted small' }, 'Attuale'), h('b', null, p.stock)),
      h('div', { class: 'arrow' }, '→'),
      h('div', null, h('span', { class: 'muted small' }, 'Dopo il carico'), h('b', { class: 'ok' }, qta > 0 ? p.stock + qta : '—')));
    okBtn.disabled = qta <= 0;
    okBtn.replaceChildren(icon('check', 20), qta > 0 ? `Carica ${qta}` : 'Carica');
  };
  input.addEventListener('input', refresh);
  const add = (n) => { input.value = String((parseInt(input.value, 10) || 0) + n); refresh(); };

  async function save() {
    if (okBtn.disabled) return;
    try {
      await caricoStock(p.id, qta, note.value);
      toast(`${p.nome}: caricati ${qta} pezzi`, { type: 'success' });
      m.close();
      onDone && onDone();
    } catch (err) { showError(err); }
  }

  const m = openModal({
    title: `Carico magazzino · ${p.nome}`, size: 'sm',
    content: h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); save(); } },
      field('Quantità da aggiungere', input),
      h('div', { class: 'quick-amounts' }, [1, 10, 25, 50, 100].map((n) => h('button', { type: 'button', class: 'btn chip-btn', onclick: () => add(n) }, `+${n}`))),
      field('Nota', note),
      preview,
      h('button', { type: 'submit', hidden: true })),
    footer: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Annulla'), okBtn],
  });
  refresh();
}

export function openInventario(prodottoId, onDone) {
  const p = findProdotto(prodottoId);
  if (!p) return;
  const input = h('input', { class: 'amount-input', type: 'number', inputmode: 'numeric', min: 0, step: 1, placeholder: String(p.stock), autofocus: true });
  const note = h('input', { type: 'text', placeholder: 'Facoltativa', autocomplete: 'off' });
  const result = h('div', { class: 'inv-result' });
  const okBtn = h('button', { class: 'btn primary lg', onclick: () => save() }, icon('check', 20), 'Conferma inventario');
  const refresh = () => {
    const raw = input.value.trim();
    const n = parseInt(raw, 10);
    if (raw === '' || Number.isNaN(n) || n < 0) {
      result.replaceChildren(h('span', { class: 'muted' }, 'Inserire la quantità contata fisicamente.'));
      okBtn.disabled = true;
      return;
    }
    const diff = n - p.stock;
    okBtn.disabled = false;
    result.replaceChildren(
      h('div', null, h('span', { class: 'muted small' }, 'Teorico (app)'), h('b', null, p.stock)),
      h('div', null, h('span', { class: 'muted small' }, 'Contato'), h('b', null, n)),
      h('div', null, h('span', { class: 'muted small' }, 'Differenza'),
        h('b', { class: diff < 0 ? 'bad' : diff > 0 ? 'warn' : 'ok' }, diff === 0 ? 'Quadra ✓' : `${diff > 0 ? '+' : ''}${diff} (${fmtEuro(diff * p.prezzo)})`)));
  };
  input.addEventListener('input', refresh);

  async function save() {
    if (okBtn.disabled) return;
    try {
      const mov = await inventario(p.id, parseInt(input.value, 10), note.value);
      toast(mov ? `${p.nome}: magazzino aggiornato a ${mov.stockDopo}` : `${p.nome}: il magazzino quadra`, { type: 'success' });
      m.close();
      onDone && onDone();
    } catch (err) { showError(err); }
  }

  const m = openModal({
    title: `Inventario · ${p.nome}`, size: 'sm',
    content: h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); save(); } },
      h('p', { class: 'muted' }, 'Contare le unità realmente presenti e confrontarle con quelle calcolate dall\'app. Una differenza negativa indica unità consumate ma non registrate.'),
      field('Quantità contata', input),
      result,
      field('Nota', note),
      h('button', { type: 'submit', hidden: true })),
    footer: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Annulla'), okBtn],
  });
  refresh();
}
