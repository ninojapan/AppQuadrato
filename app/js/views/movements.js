// Storico movimenti con filtri e annullamenti.
// Operatore: vede i movimenti e può modificare/annullare i consumi recenti. Amministratore: tutto, più esportazione CSV.
import { state, storna, puoModificare, operEditHours, isAdmin, sortTessere, cardLabel } from '../store.js';
import { openOrder } from './order.js';
import { movimentiRange } from '../db.js';
import { h, icon, clear, confirmDialog, toast, showError, emptyState } from '../ui.js';
import { fmtEuro, fmtNum, fmtDateTime, csvCell, downloadBlob, isoDate } from '../util.js';
import { periodPicker } from '../period.js';

const TIPI = {
  consumo: { label: 'Consumo', cls: 't-consumo' },
  ricarica: { label: 'Ricarica', cls: 't-ricarica' },
  rimborso: { label: 'Rimborso', cls: 't-rimborso' },
  carico: { label: 'Carico', cls: 't-carico' },
  inventario: { label: 'Inventario', cls: 't-inventario' },
  storno: { label: 'Storno', cls: 't-storno' },
  chiusura: { label: 'Chiusura tessera', cls: 't-storno' },
};

export function movTypeBadge(m) {
  const t = TIPI[m.tipo] || { label: m.tipo, cls: '' };
  return h('span', { class: `type-badge ${t.cls}` }, t.label,
    m.stornato ? h('span', { class: 'stornato-tag' }, m.modificato ? 'modificato' : 'annullato') : null);
}

export function describeMov(m) {
  const righe = (m.righe || []).map((r) => `${r.qta}× ${r.nome}`).join(', ');
  switch (m.tipo) {
    case 'consumo': return m.sostituisce ? `${righe} (correzione di #${m.sostituisce})` : righe;
    case 'ricarica': case 'rimborso': return m.note || '';
    case 'carico': return `${m.prodottoNome}: +${m.qta} (${m.stockPrima} → ${m.stockDopo})${m.note ? ` · ${m.note}` : ''}`;
    case 'inventario': return `${m.prodottoNome}: ${m.qta > 0 ? '+' : ''}${m.qta} (${m.stockPrima} → ${m.stockDopo})${m.note ? ` · ${m.note}` : ''}`;
    case 'storno': {
      const what = TIPI[m.rifTipo]?.label || m.rifTipo;
      const det = m.rifTipo === 'consumo' ? righe : m.prodottoNome || '';
      return `Annulla ${what.toLowerCase()} #${m.rif}${det ? `: ${det}` : ''}${m.note ? ` · ${m.note}` : ''}`;
    }
    default: return m.note || '';
  }
}

const FILTRI = [
  { value: 'tutti', label: 'Tutti' },
  { value: 'consumo', label: 'Consumi' },
  { value: 'credito', label: 'Ricariche/Rimborsi' },
  { value: 'magazzino', label: 'Magazzino' },
  { value: 'storno', label: 'Storni' },
];

export function renderMovements(main) {
  const admin = isAdmin();
  let range;
  let tipo = admin ? 'tutti' : 'consumo';
  let tesseraId = '';
  let all = [];
  let limit = 200;

  const body = h('div', { class: 'table-wrap' });
  const totals = h('div', { class: 'toolbar-stats' });
  const picker = periodPicker(admin ? '7g' : 'oggi', (r) => { range = r; load(); });
  range = picker.current();

  const tipoSel = h('select', { onchange: (e) => { tipo = e.target.value; limit = 200; draw(); } }, FILTRI.map((f) => h('option', { value: f.value }, f.label)));
  tipoSel.value = tipo;
  const cardSel = h('select', { onchange: (e) => { tesseraId = e.target.value; limit = 200; draw(); } },
    h('option', { value: '' }, 'Tutte le tessere'),
    sortTessere(state.tessere).map((t) => h('option', { value: String(t.id) }, cardLabel(t))));

  main.append(h('section', { class: 'view movements' },
    h('div', { class: 'view-head' },
      h('h1', null, icon('list', 26), 'Movimenti'),
      totals,
      admin ? h('button', { class: 'btn ghost', onclick: () => exportCsv() }, icon('download', 18), 'Esporta CSV') : null),
    admin ? null : h('div', { class: 'info-banner' }, icon('edit', 20),
      h('span', null, `Puoi modificare o annullare i consumi registrati nelle ultime ${operEditHours()} ore. Per tutto il resto serve l'amministratore.`)),
    h('div', { class: 'toolbar wrap' }, picker.el, tipoSel, cardSel),
    body));

  function filtered() {
    return all.filter((m) => {
      if (tesseraId && String(m.tesseraId) !== tesseraId) return false;
      if (tipo === 'tutti') return true;
      if (tipo === 'credito') return m.tipo === 'ricarica' || m.tipo === 'rimborso';
      if (tipo === 'magazzino') return m.tipo === 'carico' || m.tipo === 'inventario';
      return m.tipo === tipo;
    });
  }

  async function load() {
    try {
      all = (await movimentiRange(range.from, range.to)).sort((a, b) => b.ts - a.ts || b.id - a.id);
    } catch (err) { showError(err); all = []; }
    limit = 200;
    draw();
  }

  function draw() {
    const list = filtered();
    const cons = list.filter((m) => m.tipo === 'consumo' && !m.stornato).reduce((s, m) => s + m.importo, 0);
    const ric = list.filter((m) => m.tipo === 'ricarica' && !m.stornato).reduce((s, m) => s + m.importo, 0);
    totals.replaceChildren(
      h('span', null, h('b', null, list.length), ' movimenti'),
      h('span', null, 'Consumi ', h('b', null, fmtEuro(cons))),
      h('span', { class: 'ok' }, 'Ricariche ', h('b', null, fmtEuro(ric))));
    clear(body);
    if (!list.length) { body.append(emptyState('list', 'Nessun movimento nel periodo selezionato')); return; }
    body.append(h('table', { class: 'table compact' },
      h('thead', null, h('tr', null,
        h('th', null, '#'), h('th', null, 'Data e ora'), h('th', null, 'Tipo'), h('th', null, 'Tessera'), h('th', null, 'Dettaglio'),
        h('th', { class: 'num' }, 'Importo'), h('th', { class: 'num' }, 'Saldo dopo'), h('th', null, 'Utente'), h('th', null, ''))),
      h('tbody', null, list.slice(0, limit).map((m) => h('tr', { class: m.stornato ? 'stornato' : '' },
        h('td', { class: 'muted' }, m.id),
        h('td', { class: 'nowrap' }, fmtDateTime(m.ts)),
        h('td', null, movTypeBadge(m)),
        h('td', { class: 'nowrap' }, m.tesseraLabel || ''),
        h('td', { class: 'detail' }, describeMov(m)),
        h('td', { class: `num nowrap ${m.delta < 0 ? 'bad' : m.delta > 0 ? 'ok' : ''}` }, m.delta ? fmtEuro(m.delta) : ''),
        h('td', { class: 'num nowrap' }, m.saldoDopo != null ? fmtEuro(m.saldoDopo) : ''),
        h('td', { class: 'muted small' }, m.ruolo === 'admin' ? 'Admin' : 'Operatore'),
        h('td', { class: 'actions' }, h('div', { class: 'row-actions' }, actions(m))))))));
    if (list.length > limit) {
      body.append(h('div', { class: 'more' }, h('button', { class: 'btn ghost', onclick: () => { limit += 300; draw(); } }, `Mostra altri (${list.length - limit})`)));
    }
  }

  function actions(m) {
    if (!puoModificare(m)) return null;
    if (m.tipo === 'consumo') {
      return [
        h('button', { class: 'btn ghost sm', onclick: () => openOrder(m.tesseraId, () => load(), m) }, icon('edit', 16), 'Modifica'),
        h('button', { class: 'btn ghost sm danger-text', onclick: () => doStorno(m) }, icon('undo', 16), 'Annulla'),
      ];
    }
    return h('button', { class: 'btn ghost sm', onclick: () => doStorno(m) }, icon('undo', 16), 'Storna');
  }

  async function doStorno(m) {
    const consumo = m.tipo === 'consumo';
    const ok = await confirmDialog(consumo ? `Annullare l'ordine #${m.id}?` : `Stornare il movimento #${m.id}?`, {
      title: consumo ? 'Annulla ordine' : 'Storno', ok: consumo ? 'Annulla ordine' : 'Storna', cancel: 'Indietro', danger: true,
      detail: h('div', null,
        h('div', null, movTypeBadge(m), ' ', m.tesseraLabel || m.prodottoNome || '', m.importo ? ` · ${fmtEuro(m.importo)}` : ''),
        h('div', { class: 'small muted' }, describeMov(m)),
        h('p', { class: 'small' }, 'Saldo della tessera e magazzino verranno ripristinati.')),
    });
    if (!ok) return;
    try {
      await storna(m.id, consumo ? 'Ordine annullato' : '');
      toast(consumo ? 'Ordine annullato' : 'Movimento stornato', { type: 'success' });
      load();
    } catch (err) { showError(err); }
  }

  function exportCsv() {
    const list = filtered().slice().reverse();
    const rows = [['ID', 'Data', 'Ora', 'Tipo', 'Tessera', 'Dettaglio', 'Importo €', 'Saldo prima €', 'Saldo dopo €', 'Utente', 'Annullato']];
    for (const m of list) {
      const d = new Date(m.ts);
      rows.push([
        m.id, d.toLocaleDateString('it-IT'), d.toLocaleTimeString('it-IT'), TIPI[m.tipo]?.label || m.tipo, m.tesseraLabel || '',
        describeMov(m), m.delta ? fmtNum(m.delta) : '', m.saldoPrima != null ? fmtNum(m.saldoPrima) : '',
        m.saldoDopo != null ? fmtNum(m.saldoDopo) : '', m.ruolo, m.stornato ? 'SI' : '',
      ]);
    }
    const csv = `﻿${rows.map((r) => r.map(csvCell).join(';')).join('\r\n')}`;
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `movimenti_${range.from ? isoDate(range.from) : 'inizio'}_${isoDate(range.to)}.csv`);
  }

  load();
}
