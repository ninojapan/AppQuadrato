// Selettore di periodo condiviso da Movimenti e Statistiche.
import { h, clear } from './ui.js';
import { startOfDay, endOfDay, addDays, isoDate } from './util.js';

export const PRESETS = [
  { value: 'oggi', label: 'Oggi' },
  { value: '7g', label: '7 giorni' },
  { value: '30g', label: '30 giorni' },
  { value: 'mese', label: 'Questo mese' },
  { value: 'mesePrec', label: 'Mese scorso' },
  { value: 'tutto', label: 'Tutto' },
  { value: 'custom', label: 'Date…' },
];

export function rangeFor(preset, custom = {}) {
  const now = Date.now();
  const today = startOfDay(now);
  switch (preset) {
    case 'oggi': return { from: today, to: endOfDay(now) };
    case '7g': return { from: addDays(today, -6), to: endOfDay(now) };
    case '30g': return { from: addDays(today, -29), to: endOfDay(now) };
    case 'mese': { const d = new Date(today); d.setDate(1); return { from: d.getTime(), to: endOfDay(now) }; }
    case 'mesePrec': {
      const a = new Date(today); a.setDate(1); a.setMonth(a.getMonth() - 1);
      const b = new Date(today); b.setDate(0);
      return { from: a.getTime(), to: endOfDay(b.getTime()) };
    }
    case 'custom': {
      const f = custom.from ? new Date(`${custom.from}T00:00:00`).getTime() : 0;
      const t = custom.to ? endOfDay(new Date(`${custom.to}T00:00:00`).getTime()) : endOfDay(now);
      return { from: f, to: t };
    }
    default: return { from: 0, to: endOfDay(now) };
  }
}

/** Componente: chip dei periodi + date personalizzate. onchange({from,to,preset}) */
export function periodPicker(initial, onchange) {
  let preset = initial;
  const custom = { from: isoDate(addDays(Date.now(), -30)), to: isoDate(Date.now()) };
  const chips = h('div', { class: 'chips' });
  const fromIn = h('input', { type: 'date', value: custom.from, onchange: (e) => { custom.from = e.target.value; emit(); } });
  const toIn = h('input', { type: 'date', value: custom.to, onchange: (e) => { custom.to = e.target.value; emit(); } });
  const customBox = h('div', { class: 'custom-dates' }, h('span', null, 'Dal'), fromIn, h('span', null, 'al'), toIn);
  const wrap = h('div', { class: 'period' }, chips, customBox);
  const draw = () => {
    clear(chips);
    for (const p of PRESETS) {
      chips.append(h('button', { class: `chip-btn btn ${p.value === preset ? 'active' : ''}`, onclick: () => { preset = p.value; draw(); emit(); } }, p.label));
    }
    customBox.hidden = preset !== 'custom';
  };
  const emit = () => onchange({ ...rangeFor(preset, custom), preset });
  draw();
  return { el: wrap, current: () => ({ ...rangeFor(preset, custom), preset }) };
}
