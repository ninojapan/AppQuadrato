// Genera logo e icone dell'app partendo dall'immagine del logo della nave.
// Uso:  node scripts/make-icons.mjs [percorso/logo.png]   (predefinito: assets-src/logo-nave-trieste.webp)
// (richiede Playwright con Chromium: npx playwright install chromium)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(process.argv[2] || `${root}/assets-src/logo-nave-trieste.webp`);
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[extname(src).toLowerCase()];
if (!mime) throw new Error(`Formato non supportato: ${src}`);
const dataUrl = `data:${mime};base64,${(await readFile(src)).toString('base64')}`;

let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }

const BG = '#070b16';
const outputs = [
  // [file, dimensione, margine % attorno al logo, sfondo]
  ['app/assets/logo.png', 320, 0, 'transparent'],
  ['app/icons/icon-192.png', 192, 0.08, BG],
  ['app/icons/icon-512.png', 512, 0.08, BG],
  ['app/icons/maskable-512.png', 512, 0.2, BG],
  ['app/icons/apple-touch-icon.png', 180, 0.1, BG],
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [file, size, pad, bg] of outputs) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(`<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg === 'transparent' ? 'transparent' : `radial-gradient(circle at 30% 25%, #18223d, ${bg} 70%)`}">
    <img src="${dataUrl}" style="width:${inner}px;height:${inner}px;object-fit:contain"></body></html>`);
  await page.waitForFunction(() => document.images[0].complete);
  await mkdir(dirname(`${root}/${file}`), { recursive: true });
  await writeFile(`${root}/${file}`, await page.screenshot({ omitBackground: bg === 'transparent', type: 'png' }));
  console.log('creato', file);
}
await browser.close();
