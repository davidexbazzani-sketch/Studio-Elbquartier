// FUNKL-Sorten: eine beschlagene Dose (zum Freiwischen) mit schwebenden Zutaten je Sorte.
// Die Seite wechselt beim Scrollen die Sorte; die Dose dreht sich mit dem Scrollfortschritt.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createCan, Condensation, makeLabel, warmLabels, FRONT_YAW, CAN } from './can.js';
import { FLAVORS, studioHDR } from './funkl-data.js';

const TAU = Math.PI * 2;

/* ---------- Zutaten ---------- */
function citrusTexture(outer, inner, seg) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = outer; g.beginPath(); g.arc(256, 256, 256, 0, TAU); g.fill();
  g.fillStyle = '#fbf6d8'; g.beginPath(); g.arc(256, 256, 226, 0, TAU); g.fill();
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * TAU + 0.04, a1 = ((i + 1) / 10) * TAU - 0.04;
    g.fillStyle = seg;
    g.beginPath(); g.moveTo(256 + Math.cos((a0 + a1) / 2) * 22, 256 + Math.sin((a0 + a1) / 2) * 22);
    g.arc(256, 256, 205, a0, a1); g.closePath(); g.fill();
    // Fruchtfleisch-Fasern
    g.strokeStyle = inner; g.lineWidth = 3; g.globalAlpha = 0.5;
    for (let k = 0; k < 6; k++) { const a = a0 + (a1 - a0) * (k + 0.5) / 6; g.beginPath(); g.moveTo(256 + Math.cos(a) * 60, 256 + Math.sin(a) * 60); g.lineTo(256 + Math.cos(a) * 190, 256 + Math.sin(a) * 190); g.stroke(); }
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function mat(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, ...extra });
}

function citrusSlice(outer, inner, seg) {
  const g = new THREE.Group();
  const tex = citrusTexture(outer, inner, seg);
  const side = mat(outer, { roughness: 0.5 });
  const face = mat('#ffffff', { map: tex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05, transmission: 0 });
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 48), [side, face, face]);
  cyl.rotation.x = Math.PI / 2;
  g.add(cyl);
  return g;
}

function ingredients(id) {
  const items = [];
  const add = (obj, n, scale = 1) => { for (let i = 0; i < n; i++) items.push({ obj: i === 0 ? obj : obj.clone(), scale: scale * (0.75 + Math.random() * 0.5) }); };
  if (id === 'mango') {
    const cube = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.17, 0.17, 3, 0.04), mat('#ffb11f', { roughness: 0.3, sheen: 0.6, sheenColor: '#ffe08a' }));
    add(cube, 7);
    // Mangoblätter
    const leafS = new THREE.Shape(); leafS.moveTo(0, -0.16); leafS.quadraticCurveTo(0.075, 0, 0, 0.16); leafS.quadraticCurveTo(-0.075, 0, 0, -0.16);
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(leafS, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 16 }), mat('#2fae4f', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, side: THREE.DoubleSide })), 4);
  } else if (id === 'melone') {
    // Melonenstück: Keil mit rosa Fruchtfleisch, weißer und grüner Rinde
    const wedge = new THREE.Group();
    const sh = new THREE.Shape(); sh.moveTo(0, 0.24); sh.absarc(0, 0, 0.24, Math.PI * 0.25, Math.PI * 0.75, false); sh.lineTo(0, -0.06); sh.closePath();
    const flesh = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }), mat('#ff3d6e', { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
    wedge.add(flesh);
    const rind = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.022, 8, 24, Math.PI * 0.5), mat('#2f8a3a', { roughness: 0.4 }));
    rind.rotation.z = Math.PI * 0.25; rind.position.z = 0.035;
    wedge.add(rind);
    const seedMat = mat('#1a1410', { roughness: 0.1, clearcoat: 1 });
    [[-0.05, 0.12], [0.05, 0.12], [0, 0.07], [-0.08, 0.17], [0.08, 0.17]].forEach(([x, y]) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), seedMat); s.position.set(x, y, 0.085); s.scale.set(0.6, 1, 0.5); wedge.add(s);
    });
    wedge.children.forEach((c) => c.position.y -= 0.08);
    add(wedge, 5);
    add(citrusSlice('#5fbf2a', '#cfe98a', '#9fd84a'), 4);
    const leaf = new THREE.Shape(); leaf.moveTo(0, -0.1); leaf.quadraticCurveTo(0.08, 0, 0, 0.12); leaf.quadraticCurveTo(-0.08, 0, 0, -0.1);
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(leaf, { depth: 0.008, bevelEnabled: false, curveSegments: 12 }), mat('#2fbf5a', { roughness: 0.35, side: THREE.DoubleSide })), 4);
  } else {
    const berry = new THREE.Group();
    berry.add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 32, 20), mat('#2b2f7a', { roughness: 0.45, sheen: 1, sheenColor: '#9aa6ff', sheenRoughness: 0.4, clearcoat: 0.2 })));
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.009, 6, 10), mat('#1c1c45', { roughness: 0.6 }));
    crown.position.y = 0.08; crown.rotation.x = Math.PI / 2;
    berry.add(crown);
    add(berry, 10);
    const yuzuGeo = new THREE.SphereGeometry(0.16, 72, 54);
    const p = yuzuGeo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + 0.012 * Math.sin(v.x * 70) * Math.sin(v.y * 66) * Math.sin(v.z * 74)); p.setXYZ(i, v.x, v.y, v.z); }
    yuzuGeo.computeVertexNormals();
    add(new THREE.Mesh(yuzuGeo, mat('#ffd51f', { roughness: 0.4, clearcoat: 0.6 })), 2);
    add(citrusSlice('#ffcf1a', '#fff2a8', '#ffe066'), 3);
  }
  return items;
}

/* ---------- echte Früchte (3D-Scans) ---------- */
// Größe = längste Seite in Dezimetern (etwas größer als in echt, damit sie neben der Dose wirken)
// face: Schnittfläche zur Kamera drehen (Fruchtfleisch statt Schale), juicy: glänzender Saft auf der Schnittfläche
const FRUIT = {
  mango: [{ url: 'mango-ganz.glb', n: 1, size: 0.82, sat: 1.15 }, { url: 'mango-scheibe.glb', n: 2, size: 0.72, face: true, juicy: true, sat: 1.35, lift: 1.12 }, { url: 'mango-kern.glb', n: 1, size: 0.72, face: true, juicy: true, sat: 1.35, lift: 1.12 }],
  melone: [{ url: 'melone-stueck.glb', n: 3, size: 0.8, juicy: true, face: true, sat: 1.15 }, { url: 'limette-scheibe.glb', n: 3, size: 0.46, face: true, juicy: true, sat: 1.5, lift: 1.25 }, { url: 'limette.glb', n: 1, size: 0.5, sat: 1.45, lift: 1.2 }],
  blau: [{ url: 'blaubeere.glb', n: 12, size: 0.1, berry: true }, { url: 'zitrone.glb', n: 2, size: 0.6, alt: 'yuzu.glb', sat: 1.2, lift: 1.1 }],
};
const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function loadFruit(base, def) {
  for (const url of [def.url, def.alt].filter(Boolean)) {
    try {
      const g = await gltf.loadAsync(base + url);
      const root = g.scene;
      const box = new THREE.Box3().setFromObject(root, true);
      const size = box.getSize(new THREE.Vector3());
      const holder = new THREE.Group();
      root.position.sub(box.getCenter(new THREE.Vector3()));
      holder.add(root);
      const k = def.size / Math.max(size.x, size.y, size.z);
      root.traverse((o) => {
        if (!o.isMesh) return;
        let m = o.material;
        // Fotoscans sind oft „unbeleuchtet“ gespeichert: echtes Material, damit Licht und Glanz wirken
        if (m.isMeshBasicMaterial || !m.isMeshStandardMaterial) {
          m = new THREE.MeshPhysicalMaterial({ map: m.map || null, color: m.color || 0xffffff, roughness: 0.55, metalness: 0 });
        }
        if (def.juicy) Object.assign(m, { clearcoat: 0.8, clearcoatRoughness: 0.12, roughness: Math.min(m.roughness ?? 0.55, 0.45) });
        if (def.berry) Object.assign(m, { sheen: 1, sheenColor: new THREE.Color('#9aa6c8'), sheenRoughness: 0.45, roughness: 0.6, clearcoat: 0 }); // matter Reif auf der Beere
        if (def.sat || def.lift) {
          // Fotoscans wirken oft bräunlich: Sättigung und Helligkeit anheben (nur die Farbe, nicht das Licht)
          const sat = def.sat ?? 1, lift = def.lift ?? 1;
          m.onBeforeCompile = (sh) => {
            sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
              float fl = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
              diffuseColor.rgb = clamp(mix(vec3(fl), diffuseColor.rgb, ${sat.toFixed(2)}) * ${lift.toFixed(2)}, 0.0, 1.0);`);
          };
          m.customProgramCacheKey = () => `frucht-${sat}-${lift}`;
        }
        m.envMapIntensity = 1;
        if (m.transparent && m.opacity > 0.98) m.transparent = false;
        o.material = m;
      });
      const wrap = new THREE.Group();
      wrap.add(holder);
      holder.scale.setScalar(k);
      if (def.face) {
        // Schnittfläche finden: kürzeste Achse; die Wölbung (Schwerpunkt) liegt auf der anderen Seite
        const ext = [size.x, size.y, size.z];
        const ax = ext.indexOf(Math.min(...ext));
        const c = new THREE.Vector3(); let n = 0; const v = new THREE.Vector3();
        root.updateMatrixWorld(true);
        root.traverse((o) => { if (!o.isMesh) return; const pa = o.geometry.attributes.position; for (let i = 0; i < pa.count; i += 7) { c.add(v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld)); n++; } });
        c.divideScalar(Math.max(1, n));
        const dir = new THREE.Vector3(); dir.setComponent(ax, c.getComponent(ax) > 0 ? 1 : -1);
        wrap.userData.faceQ = new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(0, 0.25, 1).normalize());
      }
      return wrap;
    } catch (e) { /* nächste Quelle versuchen */ }
  }
  return null;
}
async function realIngredients(id, base) {
  const defs = FRUIT[id] || [];
  const loaded = await Promise.all(defs.map((d) => loadFruit(base, d)));
  const items = [];
  loaded.forEach((obj, k) => { if (obj) for (let i = 0; i < defs[k].n; i++) { const o = i ? obj.clone() : obj; o.userData.faceQ = obj.userData.faceQ; items.push({ obj: o, scale: 0.85 + Math.random() * 0.3 }); } });
  return items;
}

/* ---------- Szene ---------- */
export async function createShowcase({ container, reducedMotion = false, quality, models = '../../assets/models/funkl/' }) {
  const low = quality === 'low' || window.innerWidth < 768;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab;';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.environment = await studioHDR(renderer);
  scene.environmentRotation.set(0, -0.6, 0);
  const key = new THREE.DirectionalLight('#ffffff', 1.2); key.position.set(2, 3, 4);
  scene.add(key, new THREE.AmbientLight('#ffffff', 0.4));
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);

  const cond = new Condensation(renderer, { size: low ? 512 : 1024, maxDrops: low ? 320 : 600 });
  const labels = FLAVORS.map((f) => makeLabel(f));
  warmLabels(renderer, labels);
  const can = createCan({ label: labels[0], condensation: cond });
  const holder = new THREE.Group();
  const spin = new THREE.Group();
  can.group.position.y = -CAN.h / 2;
  can.group.rotation.y = FRONT_YAW;
  spin.add(can.group);
  holder.add(spin);
  scene.add(holder);

  // Zutaten je Sorte, schweben auf Bahnen um die Dose
  const realSets = await Promise.all(FLAVORS.map((f) => realIngredients(f.id, models)));
  const sets = FLAVORS.map((f, fi) => {
    const g = new THREE.Group();
    // echte Scans, wo vorhanden; sonst die gezeichneten Zutaten als Ersatz
    const list = realSets[fi].length >= 3 ? realSets[fi] : ingredients(f.id);
    const items = list.map((it, i, all) => {
      const a = (i / all.length) * TAU + Math.random() * 0.4;
      const o = it.obj;
      const faceQ = o.userData.faceQ || null;
      o.userData = { faceQ, a, r: 0.6 + Math.random() * 0.38, y: (Math.random() - 0.5) * 1.45, spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).subScalar(0.5).multiplyScalar(1.6), s: it.scale, ph: Math.random() * TAU, face: !!it.obj.userData?.face || (i > 0 && all[0].obj.userData?.face && it.obj === all[0].obj) };
      g.add(o);
      return o;
    });
    g.visible = false;
    g.userData = { items, show: 0, showT: 0 };
    scene.add(g);
    return g;
  });

  let current = 0;
  let rotT = 0, rot = 0;
  const tmpE = new THREE.Euler();
  let time = 0;
  sets[0].visible = true; sets[0].userData.showT = 1;

  function setFlavor(i) {
    if (i === current) return;
    sets[current].userData.showT = 0;
    current = i;
    const s = sets[i];
    s.visible = true; s.userData.showT = 1;
    flip.t = 1; flip.target = i;
  }
  const flip = { t: 0, target: 0, done: true };

  // Drehen: waagerecht ziehen (Maus oder Finger), mit Schwung; senkrecht scrollt die Seite
  let drag = null, userRot = 0, userVel = 0;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, mode: e.pointerType === 'mouse' ? 'rot' : null, last: e.clientX, t: performance.now() };
    if (drag.mode) { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; }
    kick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.mode && Math.hypot(dx, dy) > 6) { drag.mode = Math.abs(dx) > Math.abs(dy) ? 'rot' : 'scroll'; if (drag.mode === 'rot') canvas.setPointerCapture(e.pointerId); }
    if (drag.mode !== 'rot') return;
    const now = performance.now(), step = (e.clientX - drag.last) * 0.012;
    userRot += step;
    userVel = step / Math.max(0.008, (now - drag.t) / 1000);
    drag.last = e.clientX; drag.t = now;
    onTouch?.();
    kick();
  });
  const end = (e) => { if (drag && drag.id === e.pointerId) { drag = null; canvas.style.cursor = 'grab'; } };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  let onTouch = null;

  /* ---------- Schleife ---------- */
  let visible = false, running = false, last = 0, raf = 0;
  cond.setLevel(0.85, true);
  cond.prewarm(reducedMotion ? 30 : 14);
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    rot += (rotT - rot) * Math.min(1, dt * 4);
    if (!drag) { userRot += userVel * dt; userVel *= Math.exp(-dt * 2.2); }
    // Sortenwechsel: schnelle Drehung, Etikett wechselt, wenn die Rückseite vorne ist
    if (flip.t > 0) {
      const before = flip.t;
      flip.t = Math.max(0, flip.t - dt * 1.4);
      if (before > 0.5 && flip.t <= 0.5) can.setLabel(labels[flip.target]);
    }
    const flipAngle = (1 - flip.t) * TAU * (flip.t > 0 ? 1 : 0);
    const e = flip.t > 0 ? 1 - Math.pow(flip.t, 3) : 0;
    spin.rotation.y = rot + userRot + (flip.t > 0 ? e * TAU : 0) + Math.sin(time * 0.7) * 0.12;
    void flipAngle;
    holder.position.y = Math.sin(time * 1.1) * 0.03;
    holder.rotation.z = Math.sin(time * 0.8) * 0.04 - 0.05;

    sets.forEach((g) => {
      const u = g.userData;
      u.show += (u.showT - u.show) * Math.min(1, dt * (u.showT ? 3 : 5));
      if (u.show < 0.01 && !u.showT) { g.visible = false; return; }
      u.items.forEach((o) => {
        const d = o.userData;
        const pop = u.showT ? THREE.MathUtils.smoothstep(u.show, 0, 1) : u.show;
        const out = 1 + (1 - u.show) * (u.showT ? 0.6 : 1.4);
        const a = d.a + time * 0.18;
        o.position.set(Math.cos(a) * d.r * out, d.y + Math.sin(time + d.ph) * 0.06, Math.sin(a) * d.r * out * 0.8);
        // vor der Dose ausweichen, damit sie sichtbar bleibt
        if (o.position.z > 0 && Math.abs(o.position.x) < 0.62 && Math.abs(o.position.y) < 0.75) {
          o.position.x = Math.sign(o.position.x || 1) * (0.62 - (0.62 - Math.abs(o.position.x)) * 0.25);
        }
        if (d.faceQ) {
          // Schnittfläche zur Kamera, sanft schaukelnd
          tmpE.set(Math.sin(time * 0.8 + d.ph) * 0.45, Math.sin(time * 0.6 + d.ph * 2) * 0.6, Math.sin(time * 0.5 + d.ph) * 0.4);
          o.quaternion.setFromEuler(tmpE).multiply(d.faceQ);
        } else if (d.face) o.rotation.set(-1.2 + Math.sin(time * 0.9 + d.ph) * 0.3, Math.sin(time * 0.6 + d.ph) * 0.5, Math.sin(time * 0.7 + d.ph) * 0.3);
        else o.rotation.set(d.spin.x * time + d.ph, d.spin.y * time, d.spin.z * time);
        o.scale.setScalar(d.s * pop * (1 + 0.08 * Math.sin(time * 2 + d.ph)));
      });
    });

    cond.step(dt);
    cond.render(dt);
    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(frame); else running = false;
  }
  function kick() { if (running || !visible) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vis = CAN.h / (camera.aspect < 0.8 ? 0.6 : 0.74);
    const fitW = (2.2) / 2 / Math.tan(Math.atan(Math.tan(THREE.MathUtils.degToRad(14)) * camera.aspect));
    camera.position.set(0, 0.15, Math.max(vis / 2 / Math.tan(THREE.MathUtils.degToRad(14)), fitW));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(container);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && document.visibilityState === 'visible'; if (visible) kick(); });
  io.observe(container);
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible' && container.getBoundingClientRect().bottom > 0; if (visible) kick(); });
  resize();
  renderer.compile(scene, camera);

  return {
    canvas, renderer,
    setFlavor,
    setRotation: (r) => { rotT = r; kick(); },
    onInteract(fn) { onTouch = fn; },
    /** Standbild einer Dose (für Shop-Bilder): transparenter Hintergrund */
    snapshotCan({ flavor, width, height, cold = true }) {
      sets.forEach((g) => { g.visible = false; });
      can.setLabel(labels[flavor]);
      spin.rotation.y = 0.25; holder.rotation.z = -0.06; holder.position.y = 0;
      if (cold) { cond.clear(); cond.setLevel(0.55, true); cond.prewarm(45); }
      renderer.setPixelRatio(1); renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.position.set(0, 0.1, 3.3); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      return canvas.toDataURL('image/webp', 0.9);
    },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); cond.dispose(); renderer.dispose(); canvas.remove(); },
  };
}
