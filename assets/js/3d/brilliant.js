// Brillantschliff als echte Geometrie: 57 Facetten + facettierte Rundiste.
// Die Facetten werden wie beim Schleifer über Winkel definiert und als Ebenen
// aus einem Block "herausgeschnitten". Dieselben Ebenen nutzt der Diamant-Shader,
// um Lichtwege im Stein exakt zu verfolgen.

import * as THREE from 'three';

const V = THREE.Vector3;
const DEG = Math.PI / 180;

// Proportionen eines sehr gut geschliffenen Brillanten (Durchmesser = 1)
export const IDEAL_CUT = {
  crownAngle: 34.5,     // Kronenwinkel
  pavilionAngle: 40.75, // Pavillonwinkel
  tableRadius: 0.3,     // Tafel (Eckradius) ≈ 57 % Tafelgröße
  girdle: 0.013,        // halbe Rundistendicke
  starLength: 0.5,      // Sternfacetten reichen 50 % zur Rundiste
  lowerHalf: 0.77,      // untere Rundistenfacetten 77 %
  girdleFacets: 64,
};

function planeFrom3(a, b, c, kind) {
  const n = new V().subVectors(b, a).cross(new V().subVectors(c, a)).normalize();
  let d = n.dot(a);
  if (d < 0) { n.negate(); d = -d; } // Normale zeigt nach außen (Mittelpunkt liegt innen)
  return { n, d, kind };
}

const polar = (r, a, y) => new V(r * Math.cos(a), y, r * Math.sin(a));

export function brilliantPlanes(p = IDEAL_CUT) {
  const r = 0.5;
  const gt = p.girdle;
  const ca = p.crownAngle * DEG;
  const pa = p.pavilionAngle * DEG;
  const planes = [];

  const tableY = gt + (r - p.tableRadius) * Math.tan(ca);
  planes.push({ n: new V(0, 1, 0), d: tableY, kind: 'table' });

  const apothem = p.tableRadius * Math.cos(22.5 * DEG);
  const starR = apothem + p.starLength * (r - apothem);
  const starY = gt + (r - starR * Math.cos(22.5 * DEG)) * Math.tan(ca);
  const lowR = r * (1 - p.lowerHalf);
  const lowY = -gt - (r - lowR * Math.cos(22.5 * DEG)) * Math.tan(pa);

  for (let k = 0; k < 8; k++) {
    const a0 = k * 45 * DEG, a1 = (k + 1) * 45 * DEG, am = (k + 0.5) * 45 * DEG;

    // Krone
    planes.push({
      n: new V(Math.sin(ca) * Math.cos(a0), Math.cos(ca), Math.sin(ca) * Math.sin(a0)),
      d: r * Math.sin(ca) + gt * Math.cos(ca),
      kind: 'bezel',
    });
    const star = polar(starR, am, starY);
    planes.push(planeFrom3(polar(p.tableRadius, a0, tableY), polar(p.tableRadius, a1, tableY), star, 'star'));
    planes.push(planeFrom3(star, polar(r, a0, gt), polar(r, am, gt), 'upperGirdle'));
    planes.push(planeFrom3(star, polar(r, am, gt), polar(r, a1, gt), 'upperGirdle'));

    // Pavillon
    planes.push({
      n: new V(Math.sin(pa) * Math.cos(a0), -Math.cos(pa), Math.sin(pa) * Math.sin(a0)),
      d: r * Math.sin(pa) + gt * Math.cos(pa),
      kind: 'main',
    });
    const low = polar(lowR, am, lowY);
    planes.push(planeFrom3(low, polar(r, a0, -gt), polar(r, am, -gt), 'lowerGirdle'));
    planes.push(planeFrom3(low, polar(r, am, -gt), polar(r, a1, -gt), 'lowerGirdle'));
  }

  // Rundiste: Tangentialebenen an den Zylinder
  for (let i = 0; i < p.girdleFacets; i++) {
    const a = ((i + 0.5) / p.girdleFacets) * Math.PI * 2;
    planes.push({ n: new V(Math.cos(a), 0, Math.sin(a)), d: r, kind: 'girdle' });
  }

  return {
    planes,
    radius: r,
    tableY,
    culetY: -(r * Math.tan(pa) + gt),
  };
}

// ---------- konvexes Polyeder durch Ebenen-Schnitte ----------

const EPS = 1e-9;

function clipPolyhedron(faces, plane) {
  const { n, d } = plane;
  const out = [];
  const cap = [];
  for (const face of faces) {
    const verts = face.verts;
    const res = [];
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i], b = verts[(i + 1) % verts.length];
      const da = n.dot(a) - d, db = n.dot(b) - d;
      if (da <= EPS) res.push(a);
      if (Math.abs(da) <= EPS) cap.push(a);
      if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) {
        const p = a.clone().lerp(b, da / (da - db));
        res.push(p);
        cap.push(p);
      }
    }
    if (res.length >= 3) out.push({ plane: face.plane, verts: res });
  }

  // Deckfläche aus den Schnittpunkten
  const uniq = [];
  for (const p of cap) if (!uniq.some((q) => q.distanceToSquared(p) < 1e-14)) uniq.push(p);
  if (uniq.length >= 3) {
    const c = uniq.reduce((s, p) => s.add(p), new V()).multiplyScalar(1 / uniq.length);
    const u = new V().subVectors(uniq[0], c).normalize();
    const w = new V().crossVectors(n, u);
    uniq.sort((p, q) => {
      const ap = Math.atan2(new V().subVectors(p, c).dot(w), new V().subVectors(p, c).dot(u));
      const aq = Math.atan2(new V().subVectors(q, c).dot(w), new V().subVectors(q, c).dot(u));
      return ap - aq;
    });
    out.push({ plane, verts: uniq });
  }
  return out;
}

function boxFaces(s) {
  const P = (x, y, z) => new V(x * s, y * s, z * s);
  const quad = (n, d, vs) => ({ plane: { n, d: d * s, kind: 'box' }, verts: vs });
  return [
    quad(new V(1, 0, 0), 1, [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)]),
    quad(new V(-1, 0, 0), 1, [P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), P(-1, -1, -1)]),
    quad(new V(0, 1, 0), 1, [P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1)]),
    quad(new V(0, -1, 0), 1, [P(-1, -1, 1), P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1)]),
    quad(new V(0, 0, 1), 1, [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)]),
    quad(new V(0, 0, -1), 1, [P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1)]),
  ];
}

const cache = new Map();

/**
 * Liefert { geometry, planes (Float32Array vec4, ohne Rundiste), girdleRadius, stats }.
 * Die Geometrie hat flache Facetten-Normalen, Durchmesser 1, Rundiste bei y≈0.
 */
export function createBrilliant(params = IDEAL_CUT) {
  const key = JSON.stringify(params);
  if (cache.has(key)) return cache.get(key);

  const { planes, radius, tableY, culetY } = brilliantPlanes(params);
  let faces = boxFaces(2);
  for (const pl of planes) faces = clipPolyhedron(faces, pl);

  const pos = [], nor = [];
  const stats = {};
  for (const f of faces) {
    const { n, kind } = f.plane;
    stats[kind] = (stats[kind] || 0) + 1;
    // nach außen orientieren (Windung prüfen)
    const v = f.verts;
    for (let i = 1; i < v.length - 1; i++) {
      const a = v[0], b = v[i], c = v[i + 1];
      const tri = new V().subVectors(b, a).cross(new V().subVectors(c, a));
      if (tri.lengthSq() < 1e-16) continue;
      const order = tri.dot(n) >= 0 ? [a, b, c] : [a, c, b];
      for (const p of order) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  const inner = planes.filter((p) => p.kind !== 'girdle');
  const packed = new Float32Array(inner.length * 4);
  inner.forEach((p, i) => packed.set([p.n.x, p.n.y, p.n.z, p.d], i * 4));

  const result = { geometry, planes: packed, planeCount: inner.length, girdleRadius: radius, tableY, culetY, stats };
  cache.set(key, result);
  return result;
}
