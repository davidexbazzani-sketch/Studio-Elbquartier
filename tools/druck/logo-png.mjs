// Rechnet die Logo-Varianten aus tools/druck/logo.html als PNG mit transparentem Hintergrund.
// node tools/druck/logo-png.mjs   (Dev-Server muss auf Port 8765 laufen)
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ZIEL = new URL('../../Druckdaten/Logo/', import.meta.url);
const profil = mkdtempSync(join(tmpdir(), 'logo-'));
const port = 9800 + Math.floor(Math.random() * 100);
const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ziele;
for (let i = 0; i < 50; i++) { try { ziele = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (ziele.some((t) => t.type === 'page')) break; } catch {} await sleep(200); }
const ws = new WebSocket(ziele.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let n = 0; const offen = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && offen.has(d.id)) { offen.get(d.id)(d.result); offen.delete(d.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++n; offen.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 3000, height: 4200, deviceScaleFactor: 2, mobile: false });
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
await send('Page.navigate', { url: 'http://localhost:8765/tools/druck/logo.html' });
await sleep(1500);
await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => 1)', awaitPromise: true });
for (const id of ['quer', 'quer-hell', 'gestapelt', 'gestapelt-hell', 'zeichen-name', 'zeichen-name-weiss', 'zeichen-name-hell']) {
  const r = await send('Runtime.evaluate', { expression: `JSON.stringify(document.getElementById('${id}').getBoundingClientRect())`, returnByValue: true });
  const b = JSON.parse(r.result.value);
  const bild = await send('Page.captureScreenshot', { format: 'png', clip: { x: b.x, y: b.y, width: b.width, height: b.height, scale: 1 } });
  writeFileSync(new URL(`studio-elbquartier-logo-${id}.png`, ZIEL), Buffer.from(bild.data, 'base64'));
  console.log(id, Math.round(b.width), '×', Math.round(b.height));
}
ws.close(); chrome.kill('SIGKILL'); rmSync(profil, { recursive: true, force: true });
