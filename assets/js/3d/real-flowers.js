// Echte Blumen für den Strauß-Konfigurator:
//  - Rosen, Pfingstrosen, Tulpen: 3D-Fotoscans echter Blüten (aufbereitet mit tools/blumen/koepfe.py)
//  - Eukalyptus, Schleierkraut, Lavendel: freigestellte Fotos echter Zweige auf gekreuzten Flächen
// Farbvarianten, für die es keinen eigenen Scan gibt, entstehen durch Umfärben der Fototextur
// (Farbton drehen, Sättigung und Helligkeit) – Struktur und Licht des Fotos bleiben erhalten.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = new URL('../../models/blumen/', import.meta.url).href;

// Sorte → Farbe → Scan + Umfärbung (Zielton, Stärke, Aufhellung)
export const REAL = {
  rose: {
    rot: { scan: 'rose-rot' },
    rose: { scan: 'rose-rosa' },
    pfirsich: { scan: 'rose-apricot' },
    creme: { scan: 'rose-apricot', tint: '#f8eedc', amt: 0.85, lift: 1.15, kontrast: 0.55 },
  },
  peony: {
    blush: { scan: 'pfingstrose' },
    weiss: { scan: 'pfingstrose', tint: '#fbf6ee', amt: 0.92, lift: 1.4, kontrast: 0.42 },
    koralle: { scan: 'pfingstrose', tint: '#f7a48f', amt: 0.85, lift: 1.25, kontrast: 0.5 },
  },
  tulip: {
    rot: { scan: 'tulpe' },
    rosa: { scan: 'tulpe', tint: '#f7a9c1', amt: 0.9, lift: 1.3, kontrast: 0.6 },
    weiss: { scan: 'tulpe', tint: '#fbf8ee', amt: 0.95, lift: 1.4, kontrast: 0.5 },
    gelb: { scan: 'tulpe', tint: '#ffe170', amt: 0.92, lift: 1.35, kontrast: 0.6 },
    flieder: { scan: 'tulpe', tint: '#cdb6ec', amt: 0.9, lift: 1.3, kontrast: 0.6 },
  },
};
// Füllgrün: Fotos, Höhe in Strauß-Einheiten
const FILLERS = { eucalyptus: { file: 'eukalyptus', h: 0.62, planes: 2 }, gypsophila: { file: 'schleierkraut', h: 0.58, planes: 3 }, lavender: { file: 'lavendel', h: 0.6, planes: 2 } };

function recolorPatch(mat, { tint, amt = 0.85, lift = 1, kontrast = 0.7 }, meanY = 0.2) {
  if (!tint) return;
  const c = new THREE.Color(tint).convertSRGBToLinear();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.rcTint = { value: new THREE.Vector3(c.r, c.g, c.b) }; sh.uniforms.rcAmt = { value: amt }; sh.uniforms.rcLift = { value: lift }; sh.uniforms.rcMean = { value: meanY }; sh.uniforms.rcK = { value: kontrast };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 rcTint; uniform float rcAmt; uniform float rcLift; uniform float rcMean; uniform float rcK;
        vec3 recolor(vec3 c){
          // Helligkeit und Struktur aus dem Foto, Farbe aus dem Zielton; grüne Kelchblätter bleiben grün
          float Y = dot(c, vec3(0.2126, 0.7152, 0.0722));
          float green = smoothstep(0.02, 0.08, c.g - max(c.r, c.b));
          float tY = dot(rcTint, vec3(0.2126, 0.7152, 0.0722));
          float rel = Y / max(rcMean, 1e-3);                               // Helligkeit relativ zum Durchschnitt des Fotos
          vec3 t = rcTint * clamp(pow(rel, rcK) * rcLift, 0.0, 1.3);
          return mix(c, t, rcAmt * (1.0 - green));
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb = recolor(diffuseColor.rgb);`);
  };
  mat.customProgramCacheKey = () => `rc_${tint}_${amt}_${lift}_${kontrast}`;
}

function cardGeometry(aspect, foot, h, planes) {
  const w = h * aspect;
  const parts = [];
  for (let i = 0; i < planes; i++) {
    const g = new THREE.PlaneGeometry(w, h, 6, 8);
    // Fuß des Zweigs in den Ursprung, leicht nach hinten gewölbt (wirkt räumlicher)
    g.translate((0.5 - foot) * w, h / 2, 0);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k);
      p.setZ(k, -0.18 * (x * x) / Math.max(w, 1e-3) - 0.04 * y * (i % 2 ? 1 : -1));
    }
    g.rotateY((i * Math.PI) / planes + 0.3);
    g.computeVertexNormals();
    parts.push(g);
  }
  return mergeGeometries(parts);
}

let promise = null;
/** Lädt alles einmal; liefert { head(type, colorKey) → {geometry, material} | null }. */
export function loadRealFlowers() {
  if (promise) return promise;
  promise = (async () => {
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const tl = new THREE.TextureLoader();
    const scans = {};
    const names = [...new Set(Object.values(REAL).flatMap((c) => Object.values(c).map((v) => v.scan)))];
    await Promise.all(names.map((n) => new Promise((res, rej) => loader.load(BASE + n + '.glb', (g) => {
      const geos = []; let map = null;
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
        for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
        if (!geo.attributes.normal) geo.computeVertexNormals();
        geos.push(geo);
        map = map || o.material.map;
      });
      if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
      // mittlere (lineare) Helligkeit der Blütenfarbe – Bezug fürs Umfärben
      let meanY = 0.2;
      try {
        const img = map.image, cv = document.createElement('canvas'); cv.width = cv.height = 64;
        const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, 64, 64);
        const d = cx.getImageData(0, 0, 64, 64).data; let s = 0, k = 0;
        const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        for (let i = 0; i < d.length; i += 4) {
          const r = lin(d[i]), g = lin(d[i + 1]), b = lin(d[i + 2]);
          if (g - Math.max(r, b) > 0.03 || r + g + b < 0.01) continue;   // Grün und leere Atlasbereiche nicht mitzählen
          s += 0.2126 * r + 0.7152 * g + 0.0722 * b; k++;
        }
        if (k) meanY = s / k;
      } catch {}
      scans[n] = { geometry: geos.length > 1 ? mergeGeometries(geos) : geos[0], map, meanY };
      res();
    }, undefined, rej))));
    const info = await (await fetch(BASE + 'fueller.json')).json();
    const fillers = {};
    await Promise.all(Object.entries(FILLERS).map(([type, f]) => new Promise((res) => tl.load(BASE + f.file + '.webp', (t) => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const i = info[f.file];
      fillers[type] = {
        geometry: cardGeometry(i.aspect, i.fuss, f.h, f.planes),
        material: new THREE.MeshStandardMaterial({ map: t, alphaTest: type === 'gypsophila' ? 0.35 : 0.5, side: THREE.DoubleSide, roughness: 0.75 }),
        scale: 1,
      };
      res();
    }))));
    const mats = new Map();
    function head(type, color) {
      if (fillers[type]) return fillers[type];
      const variants = REAL[type]; if (!variants) return null;
      const v = variants[color] || Object.values(variants)[0];
      const sc = scans[v.scan]; if (!sc) return null;
      const key = `${type}|${color}`;
      if (!mats.has(key)) {
        // Fotoscans tragen das Licht der Aufnahme schon in sich: wenig zusätzliches Glanzlicht, sanfte Eigenhelligkeit
        const m = new THREE.MeshStandardMaterial({ map: sc.map, roughness: 0.62, side: THREE.DoubleSide });
        recolorPatch(m, v, sc.meanY);
        mats.set(key, m);
      }
      // echte Blüten etwas größer als die gezeichneten: ein gebundener Strauß ist dicht
      return { geometry: sc.geometry, material: mats.get(key), scale: { rose: 1.3, peony: 1.22, tulip: 1.18 }[type] || 1 };
    }
    return { head };
  })();
  return promise;
}
