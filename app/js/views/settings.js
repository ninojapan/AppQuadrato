// Impostazioni (solo amministratore): nave e logo, regole di cassa, password, backup, aggiornamenti.
import {
  state, setSettings, changePassword, newRecoveryCode, buildBackup, restoreBackup, resetAll, isConfigured,
} from '../store.js';
import { h, icon, field, toast, showError, confirmDialog, switchInput, openModal } from '../ui.js';
import { fmtEuro, parseEuro, fmtDateTime, downloadBlob, shareFile, resizeImage, isoDate } from '../util.js';
import { refresh, logoSrc, lockApp } from '../app.js';
import { versionLabel, checkForUpdatesNow } from '../update.js';
import { showRecoveryCode } from './setup.js';
import { isStandalone, installApp } from './install.js';

export function renderSettings(main) {
  const s = state.settings;

  /* ---- nave e logo ---- */
  const ship = h('input', { type: 'text', value: s.shipName || '', placeholder: 'Es. Nave Trieste (L 9890)' });
  const logoImg = h('img', { class: 'logo-preview', src: logoSrc(), alt: 'Logo' });
  const logoIn = h('input', {
    type: 'file', accept: 'image/*', hidden: true,
    onchange: async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const data = await resizeImage(f, 512, 'image/png');
        await setSettings({ logo: data });
        toast('Logo aggiornato', { type: 'success' });
        refresh();
      } catch (err) { showError(err); }
    },
  });

  const shipCard = card('anchor', 'Nave e logo',
    h('div', { class: 'logo-row' },
      logoImg,
      h('div', { class: 'logo-actions' },
        h('button', { class: 'btn ghost sm', onclick: () => logoIn.click() }, icon('upload', 18), 'Carica logo'),
        s.logo ? h('button', {
          class: 'btn ghost sm', onclick: async () => { await setSettings({ logo: null }); refresh(); },
        }, icon('undo', 18), 'Logo predefinito') : null,
        h('span', { class: 'small muted' }, 'Il logo di Nave Trieste è già incluso nell\'app. Qui si può sostituire solo su questo tablet (PNG con sfondo trasparente consigliato).'),
        logoIn)),
    field('Nome della nave (sotto il titolo)', ship),
    h('button', { class: 'btn primary', onclick: async () => { await setSettings({ shipName: ship.value.trim() }); toast('Salvato', { type: 'success' }); refresh(); } }, icon('check', 18), 'Salva'));

  /* ---- regole cassa ---- */
  const fido = h('input', { type: 'text', inputmode: 'decimal', value: (s.fido / 100).toFixed(2).replace('.', ',') });
  const low = h('input', { type: 'text', inputmode: 'decimal', value: (s.lowBalance / 100).toFixed(2).replace('.', ',') });
  const timeout = h('input', { type: 'number', inputmode: 'numeric', min: 0, step: 1, value: String(s.adminTimeout) });
  let showBalance = s.showBalance !== false;
  const rulesCard = card('euro', 'Regole di cassa',
    h('div', { class: 'grid-3' },
      field('Debito massimo per tessera €', fido, 'Oltre questo debito la tessera si blocca fino alla ricarica.'),
      field('Soglia “saldo basso” €', low, 'Sotto questa cifra il saldo è evidenziato in giallo.'),
      field('Uscita automatica admin (minuti)', timeout, 'Dopo questo tempo di inattività torna in modalità operatore. 0 = mai.')),
    h('label', { class: 'switch-row' },
      h('div', null, h('b', null, 'Mostra il saldo nella home'), h('div', { class: 'small muted' }, 'Se disattivato, in home compaiono solo i nominativi.')),
      switchInput(showBalance, (v) => { showBalance = v; })),
    h('button', {
      class: 'btn primary',
      onclick: async () => {
        const f = parseEuro(fido.value);
        const l = parseEuro(low.value);
        const t = parseInt(timeout.value, 10);
        if (Number.isNaN(f) || f < 0 || f > 10000) return toast('Debito massimo non valido', { type: 'error' });
        if (Number.isNaN(l) || l < 0) return toast('Soglia non valida', { type: 'error' });
        if (Number.isNaN(t) || t < 0) return toast('Minuti non validi', { type: 'error' });
        await setSettings({ fido: f, lowBalance: l, adminTimeout: t, showBalance });
        toast(`Salvato · debito massimo ${fmtEuro(f)}`, { type: 'success' });
      },
    }, icon('check', 18), 'Salva'));

  /* ---- password ---- */
  const pwCard = card('key', 'Password',
    h('div', { class: 'grid-2' },
      pwChanger('admin', 'Nuova password AMMINISTRATORE'),
      pwChanger('operatore', 'Nuova password OPERATORE')),
    h('div', { class: 'row' },
      h('button', {
        class: 'btn ghost sm',
        onclick: async () => {
          if (!(await confirmDialog('Generare un nuovo codice di recupero? Quello precedente non sarà più valido.'))) return;
          try { showRecoveryCode(await newRecoveryCode()); } catch (err) { showError(err); }
        },
      }, icon('refresh', 18), 'Nuovo codice di recupero')));

  /* ---- backup ---- */
  const lastBk = h('span', { class: 'small muted' });
  const drawLast = () => { lastBk.textContent = state.settings.lastBackup ? `Ultimo backup: ${fmtDateTime(state.settings.lastBackup)}` : 'Nessun backup eseguito'; };
  drawLast();
  const restoreIn = h('input', {
    type: 'file', accept: '.json,application/json', hidden: true,
    onchange: async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        const d = obj.data || {};
        const ok = await confirmDialog('Ripristinare questo backup? TUTTI i dati attuali verranno sostituiti.', {
          ok: 'Ripristina', danger: true,
          detail: h('div', { class: 'small' },
            h('div', null, `Creato: ${obj.esportato ? fmtDateTime(Date.parse(obj.esportato)) : '?'}`),
            h('div', null, `${(d.tessere || []).length} tessere · ${(d.prodotti || []).length} prodotti · ${(d.movimenti || []).length} movimenti`),
            h('div', null, 'Verranno ripristinate anche le password presenti nel backup.')),
        });
        if (!ok) return;
        await restoreBackup(obj);
        toast('Backup ripristinato', { type: 'success' });
        if (!isConfigured()) location.reload(); else refresh();
      } catch (err) { showError(err.name === 'SyntaxError' ? new Error('File non valido') : err); }
    },
  });

  async function makeBackup(share) {
    try {
      const data = await buildBackup();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const name = `backup-quadrato_${isoDate(Date.now())}_${new Date().toTimeString().slice(0, 5).replace(':', '')}.json`;
      if (share) {
        if (!(await shareFile(blob, name))) { toast('Condivisione non disponibile: uso il download', { type: 'info' }); downloadBlob(blob, name); }
      } else downloadBlob(blob, name);
      await setSettings({ lastBackup: Date.now() });
      drawLast();
    } catch (err) { showError(err); }
  }

  const backupCard = card('download', 'Backup dei dati',
    h('p', { class: 'muted' }, 'I dati sono salvati solo su questo tablet. Fare un backup regolarmente e conservarlo altrove (PC, chiavetta, mail). Il backup serve anche per spostare i dati su un altro tablet.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => makeBackup(false) }, icon('download', 18), 'Scarica backup'),
      navigator.share ? h('button', { class: 'btn ghost', onclick: () => makeBackup(true) }, icon('share', 18), 'Condividi backup') : null,
      h('button', { class: 'btn ghost', onclick: () => restoreIn.click() }, icon('upload', 18), 'Ripristina da file'),
      restoreIn),
    lastBk);

  /* ---- app ---- */
  const appCard = card('refresh', 'Applicazione',
    h('div', { class: 'info-list' },
      h('div', null, h('span', null, 'Versione'), h('b', null, versionLabel())),
      h('div', null, h('span', null, 'Modalità'), h('b', null, isStandalone() ? 'App installata' : 'Browser')),
      h('div', null, h('span', null, 'Dati'), h('b', null, `${state.tessere.length} tessere · ${state.prodotti.length} prodotti`))),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => checkForUpdatesNow() }, icon('refresh', 18), 'Verifica aggiornamenti'),
      isStandalone() ? null : h('button', { class: 'btn ghost', onclick: () => installApp() }, icon('install', 18), 'Installa sul tablet')),
    h('p', { class: 'small muted' }, 'Ad ogni avvio, se c\'è connessione, l\'app controlla da sola se esiste una versione più recente e chiede se installarla.'));

  /* ---- zona pericolosa ---- */
  const dangerCard = card('alert', 'Cancellazione dati',
    h('p', { class: 'muted' }, 'Cancella definitivamente tessere, prodotti, movimenti e password. Usare solo dopo aver fatto un backup.'),
    h('button', {
      class: 'btn danger',
      onclick: async () => {
        if (!(await confirmDialog('Cancellare TUTTI i dati di questo tablet?', { ok: 'Continua', danger: true }))) return;
        confirmByTyping(async () => {
          try { await resetAll(); location.reload(); } catch (err) { showError(err); }
        });
      },
    }, icon('trash', 18), 'Cancella tutti i dati'), 'danger');

  main.append(h('section', { class: 'view settings' },
    h('div', { class: 'view-head' }, h('h1', null, icon('settings', 26), 'Impostazioni'),
      h('button', { class: 'btn ghost', onclick: () => lockApp() }, icon('lock', 18), 'Blocca app')),
    h('div', { class: 'settings-grid' }, shipCard, rulesCard, pwCard, backupCard, appCard, dangerCard)));
}

function card(ic, title, ...content) {
  const last = content[content.length - 1];
  const tone = typeof last === 'string' ? content.pop() : '';
  return h('div', { class: `panel settings-card ${tone}` },
    h('div', { class: 'panel-head' }, h('h3', null, icon(ic, 20), title)), ...content);
}

function pwChanger(which, label) {
  const a = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Nuova password' });
  const b = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Ripeti' });
  return h('div', { class: 'pw-changer' },
    h('div', { class: 'field-label' }, label),
    a, b,
    h('button', {
      class: 'btn ghost sm',
      onclick: async () => {
        if (a.value !== b.value) return toast('Le password non coincidono', { type: 'error' });
        try {
          await changePassword(which, a.value);
          a.value = ''; b.value = '';
          toast('Password aggiornata', { type: 'success' });
        } catch (err) { showError(err); }
      },
    }, icon('check', 16), 'Cambia'));
}

function confirmByTyping(onOk) {
  const input = h('input', { type: 'text', autocapitalize: 'characters', placeholder: 'CANCELLA', autocomplete: 'off' });
  const m = openModal({
    title: 'Conferma definitiva', size: 'sm',
    content: [h('p', null, 'Per confermare scrivere ', h('b', null, 'CANCELLA'), ' nel campo sotto.'), input],
    footer: [
      h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Annulla'),
      h('button', {
        class: 'btn danger',
        onclick: () => {
          if (input.value.trim().toUpperCase() !== 'CANCELLA') return toast('Testo non corretto', { type: 'error' });
          m.close();
          onOk();
        },
      }, 'Cancella tutto'),
    ],
  });
}
