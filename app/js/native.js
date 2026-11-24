// Funzioni disponibili solo quando l'app gira dentro l'APK Android (vedi android/…/MainActivity.java).
import { toast } from './ui.js';

export const nativeApp = typeof window !== 'undefined' && window.QuadratoAndroid ? window.QuadratoAndroid : null;
export const isNativeApp = () => !!nativeApp;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',', 2)[1] || '');
    r.onerror = () => reject(r.error || new Error('Lettura del file non riuscita'));
    r.readAsDataURL(blob);
  });
}

/** Salva il file scegliendo la cartella (Download, chiavetta…). */
export async function nativeSave(blob, filename) {
  nativeApp.saveFile(filename, blob.type || 'application/octet-stream', await blobToBase64(blob));
}

/** Apre il menu Condividi di Android (Mail, WhatsApp, Bluetooth…). */
export async function nativeShare(blob, filename) {
  nativeApp.shareFile(filename, blob.type || 'application/octet-stream', await blobToBase64(blob));
}

export function openExternal(url) {
  if (nativeApp) nativeApp.openUrl(url);
  else window.open(url, '_blank', 'noopener');
}

// Esito del salvataggio, comunicato da Android.
window.__nativeSaved = (ok, attempted) => {
  if (ok) toast('File salvato', { type: 'success' });
  else if (attempted) toast('Salvataggio non riuscito', { type: 'error' });
};
