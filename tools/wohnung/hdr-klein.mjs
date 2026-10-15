// Verkleinert Radiance-HDR-Dateien (RGBE) auf die halbe Breite und Höhe, z. B. die Raum-Lichter des Rundgangs
// für Handys: env_wohnen.hdr (1024 × 512) → env_wohnen_klein.hdr (512 × 256), ein Viertel der Datenmenge.
// Mittelt je 2 × 2 Pixel in Gleitkomma und schreibt unkomprimiertes RGBE (der Webserver packt es per gzip).
// Aufruf im Projektordner:  node tools/wohnung/hdr-klein.mjs assets/wohnung/env_*.hdr

import fs from 'node:fs';

function readHDR(file) {
  const buf = fs.readFileSync(file);
  let pos = 0;
  const line = () => { const s = pos; while (buf[pos] !== 0x0a) pos++; return buf.toString('latin1', s, pos++); };
  const header = [];
  for (let l = line(); l !== ''; l = line()) header.push(l);
  const size = line();
  const m = /^-Y (\d+) \+X (\d+)$/.exec(size);
  if (!m) throw new Error(`${file}: unbekannte Ausrichtung „${size}“`);
  const h = +m[1], w = +m[2];
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    if (buf[pos] === 2 && buf[pos + 1] === 2 && !(buf[pos + 2] & 0x80)) { // neue RLE-Zeile
      pos += 4;
      for (let c = 0; c < 4; c++) {
        for (let x = 0; x < w;) {
          let n = buf[pos++];
          if (n > 128) { n -= 128; const v = buf[pos++]; for (let k = 0; k < n; k++) px[row + (x++) * 4 + c] = v; }
          else for (let k = 0; k < n; k++) px[row + (x++) * 4 + c] = buf[pos++];
        }
      }
    } else { // flache Zeile
      px.set(buf.subarray(pos, pos + w * 4), row); pos += w * 4;
    }
  }
  return { header, w, h, px };
}

const toFloat = (px, i, out) => {
  const e = px[i + 3];
  if (!e) { out[0] = out[1] = out[2] = 0; return; }
  const f = Math.pow(2, e - 136);
  out[0] = px[i] * f; out[1] = px[i + 1] * f; out[2] = px[i + 2] * f;
};

for (const file of process.argv.slice(2)) {
  if (file.endsWith('_klein.hdr')) continue;
  const { header, w, h, px } = readHDR(file);
  const W = w >> 1, H = h >> 1;
  const out = new Uint8Array(W * H * 4);
  const a = [0, 0, 0], s = [0, 0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    s[0] = s[1] = s[2] = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      toFloat(px, ((y * 2 + dy) * w + x * 2 + dx) * 4, a);
      s[0] += a[0] / 4; s[1] += a[1] / 4; s[2] += a[2] / 4;
    }
    const max = Math.max(s[0], s[1], s[2]), o = (y * W + x) * 4;
    if (max < 1e-32) continue;
    const e = Math.ceil(Math.log2(max) + 1e-9);
    const scale = 256 / Math.pow(2, e);
    out[o] = Math.min(255, Math.floor(s[0] * scale)); out[o + 1] = Math.min(255, Math.floor(s[1] * scale));
    out[o + 2] = Math.min(255, Math.floor(s[2] * scale)); out[o + 3] = e + 128;
  }
  const head = Buffer.from(`${header.join('\n')}\n\n-Y ${H} +X ${W}\n`, 'latin1');
  const target = file.replace(/\.hdr$/, '_klein.hdr');
  fs.writeFileSync(target, Buffer.concat([head, Buffer.from(out)]));
  console.log(`${file} (${w} × ${h}, ${(fs.statSync(file).size / 1e6).toFixed(2)} MB) → ${target} (${W} × ${H}, ${(fs.statSync(target).size / 1e6).toFixed(2)} MB)`);
}
