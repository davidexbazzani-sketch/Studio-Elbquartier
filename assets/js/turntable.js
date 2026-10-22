// 3D-Drehscheibe mit stilisierten Läden.
// Wird erst geladen, wenn der Abschnitt in Sichtweite kommt (siehe main.js).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SHOPS } from './shops.js';
import { mergeStatic } from './3d/merge-static.js';

const yieldToMain = () => new Promise((r) => (window.scheduler?.yield ? scheduler.yield().then(r) : setTimeout(r, 0)));

const TAU = Math.PI * 2;
const STEP = TAU / SHOPS.length;
const RADIUS = 5.4;

// ---------- Materialien & Texturen ----------

const std = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts });

const GOLD = new THREE.MeshStandardMaterial({ color: '#e6c78c', metalness: 1, roughness: 0.2 });
const SILVER = new THREE.MeshStandardMaterial({ color: '#e7e4df', metalness: 1, roughness: 0.16 });
const PORCELAIN = new THREE.MeshPhysicalMaterial({ color: '#fffdf8', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
// Glas: Auf Handys ohne echte Lichtbrechung (transmission). Die braucht pro Bild einen zweiten Durchgang durch
// die ganze Szene und eigene Shader; bei den kleinen Dach-Symbolen ist der Unterschied kaum zu sehen.
const LITE_GLASS = matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
const glass = ({ transmission, opacity = 1, ...opts }) => new THREE.MeshPhysicalMaterial(LITE_GLASS
  ? { ...opts, transparent: true, opacity: Math.min(opacity, 1 - transmission * 0.62), depthWrite: false }
  : { ...opts, transmission, opacity });
const GLASS = glass({
  color: '#ffffff', metalness: 0, roughness: 0.02, transmission: 1, thickness: 0.25, ior: 1.5,
  transparent: true, envMapIntensity: 1.2,
});
const DIAMOND = new THREE.MeshPhysicalMaterial({
  color: '#f4f8ff', metalness: 0.1, roughness: 0, flatShading: true, envMapIntensity: 3.2,
  clearcoat: 1, iridescence: 0.6, iridescenceIOR: 1.8,
});
const GREEN = std('#7f9470', { roughness: 0.6 });

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const stripeTexture = (deep) =>
  canvasTexture(512, 8, (g, w, h) => {
    const n = 10;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? '#fffaf2' : deep;
      g.fillRect((i * w) / n, 0, w / n + 1, h);
    }
  });

const signTexture = (text) =>
  canvasTexture(1024, 224, (g, w, h) => {
    g.fillStyle = '#fffdf9';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f1c18';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 132;
    do {
      g.font = `italic 400 ${size}px "Instrument Serif", Georgia, serif`;
      size -= 4;
    } while (g.measureText(text).width > w * 0.86);
    g.fillText(text, w / 2, h / 2 + 6);
  });

const shadowTexture = () =>
  canvasTexture(256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(60,45,25,0.28)');
    r.addColorStop(0.55, 'rgba(60,45,25,0.10)');
    r.addColorStop(1, 'rgba(60,45,25,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  });

function mesh(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.setScalar(s);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

// ---------- Symbole auf dem Dach ----------

const ICONS = {
  juwelier() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.TorusGeometry(0.4, 0.065, 32, 96), GOLD, { y: 0.48 }));
    // Brillant: Krone + Pavillon
    const stone = mesh(
      lathe([[0, -0.2], [0.2, 0], [0.2, 0.03], [0.12, 0.11], [0, 0.11]], 16),
      DIAMOND, { y: 0.98 }
    );
    g.add(stone);
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.12, 6), GOLD, { y: 0.86 }));
    g.userData.sparkle = stone;
    return g;
  },
  blumen(c) {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0], [0.22, 0], [0.3, 0.42], [0.27, 0.44], [0, 0.44]]), std(c.deep, { roughness: 0.5 }), { y: 0 }));
    const petals = [std('#f2c9be', { roughness: 0.55 }), std('#fbf1ea', { roughness: 0.55 }), std('#e8b3a6', { roughness: 0.55 })];
    const head = lathe([[0, 0], [0.09, 0.03], [0.13, 0.12], [0.12, 0.24], [0.08, 0.22], [0, 0.16]], 24);
    [[-0.17, 0.95, -0.25], [0, 1.1, 0], [0.18, 0.92, 0.25], [0.04, 0.85, -0.05]].forEach(([x, y, rz], i) => {
      const stem = mesh(new THREE.CylinderGeometry(0.018, 0.022, y - 0.3, 8), GREEN, { x: x / 2, y: 0.3 + (y - 0.3) / 2, rz: -rz * 0.5 });
      g.add(stem);
      g.add(mesh(head, petals[i % 3], { x, y, rz: -rz * 0.6 }));
    });
    g.add(mesh(new THREE.SphereGeometry(0.12, 16, 12), GREEN, { x: -0.22, y: 0.55, s: 1 }));
    g.add(mesh(new THREE.SphereGeometry(0.1, 16, 12), GREEN, { x: 0.24, y: 0.6 }));
    return g;
  },
  restaurant() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.05, 64), PORCELAIN, { y: 0.03 }));
    g.add(mesh(new THREE.SphereGeometry(0.44, 64, 32, 0, TAU, 0, Math.PI / 2), SILVER, { y: 0.06 }));
    g.add(mesh(new THREE.SphereGeometry(0.07, 24, 16), SILVER, { y: 0.54 }));
    g.add(mesh(new THREE.TorusGeometry(0.44, 0.018, 12, 64), SILVER, { y: 0.07, rx: Math.PI / 2 }));
    return g;
  },
  cafe(c) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.46, 0.4, 0.05, 64), PORCELAIN, { y: 0.03 }));
    g.add(mesh(lathe([[0, 0.06], [0.2, 0.06], [0.3, 0.2], [0.33, 0.52], [0.3, 0.52], [0.27, 0.22], [0, 0.18]]), PORCELAIN));
    g.add(mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.01, 48), std('#8a5a3c', { roughness: 0.3 }), { y: 0.47 }));
    g.add(mesh(new THREE.CircleGeometry(0.12, 32), std('#f3e2c8', { roughness: 0.6 }), { y: 0.478, rx: -Math.PI / 2 }));
    g.add(mesh(new THREE.TorusGeometry(0.11, 0.028, 12, 32, Math.PI * 1.2), PORCELAIN, { x: 0.33, y: 0.32, rz: -Math.PI * 0.6 }));
    // Dampf
    const steamMat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, roughness: 1 });
    g.userData.steam = [0, 1, 2].map((i) => {
      const p = mesh(new THREE.SphereGeometry(0.06, 16, 12), steamMat.clone(), { x: (i - 1) * 0.1, y: 0.6, shadow: false });
      p.userData.phase = i / 3;
      g.add(p);
      return p;
    });
    void c;
    return g;
  },
  bar() {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0], [0.22, 0], [0.22, 0.02], [0.03, 0.04], [0.025, 0.5], [0.4, 0.92], [0.39, 0.93], [0.025, 0.53], [0, 0.53]], 64), GLASS));
    const liquid = glass({ color: '#f2a7b3', roughness: 0.05, transmission: 0.6, thickness: 0.4, ior: 1.34 });
    g.add(mesh(new THREE.ConeGeometry(0.33, 0.33, 48, 1, false), liquid, { y: 0.69 + 0.165 - 0.165, rx: Math.PI }));
    g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 6), SILVER, { x: 0.05, y: 0.82, rz: 0.5 }));
    g.add(mesh(new THREE.SphereGeometry(0.07, 20, 16), std('#93a35f', { roughness: 0.35 }), { x: -0.02, y: 0.7, s: 1 }));
    return g;
  },
  autohaus(c) {
    // kleiner Sportwagen in Seitenansicht: Karosserie als Profil extrudiert, Scheiben dunkel, vier Räder
    const g = new THREE.Group();
    const body = new THREE.Shape();
    body.moveTo(-0.55, 0.1);
    body.lineTo(0.55, 0.1);
    body.quadraticCurveTo(0.6, 0.12, 0.58, 0.22);
    body.quadraticCurveTo(0.42, 0.29, 0.2, 0.3);
    body.quadraticCurveTo(0.06, 0.46, -0.16, 0.46);
    body.quadraticCurveTo(-0.38, 0.45, -0.5, 0.3);
    body.quadraticCurveTo(-0.6, 0.26, -0.55, 0.1);
    const paint = new THREE.MeshPhysicalMaterial({ color: c.deep, metalness: 0.5, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05 });
    const geo = new THREE.ExtrudeGeometry(body, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 4, curveSegments: 24 });
    geo.translate(0, 0, -0.17);
    g.add(mesh(geo, paint));
    const glass = new THREE.Shape();
    glass.moveTo(0.16, 0.31);
    glass.quadraticCurveTo(0.04, 0.43, -0.15, 0.43);
    glass.quadraticCurveTo(-0.33, 0.42, -0.42, 0.31);
    const glassGeo = new THREE.ExtrudeGeometry(glass, { depth: 0.38, bevelEnabled: false, curveSegments: 16 });
    glassGeo.translate(0, 0, -0.19);
    g.add(mesh(glassGeo, std('#1d2226', { metalness: 0.2, roughness: 0.08 })));
    const tire = std('#1c1c1c', { roughness: 0.85 });
    [[-0.34, 1], [0.34, 1], [-0.34, -1], [0.34, -1]].forEach(([x, z]) => {
      g.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 28), tire, { x, y: 0.11, z: z * 0.2, rx: Math.PI / 2 }));
      g.add(mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.075, 20), SILVER, { x, y: 0.11, z: z * 0.2, rx: Math.PI / 2 }));
    });
    g.scale.setScalar(0.95);
    return g;
  },
  getraenke(c) {
    // FUNKL-Dose mit Funken
    const g = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color: c.deep, metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 48), paint, { y: 0.37 }));
    g.add(mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.07, 48), SILVER, { y: 0.715 }));
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.05, 48), SILVER, { y: 0.045 }));
    g.add(mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 48), std('#ffd23f', { roughness: 0.3 }), { y: 0.5, rx: Math.PI / 2 }));
    const star = new THREE.Shape();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, r = i % 2 ? 0.035 : 0.11; if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(r, 0); }
    g.add(mesh(new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 }), std('#ffd23f', { roughness: 0.25 }), { x: 0.34, y: 0.86, rz: 0.3 }));
    g.rotation.z = -0.12;
    return g;
  },
  immobilien(c) {
    // kleine Stadtvilla mit Flachdach, großen Fenstern und Messing-Sonne
    const g = new THREE.Group();
    const wall = std('#fbf8f2', { roughness: 0.7 });
    const glass = std('#9fb3bb', { metalness: 0.3, roughness: 0.08 });
    const brass = std('#b39463', { metalness: 1, roughness: 0.3 });
    g.add(mesh(new RoundedBoxGeometry(0.78, 0.3, 0.5, 2, 0.02), wall, { y: 0.17 }));
    g.add(mesh(new RoundedBoxGeometry(0.62, 0.26, 0.42, 2, 0.02), wall, { x: -0.06, y: 0.45 }));
    g.add(mesh(new RoundedBoxGeometry(0.9, 0.04, 0.6, 2, 0.01), std(c.deep, { roughness: 0.5 }), { y: 0.33 }));
    g.add(mesh(new RoundedBoxGeometry(0.74, 0.035, 0.52, 2, 0.01), std(c.deep, { roughness: 0.5 }), { x: -0.06, y: 0.595 }));
    g.add(mesh(new THREE.BoxGeometry(0.46, 0.2, 0.01), glass, { x: -0.06, y: 0.16, z: 0.251 }));
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.17, 0.01), glass, { x: -0.06, y: 0.45, z: 0.211 }));
    g.add(mesh(new THREE.TorusGeometry(0.11, 0.012, 10, 40, Math.PI), brass, { x: 0.3, y: 0.72 }));
    return g;
  },
  brillen(c) {
    // runde Brille auf einem kleinen Ständer
    const g = new THREE.Group();
    const frame = std(c.deep, { metalness: 0.3, roughness: 0.3 });
    const lens = glass({ color: '#dfe8ea', roughness: 0.05, transmission: 0.6, thickness: 0.05, ior: 1.5, transparent: true, opacity: 0.6 });
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.TorusGeometry(0.17, 0.022, 12, 48), frame, { x: s * 0.2, y: 0.62 }));
      g.add(mesh(new THREE.CircleGeometry(0.16, 40), lens, { x: s * 0.2, y: 0.62 }));
      g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), frame, { x: s * 0.37, y: 0.64, z: -0.2, rx: Math.PI / 2 }));
    }
    g.add(mesh(new THREE.TorusGeometry(0.035, 0.016, 8, 20, Math.PI), frame, { y: 0.66 }));
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 12), SILVER, { y: 0.23, z: -0.05 }));
    g.add(mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.03, 32), SILVER, { y: 0.015, z: -0.05 }));
    return g;
  },
  boutique(c) {
    const g = new THREE.Group();
    const fabric = new THREE.MeshPhysicalMaterial({ color: '#e9c8be', roughness: 0.8, sheen: 1, sheenColor: '#fff3ee', sheenRoughness: 0.5 });
    g.add(mesh(lathe([[0, 0.02], [0.42, 0.02], [0.36, 0.2], [0.24, 0.5], [0.15, 0.62], [0.17, 0.78], [0.15, 0.88], [0, 0.88]], 64), fabric));
    g.add(mesh(new THREE.TorusGeometry(0.035, 0.01, 8, 24), std(c.deep), { y: 0.62 + 0.0, s: 1, rx: Math.PI / 2 }));
    // Bügel
    const hanger = std('#c9a77a', { roughness: 0.4 });
    g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.56, 8), hanger, { y: 0.9, rz: Math.PI / 2 }));
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), hanger, { x: -0.14, y: 0.98, rz: -1.05 }));
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), hanger, { x: 0.14, y: 0.98, rz: 1.05 }));
    g.add(mesh(new THREE.TorusGeometry(0.06, 0.01, 8, 24, Math.PI * 1.4), SILVER, { y: 1.12, rz: -0.4 }));
    return g;
  },
};

// ---------- Kleine Requisiten vor dem Laden ----------

function planter(x, c) {
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(0.28, 0.24, 0.28, 2, 0.04), std(c.deep, { roughness: 0.6 }), { y: 0.12 }));
  g.add(mesh(new THREE.SphereGeometry(0.2, 20, 16), GREEN, { y: 0.36 }));
  g.position.set(x, 0.12, 0.98);
  return g;
}

function bistro(x, c) {
  const g = new THREE.Group();
  const metal = std('#3a3631', { metalness: 0.6, roughness: 0.4 });
  g.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 32), PORCELAIN, { y: 0.36 }));
  g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 8), metal, { y: 0.18 }));
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 24), metal, { y: 0.006 }));
  [-1, 1].forEach((s) => {
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 24), std(c.deep, { roughness: 0.5 }), { x: s * 0.27, y: 0.22 }));
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), metal, { x: s * 0.27, y: 0.11 }));
  });
  g.position.set(x, 0.12, 1.0);
  return g;
}

function buckets(x) {
  const g = new THREE.Group();
  const zinc = std('#b9bfc0', { metalness: 0.7, roughness: 0.35 });
  const blooms = ['#f2c9be', '#fbf1ea', '#e8b3a6', '#f5dfb0'];
  [-0.2, 0.05, 0.28].forEach((bx, i) => {
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.2, 20), zinc, { x: bx, y: 0.1 }));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + i;
      g.add(mesh(new THREE.SphereGeometry(0.055, 12, 10), std(blooms[(k + i) % 4], { roughness: 0.6 }), {
        x: bx + Math.cos(a) * 0.05, y: 0.27 + (k % 2) * 0.05, z: Math.sin(a) * 0.05,
      }));
    }
  });
  g.position.set(x, 0.12, 1.0);
  return g;
}

// ---------- Laden zusammenbauen ----------

function buildShop(shop, index) {
  const c = shop.colors;
  const root = new THREE.Group();
  root.userData.index = index;

  const lift = new THREE.Group(); // wird beim aktiven Laden leicht angehoben
  root.add(lift);

  const body = std(c.body, { roughness: 0.85 });
  const trim = std(c.trim, { roughness: 0.8 });
  const deep = std(c.deep, { roughness: 0.55 });

  lift.add(mesh(new RoundedBoxGeometry(2.5, 0.12, 1.9, 2, 0.05), trim, { y: 0.06 }));
  lift.add(mesh(new RoundedBoxGeometry(2.1, 1.92, 1.4, 4, 0.07), body, { y: 0.12 + 0.96 }));
  lift.add(mesh(new RoundedBoxGeometry(2.24, 0.14, 1.54, 2, 0.05), trim, { y: 2.08 }));

  // Schaufenster mit warmem Licht
  const frontZ = 0.7;
  lift.add(mesh(new RoundedBoxGeometry(1.14, 0.9, 0.06, 2, 0.02), deep, { x: -0.36, y: 0.86, z: frontZ }));
  const glow = new THREE.MeshPhysicalMaterial({
    color: '#fff6e6', emissive: '#ffe9c4', emissiveIntensity: 0.55, roughness: 0.08, clearcoat: 1,
  });
  lift.add(mesh(new THREE.BoxGeometry(1.04, 0.8, 0.02), glow, { x: -0.36, y: 0.86, z: frontZ + 0.025, shadow: false }));
  lift.add(mesh(new THREE.BoxGeometry(0.02, 0.8, 0.03), deep, { x: -0.36, y: 0.86, z: frontZ + 0.035 }));

  // Rückseite: kleines Fenster, damit die Läden auch von hinten bewohnt wirken
  lift.add(mesh(new RoundedBoxGeometry(0.9, 0.62, 0.06, 2, 0.02), deep, { x: 0, y: 1.05, z: -frontZ }));
  lift.add(mesh(new THREE.BoxGeometry(0.8, 0.52, 0.02), glow, { x: 0, y: 1.05, z: -frontZ - 0.025, shadow: false }));

  // Tür
  lift.add(mesh(new RoundedBoxGeometry(0.5, 1.06, 0.07, 2, 0.02), deep, { x: 0.62, y: 0.12 + 0.53, z: frontZ }));
  lift.add(mesh(new THREE.SphereGeometry(0.03, 12, 10), GOLD, { x: 0.8, y: 0.66, z: frontZ + 0.05 }));
  lift.add(mesh(new THREE.BoxGeometry(0.34, 0.42, 0.02), glow, { x: 0.62, y: 0.9, z: frontZ + 0.035, shadow: false }));

  // Markise
  const stripes = stripeTexture(c.deep);
  const awningMat = std('#ffffff', { map: stripes, roughness: 0.9, side: THREE.DoubleSide });
  lift.add(mesh(new THREE.BoxGeometry(2.14, 0.03, 0.55), awningMat, { y: 1.52, z: frontZ + 0.24, rx: 0.42 }));
  lift.add(mesh(new THREE.BoxGeometry(2.14, 0.12, 0.02), awningMat, { y: 1.36, z: frontZ + 0.49 }));

  // Ladenschild
  lift.add(mesh(new RoundedBoxGeometry(1.62, 0.34, 0.06, 2, 0.02), deep, { y: 1.82, z: frontZ }));
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture(shop.name), roughness: 0.6 });
  lift.add(mesh(new THREE.PlaneGeometry(1.54, 0.28), signMat, { y: 1.82, z: frontZ + 0.032, shadow: false }));

  // Requisiten
  if (shop.id === 'blumen') lift.add(buckets(-0.5));
  else if (shop.id === 'restaurant' || shop.id === 'cafe') lift.add(bistro(-0.38, c));
  else { lift.add(planter(-0.98, c)); lift.add(planter(0.12, c)); }

  // Dachsymbol
  const icon = ICONS[shop.id](c);
  icon.position.y = 2.16;
  lift.add(icon);

  root.userData.lift = lift;
  root.userData.icon = icon;
  return root;
}

// ---------- Öffentliche API ----------

export async function createTurntable({ container, hint, onChange, onOpen, reducedMotion = false }) {
  try { await document.fonts.load('italic 100px "Instrument Serif"'); } catch (_) { /* Fallback-Schrift */ }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const dprCap = window.innerWidth < 768 ? 1.5 : 2; // Handy: etwas weniger Pixel, dafür flüssig
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft gibt es in three r186 nicht mehr (wird beim ersten Bild umgestellt, vorab übersetzte Shader passten dann nicht)
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const lookAt = new THREE.Vector3(0, 1.45, RADIUS - 0.5);

  scene.add(new THREE.HemisphereLight('#fffaf0', '#e9dfcf', 1.1));
  const sun = new THREE.DirectionalLight('#fff4e2', 2.2);
  sun.position.set(-5, 11, RADIUS + 8);
  sun.target.position.set(0, 0, RADIUS - 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 6;
  scene.add(sun, sun.target);

  // Drehscheibe
  const table = new THREE.Group();
  scene.add(table);
  const discR = RADIUS + 1.75;
  table.add(mesh(new THREE.CylinderGeometry(discR, discR, 0.32, 128), std('#f4eee4', { roughness: 0.9 }), { y: -0.16 }));
  table.add(mesh(new THREE.TorusGeometry(discR, 0.028, 12, 160), std('#cdb58f', { metalness: 0.4, roughness: 0.4 }), { y: 0, rx: Math.PI / 2 }));
  table.add(mesh(new THREE.TorusGeometry(RADIUS - 1.6, 0.012, 8, 160), std('#d9ccb6'), { y: 0.002, rx: Math.PI / 2, shadow: false }));

  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(discR * 2.8, discR * 2.8),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -0.34;
  scene.add(blob);

  // Läden einzeln bauen und dazwischen kurz Luft lassen, damit Scrollen auf dem Handy flüssig bleibt.
  // Ruhende Teile werden je Laden zusammengefasst (gemessen: 338 statt 599 Zeichenbefehle pro Bild).
  const shared = new Map();
  const shops = [];
  for (const [i, s] of SHOPS.entries()) {
    const g = buildShop(s, i);
    mergeStatic(g, { shareMaterials: shared });
    const a = i * STEP;
    g.position.set(Math.sin(a) * RADIUS, 0, Math.cos(a) * RADIUS);
    g.rotation.y = a;
    table.add(g);
    shops.push(g);
    await yieldToMain();
  }

  // ---------- Zustand ----------
  let rot = reducedMotion ? 0 : STEP * 1.6; // kleine Einschwing-Drehung beim ersten Sichtbarwerden
  let target = 0;
  let active = 0;
  let hovered = -1;
  let interacted = false;
  let running = false;
  let visible = false;
  let raf = 0;
  let last = performance.now();
  let autoTimer = 0;

  const norm = (i) => ((i % SHOPS.length) + SHOPS.length) % SHOPS.length;
  const indexFor = (r) => norm(Math.round(-r / STEP));
  const snap = () => { target = Math.round(target / STEP) * STEP; };

  function goTo(i) {
    const desired = -i * STEP;
    target = desired + TAU * Math.round((target - desired) / TAU);
    kick();
  }
  const next = () => { target = Math.round(target / STEP) * STEP - STEP; kick(); };
  const prev = () => { target = Math.round(target / STEP) * STEP + STEP; kick(); };

  function markInteracted() { interacted = true; clearInterval(autoTimer); }

  // ---------- Größe ----------
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const dist = 12.5 + Math.max(0, 1.15 - camera.aspect) * 6;
    camera.position.set(0, 3.0 + Math.max(0, 1 - camera.aspect) * 1.2, RADIUS + dist);
    camera.lookAt(lookAt);
    camera.updateProjectionMatrix();
    kick();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // ---------- Eingabe ----------
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function pick(ev) {
    const r = el.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(shops, true)[0];
    if (!hit) return -1;
    let o = hit.object;
    while (o && o.userData.index === undefined) o = o.parent;
    return o ? o.userData.index : -1;
  }

  let drag = null;
  el.addEventListener('pointerdown', (ev) => {
    drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, start: target, moved: 0, axis: null, lastX: ev.clientX, lastT: performance.now(), v: 0 };
  });
  el.addEventListener('pointermove', (ev) => {
    if (drag && drag.id === ev.pointerId) {
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.axis && Math.hypot(dx, dy) > 6) {
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (drag.axis === 'x') { el.setPointerCapture(ev.pointerId); markInteracted(); container.classList.add('is-dragging'); }
      }
      if (drag.axis === 'x') {
        const now = performance.now();
        const per = STEP / Math.max(220, container.clientWidth * 0.32);
        target = drag.start + dx * per;
        const dtMove = now - drag.lastT;
        if (dtMove > 8) {
          drag.v = ((ev.clientX - drag.lastX) * per) / dtMove;
          drag.lastX = ev.clientX; drag.lastT = now;
        }
        kick();
      }
      drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      return;
    }
    if (ev.pointerType === 'mouse') {
      const i = pick(ev);
      if (i !== hovered) { hovered = i; el.style.cursor = i >= 0 ? 'pointer' : 'grab'; kick(); }
    }
  });
  const endDrag = (ev) => {
    if (!drag || drag.id !== ev.pointerId) return;
    const wasDrag = drag.axis === 'x';
    if (wasDrag) {
      // Schwung, begrenzt auf höchstens einen weiteren Laden
      if (performance.now() - drag.lastT < 120) target += THREE.MathUtils.clamp(drag.v * 180, -STEP, STEP);
      snap();
      container.classList.remove('is-dragging');
    } else if (ev.type === 'pointerup' && drag.moved < 8) {
      const i = pick(ev);
      if (i >= 0) {
        markInteracted();
        if (i === active && Math.abs(target - rot) < STEP * 0.25) onOpen?.(i);
        else goTo(i);
      }
    }
    drag = null;
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
  el.addEventListener('pointerleave', () => { if (hovered !== -1) { hovered = -1; kick(); } });

  // Trackpad / Shift+Mausrad: nur horizontale Bewegung, vertikales Scrollen bleibt der Seite
  let wheelTimer = 0;
  el.addEventListener('wheel', (ev) => {
    const dx = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.shiftKey ? ev.deltaY : 0;
    if (!dx) return;
    ev.preventDefault();
    markInteracted();
    target -= dx * 0.0035;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { snap(); kick(); }, 160);
    kick();
  }, { passive: false });

  // ---------- Hinweis "Klick mich" über dem aktiven Laden ----------
  const tmp = new THREE.Vector3();
  function placeHint() {
    if (!hint) return;
    const s = shops[active];
    s.userData.icon.getWorldPosition(tmp);
    tmp.y += 1.45;
    tmp.project(camera);
    const settled = Math.abs(target - rot) < 0.02 && !drag?.axis;
    hint.style.transform = `translate3d(${(tmp.x * 0.5 + 0.5) * container.clientWidth}px, ${(-tmp.y * 0.5 + 0.5) * container.clientHeight}px, 0) translate(-50%, -100%)`;
    hint.classList.toggle('is-visible', settled);
  }

  // ---------- Schleife ----------
  const clock = { t: 0 };
  function frame(now) {
    // Während gescrollt wird, nicht zeichnen: Die Grafikkarte gehört dann dem Scrollen (vor allem auf Handys).
    // Sobald das Scrollen ruht, geht es weiter (kick unten).
    if (scrolling && !drag) { running = false; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock.t += dt;

    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * (drag?.axis ? 18 : 5.5));
    rot += (target - rot) * k;
    table.rotation.y = rot;

    const idx = indexFor(rot);
    if (idx !== active) { active = idx; onChange?.(active); }

    let busy = Math.abs(target - rot) > 0.0005;
    shops.forEach((s, i) => {
      const lift = s.userData.lift;
      const goal = i === active ? 0.12 : i === hovered ? 0.06 : 0;
      lift.position.y += (goal - lift.position.y) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 8));
      if (Math.abs(goal - lift.position.y) > 0.001) busy = true;
      const icon = s.userData.icon;
      if (!reducedMotion) {
        icon.rotation.y = clock.t * 0.6 + i;
        icon.position.y = 2.16 + Math.sin(clock.t * 1.4 + i) * 0.04;
        if (icon.userData.steam) icon.userData.steam.forEach((p) => {
          const f = (clock.t * 0.35 + p.userData.phase) % 1;
          p.position.y = 0.55 + f * 0.6;
          p.scale.setScalar(0.6 + f * 1.1);
          p.material.opacity = 0.45 * Math.sin(f * Math.PI);
        });
      }
    });

    renderer.render(scene, camera);
    placeHint();

    // Kontinuierlich rendern, solange sichtbar und animiert (Symbole schweben); sonst pausieren
    if (visible && (!reducedMotion || busy)) raf = requestAnimationFrame(frame);
    else running = false;
  }

  let scrolling = false, scrollRest = 0;
  addEventListener('scroll', () => {
    scrolling = true;
    clearTimeout(scrollRest);
    scrollRest = setTimeout(() => { scrolling = false; kick(); }, 140);
  }, { passive: true });

  function kick() {
    if (running || !visible) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // Shader vorab im Hintergrund übersetzen; sonst blockiert das erste Bild auf Handys mehrere Sekunden
  try { await renderer.compileAsync(scene, camera); } catch (_) { /* dann eben beim ersten Bild */ }

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && document.visibilityState === 'visible';
    if (visible) kick();
  }, { threshold: 0.05 });
  io.observe(container);
  document.addEventListener('visibilitychange', () => {
    visible = document.visibilityState === 'visible' && container.getBoundingClientRect().bottom > 0;
    if (visible) kick();
  });

  // Sanftes automatisches Weiterdrehen, bis jemand selbst dreht
  if (!reducedMotion) {
    autoTimer = setInterval(() => { if (visible && !interacted && !drag) next(); }, 4200);
  }

  resize();
  onChange?.(active);

  return {
    next: () => { markInteracted(); next(); },
    prev: () => { markInteracted(); prev(); },
    goTo: (i) => { markInteracted(); goTo(i); },
    get active() { return active; },
    dispose() {
      cancelAnimationFrame(raf); clearInterval(autoTimer);
      io.disconnect(); ro.disconnect();
      renderer.dispose(); pmrem.dispose();
      el.remove();
    },
  };
}
