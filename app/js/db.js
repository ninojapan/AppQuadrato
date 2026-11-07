// Accesso a IndexedDB: tutti i dati restano sul tablet.
const DB_NAME = 'registro-quadrato';
const DB_VERSION = 1;
export const STORES = ['tessere', 'prodotti', 'movimenti', 'settings'];

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('tessere')) {
        db.createObjectStore('tessere', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('prodotti')) {
        db.createObjectStore('prodotti', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('movimenti')) {
        const m = db.createObjectStore('movimenti', { keyPath: 'id', autoIncrement: true });
        m.createIndex('ts', 'ts');
        m.createIndex('tesseraId', 'tesseraId');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database bloccato: chiudere le altre finestre dell\'app.'));
  });
  return dbPromise;
}

const asPromise = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export async function getAll(store) {
  const db = await openDB();
  return asPromise(db.transaction(store).objectStore(store).getAll());
}

export async function get(store, key) {
  const db = await openDB();
  return asPromise(db.transaction(store).objectStore(store).get(key));
}

/** Movimenti con ts compreso tra from e to (inclusi). */
export async function movimentiRange(from, to) {
  const db = await openDB();
  const idx = db.transaction('movimenti').objectStore('movimenti').index('ts');
  return asPromise(idx.getAll(IDBKeyRange.bound(from, to)));
}

export async function movimentiTessera(tesseraId) {
  const db = await openDB();
  const idx = db.transaction('movimenti').objectStore('movimenti').index('tesseraId');
  return asPromise(idx.getAll(IDBKeyRange.only(tesseraId)));
}

/**
 * Transazione atomica su più archivi. `fn` riceve un oggetto { nomeArchivio: objectStore }
 * e deve solo emettere richieste (niente await al suo interno).
 * La promise si risolve a transazione completata con il valore restituito da fn.
 */
export async function tx(storeNames, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeNames, 'readwrite');
    const stores = {};
    for (const s of storeNames) stores[s] = t.objectStore(s);
    let out;
    try {
      out = fn(stores);
    } catch (err) {
      try { t.abort(); } catch { /* già chiusa */ }
      reject(err);
      return;
    }
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Operazione annullata'));
  });
}

export async function exportAll() {
  const data = {};
  for (const s of STORES) data[s] = await getAll(s);
  return data;
}

export async function replaceAll(data) {
  return tx(STORES, (st) => {
    for (const s of STORES) {
      st[s].clear();
      for (const row of data[s] || []) st[s].put(row);
    }
  });
}
