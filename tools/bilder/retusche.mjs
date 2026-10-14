// Bilder retuschieren (Marken, Schriftzüge, Personen unkenntlich machen) und zuschneiden – im Headless-Chrome.
//   node tools/bilder/retusche.mjs <ein.webp|jpg> <aus.webp|jpg> [--crop x,y,b,h] [--blur x,y,b,h[,radius]]… [--size b,h] [--q 0.86]
// Koordinaten in Pixeln des Originals. Weichzeichnen hat weiche Ränder, damit kein Kasten sichtbar wird.
// Das Original vorher sichern (tools/archiv/bilder-original/).
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [ein, aus, ...rest] = process.argv.slice(2);
let crop = null, size = null, q = 0.86; const blurs = [];
for (let i = 0; i < rest.length; i += 2) {
  const v = rest[i + 1].split(',').map(Number);
  if (rest[i] === '--crop') crop = v;
  else if (rest[i] === '--blur') blurs.push(v);
  else if (rest[i] === '--q') q = v[0];
  else if (rest[i] === '--size') size = v;
}
const mime = ein.endsWith('.jpg') || ein.endsWith('.jpeg') ? 'image/jpeg' : 'image/webp';
const daten = `data:${mime};base64,` + readFileSync(ein).toString('base64');
const ausMime = aus.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profil = mkdtempSync(join(tmpdir(), 'retusche-'));
const port = 9700 + Math.floor(Math.random() * 100);
const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ziele;
for (let i = 0; i < 50; i++) { try { ziele = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (ziele.some((t) => t.type === 'page')) break; } catch {} await sleep(200); }
const ws = new WebSocket(ziele.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let n = 0; const offen = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && offen.has(d.id)) { offen.get(d.id)(d.result); offen.delete(d.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++n; offen.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

const fn = async (src, crop, blurs, mime, q, size) => {
  const img = new Image(); img.src = src; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  for (const [x, y, w, h, r = 14] of blurs) {
    const pad = r * 3;
    // weichgezeichnete Kopie des Bereichs (mit Rand, damit die Kante nicht ausfranst)
    const b = document.createElement('canvas'); b.width = w + 2 * pad; b.height = h + 2 * pad;
    const bg = b.getContext('2d'); bg.filter = `blur(${r}px)`;
    bg.drawImage(c, x - pad, y - pad, b.width, b.height, 0, 0, b.width, b.height);
    // weiche Maske: Rechteck mit ausgeblendetem Rand
    const m = document.createElement('canvas'); m.width = b.width; m.height = b.height;
    const mg = m.getContext('2d'); mg.filter = `blur(${r * 0.6}px)`; mg.fillStyle = '#000'; mg.fillRect(pad, pad, w, h);
    bg.filter = 'none'; bg.globalCompositeOperation = 'destination-in'; bg.drawImage(m, 0, 0);
    g.drawImage(b, x - pad, y - pad);
  }
  let out = c;
  if (crop) {
    out = document.createElement('canvas'); out.width = crop[2]; out.height = crop[3];
    out.getContext('2d').drawImage(c, crop[0], crop[1], crop[2], crop[3], 0, 0, crop[2], crop[3]);
  }
  if (size) {   // in Stufen verkleinern (schärfer als ein einziger großer Schritt)
    let cur = out;
    while (cur.width / 2 >= size[0]) {
      const h = document.createElement('canvas'); h.width = Math.round(cur.width / 2); h.height = Math.round(cur.height / 2);
      const hg = h.getContext('2d'); hg.imageSmoothingQuality = 'high'; hg.drawImage(cur, 0, 0, h.width, h.height); cur = h;
    }
    const f = document.createElement('canvas'); f.width = size[0]; f.height = size[1];
    const fg = f.getContext('2d'); fg.imageSmoothingQuality = 'high'; fg.drawImage(cur, 0, 0, size[0], size[1]); out = f;
  }
  return out.toDataURL(mime, q);
};
const r = await send('Runtime.evaluate', {
  expression: `(${fn})(${JSON.stringify(daten)}, ${JSON.stringify(crop)}, ${JSON.stringify(blurs)}, ${JSON.stringify(ausMime)}, ${q}, ${JSON.stringify(size)})`,
  awaitPromise: true, returnByValue: true,
});
if (r.exceptionDetails) { console.error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); process.exitCode = 1; }
else { writeFileSync(aus, Buffer.from(r.result.value.split(',')[1], 'base64')); console.log('gespeichert', aus); }
ws.close(); chrome.kill('SIGKILL'); rmSync(profil, { recursive: true, force: true });
