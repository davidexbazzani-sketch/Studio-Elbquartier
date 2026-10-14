// Leinen zum Anfassen (Linnen & Lou): ein Stoffmuster als echte Stoffsimulation.
// Verlet-Integration auf einem Partikelgitter mit Struktur-, Scher- und Biegefedern.
// Das Tuch hängt an einem Holzstab, bewegt sich im Luftzug und lässt sich greifen und ziehen.
// Maßstab: Meter. Das Stoffgewicht ändert Biegesteifigkeit, Dämpfung und Windempfindlichkeit.

import * as THREE from 'three';
import { createStage } from './stage.js';

const TAU = Math.PI * 2;

export const WEIGHTS = {
  leicht: { gsm: 150, bend: 0.08, damping: 0.988, wind: 1.35 },
  mittel: { gsm: 190, bend: 0.32, damping: 0.982, wind: 1.0 },
  schwer: { gsm: 240, bend: 0.85, damping: 0.976, wind: 0.62 },
};

function canvasTex(w, draw, { h = w, color = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Leinenfoto zu einer hellen Graustufen-Struktur (Mittelwert nahe Weiß), damit die Farbe frei wählbar bleibt. */
function detailFrom(img) {
  const s = img.width;
  return canvasTex(s, (g) => {
    g.drawImage(img, 0, 0, s, s);
    const d = g.getImageData(0, 0, s, s);
    const px = d.data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
    const mean = sum / (px.length / 4);
    for (let i = 0; i < px.length; i += 4) {
      const l = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
      const v = Math.max(0, Math.min(255, 228 + (l - mean) * 1.6)); // Kontrast der Fäden etwas betonen
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    g.putImageData(d, 0, 0);
  }, { color: false });
}

function wallTex() {
  return canvasTex(1024, (g, s) => {
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.fillStyle = '#ece8e1';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1800; i++) { // Kalkputz
      const x = r() * s, y = r() * s, rad = 6 + r() * 40;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      const c = r() > 0.5 ? '255,255,255' : '190,180,165';
      grd.addColorStop(0, `rgba(${c},${0.04 + r() * 0.05})`);
      grd.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
}

function tagTex(label) {
  return canvasTex(256, (g, w, h) => {
    g.fillStyle = '#c9a77c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 400; i++) g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    g.fillStyle = '#efe6d6';
    g.beginPath(); g.arc(w / 2, 22, 9, 0, TAU); g.fill(); // Loch für die Schnur
    g.fillStyle = '#2a2622';
    g.textAlign = 'center';
    g.font = '28px Gloock, Georgia, serif';
    g.fillText('Linnen & Lou', w / 2, 78);
    g.font = '600 17px Inter, system-ui, sans-serif';
    label.forEach((t, i) => g.fillText(t, w / 2, 122 + i * 30));
  }, { h: 300 });
}

export function createCloth({ container, reducedMotion = false, textureUrl, preserveDrawingBuffer = false } = {}) {
  const stage = createStage({
    container, reducedMotion, autoRotate: false, rotatable: false, fov: 26, pitch: 0.04, pitchRange: [0.04, 0.04],
    exposure: 1.0, margin: 1.0, shadows: true, preserveDrawingBuffer, envIntensity: 0.28,
  });
  const { scene, camera, canvas } = stage;
  const { key, rim, hemi } = stage.lights;
  key.position.set(-1.6, 2.2, 2.6);
  key.intensity = 1.8;
  key.shadow.camera.left = -1; key.shadow.camera.right = 1; key.shadow.camera.top = 1; key.shadow.camera.bottom = -1;
  key.shadow.radius = 8;
  key.shadow.camera.updateProjectionMatrix();
  rim.position.set(2.5, 1.2, -0.4);
  rim.intensity = 0.9;
  hemi.intensity = 0.6;

  // ---------- Gitter ----------
  const W = 0.62, H = 0.84, NX = 34, NY = 46, N = NX * NY;
  const WALL = -0.07;
  const pos = new Float32Array(N * 3), prev = new Float32Array(N * 3), rest = new Float32Array(N * 3);
  const inv = new Float32Array(N); // 1 / Masse, 0 = festgehalten
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      const x = -W / 2 + (W * i) / (NX - 1), y = -(H * j) / (NY - 1);
      rest.set([x, y, 0], k * 3);
      inv[k] = j === 0 ? 0 : 1;
    }
  }
  // Oberkante am Stab gerafft (wie ein Vorhang): so legt sich der Stoff in weiche Falten
  const GATHER = 0.8, FOLDS = 5.5;
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i, u = i / (NX - 1);
      const fade = Math.max(0, 1 - j / (NY * 0.9));
      pos[k * 3] = rest[k * 3] * (GATHER + (1 - GATHER) * (1 - fade));
      pos[k * 3 + 1] = rest[k * 3 + 1];
      pos[k * 3 + 2] = 0.03 + 0.026 * Math.sin(u * Math.PI * 2 * FOLDS) * (0.35 + 0.65 * fade);
    }
  }
  prev.set(pos);

  // Federn: a, b, Ruhelänge, Art (0 Struktur, 1 Scherung, 2 Biegung)
  const springs = [];
  const add = (a, b, type) => {
    const dx = rest[a * 3] - rest[b * 3], dy = rest[a * 3 + 1] - rest[b * 3 + 1];
    springs.push(a, b, Math.hypot(dx, dy), type);
  };
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      if (i < NX - 1) add(k, k + 1, 0);
      if (j < NY - 1) add(k, k + NX, 0);
      if (i < NX - 1 && j < NY - 1) { add(k, k + NX + 1, 1); add(k + 1, k + NX, 1); }
      if (i < NX - 2) add(k, k + 2, 2);
      if (j < NY - 2) add(k, k + NX * 2, 2);
    }
  }
  const S = springs.length / 4;
  const sa = new Int32Array(S), sb = new Int32Array(S), sl = new Float32Array(S), st = new Uint8Array(S);
  for (let s = 0; s < S; s++) { sa[s] = springs[s * 4]; sb[s] = springs[s * 4 + 1]; sl[s] = springs[s * 4 + 2]; st[s] = springs[s * 4 + 3]; }

  // ---------- Geometrie ----------
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const uv = new Float32Array(N * 2);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) uv.set([i / (NX - 1), 1 - j / (NY - 1)], (j * NX + i) * 2);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let j = 0; j < NY - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -H / 2, 0), H);

  const mat = new THREE.MeshPhysicalMaterial({
    color: '#d8c3a0', roughness: 0.9, sheen: 0.7, sheenRoughness: 0.75, sheenColor: new THREE.Color('#fff8ee'),
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (sh) => { // dünnes Leinen lässt Licht durch: Gegenlicht schimmert hindurch
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
  for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
    float back = max(0.0, dot(-normal, directionalLights[i].direction));
    reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[i].color * back * 0.22;
  }
#endif`);
  };
  const cloth = new THREE.Mesh(geo, mat);
  cloth.castShadow = cloth.receiveShadow = true;
  cloth.frustumCulled = false;

  // Holzstab mit Aufhängung und Preisanhänger
  const wood = new THREE.MeshStandardMaterial({ color: '#9a7350', roughness: 0.55 });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, W + 0.09, 24), wood);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 0.012, 0.004);
  rod.castShadow = true;
  const capGeo = new THREE.SphereGeometry(0.016, 16, 12);
  const capL = new THREE.Mesh(capGeo, wood), capR = new THREE.Mesh(capGeo, wood);
  capL.position.set(-(W + 0.09) / 2, 0.012, 0.004);
  capR.position.set((W + 0.09) / 2, 0.012, 0.004);
  const cord = new THREE.MeshStandardMaterial({ color: '#c9b79c', roughness: 0.9 });
  const strings = [-1, 1].map((sgn) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.6, 6), cord);
    m.position.set(sgn * (W / 2 + 0.02), 0.31, 0.0);
    m.rotation.z = sgn * 0.12;
    return m;
  });
  const tagMat = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.088), tagMat);
  tag.position.set(W / 2 + 0.02, -0.075, 0.012);
  tag.rotation.set(0, -0.12, 0.05);
  tag.castShadow = true;
  const tagCord = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.05, 5), cord);
  tagCord.position.set(W / 2 + 0.02, -0.01, 0.01);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshStandardMaterial({ map: wallTex(), roughness: 0.95 }));
  wall.position.set(0, -0.3, WALL - 0.012);
  wall.receiveShadow = true;

  const holder = new THREE.Group();
  holder.position.y = 0.42;
  holder.add(cloth, rod, capL, capR, ...strings, tag, tagCord);
  scene.add(holder, wall);
  stage.setFrame(new THREE.Vector3(0, 0.04, 0), 0.52);

  // Leinenstruktur aus dem Foto laden
  const ready = new Promise((res) => {
    if (!textureUrl) return res();
    const img = new Image();
    img.onload = () => {
      const t = detailFrom(img);
      t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
      t.repeat.set(2.2, 3);
      mat.map = t;
      mat.bumpMap = t;
      mat.bumpScale = 1.2;
      mat.needsUpdate = true;
      stage.kick();
      res();
    };
    img.onerror = () => res();
    img.src = textureUrl;
  });

  // ---------- Simulation ----------
  let weight = WEIGHTS.mittel;
  let time = 0;
  const G = -9.81;
  const nrm = geo.attributes.normal;

  function step(h) {
    time += h;
    // Luftzug: langsam an- und abschwellend, im Raum leicht unterschiedlich
    const gust = reducedMotion ? 0 : (0.55 + 0.45 * Math.sin(time * 0.7) * Math.sin(time * 0.23 + 1.3)) * 1.6 * weight.wind;
    const damp = weight.damping;
    for (let k = 0; k < N; k++) {
      if (!inv[k]) continue;
      const o = k * 3;
      const x = pos[o], y = pos[o + 1], z = pos[o + 2];
      const wz = gust * (0.6 + 0.4 * Math.sin(x * 9 + time * 1.7) * Math.cos(y * 7 - time * 1.3));
      const wx = gust * 0.25 * Math.sin(y * 5 + time * 0.9);
      const dot = nrm.getX(k) * wx + nrm.getZ(k) * wz; // Wind drückt entlang der Flächennormale
      const ax = nrm.getX(k) * dot, ay = nrm.getY(k) * dot + G, az = nrm.getZ(k) * dot;
      const vx = (x - prev[o]) * damp, vy = (y - prev[o + 1]) * damp, vz = (z - prev[o + 2]) * damp;
      prev[o] = x; prev[o + 1] = y; prev[o + 2] = z;
      pos[o] = x + vx + ax * h * h;
      pos[o + 1] = y + vy + ay * h * h;
      pos[o + 2] = z + vz + az * h * h;
    }
    const bend = weight.bend;
    for (let it = 0; it < 10; it++) {
      for (let s = 0; s < S; s++) {
        const a = sa[s], b = sb[s];
        const wa = inv[a], wb = inv[b], wsum = wa + wb;
        if (!wsum) continue;
        const stiff = st[s] === 2 ? bend : st[s] === 1 ? 0.8 : 1;
        const oa = a * 3, ob = b * 3;
        const dx = pos[ob] - pos[oa], dy = pos[ob + 1] - pos[oa + 1], dz = pos[ob + 2] - pos[oa + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const f = (((len - sl[s]) / len) * stiff) / wsum;
        pos[oa] += dx * f * wa; pos[oa + 1] += dy * f * wa; pos[oa + 2] += dz * f * wa;
        pos[ob] -= dx * f * wb; pos[ob + 1] -= dy * f * wb; pos[ob + 2] -= dz * f * wb;
      }
      for (let k = 0; k < N; k++) { // nicht durch die Wand
        const o = k * 3 + 2;
        if (pos[o] < WALL) pos[o] = WALL;
      }
      if (grab) { // Finger greifen nicht nur einen Punkt: Nachbarn werden weich mitgezogen
        for (const n of grab.near) {
          const o = n.k * 3;
          const tx = grab.target.x + n.dx, ty = grab.target.y + n.dy, tz = Math.max(WALL, grab.target.z + n.dz);
          pos[o] += (tx - pos[o]) * n.w; pos[o + 1] += (ty - pos[o + 1]) * n.w; pos[o + 2] += (tz - pos[o + 2]) * n.w;
        }
      }
    }
  }

  function settle(steps) { for (let i = 0; i < steps; i++) step(1 / 120); }

  // ---------- Greifen und Ziehen ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane();
  const hit = new THREE.Vector3();
  let grab = null;
  function pointer(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  canvas.addEventListener('pointerdown', (e) => {
    pointer(e);
    const res = ray.intersectObject(cloth, false)[0];
    if (!res) return;
    const f = res.face;
    let best = f.a, bd = Infinity; // nächster Gitterpunkt am Treffer
    for (const v of [f.a, f.b, f.c]) {
      const o = v * 3;
      const d = (pos[o] - (res.point.x)) ** 2 + (pos[o + 1] + holder.position.y - res.point.y) ** 2 + (pos[o + 2] - res.point.z) ** 2;
      if (d < bd) { bd = d; best = v; }
    }
    if (!inv[best]) return;
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), res.point);
    const near = [];
    const bi = best % NX, bj = Math.floor(best / NX), o0 = best * 3;
    for (let dj = -2; dj <= 2; dj++) {
      for (let di = -2; di <= 2; di++) {
        const i = bi + di, j = bj + dj, d = Math.hypot(di, dj);
        if (i < 0 || j < 1 || i >= NX || j >= NY || d > 2.3) continue;
        const k = j * NX + i, o = k * 3;
        near.push({ k, w: d === 0 ? 1 : 0.55 * (1 - d / 2.6), dx: pos[o] - pos[o0], dy: pos[o + 1] - pos[o0 + 1], dz: pos[o + 2] - pos[o0 + 2] });
      }
    }
    grab = { k: best, id: e.pointerId, near, target: new THREE.Vector3(pos[o0], pos[o0 + 1], pos[o0 + 2]) };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* Zeiger schon weg */ }
    canvas.style.cursor = 'grabbing';
    stage.kick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!grab) {
      if (e.pointerType === 'mouse') { pointer(e); canvas.style.cursor = ray.intersectObject(cloth, false).length ? 'grab' : 'default'; }
      return;
    }
    if (e.pointerId !== grab.id) return;
    pointer(e);
    if (ray.ray.intersectPlane(plane, hit)) grab.target.copy(hit).sub(holder.position);
    stage.kick();
  });
  const release = (e) => {
    if (!grab || e.pointerId !== grab.id) return;
    grab = null;
    canvas.style.cursor = 'grab';
    stage.kick();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release); // z. B. wenn der Finger die Seite senkrecht scrollt

  // ---------- Ablauf ----------
  let acc = 0, still = 0;
  stage.onFrame((dt) => {
    acc += Math.min(dt, 1 / 20);
    let n = 0;
    while (acc >= 1 / 120 && n < 4) { step(1 / 120); acc -= 1 / 120; n++; }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    // ohne Wind und ohne Greifen kommt das Tuch zur Ruhe: dann nicht weiter rechnen
    let motion = 0;
    for (let k = 0; k < N * 3; k += 9) motion = Math.max(motion, Math.abs(pos[k] - prev[k]) + Math.abs(pos[k + 1] - prev[k + 1]) + Math.abs(pos[k + 2] - prev[k + 2]));
    still = motion < 2e-6 ? still + 1 : 0;
    return !!grab || !reducedMotion || still < 30;
  });

  function set({ color, weight: w, label } = {}) {
    if (color) {
      mat.color.set(color).multiplyScalar(1.04); // gleicht die helle Struktur aus
      mat.sheenColor.set(color).lerp(new THREE.Color('#ffffff'), 0.6);
    }
    if (w && WEIGHTS[w]) weight = WEIGHTS[w];
    if (label) {
      tagMat.map?.dispose();
      tagMat.map = tagTex(label);
      tagMat.needsUpdate = true;
    }
    if (reducedMotion) { still = 0; settle(240); }
    stage.kick();
  }

  settle(reducedMotion ? 600 : 240);
  geo.computeVertexNormals();

  return {
    canvas,
    ready,
    set,
    whenRendered: stage.whenRendered,
    /** Standbild (für Ersatzbilder ohne 3D). */
    snapshot: ({ width, height }) => stage.snapshot({ width, height }),
    /** Kleiner Stoß ins Tuch, z. B. beim Antippen einer Farbe. */
    poke(strength = 0.012) {
      for (let k = 0; k < N; k++) if (inv[k]) prev[k * 3 + 2] -= strength * (rest[k * 3 + 1] / -H);
      stage.kick();
    },
    dispose: stage.dispose,
  };
}
