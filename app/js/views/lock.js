import { checkPassword, resetAdminWithRecovery, state, setSettings } from '../store.js';
import { h, icon, openModal, field, toast, showError } from '../ui.js';
import { brand } from '../app.js';
import { installBanner } from './install.js';

// Su tablet non apriamo la tastiera di sistema automaticamente (coprirebbe il tastierino).
const finePointer = () => window.matchMedia && window.matchMedia('(pointer: fine)').matches;

/** Tastierino numerico + campo password (si può usare anche la tastiera del tablet). */
function passwordPad(onSubmit, { placeholder = 'Password', autofocus = false } = {}) {
  const input = h('input', {
    class: 'pw-input', type: 'password', placeholder, autocomplete: 'off', autocapitalize: 'off',
    spellcheck: 'false', enterkeyhint: 'go', autofocus: autofocus && finePointer(),
    onkeydown: (e) => { if (e.key === 'Enter') submit(); },
  });
  let busy = false;
  const wrap = h('div', { class: 'pw-pad' });
  async function submit() {
    if (busy || !input.value) return;
    busy = true;
    const ok = await onSubmit(input.value);
    busy = false;
    if (!ok) {
      wrap.classList.remove('shake');
      void wrap.offsetWidth;
      wrap.classList.add('shake');
      input.value = '';
    }
  }
  const press = (k) => {
    if (k === 'del') input.value = input.value.slice(0, -1);
    else if (k === 'ok') submit();
    else input.value += k;
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  wrap.append(
    h('div', { class: 'pw-row' }, input),
    h('div', { class: 'keypad' }, keys.map((k) => h('button', {
      type: 'button',
      class: `key ${k === 'ok' ? 'key-ok' : ''} ${k === 'del' ? 'key-del' : ''}`,
      onclick: () => press(k),
    }, k === 'del' ? icon('backspace', 26) : k === 'ok' ? icon('check', 28) : k))),
  );
  return { el: wrap, input };
}

export function renderLock(container, onUnlock) {
  let fails = 0;
  const msg = h('div', { class: 'lock-msg' }, 'Inserire la password operatore o amministratore');
  const pad = passwordPad(async (pw) => {
    const role = await checkPassword(pw);
    if (role) { onUnlock(role); return true; }
    fails++;
    msg.textContent = 'Password errata';
    msg.classList.add('err');
    if (fails >= 5) await new Promise((r) => setTimeout(r, 1500));
    return false;
  });

  container.append(h('div', { class: 'lock-screen' },
    h('div', { class: 'lock-glow' }),
    h('div', { class: 'lock-card lock-split' },
      h('div', { class: 'lock-left' },
        brand('lg'),
        h('div', { class: 'lock-icon' }, icon('lock', 26)),
        msg,
        h('button', { class: 'link-btn', onclick: () => recoveryDialog() }, 'Password amministratore dimenticata?')),
      h('div', { class: 'lock-right' }, pad.el)),
    installBanner()));
  if (finePointer()) requestAnimationFrame(() => pad.input.focus());
}

export function promptAdminLogin(onSuccess) {
  const pad = passwordPad(async (pw) => {
    const role = await checkPassword(pw);
    if (role === 'admin') {
      m.close();
      state.role = 'admin';
      onSuccess();
      return true;
    }
    return false;
  }, { placeholder: 'Password amministratore', autofocus: true });
  const m = openModal({
    title: 'Accesso amministratore', size: 'sm', className: 'admin-login',
    content: [h('p', { class: 'muted' }, 'Inserire la password amministratore.'), pad.el],
  });
}

function recoveryDialog() {
  const code = h('input', { type: 'text', placeholder: 'XXXX-XXXX-XXXX', autocapitalize: 'characters', autocomplete: 'off' });
  const pw1 = h('input', { type: 'password', autocomplete: 'new-password' });
  const pw2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const m = openModal({
    title: 'Recupero password amministratore', size: 'sm',
    content: [
      h('p', { class: 'muted' }, 'Inserire il codice di recupero mostrato alla prima configurazione e scegliere una nuova password amministratore.'),
      field('Codice di recupero', code),
      field('Nuova password amministratore', pw1),
      field('Ripeti password', pw2),
    ],
    footer: [
      h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Annulla'),
      h('button', {
        class: 'btn primary',
        onclick: async () => {
          if (pw1.value !== pw2.value) return toast('Le password non coincidono', { type: 'error' });
          try {
            await resetAdminWithRecovery(code.value, pw1.value);
            await setSettings({ recoveryUsed: Date.now() });
            m.close();
            toast('Password amministratore aggiornata', { type: 'success' });
          } catch (err) { showError(err); }
        },
      }, 'Reimposta'),
    ],
  });
}
