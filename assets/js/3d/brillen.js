// Klarsund – Brillenmodelle und realistische Materialien (für AR-Anprobe und Produktansicht).
// Modelle in Zentimetern (tools/brillen/vorbereiten.py): Ursprung = Brückenmitte auf Glasmitte,
// Vorderseite bei z = 0, Bügel nach −z, oben = +y. Material-Rollen: rahmen, metall, metall2, glas, pads.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = new URL('../../models/brillen/', import.meta.url).href;

export const MODELLE = {
  elbe: {
    name: 'Elbe', art: 'Acetat · Vollrand', preis: 289,
    text: 'Kantig, ruhig, zeitlos – aus italienischem Acetat, von Hand poliert.',
    farben: {
      schwarz: { label: 'Tiefschwarz', sw: '#151517', rahmen: { typ: 'acetat', farbe: '#0f0f11' } },
      havanna: { label: 'Havanna', sw: '#6b3f1e', rahmen: { typ: 'havanna' } },
      kristall: { label: 'Kristall Rauch', sw: '#9ea6aa', rahmen: { typ: 'kristall', farbe: '#9aa4a8' } },
    },
    glaeser: ['klar', 'blaufilter', 'sonne'],
  },
  ottensen: {
    name: 'Ottensen', art: 'Titan · Panto rund', preis: 349,
    text: 'Federleichtes Titan, runde Panto-Form – fein wie eine Zeichnung.',
    farben: {
      gold: { label: 'Gold', sw: '#c9a45c', metall: '#e9c787' },
      silber: { label: 'Silber', sw: '#c8c9cc', metall: '#e2e4e7' },
      gunmetal: { label: 'Gunmetal', sw: '#4b4d52', metall: '#9a9ea5' },
    },
    glaeser: ['klar', 'blaufilter', 'sonne'],
  },
  kapitaen: {
    name: 'Kapitän', art: 'Pilotenbrille · Sonnenbrille', preis: 319,
    text: 'Die klassische Pilotenform mit mineralischen Gläsern, UV400 (Schutz bis 400 nm), Filterkategorie 3.',
    farben: {
      gold: { label: 'Gold · G15 grün', sw: '#c9a45c', metall: '#e9c787', glas: 'g15' },
      silber: { label: 'Silber · Grau', sw: '#c8c9cc', metall: '#e2e4e7', glas: 'grau' },
      braun: { label: 'Gold · Braun Verlauf', sw: '#8a5a33', metall: '#e9c787', glas: 'verlauf' },
    },
    glaeser: null,
  },
};
export const GLAESER = {
  klar: { label: 'Klar, entspiegelt', preis: 0 },
  blaufilter: { label: 'Blaulichtfilter', preis: 49 },
  sonne: { label: 'Sonnenglas grau', preis: 69 },
};

// ---------- Texturen ----------

/** Schildpatt (Havanna): Bernstein mit dunkelbraunen, weichen Flecken. */
function havannaTexture() {
  // Schildpatt: warmer Bernstein-Grund, darin viele kleine, weich verlaufende Flecken in drei Brauntönen
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  const base = g.createLinearGradient(0, 0, N, N); base.addColorStop(0, '#b06a26'); base.addColorStop(1, '#94511b');
  g.fillStyle = base; g.fillRect(0, 0, N, N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const blob = (x, y, r, col, a, sx) => {
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {        // kachelbar
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      grd.addColorStop(0, `rgba(${col},${a})`); grd.addColorStop(0.6, `rgba(${col},${a * 0.55})`); grd.addColorStop(1, `rgba(${col},0)`);
      g.save(); g.translate(x + ox, y + oy); g.scale(sx, 1 / sx); g.translate(-(x + ox), -(y + oy));
      g.fillStyle = grd; g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill(); g.restore();
    }
  };
  // große, gestreckte Schatten-Wolken (echtes Schildpatt ist zur Hälfte dunkel), dann Flecken, dann Bernstein-Lichter
  for (let i = 0; i < 120; i++) blob(rnd() * N, rnd() * N, 40 + rnd() * 80, '74,34,11', 0.7, 1.3 + rnd() * 1.1);
  for (let i = 0; i < 260; i++) blob(rnd() * N, rnd() * N, 10 + rnd() * 30, '42,18,6', 0.85, 0.8 + rnd() * 1.2);
  for (let i = 0; i < 110; i++) blob(rnd() * N, rnd() * N, 4 + rnd() * 10, '20,9,4', 0.85, 0.7 + rnd());
  for (let i = 0; i < 80; i++) blob(rnd() * N, rnd() * N, 8 + rnd() * 22, '222,146,60', 0.55, 1.2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

/** Projektion einer Textur in Objektkoordinaten (Modelle haben keine brauchbaren UVs). */
function triplanar(mat, tex, scale) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.triTex = { value: tex }; sh.uniforms.triScale = { value: scale };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos; varying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position; vObjN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D triTex; uniform float triScale; varying vec3 vObjPos; varying vec3 vObjN;')
      .replace('#include <map_fragment>', `
        vec3 bw = pow(abs(normalize(vObjN)), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec4 tx = texture2D(triTex, vObjPos.zy * triScale);
        vec4 ty = texture2D(triTex, vObjPos.xz * triScale);
        vec4 tz = texture2D(triTex, vObjPos.xy * triScale);
        diffuseColor *= tx * bw.x + ty * bw.y + tz * bw.z;`);
  };
  mat.customProgramCacheKey = () => 'tri';
}

let havanna = null;
function rahmenMaterial(spec) {
  if (spec.typ === 'havanna') {
    havanna = havanna || havannaTexture();
    const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
    triplanar(m, havanna, 0.17);   // Kachel ≈ 6 cm: Flecken 3–10 mm wie bei echtem Schildpatt
    return m;
  }
  if (spec.typ === 'kristall') {
    return new THREE.MeshPhysicalMaterial({ color: spec.farbe, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04,
      transparent: true, opacity: 0.42, ior: 1.49, specularIntensity: 1.2, depthWrite: true, envMapIntensity: 1.6 });
  }
  return new THREE.MeshPhysicalMaterial({ color: spec.farbe, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
}

function metallMaterial(farbe, rough = 0.28) {
  return new THREE.MeshPhysicalMaterial({ color: farbe, metalness: 1, roughness: rough, clearcoat: 0.2, clearcoatRoughness: 0.12, envMapIntensity: 1.4 });
}

// Gläser filtern das Licht wie echte Gläser: das Bild dahinter wird mit der Durchlässigkeit multipliziert
// (Sonnenglas G15 lässt ~15 % grünlich-grau durch). Die Spiegelung kommt als zweite Schicht obendrauf.
const DURCHLASS = {
  klar: { c: [0.97, 0.975, 0.97] },
  blaufilter: { c: [0.985, 0.98, 0.955] },
  sonne: { c: [0.13, 0.13, 0.135] }, grau: { c: [0.035, 0.035, 0.038] },
  g15: { c: [0.026, 0.036, 0.022] },
  verlauf: { c: [0.035, 0.02, 0.01], unten: [0.6, 0.45, 0.3] },
};
function glasMaterial(art) {
  const d = DURCHLASS[art] || DURCHLASS.klar;
  const m = new THREE.MeshBasicMaterial({
    color: new THREE.Color(...d.c), toneMapped: false, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
  });
  m.userData.glas = true;
  if (d.unten) {     // Verlauf: oben dunkel, unten hell
    const u = new THREE.Color(...d.unten);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.unten = { value: u };
      sh.uniforms.yb = { value: m.userData.yb || new THREE.Vector2(-2.6, 1.4) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vGy;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGy = position.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 unten; uniform vec2 yb; varying float vGy;')
        .replace('#include <opaque_fragment>', 'diffuseColor.rgb = mix(unten, diffuseColor.rgb, smoothstep(yb.x + (yb.y - yb.x) * 0.1, yb.x + (yb.y - yb.x) * 0.75, vGy));\n#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => 'verlauf3';
  }
  return m;
}

// Produktansicht (heller, transparenter Hintergrund): Filter-Mischung geht dort nicht – normales getöntes Glas
function ansichtGlas(art) {
  const d = DURCHLASS[art] || DURCHLASS.klar;
  const c = d.unten ? d.c.map((v, i) => (v + d.unten[i]) / 2) : d.c;
  const t = (c[0] + c[1] + c[2]) / 3, mx = Math.max(...c);
  return new THREE.MeshPhysicalMaterial({ color: new THREE.Color(...c.map((v) => v / mx)).multiplyScalar(t > 0.5 ? 1 : 0.05 + 0.4 * t),   // Glas streut kaum: dunkle Gläser wirken fast schwarz mit Spiegelung
    roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, depthWrite: false,
    opacity: THREE.MathUtils.clamp(1 - t * 0.95, 0.08, 0.94), envMapIntensity: 0.3 + 0.9 * t, specularIntensity: 0.5 + 0.5 * t,
    side: THREE.DoubleSide });
}

// Spiegelung auf dem Glas als eigene Schicht: wird aufaddiert, damit sie nicht mit der Transparenz verblasst
// Klare Gläser sind entspiegelt: nur schwacher, grünlicher Restreflex (typisch für Superentspiegelung)
function spiegelMaterial(stark, entspiegelt = false) {
  const m = new THREE.MeshPhysicalMaterial({ color: '#000000', metalness: 0, roughness: 0.04, specularIntensity: 1, ior: 1.6,
    specularColor: entspiegelt ? new THREE.Color('#dcefe0') : new THREE.Color('#ffffff'),
    envMapIntensity: stark, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
    iridescence: entspiegelt ? 0 : 0.25, iridescenceIOR: 1.35, iridescenceThicknessRange: [260, 420] });
  return m;
}

// Kristall-Acetat in der Anprobe: filtert das Kamerabild wie ein klarer, leicht rauchiger Kunststoffblock –
// von vorn fast durchsichtig, an den schrägen Kanten (längerer Lichtweg) dunkler. Glanz kommt als eigene Schicht.
function kristallFilter(farbe) {
  const c = new THREE.Color(farbe);
  return new THREE.ShaderMaterial({
    uniforms: { vorn: { value: new THREE.Color(0.80, 0.82, 0.83).multiply(c.clone().lerp(new THREE.Color(1, 1, 1), 0.75)) },
      kante: { value: new THREE.Color(0.30, 0.33, 0.35).multiply(c.clone().lerp(new THREE.Color(1, 1, 1), 0.4)) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 vorn; uniform vec3 kante; varying vec3 vN; varying vec3 vV;
      void main() { float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(mix(vorn, kante, smoothstep(0.15, 0.85, f)), 1.0); }`,
    transparent: true, depthWrite: true, side: THREE.FrontSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
}
function kristallGlanz() {
  return new THREE.MeshPhysicalMaterial({ color: '#000000', roughness: 0.08, specularIntensity: 1, ior: 1.49, clearcoat: 1, clearcoatRoughness: 0.04,
    envMapIntensity: 0.35, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
}

// Nasenpads aus klarem Silikon: kaum sichtbar, nur ein matter Schimmer
const padsMaterial = () => new THREE.MeshPhysicalMaterial({ color: '#d9d7d0', roughness: 0.35, transparent: true, opacity: 0.2, depthWrite: false });

// ---------- Laden ----------

const cache = {};
export function loadModell(id) {
  if (cache[id]) return cache[id];
  cache[id] = new Promise((res, rej) => {
    const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
    l.load(BASE + id + '.glb', (g) => {
      const meshes = [];
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
      res({ scene: g.scene, meshes });
    }, undefined, rej);
  });
  return cache[id];
}

/**
 * Brille als Gruppe mit Materialien nach Wunsch.
 * @param {string} id Modell, @param {string} farbe, @param {string} glas (für Sonnenbrillen ignoriert)
 * @param {{spreizung?: number, ar?: boolean}} opt spreizung: halbe Kopfbreite in cm, Bügel laufen außen am Kopf entlang;
 *   ar: Kamerabild liegt dahinter (Kristall wird dann als Filter gerendert)
 */
export async function createBrille(id, farbe, glas, opt = {}) {
  const m = MODELLE[id]; const f = m.farben[farbe] || Object.values(m.farben)[0];
  const { scene } = await loadModell(id);
  const root = scene.clone(true);
  const mats = {
    rahmen: f.rahmen ? rahmenMaterial(f.rahmen) : id === 'kapitaen' ? rahmenMaterial({ typ: 'acetat', farbe: '#141416' }) : metallMaterial(f.metall || '#d6b26a'),
    metall: metallMaterial(f.metall || '#c9cbce'),
    metall2: metallMaterial(f.metall2 || '#c9cbce', 0.26),
    glas: opt.ar ? glasMaterial(f.glas || glas || 'klar') : ansichtGlas(f.glas || glas || 'klar'),
    pads: padsMaterial(),
  };
  // Anprobe: die Kamera-Umgebung ist dunkler als das Studiolicht der Produktansicht – Metall etwas stärker spiegeln lassen
  if (opt.ar) for (const k of ['rahmen', 'metall', 'metall2']) if (mats[k].metalness === 1) mats[k].envMapIntensity = 2.0;
  // In der Anprobe (Kamerabild dahinter) wird Kristall als echter Filter gerendert
  const kristallAR = opt.ar && f.rahmen?.typ === 'kristall';
  if (kristallAR) mats.rahmen = kristallFilter(f.rahmen.farbe);
  const spiegel = [], glanz = [];
  inBrillenRaum(root);
  if (id === 'kapitaen') padsAbtrennen(root, mats.pads, 'rahmen', (x) => x < 2.5);
  // Ottensen: Die Pads stecken im Glas-Teil (im Original ebenfalls transparent) – kleine Einzelteile dort sind Pads
  kleineTeileAbtrennen(root, 'glas', 2.2, mats.pads);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const role = o.material === mats.pads ? 'pads' : (o.material.name || 'rahmen').replace(/\.\d+$/, '');
    if (opt.spreizung && role !== 'pads') spreizen(o.geometry, opt.spreizung);   // Pads teilen sich die Punkte mit dem Rahmen
    o.material = mats[role] || mats.rahmen;
    o.renderOrder = role === 'glas' ? 2 : 1;
    o.castShadow = false;
    if (role === 'glas') spiegel.push(o);
    if (kristallAR && o.material === mats.rahmen) glanz.push(o);
  });
  for (const o of glanz) {
    const r = new THREE.Mesh(o.geometry, kristallGlanz());
    r.renderOrder = 1; o.parent.add(r); r.position.copy(o.position); r.quaternion.copy(o.quaternion); r.scale.copy(o.scale);
  }
  // Verlauf über die tatsächliche Glashöhe: oben ~96 % Filterung, unten ~60 %
  if (spiegel.length && mats.glas.onBeforeCompile) {
    let lo = Infinity, hi = -Infinity;
    for (const o of spiegel) { o.geometry.computeBoundingBox(); lo = Math.min(lo, o.geometry.boundingBox.min.y); hi = Math.max(hi, o.geometry.boundingBox.max.y); }
    mats.glas.userData.yb = new THREE.Vector2(lo, hi);
  }
  for (const o of opt.ar ? spiegel : []) {
    const r = new THREE.Mesh(o.geometry, (f.glas || glas === 'sonne' ? spiegelMaterial(0.45) : spiegelMaterial(0.07, true)));
    r.renderOrder = 3; o.parent.add(r); r.position.copy(o.position); r.quaternion.copy(o.quaternion); r.scale.copy(o.scale);
  }
  root.userData.mats = mats;
  return root;
}

/**
 * Geometrie in Zentimeter-Koordinaten der Brille überführen (die Modelle sind quantisiert gespeichert:
 * Ganzzahl-Positionen plus Knoten-Skalierung). Danach liegen alle Teile direkt unter der Wurzel.
 */
function inBrillenRaum(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const meshes = []; root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const g = new THREE.BufferGeometry();
    for (const name of ['position', 'normal']) {
      const a = o.geometry.attributes[name]; if (!a) continue;
      const f = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
      g.setAttribute(name, new THREE.BufferAttribute(f, 3));
    }
    const mtx = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    let index = o.geometry.index ? Array.from(o.geometry.index.array) : null;
    // gespiegelte Teile (z. B. linker Bügel = rechter mit Skalierung −1): Umlaufsinn umdrehen, sonst zeigen die Innenseiten nach außen
    if (mtx.determinant() < 0) {
      if (!index) index = Array.from({ length: o.geometry.attributes.position.count }, (_, i) => i);
      for (let i = 0; i < index.length; i += 3) { const t = index[i + 1]; index[i + 1] = index[i + 2]; index[i + 2] = t; }
    }
    if (index) g.setIndex(index);
    g.applyMatrix4(mtx);
    o.geometry = g;
    root.add(o); o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.set(1, 1, 1);
  }
}

/**
 * Nasenpads als eigenes Teil mit Silikon-Material abtrennen. Kapitän: im Modell schwarze Klötzchen im Rahmenteil
 * (und die „Transparent“-Hülle liegt über den Gläsern); Ottensen: Teil des Metallrahmens.
 */
function padsAbtrennen(root, mat, rolle, istPad) {
  const meshes = []; root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const role = (o.material.name || '').replace(/\.\d+$/, '');
    if (role === 'pads') { o.removeFromParent(); continue; }
    if (role !== rolle || !o.geometry.index) continue;
    const p = o.geometry.attributes.position, idx = o.geometry.index.array, rest = [], pads = [];
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      const cx = (Math.abs(p.getX(a)) + Math.abs(p.getX(b)) + Math.abs(p.getX(c))) / 3;
      const cy = (p.getY(a) + p.getY(b) + p.getY(c)) / 3, cz = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
      (istPad(cx, cy, cz) ? pads : rest).push(a, b, c);
    }
    if (!pads.length) continue;
    o.geometry.setIndex(rest);
    const g = new THREE.BufferGeometry();
    for (const k in o.geometry.attributes) g.setAttribute(k, o.geometry.attributes[k]);
    g.setIndex(pads);
    root.add(new THREE.Mesh(g, mat));
  }
}

/** Zusammenhängende Einzelteile einer Rolle, die kleiner als `max` cm sind, bekommen das Material `mat`. */
function kleineTeileAbtrennen(root, rolle, max, mat) {
  const meshes = []; root.traverse((o) => { if (o.isMesh && (o.material.name || '').replace(/\.\d+$/, '') === rolle && o.geometry.index) meshes.push(o); });
  for (const o of meshes) {
    const p = o.geometry.attributes.position, idx = o.geometry.index.array;
    // Punkte verbinden (Union-Find), dabei gleiche Positionen zusammenfassen (Nähte)
    // Knoten je Eckpunkt einmal vorab bestimmen (vorher für jeden Index neu als Text gebaut: auf Handys fast 1 s)
    const id = new Map(), par = [], nodeOf = new Int32Array(p.count).fill(-1);
    const knoten = (i) => {
      if (nodeOf[i] >= 0) return nodeOf[i];
      const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      if (!id.has(k)) { id.set(k, par.length); par.push(par.length); }
      return (nodeOf[i] = id.get(k));
    };
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const tri = [];
    for (let i = 0; i < idx.length; i += 3) {
      const a = knoten(idx[i]), b = knoten(idx[i + 1]), c = knoten(idx[i + 2]);
      par[find(a)] = find(b); par[find(b)] = find(c); tri.push(a);
    }
    const box = new Map(), v = new THREE.Vector3();
    for (let i = 0; i < idx.length; i++) {
      const r = find(knoten(idx[i])); const bb = box.get(r) || box.set(r, new THREE.Box3()).get(r);
      bb.expandByPoint(v.set(p.getX(idx[i]), p.getY(idx[i]), p.getZ(idx[i])));
    }
    const klein = new Set([...box].filter(([, bb]) => { const v = bb.getSize(new THREE.Vector3()); return Math.max(v.x, v.y, v.z) < max; }).map(([r]) => r));
    if (!klein.size) continue;
    const rest = [], teile = [];
    for (let t = 0; t < tri.length; t++) (klein.has(find(tri[t])) ? teile : rest).push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
    o.geometry.setIndex(rest);
    const g = new THREE.BufferGeometry();
    for (const k in o.geometry.attributes) g.setAttribute(k, o.geometry.attributes[k]);
    g.setIndex(teile);
    root.add(new THREE.Mesh(g, mat));
  }
}

/**
 * Bügel wie bei einer angepassten Brille aufbiegen: direkt hinter dem Scharnier sanft nach außen,
 * so dass sie auf Ohrhöhe außen am Kopf entlanglaufen (halbe Kopfbreite `halb` in cm), und am Scharnier
 * um ~14° nach unten abwinkeln (gleicht die Vorneigung der Fassung aus und führt sie zum Ohransatz).
 */
const KNICK = Math.tan(14 * Math.PI / 180);
function spreizen(geo, halb) {
  const p = geo.attributes.position;
  const zh = -1.2, L = 2.4, zr = -7;
  let xr = 0;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z < zr + 0.6 && z > zr - 0.6) xr = Math.max(xr, Math.abs(p.getX(i))); }
  if (!xr) return;
  const A = Math.max(0, (halb - xr) / (1 - Math.exp((zr - zh) / L)));
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), x = p.getX(i);
    if (z < zh && Math.abs(x) > 4.5) {
      p.setX(i, x + Math.sign(x) * A * (1 - Math.exp((z - zh) / L)));
      p.setY(i, p.getY(i) + (z - zh) * KNICK);
    }
  }
  p.needsUpdate = true;
  geo.computeBoundingSphere();
}
