// Logica di cassa: tessere, prodotti, movimenti, password.
import * as db from './db.js';
import { sha256, randomToken } from './sha256.js';
import { VERSION, BUILD } from './build-info.js';

export const state = {
  tessere: [],
  prodotti: [],
  settings: {},
  role: null, // 'admin' | 'operatore' | null (bloccato)
};

const DEFAULTS = {
  shipName: '',
  fido: 100,          // debito massimo consentito (centesimi)
  lowBalance: 200,    // sotto questa soglia il saldo è evidenziato
  showBalance: true,
  adminTimeout: 5,    // minuti di inattività prima di tornare in modalità operatore
  operEditHours: 24, // per quante ore l'operatore può modificare/annullare un consumo
  logo: null,
  lastBackup: null,
};

// Gradi (Marina Militare) suggeriti nel modulo di registrazione tessera.
export const GRADI = [
  'AMM.', 'AMM. SQ.', 'AMM. DIV.', 'C.A.', 'C.V.', 'C.F.', 'C.C.', 'T.V.', 'S.T.V.', 'G.M.', 'ASP. G.M.',
  '1° LGT.', 'LGT.', '1° M.LLO', 'C° 1ª CL.', 'C° 2ª CL.', 'C° 3ª CL.', '2° C° SC.', '2° C°',
  'SC. 1ª CL.', 'SC.', 'SIG.', 'OSPITE',
];

export class AppError extends Error {}
const fail = (msg) => { throw new AppError(msg); };

export async function load() {
  const [t, p, s] = await Promise.all([db.getAll('tessere'), db.getAll('prodotti'), db.getAll('settings')]);
  state.tessere = t;
  state.prodotti = p;
  state.settings = { ...DEFAULTS };
  for (const row of s) state.settings[row.key] = row.value;
}

export const isConfigured = () => !!state.settings.adminHash;
export const isAdmin = () => state.role === 'admin';
const requireAdmin = () => { if (!isAdmin()) fail('Operazione riservata all\'amministratore'); };

export async function setSettings(obj) {
  await db.tx(['settings'], (st) => {
    for (const [key, value] of Object.entries(obj)) st.settings.put({ key, value });
  });
  Object.assign(state.settings, obj);
}

/* ----------------------------- Password ----------------------------- */

const hashPw = (pw, salt = state.settings.salt) => sha256(`${salt}:${pw}`);
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function formatCode(raw) {
  return raw.match(/.{1,4}/g).join('-');
}

export async function setupInitial({ shipName, adminPw, operPw }) {
  if (isConfigured()) fail('App già configurata');
  validateNewPasswords(adminPw, operPw);
  const salt = randomToken(24);
  const recovery = randomToken(12);
  await setSettings({
    shipName: (shipName || '').trim(),
    salt,
    adminHash: await hashPw(adminPw, salt),
    operHash: await hashPw(operPw, salt),
    recoveryHash: await hashPw(normCode(recovery), salt),
    createdAt: Date.now(),
  });
  return formatCode(recovery);
}

function validateNewPasswords(adminPw, operPw) {
  if (!adminPw || adminPw.length < 4) fail('La password amministratore deve avere almeno 4 caratteri');
  if (!operPw || operPw.length < 4) fail('La password operatore deve avere almeno 4 caratteri');
  if (adminPw === operPw) fail('Password amministratore e operatore devono essere diverse');
}

/** Restituisce il ruolo corrispondente alla password, oppure null. */
export async function checkPassword(pw) {
  if (!pw) return null;
  const h = await hashPw(pw);
  if (h === state.settings.adminHash) return 'admin';
  if (h === state.settings.operHash) return 'operatore';
  return null;
}

export async function changePassword(which, pw) {
  requireAdmin();
  if (!pw || pw.length < 4) fail('La password deve avere almeno 4 caratteri');
  const h = await hashPw(pw);
  const other = which === 'admin' ? state.settings.operHash : state.settings.adminHash;
  if (h === other) fail('Password amministratore e operatore devono essere diverse');
  await setSettings({ [which === 'admin' ? 'adminHash' : 'operHash']: h });
}

export async function newRecoveryCode() {
  requireAdmin();
  const recovery = randomToken(12);
  await setSettings({ recoveryHash: await hashPw(normCode(recovery)) });
  return formatCode(recovery);
}

export async function resetAdminWithRecovery(code, newPw) {
  const h = await hashPw(normCode(code));
  if (h !== state.settings.recoveryHash) fail('Codice di recupero non valido');
  if (!newPw || newPw.length < 4) fail('La password deve avere almeno 4 caratteri');
  const nh = await hashPw(newPw);
  if (nh === state.settings.operHash) fail('La password amministratore deve essere diversa da quella operatore');
  await setSettings({ adminHash: nh });
}

/* ----------------------------- Tessere ----------------------------- */

export const normText = (s) => String(s || '').replace(/\s+/g, ' ').trim().toUpperCase();

export function cardLabel(t) {
  const iniz = t.nome ? `${t.nome.trim()[0]}.` : '';
  return [t.grado, t.cognome, iniz].filter(Boolean).join(' ');
}
export const cardFullName = (t) => [t.grado, t.cognome, t.nome].filter(Boolean).join(' ');

export const fido = () => state.settings.fido ?? DEFAULTS.fido;
export const disponibile = (t) => t.saldo + fido();
export const isBloccata = (t) => t.saldo <= -fido();

export function cardStatus(t) {
  if (isBloccata(t)) return 'blocked';
  if (t.saldo < 0) return 'debt';
  if (t.saldo < (state.settings.lowBalance ?? DEFAULTS.lowBalance)) return 'low';
  return 'ok';
}

/** Ordine alfabetico per cognome, poi nome. */
export function sortTessere(list) {
  return [...list].sort((a, b) => a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'));
}

export const findTessera = (id) => state.tessere.find((t) => t.id === id);
export const findProdotto = (id) => state.prodotti.find((p) => p.id === id);

function replaceIn(list, obj) {
  const i = list.findIndex((x) => x.id === obj.id);
  if (i === -1) list.push(obj); else list[i] = obj;
}

export async function saveTessera({ id, grado, cognome, nome, creditoIniziale = 0 }) {
  requireAdmin();
  const data = { grado: normText(grado), cognome: normText(cognome), nome: normText(nome) };
  if (!data.cognome) fail('Il cognome è obbligatorio');
  if (!data.nome) fail('Il nome è obbligatorio');
  const dup = state.tessere.find((t) => t.id !== id && t.grado === data.grado && t.cognome === data.cognome && t.nome === data.nome);
  if (dup) fail('Esiste già una tessera con questo nominativo');

  if (id) {
    const t = { ...findTessera(id), ...data, modificata: Date.now() };
    await db.tx(['tessere'], (st) => { st.tessere.put(t); });
    replaceIn(state.tessere, t);
    return t;
  }

  if (!Number.isInteger(creditoIniziale) || creditoIniziale < 0) fail('Credito iniziale non valido');
  const now = Date.now();
  const t = { ...data, saldo: 0, creata: now };
  const ricarica = creditoIniziale > 0;
  await db.tx(['tessere', 'movimenti'], (st) => {
    const r = st.tessere.add(t);
    r.onsuccess = () => {
      t.id = r.result;
      if (ricarica) {
        t.saldo = creditoIniziale;
        st.tessere.put(t);
        st.movimenti.add({
          ts: now, tipo: 'ricarica', tesseraId: t.id, tesseraLabel: cardLabel(t), importo: creditoIniziale,
          delta: creditoIniziale, saldoPrima: 0, saldoDopo: creditoIniziale, ruolo: 'admin', note: 'Credito iniziale',
        });
      }
    };
  });
  state.tessere.push(t);
  return t;
}

/** Elimina la tessera. Se il saldo non è zero resta traccia nei movimenti ("Chiusura tessera"). */
export async function deleteTessera(id) {
  requireAdmin();
  const t = findTessera(id);
  if (!t) fail('Tessera non trovata');
  await db.tx(['tessere', 'movimenti'], (st) => {
    st.tessere.delete(id);
    if (t.saldo !== 0) {
      st.movimenti.add({
        ts: Date.now(), tipo: 'chiusura', tesseraId: t.id, tesseraLabel: cardLabel(t), importo: Math.abs(t.saldo),
        delta: -t.saldo, saldoPrima: t.saldo, saldoDopo: 0, ruolo: 'admin',
        note: t.saldo > 0 ? 'Tessera eliminata con credito residuo' : 'Tessera eliminata con debito non saldato',
      });
    }
  });
  state.tessere = state.tessere.filter((x) => x.id !== id);
}

/** tipo: 'ricarica' (aggiunge credito) | 'rimborso' (restituisce contante e toglie credito). */
export async function movimentoCredito(tesseraId, importo, tipo = 'ricarica', note = '') {
  requireAdmin();
  const t = findTessera(tesseraId);
  if (!t) fail('Tessera non trovata');
  if (!Number.isInteger(importo) || importo <= 0) fail('Importo non valido');
  if (importo > 100000) fail('Importo troppo alto (max 1.000 €)');
  const delta = tipo === 'rimborso' ? -importo : importo;
  if (tipo === 'rimborso' && t.saldo - importo < 0) fail('Il rimborso non può superare il credito disponibile');
  const nt = { ...t, saldo: t.saldo + delta };
  const mov = {
    ts: Date.now(), tipo, tesseraId, tesseraLabel: cardLabel(t), importo, delta,
    saldoPrima: t.saldo, saldoDopo: nt.saldo, ruolo: state.role, note: note.trim(),
  };
  await db.tx(['tessere', 'movimenti'], (st) => {
    st.tessere.put(nt);
    const r = st.movimenti.add(mov);
    r.onsuccess = () => { mov.id = r.result; };
  });
  replaceIn(state.tessere, nt);
  return mov;
}

/* ----------------------------- Consumi ----------------------------- */

/** carrello: Map(prodottoId -> quantità) */
export async function registraConsumo(tesseraId, carrello) {
  if (!state.role) fail('Accesso non effettuato');
  const t = findTessera(tesseraId);
  if (!t) fail('Tessera non trovata');
  const righe = [];
  const prodotti = [];
  for (const [pid, qta] of carrello) {
    if (!qta) continue;
    const p = findProdotto(pid);
    if (!p || !p.attivo) fail('Prodotto non disponibile');
    if (!Number.isInteger(qta) || qta < 0) fail('Quantità non valida');
    if (p.gestioneStock) {
      if (p.stock < qta) fail(`${p.nome}: disponibili solo ${p.stock}`);
      prodotti.push({ ...p, stock: p.stock - qta });
    }
    righe.push({ prodottoId: p.id, nome: p.nome, prezzo: p.prezzo, qta });
  }
  const totale = righe.reduce((s, r) => s + r.prezzo * r.qta, 0);
  if (!righe.length) fail('Nessun prodotto selezionato');
  if (t.saldo - totale < -fido()) fail('Credito insufficiente: ricaricare la tessera');

  const now = Date.now();
  const nt = { ...t, saldo: t.saldo - totale, ultimoUso: now };
  const mov = {
    ts: now, tipo: 'consumo', tesseraId, tesseraLabel: cardLabel(t), righe, importo: totale, delta: -totale,
    saldoPrima: t.saldo, saldoDopo: nt.saldo, ruolo: state.role,
  };
  await db.tx(['tessere', 'prodotti', 'movimenti'], (st) => {
    st.tessere.put(nt);
    for (const p of prodotti) st.prodotti.put(p);
    const r = st.movimenti.add(mov);
    r.onsuccess = () => { mov.id = r.result; };
  });
  replaceIn(state.tessere, nt);
  for (const p of prodotti) replaceIn(state.prodotti, p);
  return mov;
}

export const STORNABILI = ['consumo', 'ricarica', 'rimborso', 'carico', 'inventario'];

export const operEditHours = () => Number(state.settings.operEditHours ?? DEFAULTS.operEditHours) || 0;

/** L'amministratore modifica tutto; l'operatore solo i consumi recenti non ancora annullati. */
export function puoModificare(m) {
  if (!m || m.stornato || !STORNABILI.includes(m.tipo)) return false;
  if (isAdmin()) return true;
  return state.role === 'operatore' && m.tipo === 'consumo' && Date.now() - m.ts <= operEditHours() * 3600000;
}

/** Annulla un movimento ripristinando saldo e/o magazzino. */
export async function storna(movId, note = '') {
  if (!state.role) fail('Accesso non effettuato');
  const m = await db.get('movimenti', movId);
  if (!m) fail('Movimento non trovato');
  if (m.stornato) fail('Movimento già annullato');
  if (!puoModificare(m)) fail(`L'operatore può annullare solo i consumi delle ultime ${operEditHours()} ore`);
  if (!STORNABILI.includes(m.tipo)) fail('Questo movimento non può essere stornato');

  const now = Date.now();
  const updT = [];
  const updP = [];
  const storno = {
    ts: now, tipo: 'storno', rif: m.id, rifTipo: m.tipo, ruolo: state.role, note: note.trim(),
    importo: m.importo || 0, righe: m.righe,
  };

  if (m.tesseraId != null) {
    const t = findTessera(m.tesseraId);
    if (!t) fail('La tessera di questo movimento è stata eliminata');
    const delta = -(m.delta || 0);
    const nt = { ...t, saldo: t.saldo + delta };
    if (m.tipo === 'ricarica' && nt.saldo < -fido()) fail('Impossibile stornare: il saldo andrebbe oltre il debito massimo');
    updT.push(nt);
    Object.assign(storno, {
      tesseraId: t.id, tesseraLabel: cardLabel(t), delta, saldoPrima: t.saldo, saldoDopo: nt.saldo,
    });
  }

  if (m.tipo === 'consumo') {
    for (const r of m.righe) {
      const p = updP.find((x) => x.id === r.prodottoId) || findProdotto(r.prodottoId);
      if (p && p.gestioneStock) replaceIn(updP, { ...p, stock: p.stock + r.qta });
    }
  } else if (m.tipo === 'carico' || m.tipo === 'inventario') {
    const p = findProdotto(m.prodottoId);
    if (!p) fail('Il prodotto di questo movimento è stato eliminato');
    const diff = m.stockDopo - m.stockPrima;
    if (p.stock - diff < 0) fail('Impossibile stornare: lo stock andrebbe sotto zero');
    updP.push({ ...p, stock: p.stock - diff });
    Object.assign(storno, {
      prodottoId: p.id, prodottoNome: p.nome, qta: -diff, stockPrima: p.stock, stockDopo: p.stock - diff,
    });
  }

  const orig = { ...m, stornato: true, stornoTs: now };
  await db.tx(['tessere', 'prodotti', 'movimenti'], (st) => {
    for (const t of updT) st.tessere.put(t);
    for (const p of updP) st.prodotti.put(p);
    st.movimenti.put(orig);
    const r = st.movimenti.add(storno);
    r.onsuccess = () => { storno.id = r.result; };
  });
  for (const t of updT) replaceIn(state.tessere, t);
  for (const p of updP) replaceIn(state.prodotti, p);
  return storno;
}

/** Prezzo e quantità di partenza quando si modifica un consumo già registrato. */
export function baseModifica(m) {
  const qta = new Map();
  const prezzo = new Map();
  for (const r of m.righe) {
    qta.set(r.prodottoId, (qta.get(r.prodottoId) || 0) + r.qta);
    prezzo.set(r.prodottoId, r.prezzo);
  }
  return { qta, prezzo };
}

/**
 * Modifica un consumo: annulla l'originale e registra quello corretto in un'unica operazione.
 * I prodotti già presenti mantengono il prezzo pagato all'epoca.
 */
export async function modificaConsumo(movId, carrello) {
  if (!state.role) fail('Accesso non effettuato');
  const m = await db.get('movimenti', movId);
  if (!m || m.tipo !== 'consumo') fail('Consumo non trovato');
  if (m.stornato) fail('Questo consumo è già stato annullato o modificato');
  if (!puoModificare(m)) fail(`L'operatore può modificare solo i consumi delle ultime ${operEditHours()} ore`);
  const t = findTessera(m.tesseraId);
  if (!t) fail('La tessera di questo consumo è stata eliminata');

  const base = baseModifica(m);
  const stock = new Map(); // prodottoId -> prodotto aggiornato
  for (const [pid, q] of base.qta) {
    const p = findProdotto(pid);
    if (p && p.gestioneStock) stock.set(pid, { ...p, stock: p.stock + q });
  }
  const righe = [];
  for (const [pid, qta] of carrello) {
    if (!qta) continue;
    if (!Number.isInteger(qta) || qta < 0) fail('Quantità non valida');
    const p = findProdotto(pid);
    if (!p || (!p.attivo && !base.qta.has(pid))) fail('Prodotto non disponibile');
    if (p.gestioneStock) {
      const cur = stock.get(pid) || { ...p };
      if (cur.stock < qta) fail(`${p.nome}: disponibili solo ${cur.stock}`);
      stock.set(pid, { ...cur, stock: cur.stock - qta });
    }
    righe.push({ prodottoId: p.id, nome: p.nome, prezzo: base.prezzo.has(pid) ? base.prezzo.get(pid) : p.prezzo, qta });
  }
  if (!righe.length) fail('Nessun prodotto: per eliminare l\'ordine usare “Annulla ordine”');
  const totale = righe.reduce((s, r) => s + r.prezzo * r.qta, 0);
  const saldoBase = t.saldo + m.importo;
  if (saldoBase - totale < -fido()) fail('Credito insufficiente: ricaricare la tessera');

  const now = Date.now();
  const label = cardLabel(t);
  const orig = { ...m, stornato: true, stornoTs: now, modificato: true };
  const storno = {
    ts: now, tipo: 'storno', rif: m.id, rifTipo: 'consumo', ruolo: state.role, note: 'Modifica ordine',
    importo: m.importo, righe: m.righe, tesseraId: t.id, tesseraLabel: label, delta: m.importo,
    saldoPrima: t.saldo, saldoDopo: saldoBase,
  };
  const nuovo = {
    ts: now, tipo: 'consumo', tesseraId: t.id, tesseraLabel: label, righe, importo: totale, delta: -totale,
    saldoPrima: saldoBase, saldoDopo: saldoBase - totale, ruolo: state.role, sostituisce: m.id,
  };
  const nt = { ...t, saldo: saldoBase - totale };
  const prodotti = [...stock.values()];
  await db.tx(['tessere', 'prodotti', 'movimenti'], (st) => {
    st.tessere.put(nt);
    for (const p of prodotti) st.prodotti.put(p);
    st.movimenti.put(orig);
    st.movimenti.add(storno);
    const r = st.movimenti.add(nuovo);
    r.onsuccess = () => { nuovo.id = r.result; };
  });
  replaceIn(state.tessere, nt);
  for (const p of prodotti) replaceIn(state.prodotti, p);
  return nuovo;
}

/* ----------------------------- Prodotti ----------------------------- */

export function sortProdotti(list) {
  return [...list].sort((a, b) => (a.posizione ?? 100) - (b.posizione ?? 100) || a.nome.localeCompare(b.nome, 'it'));
}

export async function saveProdotto({ id, nome, prezzo, foto = null, gestioneStock = false, stockIniziale = 0, posizione = 100, attivo = true }) {
  requireAdmin();
  nome = String(nome || '').replace(/\s+/g, ' ').trim();
  if (!nome) fail('Il nome del prodotto è obbligatorio');
  if (!Number.isInteger(prezzo) || prezzo <= 0) fail('Prezzo non valido');
  if (prezzo > 100000) fail('Prezzo troppo alto');
  const dup = state.prodotti.find((p) => p.id !== id && p.nome.toUpperCase() === nome.toUpperCase());
  if (dup) fail('Esiste già un prodotto con questo nome');
  posizione = Number.isFinite(posizione) ? Math.round(posizione) : 100;
  const data = { nome, prezzo, foto, gestioneStock: !!gestioneStock, posizione, attivo: !!attivo };

  if (id) {
    const p = { ...findProdotto(id), ...data, modificato: Date.now() };
    await db.tx(['prodotti'], (st) => { st.prodotti.put(p); });
    replaceIn(state.prodotti, p);
    return p;
  }

  if (!Number.isInteger(stockIniziale) || stockIniziale < 0) fail('Quantità iniziale non valida');
  const now = Date.now();
  const p = { ...data, stock: 0, creato: now };
  const carico = data.gestioneStock && stockIniziale > 0;
  await db.tx(['prodotti', 'movimenti'], (st) => {
    const r = st.prodotti.add(p);
    r.onsuccess = () => {
      p.id = r.result;
      if (carico) {
        p.stock = stockIniziale;
        st.prodotti.put(p);
        st.movimenti.add({
          ts: now, tipo: 'carico', prodottoId: p.id, prodottoNome: p.nome, qta: stockIniziale,
          stockPrima: 0, stockDopo: stockIniziale, ruolo: 'admin', note: 'Quantità iniziale',
        });
      }
    };
  });
  state.prodotti.push(p);
  return p;
}

export async function deleteProdotto(id) {
  requireAdmin();
  await db.tx(['prodotti'], (st) => { st.prodotti.delete(id); });
  state.prodotti = state.prodotti.filter((p) => p.id !== id);
}

/** Carico magazzino (solo amministratore). */
export async function caricoStock(prodottoId, qta, note = '') {
  requireAdmin();
  const p = findProdotto(prodottoId);
  if (!p) fail('Prodotto non trovato');
  if (!Number.isInteger(qta) || qta <= 0) fail('Quantità non valida');
  if (qta > 100000) fail('Quantità troppo alta');
  const np = { ...p, gestioneStock: true, stock: (p.stock || 0) + qta };
  const mov = {
    ts: Date.now(), tipo: 'carico', prodottoId: p.id, prodottoNome: p.nome, qta,
    stockPrima: p.stock || 0, stockDopo: np.stock, ruolo: 'admin', note: note.trim(),
  };
  await db.tx(['prodotti', 'movimenti'], (st) => {
    st.prodotti.put(np);
    const r = st.movimenti.add(mov);
    r.onsuccess = () => { mov.id = r.result; };
  });
  replaceIn(state.prodotti, np);
  return mov;
}

/** Inventario: allinea lo stock alla quantità contata fisicamente. */
export async function inventario(prodottoId, contati, note = '') {
  requireAdmin();
  const p = findProdotto(prodottoId);
  if (!p) fail('Prodotto non trovato');
  if (!Number.isInteger(contati) || contati < 0) fail('Quantità non valida');
  const diff = contati - (p.stock || 0);
  if (diff === 0) return null;
  const np = { ...p, stock: contati };
  const mov = {
    ts: Date.now(), tipo: 'inventario', prodottoId: p.id, prodottoNome: p.nome, qta: diff,
    stockPrima: p.stock || 0, stockDopo: contati, importo: Math.abs(diff) * p.prezzo, ruolo: 'admin', note: note.trim(),
  };
  await db.tx(['prodotti', 'movimenti'], (st) => {
    st.prodotti.put(np);
    const r = st.movimenti.add(mov);
    r.onsuccess = () => { mov.id = r.result; };
  });
  replaceIn(state.prodotti, np);
  return mov;
}

/* ----------------------------- Backup ----------------------------- */

export async function buildBackup() {
  requireAdmin();
  return {
    app: 'registro-quadrato-ufficiali',
    formato: 1,
    versione: `${VERSION}+${BUILD}`,
    esportato: new Date().toISOString(),
    data: await db.exportAll(),
  };
}

export async function restoreBackup(obj) {
  requireAdmin();
  if (!obj || obj.app !== 'registro-quadrato-ufficiali' || !obj.data) fail('File di backup non valido');
  const d = obj.data;
  if (!Array.isArray(d.tessere) || !Array.isArray(d.prodotti) || !Array.isArray(d.movimenti) || !Array.isArray(d.settings)) {
    fail('File di backup incompleto');
  }
  if (!d.settings.find((s) => s.key === 'adminHash')) fail('Il backup non contiene le password: impossibile ripristinare');
  await db.replaceAll(d);
  await load();
}

export async function resetAll() {
  requireAdmin();
  await db.replaceAll({});
  await load();
}
