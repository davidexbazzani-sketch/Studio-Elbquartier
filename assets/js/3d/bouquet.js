// Gebundener Strauß in 3D: Blüten auf Kuppel, Stiele in Spiraltechnik,
// Papier (Kraft oder Seidenpapier) und Satinband mit Schleife.
// Änderungen werden weich animiert: neue Stiele wachsen aus dem Bindepunkt,
// entfernte ziehen sich zurück, der Rest ordnet sich neu.

import * as THREE from 'three';
import { flowerGeometry, FLOWER_TYPES, createFlowerMaterial } from './flowers.js';
import { layoutBouquet, hash } from '../bouquet-layout.js';

const { lerp, smoothstep } = THREE.MathUtils;
const UP = new THREE.Vector3(0, 1, 0);

// ---------- Papier ----------

function kraftTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#c69d74';
  g.fillRect(0, 0, 512, 512);
  // Wolkiges Muster
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 30 + Math.random() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const light = Math.random() > 0.5;
    grd.addColorStop(0, light ? 'rgba(232,201,160,0.22)' : 'rgba(150,108,70,0.16)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Fasern
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, l = 3 + Math.random() * 10, a = Math.random() * Math.PI;
    g.strokeStyle = Math.random() > 0.5 ? 'rgba(240,215,180,0.35)' : 'rgba(120,85,55,0.25)';
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const APEX_Y = -0.55;
const CONE = 0.5; // Radius pro Höhe
const HEAD_SCALE = 1.5; // Blütengröße im Verhältnis zum Strauß
const paperRadius = (y) => (y - APEX_Y) * CONE;

function paperSheet({ az0, az1, yTop, yBottom = -0.34, flare = 0.14, seed = 1, seg = 44, segY = 18 }) {
  const pos = [], uv = [];
  for (let j = 0; j <= segY; j++) {
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, h = j / segY;
      const a = lerp(az0, az1, u);
      const top = yTop + 0.06 * Math.sin(3 * a + seed) + 0.025 * Math.sin(7 * a + seed * 2);
      const y = lerp(yBottom, top, h);
      let r = paperRadius(y) + flare * Math.pow(smoothstep(h, 0.62, 1), 2);
      r += 0.012 * Math.sin(a * 23 + h * 11 + seed) * Math.sin(h * 7 + a * 5); // Knitter
      pos.push(r * Math.cos(a), y, r * Math.sin(a));
      uv.push(u * (az1 - az0) * 0.7, h);
    }
  }
  const idx = [];
  for (let j = 0; j < segY; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function createPaper() {
  const tex = kraftTexture();
  const mats = {
    kraft: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide }),
    creme: new THREE.MeshStandardMaterial({ color: '#f4ece0', roughness: 0.85, side: THREE.DoubleSide }),
    rose: new THREE.MeshStandardMaterial({ color: '#efd2cb', roughness: 0.85, side: THREE.DoubleSide }),
  };
  const group = new THREE.Group();
  const front = new THREE.Mesh(paperSheet({ az0: Math.PI / 2 - 1.3, az1: Math.PI / 2 + 1.3, yTop: 0.26, flare: 0.12, seed: 2 }), mats.kraft);
  const back = new THREE.Mesh(paperSheet({ az0: Math.PI / 2 + 0.85, az1: Math.PI / 2 + Math.PI * 2 - 0.85, yTop: 0.5, flare: 0.16, seed: 5 }), mats.kraft);
  group.add(back, front);
  for (const m of [back, front]) { m.castShadow = true; m.receiveShadow = true; }
  return {
    group,
    setStyle(key) {
      const m = mats[key] || mats.kraft;
      front.material = back.material = m;
    },
  };
}

// ---------- Satinband mit Schleife ----------

function strip(points, width, widthDir) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const n = 40, pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPoint(i / n);
    const w = typeof widthDir === 'function' ? widthDir(i / n) : widthDir;
    pos.push(p.x - w.x * width / 2, p.y - w.y * width / 2, p.z - w.z * width / 2);
    pos.push(p.x + w.x * width / 2, p.y + w.y * width / 2, p.z + w.z * width / 2);
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function createRibbon() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#8fa387', roughness: 0.38, sheen: 1, sheenRoughness: 0.3, sheenColor: new THREE.Color('#ffffff'),
    side: THREE.DoubleSide,
  });
  const group = new THREE.Group();
  const y = -0.12;
  const rb = paperRadius(y) + 0.008;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(rb, rb * 0.97, 0.055, 64, 1, true), mat);
  band.position.y = y;
  group.add(band);
  const c = new THREE.Vector3(0, y, rb + 0.012);
  const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0);
  const V = (x, yy, z) => c.clone().add(new THREE.Vector3(x, yy, z));
  // zwei Schlaufen
  for (const s of [-1, 1]) {
    group.add(new THREE.Mesh(strip([V(0, 0, 0), V(s * 0.08, 0.07, 0.03), V(s * 0.19, 0.035, 0.05), V(s * 0.17, -0.05, 0.04), V(s * 0.06, -0.025, 0.02), V(0, 0, 0)], 0.05, Z), mat));
    // Enden
    group.add(new THREE.Mesh(strip([V(0, -0.01, 0.01), V(s * 0.05, -0.12, 0.05), V(s * 0.03, -0.24, 0.07), V(s * 0.08, -0.36, 0.06)], 0.045,
      (u) => X.clone().multiplyScalar(Math.cos(u * 1.2)).add(Z.clone().multiplyScalar(Math.sin(u * 1.2) * s * 0.4)).normalize()), mat));
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), mat);
  knot.scale.set(1.1, 0.9, 0.7);
  knot.position.copy(c).add(new THREE.Vector3(0, 0, 0.012));
  group.add(knot);
  const colors = { salbei: '#8fa387', rose: '#dca59d', creme: '#eee2cf', bordeaux: '#7c2a3a' };
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group, setColor: (key) => mat.color.set(colors[key] || colors.salbei) };
}

function blobShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(60,50,35,0.32)');
  r.addColorStop(0.5, 'rgba(60,50,35,0.12)');
  r.addColorStop(1, 'rgba(60,50,35,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.92;
  m.scale.set(1.3, 1.0, 1);
  return m;
}

// ---------- Strauß ----------

export function createBouquet({ reducedMotion = false, real = null } = {}) {
  const group = new THREE.Group();
  const flowerMat = createFlowerMaterial();
  // Stiel: unten dunkler (im Papier), oben frischer
  const stemMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const stemGeo = new THREE.CylinderGeometry(1, 1, 1, 7, 6, true);
  stemGeo.translate(0, 0.5, 0);
  {
    const p = stemGeo.attributes.position, c = new Float32Array(p.count * 3);
    const lo = new THREE.Color('#4d6a3b'), hi = new THREE.Color('#82a063'), t = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      t.copy(lo).lerp(hi, smoothstep(p.getY(i), 0.15, 0.95));
      c.set([t.r, t.g, t.b], i * 3);
    }
    stemGeo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const paper = createPaper();
  const ribbon = createRibbon();
  group.add(paper.group, ribbon.group, blobShadow());

  const items = new Map();
  const tmpQ = new THREE.Quaternion();
  const paperScale = { cur: 0.8, target: 0.8 };

  function set({ stems, paperStyle = 'kraft', ribbonColor = 'salbei' }) {
    paper.setStyle(paperStyle);
    ribbon.setColor(ribbonColor);
    const ids = new Set(stems.map((s) => s.id));
    for (const s of stems) {
      if (items.has(s.id) && items.get(s.id).key !== s.key) { // Farbe gewechselt: neu aufbauen
        const old = items.get(s.id);
        group.remove(old.head, old.stem);
        items.delete(s.id);
      }
      if (items.has(s.id)) { items.get(s.id).alive = true; continue; }
      const variant = Math.floor(hash(s.id + 'v') * 3);
      // echte Blüte (Fotoscan bzw. Foto), sonst gezeichnete Ersatzblüte
      const r = real?.head(s.type, (s.key || '').split(':')[1] || '');
      const head = r ? new THREE.Mesh(r.geometry, r.material) : new THREE.Mesh(flowerGeometry(s.type, s.palette, variant), flowerMat);
      const stem = new THREE.Mesh(stemGeo, stemMat);
      head.castShadow = head.receiveShadow = true;
      stem.castShadow = stem.receiveShadow = true;
      head.scale.setScalar(0.001);
      group.add(stem, head);
      items.set(s.id, {
        id: s.id, key: s.key, type: s.type, head, stem, alive: true,
        pos: new THREE.Vector3(0, 0.05, 0), quat: new THREE.Quaternion(), scale: 0,
        tPos: new THREE.Vector3(), tQuat: new THREE.Quaternion(), tScale: 1,
        offset: new THREE.Vector3((hash(s.id + 'x') - 0.5) * 0.05, (hash(s.id + 'y') - 0.5) * 0.03, (hash(s.id + 'z') - 0.5) * 0.05),
        radius: FLOWER_TYPES[s.type].stem, headScale: r?.scale || 1,
      });
    }
    for (const it of items.values()) {
      if (!ids.has(it.id)) { it.alive = false; it.tScale = 0; it.tPos.multiplyScalar(0.3); }
    }
    const { slots, cap } = layoutBouquet(stems);
    for (const [id, sl] of slots) {
      const it = items.get(id);
      const dir = new THREE.Vector3(...sl.dir);
      it.tPos.copy(dir).multiplyScalar(sl.reach);
      it.tQuat.setFromUnitVectors(UP, dir).multiply(tmpQ.setFromAxisAngle(UP, sl.spin));
      it.tScale = 1;
    }
    paperScale.target = 0.78 + (cap - 0.4) * 0.55;
    if (reducedMotion) update(1, true);
    return { cap };
  }

  const H = new THREE.Vector3(), E = new THREE.Vector3(), D = new THREE.Vector3();
  function update(dt, instant = false) {
    const k = instant ? 1 : 1 - Math.exp(-dt * 5);
    let busy = false;
    for (const it of [...items.values()]) {
      it.pos.lerp(it.tPos, k);
      it.quat.slerp(it.tQuat, k);
      it.scale += (it.tScale - it.scale) * k;
      if (Math.abs(it.scale - it.tScale) > 0.002 || it.pos.distanceToSquared(it.tPos) > 1e-6) busy = true;
      if (!it.alive && it.scale < 0.02) {
        group.remove(it.head, it.stem);
        items.delete(it.id);
        continue;
      }
      const s = Math.max(it.scale, 0.001);
      it.head.position.copy(it.pos);
      it.head.quaternion.copy(it.quat);
      it.head.scale.setScalar(s * HEAD_SCALE * it.headScale);
      // Stiel: durch den Bindepunkt hindurch nach unten
      H.copy(it.pos);
      E.copy(it.pos).multiplyScalar(-0.82).add(it.offset);
      D.subVectors(H, E);
      const len = D.length();
      it.stem.position.copy(E);
      it.stem.quaternion.setFromUnitVectors(UP, D.normalize());
      it.stem.scale.set(it.radius * s, len, it.radius * s);
    }
    paperScale.cur += (paperScale.target - paperScale.cur) * k;
    if (Math.abs(paperScale.target - paperScale.cur) > 0.001) busy = true;
    paper.group.scale.set(paperScale.cur, 1, paperScale.cur);
    ribbon.group.scale.set(paperScale.cur, 1, paperScale.cur);
    return busy;
  }

  return { group, set, update, get count() { return [...items.values()].filter((i) => i.alive).length; } };
}
