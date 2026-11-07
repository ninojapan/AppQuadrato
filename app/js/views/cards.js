// Gestione tessere (solo amministratore): anagrafica, ricariche, rimborsi, estratto conto.
import {
  state, GRADI, saveTessera, deleteTessera, movimentoCredito, findTessera, sortTessere, cardLabel, cardFullName,
  cardStatus, normText,
} from '../store.js';
import { movimentiTessera } from '../db.js';
import { h, icon, clear, openModal, field, confirmDialog, toast, showError, segmented, emptyState } from '../ui.js';
import { fmtEuro, parseEuro, fmtDateTime, debounce } from '../util.js';
import { describeMov, movTypeBadge } from './movements.js';

let redraw = null;

export function renderCards(main) {
  let query = '';
  const body = h('div', { class: 'table-wrap' });
  const search = h('input', {
    class: 'search-input', type: 'search', placeholder: 'Cerca…', autocapitalize: 'characters',
    oninput: debounce((e) => { query = e.target.value.trim().toUpperCase(); draw(); }, 80),
  });
  const stats = h('div', { class: 'toolbar-stats' });

  main.append(h('section', { class: 'view cards' },
    h('div', { class: 'view-head' },
      h('h1', null, icon('card', 26), 'Tessere'),
      stats,
      h('button', { class: 'btn primary', onclick: () => openCardForm() }, icon('plus', 18), 'Nuova tessera')),
    h('div', { class: 'toolbar' }, h('div', { class: 'search' }, icon('search', 20), search)),
    body));

  function draw() {
    const all = state.tessere;
    const credito = all.reduce((s, t) => s + Math.max(0, t.saldo), 0);
    const debito = all.reduce((s, t) => s + Math.min(0, t.saldo), 0);
    stats.replaceChildren(
      h('span', null, h('b', null, all.length), ' tessere'),
      h('span', { class: 'ok' }, 'Credito ', h('b', null, fmtEuro(credito))),
      h('span', { class: 'bad' }, 'Debito ', h('b', null, fmtEuro(debito))));

    const list = sortTessere(all).filter((t) => !query || `${t.grado} ${t.cognome} ${t.nome}`.includes(query));
    clear(body);
    if (!all.length) {
      body.append(emptyState('card', 'Nessuna tessera', 'Registra la prima tessera con grado, cognome e nome.',
        h('button', { class: 'btn primary', onclick: () => openCardForm() }, icon('plus', 18), 'Nuova tessera')));
      return;
    }
    body.append(h('table', { class: 'table' },
      h('thead', null, h('tr', null,
        h('th', null, 'Grado'), h('th', null, 'Cognome'), h('th', null, 'Nome'), h('th', { class: 'num' }, 'Saldo'), h('th', { class: 'actions' }, ''))),
      h('tbody', null, list.map((t) => h('tr', { class: `st-${cardStatus(t)}` },
        h('td', null, h('span', { class: 'grado-tag' }, t.grado || '—')),
        h('td', { class: 'strong' }, t.cognome),
        h('td', null, t.nome),
        h('td', { class: 'num' }, h('span', { class: `saldo-pill st-${cardStatus(t)}` }, fmtEuro(t.saldo))),
        h('td', { class: 'actions' },
          h('button', { class: 'btn success sm', onclick: () => openCredit(t.id, draw) }, icon('euro', 16), 'Ricarica'),
          h('button', { class: 'icon-btn', title: 'Estratto conto', onclick: () => openStatement(t.id) }, icon('file', 20)),
          h('button', { class: 'icon-btn', title: 'Modifica', onclick: () => openCardForm(t.id) }, icon('edit', 20)),
          h('button', { class: 'icon-btn danger', title: 'Elimina', onclick: () => remove(t) }, icon('trash', 20))))))));
  }

  async function remove(t) {
    const tipo = t.saldo > 0 ? 'credit' : t.saldo < 0 ? 'debt' : 'zero';
    const detail = h('div', { class: 'delete-card' },
      h('div', { class: `delete-saldo ${tipo}` },
        h('span', null, tipo === 'credit' ? 'CREDITO RESIDUO' : tipo === 'debt' ? 'DEBITO NON SALDATO' : 'SALDO'),
        h('b', null, fmtEuro(t.saldo))),
      h('p', { class: 'small' }, tipo === 'credit'
        ? 'La tessera ha ancora del credito: se va restituito in contanti, annullare e fare prima un Rimborso.'
        : tipo === 'debt'
          ? 'La tessera ha un debito non ancora pagato: se va riscosso, annullare e fare prima una Ricarica.'
          : 'Il saldo è a zero.'),
      h('p', { class: 'small muted' }, 'I movimenti già registrati restano nello storico.'));
    const ok = await confirmDialog(`Eliminare la tessera di ${cardFullName(t)}?`, {
      title: 'Elimina tessera', ok: tipo === 'zero' ? 'Elimina' : `Elimina con ${tipo === 'credit' ? 'credito' : 'debito'} ${fmtEuro(t.saldo)}`,
      danger: true, detail,
    });
    if (!ok) return;
    try { await deleteTessera(t.id); toast('Tessera eliminata'); draw(); } catch (err) { showError(err); }
  }

  redraw = draw;
  draw();
  return () => { redraw = null; };
}

export function openCardForm(id) {
  const t = id ? findTessera(id) : null;
  const listId = 'gradi-list';
  const grado = h('input', { type: 'text', list: listId, value: t?.grado || '', autocapitalize: 'characters', autocomplete: 'off', class: 'upper', placeholder: 'Es. T.V.' });
  const cognome = h('input', { type: 'text', value: t?.cognome || '', autocapitalize: 'characters', autocomplete: 'off', class: 'upper', autofocus: !t });
  const nome = h('input', { type: 'text', value: t?.nome || '', autocapitalize: 'characters', autocomplete: 'off', class: 'upper' });
  const credito = h('input', { type: 'text', inputmode: 'decimal', placeholder: '0,00', autocomplete: 'off' });
  const preview = h('div', { class: 'card-preview' });
  const updatePreview = () => {
    const tmp = { grado: normText(grado.value), cognome: normText(cognome.value), nome: normText(nome.value) };
    preview.replaceChildren(h('span', { class: 'muted small' }, 'In home apparirà:'), h('b', null, cardLabel(tmp) || '—'));
  };
  [grado, cognome, nome].forEach((i) => i.addEventListener('input', updatePreview));
  updatePreview();

  const save = async () => {
    try {
      const c = credito.value.trim() ? parseEuro(credito.value) : 0;
      if (Number.isNaN(c) || c < 0) throw new Error('Credito iniziale non valido');
      await saveTessera({ id: t?.id, grado: grado.value, cognome: cognome.value, nome: nome.value, creditoIniziale: c });
      toast(t ? 'Tessera aggiornata' : 'Tessera registrata', { type: 'success' });
      m.close();
      redraw && redraw();
    } catch (err) { showError(err); }
  };

  const m = openModal({
    title: t ? 'Modifica tessera' : 'Nuova tessera',
    content: h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); save(); } },
      h('datalist', { id: listId }, GRADI.map((g) => h('option', { value: g }))),
      field('Grado', grado, 'Scegliere dall\'elenco o scrivere liberamente.'),
      h('div', { class: 'grid-2' }, field('Cognome', cognome), field('Nome', nome)),
      t ? null : field('Credito iniziale € (facoltativo)', credito, 'Registrato come prima ricarica.'),
      preview,
      h('p', { class: 'small muted' }, 'I dati vengono salvati automaticamente in MAIUSCOLO.'),
      h('button', { type: 'submit', hidden: true })),
    footer: [
      h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Annulla'),
      h('button', { class: 'btn primary', onclick: save }, icon('check', 18), 'Salva'),
    ],
  });
}

/** Ricarica o rimborso di credito (solo amministratore). */
export function openCredit(tesseraId, onDone, initialMode = 'ricarica') {
  const t = findTessera(tesseraId);
  if (!t) return;
  let mode = initialMode;
  let amount = 0;
  const input = h('input', { class: 'amount-input', type: 'text', inputmode: 'decimal', placeholder: '0,00', autocomplete: 'off', autofocus: true });
  const note = h('input', { type: 'text', placeholder: 'Facoltativa', autocomplete: 'off' });
  const preview = h('div', { class: 'credit-preview' });
  const okBtn = h('button', { class: 'btn success lg', onclick: () => save() });

  const setAmount = (c) => { amount = c; input.value = c ? (c / 100).toFixed(2).replace('.', ',') : ''; refresh(); };
  input.addEventListener('input', () => { const c = parseEuro(input.value); amount = Number.isNaN(c) ? NaN : c; refresh(); });

  const quick = h('div', { class: 'quick-amounts' }, [5, 10, 20, 50].map((e) =>
    h('button', { type: 'button', class: 'btn chip-btn', onclick: () => setAmount((Number.isNaN(amount) ? 0 : amount) + e * 100) }, `+${e} €`)),
  h('button', { type: 'button', class: 'btn chip-btn ghost', onclick: () => setAmount(0) }, 'Azzera'));
  const zeroDebt = t.saldo < 0
    ? h('button', { type: 'button', class: 'btn chip-btn', onclick: () => setAmount(-t.saldo) }, `Salda debito ${fmtEuro(-t.saldo)}`) : null;
  const allBack = t.saldo > 0
    ? h('button', { type: 'button', class: 'btn chip-btn', onclick: () => setAmount(t.saldo) }, `Tutto il credito ${fmtEuro(t.saldo)}`) : null;
  const extra = h('div', { class: 'quick-amounts' });

  function refresh() {
    const valid = Number.isInteger(amount) && amount > 0;
    const after = t.saldo + (mode === 'rimborso' ? -amount : amount);
    preview.replaceChildren(
      h('div', null, h('span', { class: 'muted small' }, 'Saldo attuale'), h('b', null, fmtEuro(t.saldo))),
      h('div', { class: 'arrow' }, '→'),
      h('div', null, h('span', { class: 'muted small' }, 'Nuovo saldo'), h('b', { class: valid ? (after < 0 ? 'bad' : 'ok') : '' }, valid ? fmtEuro(after) : '—')));
    okBtn.disabled = !valid || (mode === 'rimborso' && after < 0);
    okBtn.className = `btn lg ${mode === 'rimborso' ? 'warn' : 'success'}`;
    okBtn.replaceChildren(icon('check', 20), mode === 'rimborso' ? `Rimborsa ${valid ? fmtEuro(amount) : ''}` : `Ricarica ${valid ? fmtEuro(amount) : ''}`);
    extra.replaceChildren(mode === 'rimborso' ? allBack || '' : zeroDebt || '');
  }

  async function save() {
    if (okBtn.disabled) return;
    okBtn.disabled = true;
    try {
      const mov = await movimentoCredito(t.id, amount, mode, note.value);
      toast(`${mode === 'rimborso' ? 'Rimborso' : 'Ricarica'} di ${fmtEuro(amount)} ${mode === 'rimborso' ? 'registrato' : 'registrata'} · saldo ${fmtEuro(mov.saldoDopo)}`, { type: 'success' });
      m.close();
      onDone && onDone();
    } catch (err) { showError(err); refresh(); }
  }

  const m = openModal({
    title: cardFullName(t),
    subtitle: 'Movimento di credito',
    size: 'sm',
    content: h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); save(); } },
      segmented([
        { value: 'ricarica', label: 'Ricarica', icon: 'plus' },
        { value: 'rimborso', label: 'Rimborso', icon: 'undo' },
      ], mode, (v) => { mode = v; refresh(); }),
      field('Importo €', input),
      quick, extra,
      field('Nota', note),
      preview,
      h('button', { type: 'submit', hidden: true })),
    footer: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Annulla'), okBtn],
  });
  refresh();
}

export async function openStatement(tesseraId) {
  const t = findTessera(tesseraId);
  if (!t) return;
  const movs = (await movimentiTessera(tesseraId)).sort((a, b) => b.ts - a.ts || b.id - a.id);
  const consumi = movs.filter((m) => m.tipo === 'consumo' && !m.stornato).reduce((s, m) => s + m.importo, 0);
  const ricariche = movs.filter((m) => m.tipo === 'ricarica' && !m.stornato).reduce((s, m) => s + m.importo, 0);
  openModal({
    title: `Estratto conto · ${cardFullName(t)}`,
    size: 'lg',
    content: [
      h('div', { class: 'kpis small-kpis' },
        h('div', { class: 'kpi' }, h('span', null, 'Saldo'), h('b', { class: t.saldo < 0 ? 'bad' : 'ok' }, fmtEuro(t.saldo))),
        h('div', { class: 'kpi' }, h('span', null, 'Totale ricariche'), h('b', null, fmtEuro(ricariche))),
        h('div', { class: 'kpi' }, h('span', null, 'Totale consumi'), h('b', null, fmtEuro(consumi))),
        h('div', { class: 'kpi' }, h('span', null, 'Movimenti'), h('b', null, movs.length))),
      movs.length ? h('table', { class: 'table compact' },
        h('thead', null, h('tr', null, h('th', null, 'Data'), h('th', null, 'Tipo'), h('th', null, 'Dettaglio'), h('th', { class: 'num' }, 'Importo'), h('th', { class: 'num' }, 'Saldo'))),
        h('tbody', null, movs.map((mv) => h('tr', { class: mv.stornato ? 'stornato' : '' },
          h('td', { class: 'nowrap' }, fmtDateTime(mv.ts)),
          h('td', null, movTypeBadge(mv)),
          h('td', null, describeMov(mv)),
          h('td', { class: `num ${mv.delta < 0 ? 'bad' : 'ok'}` }, mv.delta ? fmtEuro(mv.delta) : ''),
          h('td', { class: 'num' }, mv.saldoDopo != null ? fmtEuro(mv.saldoDopo) : ''))))) : emptyState('list', 'Nessun movimento'),
    ],
  });
}
