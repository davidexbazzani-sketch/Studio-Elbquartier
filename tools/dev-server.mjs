// Lokaler Entwicklungs-Server (Node-Fassung von tools/dev-server.py, für Rechner ohne Python):
// liefert die Seite ohne Cache aus, unterstützt Byte-Ranges für Videos und kann gerenderte
// Bilder speichern (POST /__save, nur für tools/bake-*.html). Nicht auf den Webserver laden.
// Start im Projektordner:  node tools/dev-server.mjs .   (Port mit PORT=… ändern, Standard 8765)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(process.argv[2] || '.');
const PORT = Number(process.env.PORT) || 8765;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream',
  '.ktx2': 'image/ktx2', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
};

const COMPRESS = /^(text\/|application\/(json|wasm|manifest\+json)|image\/svg|model\/gltf-binary|application\/octet-stream$)/;

const readBody = req => new Promise((ok, fail) => {
  const parts = []; req.on('data', c => parts.push(c)); req.on('end', () => ok(Buffer.concat(parts))); req.on('error', fail);
});
const end = (res, code, body = '', headers = {}) => { res.writeHead(code, headers); res.end(body); };

async function post(req, res, u) {
  const q = u.searchParams;
  if (u.pathname === '/__log') {  // Fortschritt der Render-Werkzeuge im Terminal ausgeben
    console.log((await readBody(req)).toString().slice(0, 2000)); return end(res, 200);
  }
  if (u.pathname === '/__savemodel') {  // heruntergeladene 3D-Modelle (Quelldateien) nach tools/models/quelle/
    const name = q.get('name') || '';
    if (!/^[a-z0-9-]+\.(glb|gltf|bin|png|jpg|webp|zip)$/.test(name)) return end(res, 400);
    const data = await readBody(req), out = path.join(ROOT, 'tools', 'models', 'quelle');
    fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, name), data);
    return end(res, 200, String(data.length), { 'Access-Control-Allow-Origin': '*' });
  }
  // nur lokal: vorgerenderte Bilder speichern  /__save?dir=juwelier&name=elbe-hero.webp
  const name = q.get('name') || '', folder = q.get('dir') || '';
  if (u.pathname !== '/__save' || !/^[a-z0-9-]+\.(webp|png|jpg)$/.test(name) || !/^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(folder)) return end(res, 400);
  const body = (await readBody(req)).toString(), data = Buffer.from(body.split(',', 2)[1] || '', 'base64');
  const out = path.join(ROOT, 'assets', 'img', folder);
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, name), data);
  end(res, 200, String(data.length));
}

function get(req, res, u) {
  let file = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!file.startsWith(ROOT)) return end(res, 403);
  let stat = fs.statSync(file, { throwIfNoEntry: false });
  if (stat?.isDirectory()) {
    if (!u.pathname.endsWith('/')) return end(res, 301, '', { Location: u.pathname + '/' + u.search });
    file = path.join(file, 'index.html'); stat = fs.statSync(file, { throwIfNoEntry: false });
  }
  if (!stat?.isFile()) return end(res, 404, 'Nicht gefunden', { 'Content-Type': 'text/plain; charset=utf-8' });
  const headers = { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
  // Byte-Ranges wie bei Apache, damit Videos im Browser springen und neu starten können
  const m = /^bytes=(\d*)-(\d*)$/.exec((req.headers.range || '').trim());
  if (m && (m[1] || m[2])) {
    const size = stat.size;
    let start, last;
    if (m[1]) { start = +m[1]; last = Math.min(m[2] ? +m[2] : size - 1, size - 1); }
    else { start = Math.max(0, size - +m[2]); last = size - 1; }
    if (start >= size || start > last) return end(res, 416, '', { 'Content-Range': `bytes */${size}` });
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${last}/${size}`, 'Content-Length': last - start + 1 });
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(file, { start, end: last }).pipe(res);
  }
  // wie auf dem Webserver (.htaccess): Text, Skripte, Modelle, HDR und WebAssembly gzip-komprimiert
  if (COMPRESS.test(headers['Content-Type']) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(zlib.createGzip({ level: 6 })).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') {  // nur für /__savemodel: Browser fragt vorher nach (CORS, Zugriff auf localhost)
      return end(res, 204, '', { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Private-Network': 'true' });
    }
    if (req.method === 'POST') return await post(req, res, u);
    if (req.method === 'GET' || req.method === 'HEAD') return get(req, res, u);
    end(res, 405);
  } catch (e) { console.error(e); if (!res.headersSent) end(res, 500); else res.end(); }
}).listen(PORT, () => console.log(`Studio Elbquartier läuft auf http://localhost:${PORT}`));
