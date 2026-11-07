// Prima configurazione: nome nave e password admin/operatore.
import { setupInitial } from '../store.js';
import { h, icon, field, openModal } from '../ui.js';
import { brand } from '../app.js';

export function renderSetup(container, onDone) {
  const ship = h('input', { type: 'text', placeholder: 'Es. Nave Trieste (L 9890)', autocomplete: 'off' });
  const a1 = h('input', { type: 'password', autocomplete: 'new-password' });
  const a2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const o1 = h('input', { type: 'password', autocomplete: 'new-password' });
  const o2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const err = h('div', { class: 'form-error' });

  const submit = async (e) => {
    e.preventDefault();
    err.textContent = '';
    if (a1.value !== a2.value) { err.textContent = 'Le password amministratore non coincidono'; return; }
    if (o1.value !== o2.value) { err.textContent = 'Le password operatore non coincidono'; return; }
    try {
      const code = await setupInitial({ shipName: ship.value, adminPw: a1.value, operPw: o1.value });
      showRecoveryCode(code, () => onDone('admin'));
    } catch (ex) {
      err.textContent = ex.message;
    }
  };

  container.append(h('div', { class: 'lock-screen' },
    h('div', { class: 'lock-glow' }),
    h('form', { class: 'lock-card setup-card', onsubmit: submit },
      brand('lg'),
      h('h2', { class: 'setup-title' }, 'Prima configurazione'),
      h('p', { class: 'muted' }, 'Tutti i dati restano salvati solo su questo tablet. Nessuna connessione internet necessaria.'),
      field('Nome della nave (facoltativo)', ship, 'Compare sotto il titolo.'),
      h('div', { class: 'setup-group admin' },
        h('div', { class: 'setup-group-title' }, icon('key', 18), 'Password AMMINISTRATORE'),
        h('p', { class: 'small muted' }, 'Gestisce tessere, ricariche, prodotti, magazzino, statistiche e impostazioni.'),
        h('div', { class: 'grid-2' }, field('Password', a1), field('Ripeti password', a2))),
      h('div', { class: 'setup-group oper' },
        h('div', { class: 'setup-group-title' }, icon('users', 18), 'Password OPERATORE'),
        h('p', { class: 'small muted' }, 'Serve solo per registrare i consumi.'),
        h('div', { class: 'grid-2' }, field('Password', o1), field('Ripeti password', o2))),
      err,
      h('button', { class: 'btn primary lg block', type: 'submit' }, icon('check', 20), 'Salva e inizia'))));
}

export function showRecoveryCode(code, onClose) {
  const m = openModal({
    title: 'Codice di recupero', size: 'sm', dismissable: false,
    content: [
      h('p', null, 'Annotare questo codice e conservarlo in un luogo sicuro. Serve per reimpostare la password amministratore se viene dimenticata.'),
      h('div', { class: 'recovery-code' }, code),
      h('p', { class: 'small muted' }, 'Il codice non verrà più mostrato.'),
    ],
    footer: h('button', { class: 'btn primary', onclick: () => m.close() }, icon('check', 18), 'L\'ho annotato'),
    onClose,
  });
}
