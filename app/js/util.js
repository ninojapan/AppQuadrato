// Formattazione e piccole utilità. Gli importi sono sempre in centesimi (interi).
const euroFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
const numFmt = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtEuro = (cents) => euroFmt.format((cents || 0) / 100);
export const fmtNum = (cents) => numFmt.format((cents || 0) / 100);

/** "1,50" | "1.5" | "€ 2" -> centesimi; NaN se non valido. */
export function parseEuro(str) {
  if (typeof str === 'number') return Math.round(str * 100);
  const s = String(str ?? '').replace(/[€\s]/g, '').replace(',', '.');
  if (!/^-?\d*(\.\d{0,2})?$/.test(s) || s === '' || s === '-' || s === '.') return NaN;
  return Math.round(parseFloat(s) * 100);
}

const pad = (n) => String(n).padStart(2, '0');
export const fmtDate = (ts) => { const d = new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const fmtTime = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fmtDateTime = (ts) => `${fmtDate(ts)} ${fmtTime(ts)}`;
export const isoDate = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export function startOfDay(ts = Date.now()) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function endOfDay(ts = Date.now()) { const d = new Date(ts); d.setHours(23, 59, 59, 999); return d.getTime(); }
export function addDays(ts, n) { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); }

export function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function debounce(fn, ms = 150) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Prova a condividere un file (iPad/Android: Mail, File, AirDrop...). Restituisce true se riuscito. */
export async function shareFile(blob, filename) {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return true;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return true;
  }
  return false;
}

/** Ridimensiona un'immagine scelta dall'utente e la restituisce come data URL. */
export function resizeImage(file, max = 512, type = 'image/jpeg', quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      if (type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL(type, quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non valida')); };
    img.src = url;
  });
}

const EMOJI = [
  [/caff|espresso|cialda|capsul|ginseng|orzo|decaf/, '☕'],
  [/cappucc|latte|macchiat/, '🥛'],
  [/\bt[eèé]\b|t[eè] |tea|tisan|camomill|infus/, '🍵'],
  [/acqua|water|frizzant|naturale/, '💧'],
  [/birr|beer/, '🍺'],
  [/vin[oi]|prosecco|spumant/, '🍷'],
  [/amaro|liquor|grappa|whisk|rum|gin|vodka|limoncell|sambuc/, '🥃'],
  [/coca|cola|aranciat|bibit|fanta|sprite|chinott|lemon|tonic|energy|red ?bull/, '🥤'],
  [/succ|nettar|spremut/, '🧃'],
  [/cornett|brioche|croissant|merendin/, '🥐'],
  [/cioccol|kinder|snickers|mars|twix|nutella/, '🍫'],
  [/patatin|chips|snack|salatin|taralli|cracker/, '🍟'],
  [/biscott|wafer|frollin/, '🍪'],
  [/panin|tramezz|toast|piadin|sandwich/, '🥪'],
  [/pizz/, '🍕'],
  [/gelat|ghiacciol/, '🍦'],
  [/caramell|gomm|chewing|mentine|liquiriz/, '🍬'],
  [/frutt|mela|banan|aranc/, '🍎'],
  [/yogurt/, '🥣'],
  [/sigar|tabacc/, '🚬'],
];

export function productEmoji(name) {
  const n = (name || '').toLowerCase();
  for (const [re, e] of EMOJI) if (re.test(n)) return e;
  return null;
}

export function initials(name, n = 2) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, n).map((w) => w[0]).join('').toUpperCase();
}
