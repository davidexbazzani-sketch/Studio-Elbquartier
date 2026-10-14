// Schmuckstücke als 3D-Modelle, komplett im Code gebaut.
// Einheiten: Ringinnenradius = 1 (≈ 8,6 mm bei Ringgröße 54).

import * as THREE from 'three';
import { createBrilliant } from './brilliant.js';
import { createDiamondMaterial } from './diamond-material.js';

const TAU = Math.PI * 2;
const V = THREE.Vector3;
const { smoothstep, lerp } = THREE.MathUtils;

// ---------- Materialien ----------

export const METALS = {
  gelbgold: { label: 'Gelbgold', rgb: [1.0, 0.72, 0.34], roughness: 0.12 },
  weissgold: { label: 'Weißgold', rgb: [0.86, 0.86, 0.85], roughness: 0.1 },
  rosegold: { label: 'Roségold', rgb: [0.96, 0.6, 0.47], roughness: 0.12 },
};

export function createMaterials(envRaw, { bounces = 5 } = {}) {
  const cut = createBrilliant();
  const metal = new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.12, envMapIntensity: 1 });
  const metalDS = metal.clone(); // für offene Formen (Zarge), sonst identisch
  metalDS.side = THREE.DoubleSide;
  const setMetal = (key) => {
    const def = METALS[key] || METALS.gelbgold;
    for (const m of [metal, metalDS]) {
      m.color.setRGB(...def.rgb, THREE.LinearSRGBColorSpace);
      m.roughness = def.roughness;
    }
  };
  setMetal('gelbgold');

  const diamond = createDiamondMaterial({ envMap: envRaw, cut, bounces });
  const sapphire = createDiamondMaterial({
    envMap: envRaw, cut, bounces, ior: 1.77, spread: 0.006, intensity: 1.05, contrast: 1.1,
    body: [0.05, 0.16, 0.72], absorb: 3.2,
  });
  // gleiche Drehung wie scene.environmentRotation (three.js negiert den Winkel intern)
  const setEnvRotation = (a) => {
    for (const m of [diamond, sapphire]) m.uniforms.uEnvRot.value.set(Math.cos(-a), Math.sin(-a));
  };

  // feste Metalle (z. B. drei Trauringe in drei Goldfarben in einer Szene)
  const fixed = {};
  const metalOf = (key) => {
    if (!fixed[key]) {
      const def = METALS[key];
      fixed[key] = metal.clone();
      fixed[key].color.setRGB(...def.rgb, THREE.LinearSRGBColorSpace);
      fixed[key].roughness = def.roughness;
    }
    return fixed[key];
  };

  return {
    cut,
    metal,
    metalDS,
    metalOf,
    setMetal,
    setEnvRotation,
    diamond,
    sapphire,
    pearl: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color().setRGB(0.62, 0.58, 0.54, THREE.LinearSRGBColorSpace),
      roughness: 0.16, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.03,
      iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [320, 640],
      sheen: 0.7, sheenRoughness: 0.3, sheenColor: new THREE.Color('#f0cfc8'),
      envMapIntensity: 0.9,
    }),
  };
}

// ---------- Geometrie-Helfer ----------

const mesh = (geo, mat) => new THREE.Mesh(geo, mat);
const angDist = (th) => Math.min(th, TAU - th); // Abstand zur Ringoberseite

/** Ringschiene: Profil wird um die Z-Achse geführt, Kopf oben (+Y). */
function bandGeometry({
  inner = 1, thickness = () => 0.15, width = () => 0.2,
  outerRound = 0.75, innerRound = 0.45, sideRound = 0.45, segments = 256, profile = 32,
}) {
  const S = segments, P = profile;
  const pos = new Float32Array(S * P * 3);
  let o = 0;
  for (let i = 0; i < S; i++) {
    const th = (i / S) * TAU;
    const t = thickness(th), w = width(th);
    const sx = Math.sin(th), cy = Math.cos(th);
    for (let j = 0; j < P; j++) {
      const s = (j / P) * TAU;
      const c = Math.cos(s), sn = Math.sin(s);
      const rx = Math.sign(c) * Math.pow(Math.abs(c), c > 0 ? outerRound : innerRound);
      const ry = Math.sign(sn) * Math.pow(Math.abs(sn), sideRound);
      const rr = inner + t * (0.5 + 0.5 * rx);
      pos[o++] = sx * rr; pos[o++] = cy * rr; pos[o++] = ry * w * 0.5;
    }
  }
  const idx = [];
  for (let i = 0; i < S; i++) {
    for (let j = 0; j < P; j++) {
      const a = i * P + j, b = ((i + 1) % S) * P + j;
      const c = ((i + 1) % S) * P + ((j + 1) % P), d = i * P + ((j + 1) % P);
      idx.push(a, d, b, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rohr mit veränderlichem Radius (für Krappen). */
function taperedTube(points, radius, taper = () => 1, segs = 40, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  const pos = geo.attributes.position;
  const c = new V();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    const k = taper(i / segs);
    for (let j = 0; j <= radial; j++) {
      const n = i * (radial + 1) + j;
      pos.setXYZ(n, c.x + (pos.getX(n) - c.x) * k, c.y + (pos.getY(n) - c.y) * k, c.z + (pos.getZ(n) - c.z) * k);
    }
  }
  pos.needsUpdate = true;
  return { geo, curve };
}

function stone(mat, cut, diameter, position, axis = new V(0, 1, 0), spin = 0) {
  const m = mesh(cut.geometry, mat);
  m.scale.setScalar(diameter);
  m.position.copy(position);
  m.quaternion.setFromUnitVectors(new V(0, 1, 0), axis.clone().normalize());
  m.rotateY(spin);
  return m;
}

/**
 * Krappenfassung für einen Stein mit Rundiste bei y = yg (Achse +Y).
 * base(dir) liefert den Fußpunkt jeder Krappe.
 */
function prongSetting(group, metal, { ds, yg, count, base, radius = 0.04, rails = true, offset = 0.5 }) {
  const rs = ds / 2;
  for (let i = 0; i < count; i++) {
    const a = ((i + offset) / count) * TAU;
    const dir = new V(Math.cos(a), 0, Math.sin(a));
    const at = (k, y) => dir.clone().multiplyScalar(k).setY(y);
    const pts = [
      base(dir),
      at(rs * 0.58, yg - 0.3 * ds),
      at(rs + radius * 0.9, yg - 0.1 * ds),
      at(rs + radius * 0.55, yg + 0.035 * ds),
      at(rs * 0.86, yg + 0.1 * ds),
    ];
    const { geo } = taperedTube(pts, radius, (u) => lerp(1.08, 0.78, smoothstep(u, 0, 1)));
    group.add(mesh(geo, metal));
    const tip = mesh(new THREE.SphereGeometry(radius * 0.86, 20, 14), metal);
    tip.position.copy(pts[4]);
    tip.scale.set(1, 0.8, 1);
    group.add(tip);
  }
  if (rails) {
    const rail = mesh(new THREE.TorusGeometry(rs * 0.9, radius * 0.62, 12, 96), metal);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = yg - 0.17 * ds;
    group.add(rail);
    const low = mesh(new THREE.TorusGeometry(rs * 0.6, radius * 0.5, 10, 72), metal);
    low.rotation.x = Math.PI / 2;
    low.position.y = yg - 0.31 * ds;
    group.add(low);
  }
}

// ---------- Schmuckstücke ----------

/** Solitärring „Elbe“ – 6 Krappen, Brillant ca. 1 ct. */
function solitaire(mat) {
  const g = new THREE.Group();
  const inner = 1, t = 0.15;
  const width = (th) => lerp(0.13, 0.21, smoothstep(angDist(th), 0.15, 1.5));
  g.add(mesh(bandGeometry({ inner, thickness: () => t, width }), mat.metal));

  const rOut = inner + t;
  const ds = 0.8;
  const yg = rOut + -mat.cut.culetY * ds + 0.03;
  g.add(stone(mat.diamond, mat.cut, ds, new V(0, yg, 0), undefined, 0.2));
  prongSetting(g, mat.metal, {
    ds, yg, count: 6, radius: 0.036,
    base: (dir) => {
      const x = 0.24 * dir.x, z = 0.045 * dir.z;
      return new V(x, Math.sqrt(rOut * rOut - x * x) - 0.05, z);
    },
  });
  return {
    group: g,
    focus: new V(0, yg + 0.02, 0),
    shadow: { y: -rOut, sx: 1.9, sz: 0.55 },
    view: { yaw: -0.55, pitch: 0.2 },
  };
}

/** Memoire-Ring „Speicherstadt“ – rundum Brillanten. */
function eternity(mat) {
  const g = new THREE.Group();
  const inner = 1, t = 0.13, w = 0.3;
  g.add(mesh(bandGeometry({ inner, thickness: () => t, width: () => w, outerRound: 0.5 }), mat.metal));
  const rOut = inner + t;
  const n = 24;
  const ds = ((TAU * rOut) / n) * 0.86;
  const stones = new THREE.InstancedMesh(mat.cut.geometry, mat.diamond, n);
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.034, 16, 12), mat.metal, n * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V(ds, ds, ds), one = new V(1, 1, 1);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU;
    const radial = new V(Math.sin(th), Math.cos(th), 0);
    q.setFromUnitVectors(new V(0, 1, 0), radial);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new V(0, 1, 0), i * 0.7));
    stones.setMatrixAt(i, m4.compose(radial.clone().multiplyScalar(rOut + 0.012), q, s));
    const tb = th + Math.PI / n;
    const rb = new V(Math.sin(tb), Math.cos(tb), 0).multiplyScalar(rOut + 0.022);
    beads.setMatrixAt(i * 2, m4.compose(rb.clone().setZ(w * 0.36), q, one));
    beads.setMatrixAt(i * 2 + 1, m4.compose(rb.clone().setZ(-w * 0.36), q, one));
  }
  g.add(stones, beads);
  return {
    group: g,
    focus: new V(0, rOut, 0),
    shadow: { y: -rOut, sx: 1.9, sz: 0.6 },
    view: { yaw: -0.6, pitch: 0.24 },
  };
}

function stud(mat, ds) {
  const g = new THREE.Group();
  const yg = 0;
  g.add(stone(mat.diamond, mat.cut, ds, new V(0, yg, 0), undefined, 0.35));
  const rs = ds / 2;
  prongSetting(g, mat.metal, {
    ds, yg, count: 4, radius: 0.045, offset: 0,
    base: (dir) => dir.clone().multiplyScalar(rs * 0.28).setY(yg - 0.5 * ds),
  });
  const cup = mesh(new THREE.CylinderGeometry(rs * 0.36, rs * 0.3, 0.06, 32), mat.metal);
  cup.position.y = yg - 0.5 * ds - 0.01;
  g.add(cup);
  const post = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 16), mat.metal);
  post.position.y = yg - 0.5 * ds - 0.45;
  g.add(post);
  return g;
}

/** Ohrstecker „Hafenlicht“ – Paar, je 4 Krappen. */
function studs(mat) {
  const g = new THREE.Group();
  const ds = 0.86;
  const a = stud(mat, ds), b = stud(mat, ds);
  a.rotation.set(Math.PI / 2, 0, 0.3);
  a.position.set(-0.62, 0, 0.1);
  b.rotation.set(Math.PI / 2 - 0.35, 0.55, -0.2);
  b.position.set(0.64, -0.04, -0.2);
  g.add(a, b);
  return {
    group: g,
    focus: new V(-0.62, 0, 0.3),
    shadow: { y: -0.75, sx: 2.6, sz: 1.2, opacity: 0.5 },
    view: { yaw: 0.25, pitch: 0.16 },
  };
}

/** Anhänger „Alster“ – Saphir in Zargenfassung an feiner Kette. */
function pendant(mat) {
  const g = new THREE.Group();
  const ds = 0.78, rs = ds / 2;
  const face = new V(0, 0, 1);
  g.add(stone(mat.sapphire, mat.cut, ds, new V(0, 0, 0), face, 0.1));

  // Zarge (Metallrand um den Stein)
  const prof = [
    [rs * 0.93, 0.07 * ds], [rs * 1.0, 0.085 * ds], [rs + 0.05, 0.07 * ds], [rs + 0.07, 0.02 * ds],
    [rs + 0.065, -0.12 * ds], [rs * 0.82, -0.2 * ds], [rs * 0.55, -0.24 * ds],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bezel = mesh(new THREE.LatheGeometry(prof, 96), mat.metalDS);
  bezel.quaternion.setFromUnitVectors(new V(0, 1, 0), face);
  g.add(bezel);

  // Öse
  const bail = mesh(new THREE.TorusGeometry(0.11, 0.032, 16, 48), mat.metal);
  bail.rotation.y = Math.PI / 2;
  bail.position.set(0, rs + 0.17, -0.02);
  g.add(bail);
  const link = mesh(new THREE.TorusGeometry(0.06, 0.022, 12, 32), mat.metal);
  link.position.set(0, rs + 0.06, -0.02);
  g.add(link);

  // Kette aus einzelnen Gliedern
  const linkGeo = new THREE.TorusGeometry(0.04, 0.011, 8, 20);
  const strands = [-1, 1].map((sx) => new THREE.CatmullRomCurve3([
    new V(0, rs + 0.2, -0.02),
    new V(sx * 0.2, rs + 0.42, -0.05),
    new V(sx * 0.62, rs + 1.05, -0.12),
    new V(sx * 1.05, rs + 2.0, -0.2),
    new V(sx * 1.35, rs + 3.3, -0.26),
  ], false, 'centripetal'));
  const step = 0.068;
  const counts = strands.map((c) => Math.floor(c.getLength() / step));
  const links = new THREE.InstancedMesh(linkGeo, mat.metal, counts[0] + counts[1]);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V(1.45, 1, 1);
  let k = 0;
  strands.forEach((c, si) => {
    for (let i = 0; i < counts[si]; i++) {
      const u = i / counts[si];
      const p = c.getPointAt(u), tg = c.getTangentAt(u);
      const side = new V().crossVectors(tg, face).normalize();
      const up = i % 2 ? side : new V().crossVectors(side, tg).normalize();
      const nz = new V().crossVectors(tg, up);
      q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tg, up, nz));
      links.setMatrixAt(k++, m4.compose(p, q, sc));
    }
  });
  g.add(links);
  return {
    group: g,
    focus: new V(0, 0, 0.1),
    shadow: { y: -0.85, sx: 1.4, sz: 0.7, opacity: 0.35 },
    view: { yaw: 0.3, pitch: 0.1 },
    frame: { center: new V(0, 0.45, 0), radius: 1.25 },
  };
}

/** Armreif „Möwe“ – schlanker ovaler Reif mit fünf Brillanten. */
function bangle(mat) {
  const g = new THREE.Group();
  const inner = 1, t = 0.085, w = 0.2;
  const band = mesh(bandGeometry({ inner, thickness: () => t, width: () => w, outerRound: 0.6, segments: 320 }), mat.metal);
  g.add(band);
  const rOut = inner + t;
  [-2, -1, 0, 1, 2].forEach((i) => {
    const th = Math.PI + i * 0.175;
    const ds = 0.2 - Math.abs(i) * 0.02;
    const radial = new V(Math.sin(th), Math.cos(th), 0);
    g.add(stone(mat.diamond, mat.cut, ds, radial.clone().multiplyScalar(rOut + 0.006), radial, i));
    if (i === 2) return;
    [-1, 1].forEach((sz) => {
      const b = mesh(new THREE.SphereGeometry(0.026, 14, 10), mat.metal);
      const tb = th + 0.0875;
      b.position.set(Math.sin(tb) * (rOut + 0.014), Math.cos(tb) * (rOut + 0.014), sz * w * 0.3);
      g.add(b);
    });
  });
  g.scale.set(1, 0.84, 1);
  g.rotation.z = Math.PI; // Steine nach oben
  return {
    group: g,
    focus: new V(0, rOut * 0.84, 0),
    shadow: { y: -rOut * 0.84, sx: 2.2, sz: 0.5 },
    view: { yaw: -0.5, pitch: 0.3 },
  };
}

function pearlStud(mat) {
  const g = new THREE.Group();
  const pearl = mesh(new THREE.SphereGeometry(0.42, 64, 48), mat.pearl);
  g.add(pearl);
  // kleine Metallkappe hinten an der Perle
  g.add(mesh(new THREE.SphereGeometry(0.428, 48, 8, 0, TAU, Math.PI - 0.36, 0.36), mat.metal));
  const post = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 16), mat.metal);
  post.position.y = -0.8;
  g.add(post);
  return g;
}

/** Perlenstecker „Blankenese“ – Paar. */
function pearls(mat) {
  const g = new THREE.Group();
  const a = pearlStud(mat), b = pearlStud(mat);
  a.rotation.set(Math.PI / 2, 0, 0);
  a.position.set(-0.5, 0, 0.15);
  b.rotation.set(Math.PI / 2 - 0.2, 0, Math.PI / 2 + 0.5);
  b.position.set(0.52, -0.02, -0.15);
  g.add(a, b);
  return {
    group: g,
    focus: new V(-0.5, 0, 0.15),
    shadow: { y: -0.44, sx: 2.4, sz: 1.2, opacity: 0.55 },
    view: { yaw: 0.2, pitch: 0.18 },
  };
}

/** Drei Trauringe in Gelb-, Weiß- und Roségold (für das Detailbild). */
function trio(mat) {
  const g = new THREE.Group();
  const geo = bandGeometry({ inner: 1, thickness: () => 0.14, width: () => 0.42, outerRound: 0.8, innerRound: 0.5, sideRound: 0.35 });
  [['rosegold', -1.55, 0.5], ['gelbgold', 0, 0], ['weissgold', 1.55, -0.5]].forEach(([key, x, yaw]) => {
    const r = mesh(geo, mat.metalOf(key));
    r.position.set(x, 0, -Math.abs(x) * 0.35);
    r.rotation.y = yaw;
    g.add(r);
  });
  return {
    group: g,
    focus: new V(0, 0, 0),
    shadow: { y: -1.14, sx: 5.2, sz: 1.3 },
    view: { yaw: 0, pitch: 0.18 },
  };
}

export const BUILDERS = {
  trio,
  elbe: solitaire,
  speicherstadt: eternity,
  hafenlicht: studs,
  alster: pendant,
  moewe: bangle,
  blankenese: pearls,
};

// ---------- weicher Schatten ----------

let shadowTex = null;
export function shadowPlane({ y, sx, sz, opacity = 0.6 }) {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, 'rgba(40,32,22,0.55)');
    r.addColorStop(0.35, 'rgba(40,32,22,0.22)');
    r.addColorStop(1, 'rgba(40,32,22,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 256, 256);
    shadowTex = new THREE.CanvasTexture(c);
    shadowTex.colorSpace = THREE.SRGBColorSpace;
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity, toneMapped: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.scale.set(sx, sz, 1);
  m.position.y = y - 0.004;
  m.renderOrder = -1;
  return m;
}
