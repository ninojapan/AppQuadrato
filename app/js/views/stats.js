// Statistiche consumi, ricariche e verifica magazzino (solo amministratore).
import { state, findTessera, cardLabel, sortProdotti } from '../store.js';
import { movimentiRange } from '../db.js';
import { h, icon, clear, showError, emptyState } from '../ui.js';
import { fmtEuro, fmtDate, startOfDay, addDays } from '../util.js';
import { periodPicker } from '../period.js';
import { openInventario } from './products.js';

// Colori delle barre: verificati per contrasto e daltonismo sul fondo scuro delle schede.
const C_CONSUMI = '#0ea5c6';
const C_ORARI = '#8b5cf6';

export function renderStats(main) {
  const out = h('div', { class: 'stats-body' });
  const picker = periodPicker('30g', (r) => load(r));
  main.append(h('section', { class: 'view stats' },
    h('div', { class: 'view-head' }, h('h1', null, icon('chart', 26), 'Statistiche')),
    h('div', { class: 'toolbar wrap' }, picker.el),
    out));

  const observers = [];

  async function load(range) {
    let movs;
    try { movs = await movimentiRange(range.from, range.to); } catch (err) { showError(err); return; }
    observers.splice(0).forEach((o) => o.disconnect());
    clear(out).append(...build(movs, range, observers, () => load(picker.current())));
  }

  load(picker.current());
  return () => observers.forEach((o) => o.disconnect());
}

function build(movs, range, observers, reload) {
  const consumi = movs.filter((m) => m.tipo === 'consumo' && !m.stornato);
  const ricariche = movs.filter((m) => m.tipo === 'ricarica' && !m.stornato);
  const rimborsi = movs.filter((m) => m.tipo === 'rimborso' && !m.stornato);
  const totCons = consumi.reduce((s, m) => s + m.importo, 0);
  const totRic = ricariche.reduce((s, m) => s + m.importo, 0);
  const totRimb = rimborsi.reduce((s, m) => s + m.importo, 0);
  const credito = state.tessere.reduce((s, t) => s + Math.max(0, t.saldo), 0);
  const debiti = state.tessere.filter((t) => t.saldo < 0);
  const totDeb = debiti.reduce((s, t) => s + t.saldo, 0);
  const pezzi = consumi.reduce((s, m) => s + m.righe.reduce((a, r) => a + r.qta, 0), 0);

  const kpis = h('div', { class: 'kpis' },
    kpi('Consumi nel periodo', fmtEuro(totCons), `${consumi.length} scontrini · ${pezzi} articoli`, 'cyan', true),
    kpi('Media per scontrino', fmtEuro(consumi.length ? Math.round(totCons / consumi.length) : 0), null, 'violet'),
    kpi('Ricariche nel periodo', fmtEuro(totRic), `${ricariche.length} ricariche${totRimb ? ` · rimborsi ${fmtEuro(totRimb)}` : ''}`, 'green'),
    kpi('Contante incassato', fmtEuro(totRic - totRimb), 'Ricariche meno rimborsi: deve corrispondere alla cassa', 'amber'),
    kpi('Credito residuo tessere', fmtEuro(credito), 'Situazione attuale', 'blue'),
    kpi('Debiti attuali', fmtEuro(totDeb), `${debiti.length} tessere in debito`, 'red'));

  if (!movs.length) {
    return [kpis, emptyState('chart', 'Nessun movimento nel periodo', 'Scegliere un periodo diverso.')];
  }

  /* ---- andamento ---- */
  const firstTs = range.from || Math.min(...movs.map((m) => m.ts));
  const spanDays = Math.round((startOfDay(range.to) - startOfDay(firstTs)) / 86400000) + 1;
  const perMonth = spanDays > 62;
  const buckets = new Map();
  if (perMonth) {
    const d = new Date(firstTs); d.setDate(1); d.setHours(0, 0, 0, 0);
    while (d.getTime() <= range.to) {
      buckets.set(`${d.getFullYear()}-${d.getMonth()}`, { label: d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }), full: d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }), v: 0, n: 0 });
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    for (let ts = startOfDay(firstTs); ts <= range.to; ts = addDays(ts, 1)) {
      const d = new Date(ts);
      buckets.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, { label: `${d.getDate()}/${d.getMonth() + 1}`, full: d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }), v: 0, n: 0 });
    }
  }
  for (const m of consumi) {
    const d = new Date(m.ts);
    const key = perMonth ? `${d.getFullYear()}-${d.getMonth()}` : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const b = buckets.get(key);
    if (b) { b.v += m.importo; b.n += 1; }
  }
  const trend = [...buckets.values()];

  const hours = Array.from({ length: 24 }, (_, i) => ({ label: String(i), full: `${String(i).padStart(2, '0')}:00–${String(i).padStart(2, '0')}:59`, v: 0 }));
  for (const m of consumi) hours[new Date(m.ts).getHours()].v += 1;
  // mostra solo l'intervallo di ore con attività (più leggibile)
  const active = hours.map((x, i) => (x.v ? i : -1)).filter((i) => i >= 0);
  const hoursShown = active.length ? hours.slice(Math.max(0, Math.min(...active) - 1), Math.min(24, Math.max(...active) + 2)) : hours;

  /* ---- prodotti ---- */
  const perProd = new Map();
  for (const m of consumi) {
    for (const r of m.righe) {
      const x = perProd.get(r.prodottoId) || { nome: r.nome, qta: 0, euro: 0 };
      x.qta += r.qta; x.euro += r.qta * r.prezzo;
      perProd.set(r.prodottoId, x);
    }
  }
  const topProd = [...perProd.values()].sort((a, b) => b.euro - a.euro);

  /* ---- tessere ---- */
  const perCard = new Map();
  for (const m of consumi) {
    const x = perCard.get(m.tesseraId) || { label: m.tesseraLabel, n: 0, euro: 0 };
    const t = findTessera(m.tesseraId);
    if (t) x.label = cardLabel(t);
    x.n += 1; x.euro += m.importo;
    perCard.set(m.tesseraId, x);
  }
  const topCard = [...perCard.values()].sort((a, b) => b.euro - a.euro);

  return [
    kpis,
    h('div', { class: 'panels' },
      panel(perMonth ? 'Consumi per mese (€)' : 'Consumi per giorno (€)', 'Tocca una colonna per il dettaglio',
        columnChart(trend, observers, {
          color: C_CONSUMI,
          tick: (v) => euroShort(v),
          tip: (p) => [p.full, `${fmtEuro(p.v)} · ${p.n} scontrini`],
        }), 'wide'),
      panel('Prodotti più venduti', `${topProd.length} prodotti`, barList(topProd.slice(0, 12).map((p) => ({ label: p.nome, v: p.euro, extra: `${p.qta} pz` })), C_CONSUMI)),
      panel('Scontrini per fascia oraria', 'Quando si consuma di più',
        columnChart(hoursShown, observers, {
          color: C_ORARI,
          tick: (v) => String(v),
          tip: (p) => [p.full, `${p.v} scontrini`],
        })),
      panel('Maggiori consumatori', `${topCard.length} tessere con consumi`, barList(topCard.slice(0, 12).map((c) => ({ label: c.label, v: c.euro, extra: `${c.n} scontr.` })), C_CONSUMI))),
    stockPanel(movs, reload),
  ];
}

function kpi(label, value, sub, tone, hero = false) {
  return h('div', { class: `kpi tone-${tone} ${hero ? 'hero' : ''}` },
    h('span', { class: 'kpi-label' }, label), h('b', { class: 'kpi-value' }, value), sub ? h('span', { class: 'kpi-sub' }, sub) : null);
}

function panel(title, sub, content, cls = '') {
  return h('div', { class: `panel ${cls}` },
    h('div', { class: 'panel-head' }, h('h3', null, title), sub ? h('span', { class: 'muted small' }, sub) : null), content);
}

const euroShort = (cents) => {
  const e = cents / 100;
  return `${e.toLocaleString('it-IT', { maximumFractionDigits: e < 10 && e % 1 ? 2 : 0 })} €`;
};

function niceStep(max, ticks = 4) {
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/** Istogramma a colonne in SVG con tooltip al tocco/passaggio. */
function columnChart(points, observers, { color, tick, tip, height = 230 }) {
  const box = h('div', { class: 'chart' });
  const tipEl = h('div', { class: 'chart-tip hidden' });
  const svgWrap = h('div', { class: 'chart-svg' });
  box.append(svgWrap, tipEl);
  const draw = () => {
    const W = Math.max(280, box.clientWidth);
    const H = height;
    const m = { l: 52, r: 10, t: 12, b: 26 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const maxV = Math.max(1, ...points.map((p) => p.v));
    const step = niceStep(maxV);
    const top = Math.ceil(maxV / step) * step;
    const n = points.length;
    const slot = iw / n;
    const bw = Math.max(2, Math.min(24, slot - 2));
    const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 44))));
    let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`;
    for (let v = 0; v <= top + 1e-9; v += step) {
      const y = m.t + ih - (v / top) * ih;
      s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" class="grid"/>`;
      s += `<text x="${m.l - 8}" y="${y + 4}" text-anchor="end" class="tick">${esc(tick(v))}</text>`;
    }
    points.forEach((p, i) => {
      const x = m.l + i * slot + (slot - bw) / 2;
      const bh = (p.v / top) * ih;
      const y = m.t + ih - bh;
      if (bh > 0) {
        const r = Math.min(4, bw / 2, bh);
        s += `<path class="bar" fill="${color}" d="M${x},${y + bh}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + bw - r}A${r},${r} 0 0 1 ${x + bw},${y + r}V${y + bh}Z"/>`;
      }
      if (i % every === 0) s += `<text x="${m.l + i * slot + slot / 2}" y="${H - 8}" text-anchor="middle" class="tick">${esc(p.label)}</text>`;
      s += `<rect class="hit" data-i="${i}" x="${m.l + i * slot}" y="${m.t}" width="${slot}" height="${ih}"/>`;
    });
    s += '</svg>';
    svgWrap.innerHTML = s;
  };
  const show = (e) => {
    const r = e.target.closest('.hit');
    if (!r) return;
    const i = Number(r.dataset.i);
    const p = points[i];
    svgWrap.querySelectorAll('.hit.on').forEach((x) => x.classList.remove('on'));
    r.classList.add('on');
    const [a, b] = tip(p);
    tipEl.replaceChildren(h('div', { class: 'tip-title' }, a), h('div', null, b));
    tipEl.classList.remove('hidden');
    const bb = box.getBoundingClientRect();
    const rb = r.getBoundingClientRect();
    const x = rb.left - bb.left + rb.width / 2;
    tipEl.style.left = `${Math.min(Math.max(x, 80), bb.width - 80)}px`;
  };
  svgWrap.addEventListener('pointermove', show);
  svgWrap.addEventListener('pointerdown', show);
  svgWrap.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') { tipEl.classList.add('hidden'); svgWrap.querySelectorAll('.hit.on').forEach((x) => x.classList.remove('on')); }
  });
  const ro = new ResizeObserver(() => draw());
  ro.observe(box);
  observers.push(ro);
  return box;
}

/** Classifica orizzontale: etichetta, barra proporzionale, valore. */
function barList(rows, color) {
  if (!rows.length) return h('p', { class: 'muted' }, 'Nessun dato');
  const max = Math.max(...rows.map((r) => r.v), 1);
  return h('div', { class: 'barlist' }, rows.map((r) => h('div', { class: 'barlist-row', title: `${r.label}: ${fmtEuro(r.v)} · ${r.extra}` },
    h('span', { class: 'bl-label' }, r.label),
    h('span', { class: 'bl-track' }, h('span', { class: 'bl-bar', style: { width: `${Math.max(1, (r.v / max) * 100)}%`, background: color } })),
    h('span', { class: 'bl-value' }, fmtEuro(r.v)),
    h('span', { class: 'bl-extra' }, r.extra))));
}

/** Verifica magazzino: caricato − venduto ± inventario = rimanenza. */
function stockPanel(movs, reload) {
  const prods = sortProdotti(state.prodotti.filter((p) => p.gestioneStock));
  if (!prods.length) return null;
  const rows = prods.map((p) => {
    const x = { p, caricato: 0, venduto: 0, incasso: 0, inv: 0 };
    for (const m of movs) {
      if (m.stornato || m.tipo === 'storno') continue;
      if (m.tipo === 'carico' && m.prodottoId === p.id) x.caricato += m.qta;
      if (m.tipo === 'inventario' && m.prodottoId === p.id) x.inv += m.qta;
      if (m.tipo === 'consumo') {
        for (const r of m.righe) if (r.prodottoId === p.id) { x.venduto += r.qta; x.incasso += r.qta * r.prezzo; }
      }
    }
    return x;
  });
  return h('div', { class: 'panel wide' },
    h('div', { class: 'panel-head' },
      h('h3', null, 'Verifica magazzino e incassi'),
      h('span', { class: 'muted small' }, 'Movimenti del periodo · rimanenza attuale. Confrontare la rimanenza con il conteggio fisico tramite “Verifica”.')),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table compact' },
      h('thead', null, h('tr', null,
        h('th', null, 'Prodotto'), h('th', { class: 'num' }, 'Caricati'), h('th', { class: 'num' }, 'Venduti'), h('th', { class: 'num' }, 'Rettifiche inv.'),
        h('th', { class: 'num' }, 'Incasso vendite'), h('th', { class: 'num' }, 'Rimanenza'), h('th', { class: 'num' }, 'Valore rimanenza'), h('th', null, ''))),
      h('tbody', null, rows.map((x) => h('tr', null,
        h('td', { class: 'strong' }, x.p.nome),
        h('td', { class: 'num' }, x.caricato ? `+${x.caricato}` : '0'),
        h('td', { class: 'num' }, x.venduto),
        h('td', { class: `num ${x.inv < 0 ? 'bad' : x.inv > 0 ? 'warn' : ''}` }, x.inv ? `${x.inv > 0 ? '+' : ''}${x.inv}` : '0'),
        h('td', { class: 'num' }, fmtEuro(x.incasso)),
        h('td', { class: `num strong ${x.p.stock === 0 ? 'bad' : x.p.stock <= 5 ? 'warn' : ''}` }, x.p.stock),
        h('td', { class: 'num' }, fmtEuro(x.p.stock * x.p.prezzo)),
        h('td', null, h('button', { class: 'btn ghost sm', onclick: () => openInventario(x.p.id, reload) }, icon('clipboard', 16), 'Verifica'))))))),
    h('p', { class: 'small muted' }, `Aggiornato al ${fmtDate(Date.now())}. L'incasso delle vendite è già compreso nei consumi pagati con le tessere.`));
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
