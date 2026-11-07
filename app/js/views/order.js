// Finestra di consumo: prodotti con +/-, pulsante CASSA, ritorno immediato alla home.
import {
  state, findTessera, cardFullName, disponibile, isBloccata, fido, sortProdotti, registraConsumo,
  storna, UNDO_SECONDS, isAdmin, cardStatus,
} from '../store.js';
import { h, icon, openModal, toast, showError, emptyState } from '../ui.js';
import { fmtEuro, hashHue, productEmoji, initials } from '../util.js';
import { openCredit } from './cards.js';

export function productVisual(p, cls = 'prod-img') {
  if (p.foto) return h('div', { class: cls }, h('img', { src: p.foto, alt: '', loading: 'lazy', draggable: 'false' }));
  const hue = hashHue(p.nome);
  const emoji = productEmoji(p.nome);
  return h('div', {
    class: `${cls} placeholder`,
    style: { background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 75% 32%))` },
  }, h('span', { class: emoji ? 'ph-emoji' : 'ph-initials' }, emoji || initials(p.nome)));
}

export function openOrder(tesseraId, onDone) {
  let t = findTessera(tesseraId);
  if (!t) return;
  const cart = new Map();
  const prodotti = sortProdotti(state.prodotti.filter((p) => p.attivo));
  const items = [];
  let saving = false;

  /* ---------- intestazione ---------- */
  const saldoEl = h('span', { class: 'saldo-pill' });
  const dispEl = h('span', { class: 'muted small' });
  const banner = h('div', { class: 'order-banner hidden' });
  const header = h('div', { class: 'modal-head order-head' },
    h('div', { class: 'order-who', style: { '--hue': String(hashHue(t.grado || '-')) } },
      h('div', { class: 'order-grado' }, t.grado),
      h('h2', { class: 'order-name' }, `${t.cognome} ${t.nome}`)),
    h('div', { class: 'order-saldo' }, h('span', { class: 'muted small' }, 'Saldo'), saldoEl, dispEl),
    isAdmin() ? h('button', {
      class: 'btn success', onclick: () => openCredit(t.id, () => { t = findTessera(tesseraId); update(); onDone && onDone(); }),
    }, icon('plus', 18), 'Ricarica') : null,
    h('button', { class: 'icon-btn', 'aria-label': 'Chiudi', onclick: () => m.close() }, icon('x')));

  /* ---------- prodotti ---------- */
  const grid = h('div', { class: 'prod-grid' });
  for (const p of prodotti) {
    const qtyEl = h('span', { class: 'qty' }, '0');
    const badge = h('span', { class: 'qty-badge' });
    const stockEl = p.gestioneStock ? h('span', { class: 'prod-stock' }) : null;
    const minus = h('button', { class: 'qbtn minus', 'aria-label': `Togli ${p.nome}`, onclick: () => change(p, -1) }, icon('minus', 26));
    const plus = h('button', { class: 'qbtn plus', 'aria-label': `Aggiungi ${p.nome}`, onclick: () => change(p, +1) }, icon('plus', 26));
    const main = h('button', { class: 'prod-main', onclick: () => change(p, +1) },
      productVisual(p),
      badge,
      h('div', { class: 'prod-info' },
        h('span', { class: 'prod-name' }, p.nome),
        h('span', { class: 'prod-price' }, fmtEuro(p.prezzo))),
      stockEl);
    const card = h('div', { class: 'prod' }, main, h('div', { class: 'qty-ctrl' }, minus, qtyEl, plus));
    items.push({ p, card, qtyEl, badge, stockEl, minus, plus, main });
    grid.append(card);
  }

  /* ---------- piè di pagina ---------- */
  const summary = h('div', { class: 'order-summary' });
  const totalEl = h('div', { class: 'order-total' });
  const afterEl = h('div', { class: 'order-after' });
  const reason = h('div', { class: 'order-reason' });
  const cassa = h('button', { class: 'btn cassa', onclick: () => checkout() }, icon('euro', 26), h('span', { class: 'cassa-label' }, 'CASSA'));
  const footer = h('div', { class: 'order-foot' },
    h('div', { class: 'order-foot-left' }, summary, reason),
    h('div', { class: 'order-foot-total' }, totalEl, afterEl),
    h('button', { class: 'btn ghost lg', onclick: () => m.close() }, 'Annulla'),
    cassa);

  const content = prodotti.length
    ? [banner, grid]
    : [banner, emptyState('box', 'Nessun prodotto disponibile', 'L\'amministratore deve prima registrare i prodotti.')];

  const m = openModal({ header, content, footer, size: 'full', className: 'order-modal' });

  const total = () => {
    let s = 0;
    for (const [pid, q] of cart) {
      const it = items.find((i) => i.p.id === pid);
      if (it) s += it.p.prezzo * q;
    }
    return s;
  };

  function change(p, d) {
    if (saving) return;
    const q = (cart.get(p.id) || 0) + d;
    if (q < 0) return;
    if (d > 0 && !canAdd(p)) {
      const it = items.find((i) => i.p.id === p.id);
      if (it) { it.card.classList.remove('nope'); void it.card.offsetWidth; it.card.classList.add('nope'); }
      return;
    }
    if (q === 0) cart.delete(p.id); else cart.set(p.id, q);
    update();
  }

  function canAdd(p) {
    if (isBloccata(t)) return false;
    const q = cart.get(p.id) || 0;
    if (p.gestioneStock && q + 1 > p.stock) return false;
    return total() + p.prezzo <= disponibile(t);
  }

  function update() {
    const tot = total();
    const after = t.saldo - tot;
    const blocked = isBloccata(t);
    saldoEl.textContent = fmtEuro(t.saldo);
    saldoEl.className = `saldo-pill st-${cardStatus(t)}`;
    dispEl.textContent = `Disponibile ${fmtEuro(Math.max(0, disponibile(t)))}`;

    banner.classList.toggle('hidden', !blocked);
    banner.replaceChildren(icon('lock', 22), h('span', null,
      h('b', null, 'Tessera bloccata. '),
      `Il debito massimo di ${fmtEuro(fido())} è stato raggiunto: per consumare è necessaria una ricarica dall'amministratore.`));

    let n = 0;
    for (const it of items) {
      const q = cart.get(it.p.id) || 0;
      n += q;
      it.qtyEl.textContent = q;
      it.badge.textContent = q ? `×${q}` : '';
      it.card.classList.toggle('sel', q > 0);
      it.minus.disabled = q === 0;
      const ok = canAdd(it.p);
      it.plus.disabled = !ok;
      const soldOut = it.p.gestioneStock && it.p.stock - q <= 0;
      it.card.classList.toggle('soldout', it.p.gestioneStock && it.p.stock === 0);
      it.card.classList.toggle('disabled', !ok && q === 0);
      if (it.stockEl) {
        const left = it.p.stock - q;
        it.stockEl.textContent = it.p.stock === 0 ? 'ESAURITO' : `Rimasti ${left}`;
        it.stockEl.classList.toggle('warn', left <= 5);
        it.stockEl.classList.toggle('zero', soldOut);
      }
    }

    summary.replaceChildren(...(n
      ? [...cart].map(([pid, q]) => {
        const it = items.find((i) => i.p.id === pid);
        return h('span', { class: 'chip' }, `${q}× ${it.p.nome}`);
      })
      : [h('span', { class: 'muted' }, 'Tocca i prodotti per aggiungerli')]));

    totalEl.replaceChildren(h('span', { class: 'muted small' }, `Totale${n ? ` · ${n} art.` : ''}`), h('b', null, fmtEuro(tot)));
    afterEl.textContent = `Saldo dopo: ${fmtEuro(after)}`;
    afterEl.classList.toggle('neg', after < 0);
    cassa.disabled = !n || after < -fido() || blocked;
    cassa.querySelector('.cassa-label').textContent = n ? `CASSA ${fmtEuro(tot)}` : 'CASSA';
    reason.textContent = blocked ? '' : (after < 0 && n ? `In debito (max ${fmtEuro(fido())})` : '');
  }

  async function checkout() {
    if (saving || cassa.disabled) return;
    saving = true;
    cassa.disabled = true;
    try {
      const mov = await registraConsumo(t.id, cart);
      m.close();
      onDone && onDone();
      toast(`${mov.tesseraLabel}: ${fmtEuro(mov.importo)} · saldo ${fmtEuro(mov.saldoDopo)}`, {
        type: 'success',
        duration: UNDO_SECONDS * 1000,
        action: {
          label: 'Annulla',
          countdown: true,
          run: async () => {
            try {
              await storna(mov.id, 'Annullato subito dopo la registrazione');
              toast('Consumo annullato', { type: 'info' });
              onDone && onDone();
            } catch (err) { showError(err); }
          },
        },
      });
    } catch (err) {
      saving = false;
      showError(err);
      t = findTessera(tesseraId) || t;
      update();
    }
  }

  update();
  return m;
}
