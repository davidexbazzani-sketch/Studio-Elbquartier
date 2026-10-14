// Blumen als 3D-Modelle, komplett im Code gebaut.
// Jede Blüte entsteht aus parametrischen Blütenblättern (Wölbung, Rollrand, Kerbe, Rüschen),
// angeordnet wie in der Natur im goldenen Winkel. Feine Adern und Blattnerven kommen aus
// einer selbst gezeichneten Textur, das Licht scheint durch die dünnen Blätter hindurch.
// Ergebnis: eine zusammengeführte Geometrie mit Vertex-Farben pro Blüte (ein Draw-Call),
// die Blüte zeigt entlang +Y, Laub sitzt am Stiel darunter (negatives Y).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const { lerp, smoothstep, clamp } = THREE.MathUtils;
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // 137,5°
const V = THREE.Vector3;
const HQ = typeof window === 'undefined' || window.innerWidth >= 768; // feinere Geometrie am Desktop

// deterministischer Zufall (gleiche Blume sieht immer gleich aus)
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const col = (hex) => new THREE.Color(hex);

// ---------- Textur-Atlas: Blütenadern | Blattnerven | Weiß ----------
// UV-Bereiche: Blütenblätter x 0.01–0.46, Blätter x 0.51–0.93, schlichte Teile x ≈ 0.977
const UV_PLAIN = [0.977, 0.5];
let atlasTex = null;
function atlas() {
  if (atlasTex) return atlasTex;
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  const r = rng(77);

  // Blütenblatt: Adern fächern von der Basis (unten Mitte) zur Kante
  const PW = 470;
  for (let k = 0; k <= 90; k++) {
    const ex = (k / 90) * PW, sx = PW / 2 + (r() - 0.5) * 24;
    const cx = sx + (ex - sx) * 0.55 + (r() - 0.5) * 30, cy = H * 0.45;
    // Adern: an der Basis deutlicher, zur Kante hin auslaufend
    const grd = g.createLinearGradient(0, H, 0, 0);
    const a = 0.025 + r() * 0.03;
    grd.addColorStop(0, `rgba(110,60,75,${a * 1.6})`);
    grd.addColorStop(0.7, `rgba(110,60,75,${a * 0.6})`);
    grd.addColorStop(1, 'rgba(110,60,75,0)');
    g.strokeStyle = grd;
    g.lineWidth = 0.6 + r() * 0.8;
    g.beginPath(); g.moveTo(sx, H); g.quadraticCurveTo(cx, cy, ex, 0); g.stroke();
  }
  for (let k = 0; k < 9000; k++) { // feine Sprenkel
    g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.05)';
    g.fillRect(r() * PW, r() * H, 1.4, 1.4);
  }
  const shade = g.createLinearGradient(0, H, 0, 0); // Basis minimal dunkler
  shade.addColorStop(0, 'rgba(60,30,40,0.10)');
  shade.addColorStop(0.35, 'rgba(60,30,40,0)');
  g.fillStyle = shade;
  g.fillRect(0, 0, PW, H);

  // Blatt: etwas dunklere Fläche, helle Mittelrippe und Seitennerven
  const LX = 512, LW = 440, MID = LX + LW / 2;
  g.fillStyle = '#e4e4e4';
  g.fillRect(LX, 0, LW, H);
  for (let k = 0; k < 6000; k++) {
    g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)';
    g.fillRect(LX + r() * LW, r() * H, 1.6, 1.6);
  }
  g.strokeStyle = '#ffffff';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(MID, H); g.lineTo(MID, 0); g.stroke();
  g.lineWidth = 1.6;
  for (let y = H - 30; y > 20; y -= 34) {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(MID, y);
      g.quadraticCurveTo(MID + s * LW * 0.22, y - 30, MID + s * LW * 0.47, y - 70);
      g.stroke();
    }
  }

  atlasTex = new THREE.CanvasTexture(c);
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  atlasTex.anisotropy = 8;
  return atlasTex;
}

// ---------- Bausteine ----------

/** Geometrie vorbereiten: nicht indiziert, schlichte UV, mit Vertex-Farbe. */
function prep(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { uv[i * 2] = UV_PLAIN[0]; uv[i * 2 + 1] = UV_PLAIN[1]; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  const c = col(color);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function grid(nu, nv, pos, uvs, colors) {
  const idx = [];
  for (let j = 0; j < nv - 1; j++) {
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

const SHAPES = {
  // schmale Basis, breit oben, runde Kante
  rose: (v) => 0.22 + 0.78 * Math.sin((Math.PI / 2) * Math.pow(v, 0.7)), // verkehrt-eiförmig: oben am breitesten
  tulip: (v) => 0.3 + 0.7 * Math.pow(Math.sin(Math.PI * (0.08 + 0.86 * v)), 0.6),
  peony: (v) => 0.3 + 0.7 * Math.sin(Math.PI * Math.pow(v, 0.7) * 0.9),
  sepal: (v) => Math.pow(Math.max(0, 1 - v), 0.8) * Math.min(1, v * 6 + 0.3),
  leaf: (v) => Math.pow(Math.sin(Math.PI * Math.pow(v, 0.75)), 0.85),
  lance: (v) => Math.pow(Math.sin(Math.PI * Math.pow(v, 0.55)), 1.1),
};

/**
 * Blütenblatt als gebogene Fläche. Basis im Ursprung, wächst entlang +Y
 * und neigt sich mit `open` nach außen (+Z). Breite entlang X.
 */
function petal({
  length, width, open = 0.3, bend = 0, cup = 0.6, curl = 0, ruffle = 0, round = 0.2, notch = 0, wave = 0.03,
  shape = SHAPES.rose, segU = HQ ? 10 : 7, segV = HQ ? 12 : 8, seed = 1,
  base = '#e9a3ad', tip = '#f6d3d6', edge = null, heart = null, shade = 1,
}) {
  const r = rng(seed);
  // jedes Blatt ist ein bisschen anders
  length *= 1 + (r() - 0.5) * 0.12;
  open += (r() - 0.5) * 0.14;
  bend += (r() - 0.5) * 0.2;
  const jitter = 1 + (r() - 0.5) * 0.1;
  const phase = r() * 10;
  const nu = segU + 1, nv = segV + 1;
  const pos = new Float32Array(nu * nv * 3);
  const uvs = new Float32Array(nu * nv * 2);
  const colors = new Float32Array(nu * nv * 3);
  const cBase = col(base), cTip = col(tip), cEdge = edge ? col(edge) : null, cHeart = heart ? col(heart) : null;
  const tmp = new THREE.Color();

  // Mittellinie vorab integrieren
  const STEPS = 48;
  const sy = new Float32Array(STEPS + 1), sz = new Float32Array(STEPS + 1);
  for (let k = 1; k <= STEPS; k++) {
    const v = (k - 0.5) / STEPS;
    const th = open + bend * v * v;
    sy[k] = sy[k - 1] + (Math.cos(th) * length) / STEPS;
    sz[k] = sz[k - 1] + (Math.sin(th) * length) / STEPS;
  }
  const spine = (v) => {
    const f = clamp(v, 0, 1) * STEPS, k = Math.min(STEPS - 1, Math.floor(f)), t = f - k;
    return [lerp(sy[k], sy[k + 1], t), lerp(sz[k], sz[k + 1], t)];
  };

  let o = 0, q = 0;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const u = -1 + (2 * i) / segU;
      const v = j / segV;
      // runde Spitze, kleine Kerbe in der Mitte (Rosenblatt)
      const vv = Math.max(0, v * (1 - round * u * u) - notch * Math.exp(-(u * u) / 0.03) * v * v);
      const hw = (width / 2) * shape(vv) * jitter * (1 + wave * Math.sin(vv * 13 + phase) * vv);
      let x = u * hw, inward = 0;
      if (cup > 1e-3) {
        const R = hw / Math.sin(cup);
        x = R * Math.sin(u * cup);
        inward = R * (1 - Math.cos(u * cup));
      }
      const au = Math.abs(u);
      const outward = curl * hw * au * au * au * Math.pow(vv, 1.5)
        + ruffle * hw * Math.sin(u * 7 + vv * 6 + phase) * Math.pow(au, 1.2) * vv;
      const th = open + bend * vv * vv;
      const [py, pz] = spine(vv);
      const ny = -Math.sin(th), nz = Math.cos(th); // nach außen
      const d = outward - inward;
      pos[o] = x; pos[o + 1] = py + ny * d; pos[o + 2] = pz + nz * d;
      uvs[q] = 0.01 + ((u + 1) / 2) * 0.45; uvs[q + 1] = 0.02 + vv * 0.96;

      tmp.copy(cBase).lerp(cTip, smoothstep(vv, 0.1, 1.0));
      if (cHeart) tmp.lerp(cHeart, (1 - smoothstep(vv, 0, 0.22)) * 0.55);
      if (cEdge) tmp.lerp(cEdge, smoothstep(au, 0.55, 1) * smoothstep(vv, 0.3, 1) * 0.6);
      // Basis liegt im Schatten der Blüte (eingebackene Verdeckung)
      const ao = lerp(0.68, 1, smoothstep(vv, 0, 0.38));
      const s = shade * ao * jitter;
      colors[o] = tmp.r * s; colors[o + 1] = tmp.g * s; colors[o + 2] = tmp.b * s;
      o += 3; q += 2;
    }
  }
  return grid(nu, nv, pos, uvs, colors);
}

/** Laubblatt: gefaltet entlang der Mittelrippe, im Bogen gewölbt, optional gesägter Rand. */
function leaf({
  length, width, fold = 0.35, arch = 0.5, serrate = 0, shape = SHAPES.leaf,
  segU = HQ ? 6 : 4, segV = HQ ? 10 : 7, seed = 1, base = '#3e5c33', tip = '#5c7d47', shade = 1.1,
}) {
  const r = rng(seed * 7 + 3);
  const nu = segU + 1, nv = segV + 1;
  const pos = new Float32Array(nu * nv * 3);
  const uvs = new Float32Array(nu * nv * 2);
  const colors = new Float32Array(nu * nv * 3);
  const cB = col(base), cT = col(tip), tmp = new THREE.Color();
  const jitter = 1 + (r() - 0.5) * 0.12;
  const R = length / Math.max(arch, 1e-3);
  let o = 0, q = 0;
  for (let j = 0; j < nv; j++) {
    const v = j / segV;
    const ang = arch * v;
    const yy = arch > 1e-3 ? R * Math.sin(ang) : v * length;
    const zz = arch > 1e-3 ? R * (1 - Math.cos(ang)) : 0;
    for (let i = 0; i < nu; i++) {
      const u = -1 + (2 * i) / segU;
      const saw = serrate ? 1 + serrate * (((v * 16) % 1) - 0.5) * Math.abs(u) : 1;
      const hw = (width / 2) * shape(v) * jitter * saw;
      const lift = fold * Math.abs(u) * hw; // V-Faltung entlang der Mittelrippe
      pos[o] = u * hw;
      pos[o + 1] = yy - Math.sin(ang) * lift;
      pos[o + 2] = zz + Math.cos(ang) * lift;
      uvs[q] = 0.51 + ((u + 1) / 2) * 0.42; uvs[q + 1] = 0.02 + v * 0.96;
      tmp.copy(cB).lerp(cT, smoothstep(v, 0, 1));
      const s = shade * (0.92 + r() * 0.08);
      colors[o] = tmp.r * s; colors[o + 1] = tmp.g * s; colors[o + 2] = tmp.b * s;
      o += 3; q += 2;
    }
  }
  return grid(nu, nv, pos, uvs, colors);
}

/** Teil um die Blütenachse platzieren. */
function place(geo, { rotY = 0, r = 0, y = 0, tiltX = 0 }) {
  const m = new THREE.Matrix4()
    .makeRotationY(rotY)
    .multiply(new THREE.Matrix4().makeTranslation(0, y, r))
    .multiply(new THREE.Matrix4().makeRotationX(tiltX));
  return geo.applyMatrix4(m);
}

function receptacle(radius, color = '#6f8a55') {
  const g = new THREE.SphereGeometry(radius, 12, 8);
  g.scale(1, 0.85, 1);
  return prep(g, color);
}

function sepals(n, { length, width, r, seed, color = '#5f7f48', tip = '#7f9b5f' }) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const g = petal({
      length, width, open: 1.95, bend: 0.9, cup: 0.5, round: 0, shape: SHAPES.sepal,
      segU: 4, segV: 6, seed: seed + i, base: color, tip, wave: 0,
    });
    parts.push(place(g, { rotY: (i / n) * Math.PI * 2 + 0.3, r }));
  }
  return parts;
}

function stick(a, b, radius, color) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(radius, radius, len, 5, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new V(0, 1, 0), new V().subVectors(b, a).normalize());
  g.applyQuaternion(q).translate(a.x, a.y, a.z);
  return prep(g, color);
}

/** Gefiedertes Rosenblatt (5 Fiederblättchen) am Stiel bei Höhe y. */
function roseLeaf(seed, y, rotY) {
  const parts = [];
  const r = rng(seed * 19 + 5);
  const dir = new V(0.62, 0.78, 0).normalize(); // schräg nach außen/oben
  parts.push(stick(new V(0, 0, 0), dir.clone().multiplyScalar(0.16), 0.0035, '#55703f'));
  const spots = [[0.16, 0], [0.11, 1], [0.11, -1], [0.05, 1], [0.05, -1]];
  spots.forEach(([t, side], k) => {
    const size = k === 0 ? 1 : k < 3 ? 0.85 : 0.68;
    const g = leaf({ length: 0.085 * size, width: 0.05 * size, fold: 0.3, arch: 0.6, serrate: 0.28, seed: seed * 11 + k });
    const p = dir.clone().multiplyScalar(t);
    const m = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)
      .multiply(new THREE.Matrix4().makeRotationZ(-Math.atan2(dir.x, dir.y) + side * 1.0))
      .multiply(new THREE.Matrix4().makeRotationY(r() * 0.4 - 0.2))
      .multiply(new THREE.Matrix4().makeRotationX(-0.5));
    parts.push(g.applyMatrix4(m));
  });
  const merged = mergeGeometries(parts);
  merged.applyMatrix4(new THREE.Matrix4().makeRotationY(rotY).multiply(new THREE.Matrix4().makeTranslation(0, y, 0)));
  return merged;
}

// ---------- Blüten ----------

export function rose({ base = '#c94f6e', tip = '#ec9db0', edge = '#f5c9d3', heart = '#e9c27a' } = {}, seed = 1) {
  const parts = [];
  const N = HQ ? 30 : 24;
  const r = rng(seed * 101);
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1); // 0 = innen, 1 = außen
    const width = lerp(0.12, 0.28, Math.pow(f, 0.8));
    const cup = lerp(1.35, 0.72, f);
    const g = petal({
      length: lerp(0.12, 0.25, Math.pow(f, 0.8)),
      width,
      open: lerp(0.0, 0.82, Math.pow(f, 2)),
      bend: lerp(-0.12, 1.05, Math.pow(f, 1.6)),
      cup,
      curl: lerp(0.12, 0.7, f * f),
      round: lerp(0.4, 0.2, f),
      notch: lerp(0.0, 0.07, smoothstep(f, 0.45, 1)),
      shape: SHAPES.rose,
      seed: seed * 97 + i,
      base, tip, edge, heart,
      shade: lerp(0.8, 1.04, f),
    });
    // innere Blätter liegen wie Schalen ineinander: ihre Wölbung läuft konzentrisch um die Blütenmitte
    const hwMid = (width / 2) * SHAPES.rose(0.65);
    const shell = (hwMid / Math.sin(cup)) * 0.9;
    const radius = lerp(shell, 0.042, smoothstep(f, 0.3, 0.72));
    parts.push(place(g, { rotY: i * GOLDEN + (r() - 0.5) * 0.12, r: radius, y: lerp(0.03, 0, f) }));
  }
  parts.push(...sepals(5, { length: 0.11, width: 0.04, r: 0.03, seed: seed * 7 }));
  parts.push(receptacle(0.036));
  parts.push(roseLeaf(seed, -0.2, r() * 6.28), roseLeaf(seed + 50, -0.34, r() * 6.28));
  return mergeGeometries(parts);
}

export function tulip({ base = '#e77d97', tip = '#f6b6c5', edge = null } = {}, seed = 1) {
  const parts = [];
  const r = rng(seed * 61);
  for (let i = 0; i < 6; i++) {
    const outer = i % 2 === 0;
    const g = petal({
      length: outer ? 0.33 : 0.31,
      width: outer ? 0.27 : 0.25,
      open: outer ? 0.2 : 0.1,
      bend: -0.26,
      cup: 1.0,
      round: 0.42,
      wave: 0.015,
      shape: SHAPES.tulip,
      seed: seed * 31 + i,
      base, tip, edge,
      shade: outer ? 1 : 0.9,
    });
    parts.push(place(g, { rotY: (i * Math.PI) / 3 + (r() - 0.5) * 0.1, r: outer ? 0.032 : 0.022, y: 0.01 }));
  }
  parts.push(receptacle(0.03, '#7a9b5a'));
  // lange, graugrüne Blätter am Stiel
  [[-0.3, r() * 6.28], [-0.42, r() * 6.28]].forEach(([y, rot], k) => {
    const g = leaf({ length: 0.4, width: 0.085, fold: 0.6, arch: 0.85, shape: SHAPES.lance, seed: seed * 5 + k, base: '#5f7d55', tip: '#86a079' });
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(rot).multiply(new THREE.Matrix4().makeTranslation(0, y, 0.01)).multiply(new THREE.Matrix4().makeRotationX(0.25)));
    parts.push(g);
  });
  return mergeGeometries(parts);
}

export function peony({ base = '#ec9fae', tip = '#f8d6db', edge = '#fdeef0' } = {}, seed = 1) {
  const parts = [];
  const r = rng(seed * 13 + 5);
  // äußere Schalenblätter
  for (let i = 0; i < 8; i++) {
    const g = petal({
      length: 0.25, width: 0.33, open: lerp(0.75, 1.0, r()), bend: 0.35, cup: 0.95,
      ruffle: 0.1, curl: 0.12, round: 0.3, notch: 0.04, shape: SHAPES.peony, seed: seed * 53 + i,
      base, tip, edge, shade: 1.02,
    });
    parts.push(place(g, { rotY: (i / 8) * Math.PI * 2 + r() * 0.3, r: 0.07, y: 0 }));
  }
  // gefüllte, gekräuselte Mitte
  const N = HQ ? 50 : 38;
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    const g = petal({
      length: lerp(0.1, 0.2, f), width: lerp(0.13, 0.22, f),
      open: lerp(-0.05, 0.6, Math.pow(f, 1.2)), bend: lerp(-0.4, 0.2, f), cup: lerp(1.15, 0.8, f),
      ruffle: lerp(0.55, 0.28, f), round: 0.3, notch: 0.05, shape: SHAPES.peony, seed: seed * 71 + i,
      base, tip, edge, shade: lerp(0.8, 0.98, f), segU: HQ ? 8 : 6, segV: HQ ? 8 : 6,
    });
    parts.push(place(g, { rotY: i * GOLDEN, r: lerp(0.008, 0.07, Math.pow(f, 0.7)), y: lerp(0.05, 0.02, f) }));
  }
  parts.push(...sepals(4, { length: 0.1, width: 0.05, r: 0.05, seed: seed * 3 }));
  parts.push(receptacle(0.045));
  // dunkles, glänzendes Pfingstrosenlaub
  [[-0.22, r() * 6.28], [-0.32, r() * 6.28]].forEach(([y, rot], k) => {
    const g = leaf({ length: 0.2, width: 0.07, fold: 0.35, arch: 0.9, shape: SHAPES.lance, seed: seed * 9 + k, base: '#3c5934', tip: '#5a7a49' });
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(rot).multiply(new THREE.Matrix4().makeTranslation(0, y, 0)).multiply(new THREE.Matrix4().makeRotationX(0.9)));
    parts.push(g);
  });
  return mergeGeometries(parts);
}

/** Eukalyptus (Silver Dollar): Zweig mit runden, gegenständigen Blättern. */
export function eucalyptus(_c = {}, seed = 1) {
  const parts = [];
  const r = rng(seed * 17 + 3);
  const lean = new V(r() - 0.5, 0, r() - 0.5).multiplyScalar(0.25);
  const curve = new THREE.QuadraticBezierCurve3(new V(0, 0, 0), new V(lean.x, 0.2, lean.z), new V(lean.x * 2.2, 0.38, lean.z * 2.2));
  parts.push(prep(new THREE.TubeGeometry(curve, 16, 0.006, 5, false), '#8a7f68'));
  const leafGeo = new THREE.CircleGeometry(1, HQ ? 18 : 12);
  const lp = leafGeo.attributes.position;
  const luv = leafGeo.attributes.uv;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i), y = lp.getY(i);
    lp.setZ(i, -0.18 * (x * x + y * y)); // leicht gewölbt
    luv.setXY(i, 0.51 + luv.getX(i) * 0.42, 0.02 + luv.getY(i) * 0.96);
  }
  leafGeo.computeVertexNormals();
  const tints = ['#93ab9f', '#86a093', '#a1b6ab', '#8aa598', '#9bb1a6'];
  let node = 0;
  for (let t = 0.1; t <= 0.97; t += 0.085, node++) {
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const s = lerp(0.075, 0.04, t) * (0.9 + r() * 0.2);
    for (const side of [1, -1]) {
      const g = leafGeo.toNonIndexed();
      const c = col(tints[(node * 2 + (side > 0 ? 0 : 1)) % tints.length]);
      const arr = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r * 1.12; arr[i + 1] = c.g * 1.12; arr[i + 2] = c.b * 1.12; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      const q = new THREE.Quaternion().setFromUnitVectors(new V(0, 1, 0), tan);
      const spin = (node * Math.PI) / 2;
      const m = new THREE.Matrix4().compose(p, q, new V(1, 1, 1))
        .multiply(new THREE.Matrix4().makeRotationY(spin))
        .multiply(new THREE.Matrix4().makeTranslation(side * s * 0.95, 0, 0))
        .multiply(new THREE.Matrix4().makeRotationY(side * 0.35))
        .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2 + 0.55))
        .multiply(new THREE.Matrix4().makeScale(s, s, s));
      parts.push(g.applyMatrix4(m));
    }
  }
  return mergeGeometries(parts);
}

/** Schleierkraut: verzweigter Stiel mit vielen kleinen weißen Blüten. */
export function gypsophila(_c = {}, seed = 1) {
  const parts = [];
  const r = rng(seed * 29 + 11);
  const floret = new THREE.IcosahedronGeometry(0.0105, 0);
  const stemCol = '#7d9566';
  const top = new V(0, 0.1, 0);
  parts.push(stick(new V(0, 0, 0), top, 0.004, stemCol));
  for (let b = 0; b < 6; b++) {
    const az = (b / 6) * Math.PI * 2 + r() * 0.6;
    const el = 0.35 + r() * 0.55;
    const len = 0.1 + r() * 0.12;
    const end = top.clone().add(new V(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az)).multiplyScalar(len));
    parts.push(stick(top, end, 0.003, stemCol));
    for (let s = 0; s < 3; s++) {
      const az2 = az + (r() - 0.5) * 1.6;
      const el2 = el * 0.6 + r() * 0.5;
      const tip = end.clone().add(new V(Math.sin(el2) * Math.cos(az2), Math.cos(el2), Math.sin(el2) * Math.sin(az2)).multiplyScalar(0.05 + r() * 0.06));
      parts.push(stick(end, tip, 0.002, stemCol));
      for (let k = 0; k < (HQ ? 10 : 7); k++) {
        const g = prep(floret.clone(), r() > 0.25 ? '#fdfcf7' : '#efe8d8');
        const off = new V(r() - 0.5, r() - 0.3, r() - 0.5).multiplyScalar(0.05);
        const sc = 0.65 + r() * 0.6;
        g.scale(sc, sc * 0.8, sc).translate(tip.x + off.x, tip.y + off.y, tip.z + off.z);
        parts.push(g);
      }
    }
  }
  return mergeGeometries(parts);
}

/** Lavendel: Ähre mit Quirlen aus kleinen Knospen. */
export function lavender(_c = {}, seed = 1) {
  const parts = [];
  const r = rng(seed * 41 + 7);
  const stem = new THREE.CylinderGeometry(0.0045, 0.005, 0.36, 5, 1, true);
  stem.translate(0, 0.18, 0);
  parts.push(prep(stem, '#7f9070'));
  const bud = new THREE.SphereGeometry(1, 6, 5);
  const shades = ['#8d7bc4', '#7b68b3', '#9a8ace', '#6f5ea6'];
  for (let y = 0.13, w = 0; y < 0.36; y += 0.017, w++) {
    const n = 6;
    const taper = 1 - smoothstep(y, 0.28, 0.36) * 0.55;
    for (let k = 0; k < n; k++) {
      const az = (k / n) * Math.PI * 2 + w * 0.5;
      const g = prep(bud.clone(), shades[(k + w) % shades.length]);
      const m = new THREE.Matrix4()
        .makeRotationY(az)
        .multiply(new THREE.Matrix4().makeTranslation(0, y + r() * 0.006, 0.011 * taper))
        .multiply(new THREE.Matrix4().makeRotationX(0.5))
        .multiply(new THREE.Matrix4().makeScale(0.008 * taper, 0.017 * taper, 0.008 * taper));
      parts.push(g.applyMatrix4(m));
    }
  }
  return mergeGeometries(parts);
}

// ---------- Katalog ----------

export const FLOWER_TYPES = {
  rose: { build: rose, stem: 0.011, reach: 1.0 },
  tulip: { build: tulip, stem: 0.012, reach: 1.06 },
  peony: { build: peony, stem: 0.013, reach: 0.95 },
  eucalyptus: { build: eucalyptus, stem: 0.007, reach: 0.92 },
  gypsophila: { build: gypsophila, stem: 0.006, reach: 1.02 },
  lavender: { build: lavender, stem: 0.005, reach: 1.02 },
};

const cache = new Map();
/** Geometrie je Sorte + Farbe + Variante (wenige Varianten für natürliche Unterschiede). */
export function flowerGeometry(type, palette = {}, variant = 0) {
  const key = `${type}|${JSON.stringify(palette)}|${variant}`;
  if (!cache.has(key)) cache.set(key, FLOWER_TYPES[type].build(palette, variant + 1));
  return cache.get(key);
}

export function createFlowerMaterial() {
  const tex = atlas();
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    map: tex,
    bumpMap: tex,
    bumpScale: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.55,
    metalness: 0,
    sheen: 0.22,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color('#ffeef0'),
  });
  // Dünne Blätter lassen Licht durch: von hinten beleuchtete Stellen leuchten in ihrer Farbe
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
          float back = max(0.0, dot(-normal, directionalLights[i].direction));
          reflectedLight.directDiffuse += diffuseColor.rgb * diffuseColor.rgb * directionalLights[i].color * back * 0.38;
        }
      #endif
      totalEmissiveRadiance += diffuseColor.rgb * 0.03;`
    );
  };
  return m;
}
