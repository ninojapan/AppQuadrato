// Prepara la cartella dist/ da pubblicare.
// - copia app/ in dist/
// - calcola un codice BUILD dal contenuto dei file (cambia solo se cambia l'app)
// - scrive in sw.js l'elenco dei file da salvare offline e la versione
// Uso: node scripts/build.mjs
import { readFile, writeFile, readdir, rm, mkdir, copyFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'app');
const out = join(root, 'dist');

async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(p));
    else files.push(p);
  }
  return files;
}

const { version } = JSON.parse(await readFile(join(src, 'version.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('version.json: "version" deve essere nel formato 1.2.3');

const files = (await walk(src)).map((p) => relative(src, p).split(sep).join('/')).sort();
const hash = createHash('sha256');
for (const f of files) {
  if (f === 'js/build-info.js') continue;
  hash.update(f);
  hash.update(await readFile(join(src, f)));
}
const build = hash.digest('hex').slice(0, 10);

await rm(out, { recursive: true, force: true });
for (const f of files) {
  await mkdir(dirname(join(out, f)), { recursive: true });
  await copyFile(join(src, f), join(out, f));
}

const precache = ['./', ...files.filter((f) => f !== 'sw.js' && f !== 'version.json').map((f) => `./${f}`)];
let sw = await readFile(join(out, 'sw.js'), 'utf8');
sw = sw
  .replace("'__VERSION__'", JSON.stringify(version))
  .replace("'__BUILD__'", JSON.stringify(build))
  .replace(/\/\*ASSETS\*\/[\s\S]*?\/\*END_ASSETS\*\//, JSON.stringify(precache, null, 2));
await writeFile(join(out, 'sw.js'), sw);
await writeFile(join(out, 'js/build-info.js'), `export const VERSION = ${JSON.stringify(version)};\nexport const BUILD = ${JSON.stringify(build)};\n`);
await writeFile(join(out, '.nojekyll'), '');

let size = 0;
for (const f of files) size += (await stat(join(out, f))).size;
console.log(`Versione ${version} · build ${build} · ${files.length} file · ${(size / 1024).toFixed(0)} KB → dist/`);
