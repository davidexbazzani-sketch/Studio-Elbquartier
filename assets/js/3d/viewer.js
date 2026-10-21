// Schmuck-Viewer: ein Renderer für die ganze Seite, kann zwischen Containern
// umziehen (Hero ↔ Vollbild). Drehen per Ziehen, Zoomen per Pinch/Trackpad/Buttons,
// Doppeltippen springt zum Stein. Rendert nur, wenn sich etwas bewegt.

import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { BUILDERS, createMaterials, shadowPlane } from './jewelry.js';
import { warmPMREM } from './pmrem-warm.js';

const { clamp, lerp, smoothstep } = THREE.MathUtils;

// HDRI laden und zwei Varianten erzeugen:
// raw  = Original + weiche Softbox von oben (Kontrast und Licht für den Diamanten)
// tent = zusätzlich aufgehellt wie in einem Lichtzelt (helle, edle Metallreflexe)
// Die Aufhellung rechnet die Grafikkarte in einem Durchgang (früher Pixel für Pixel im Prozessor,
// das blockierte auf Handys die Seite über eine Sekunde).
async function loadEnvironment(renderer, url, { lift, top }) {
  const src = await new HDRLoader().setDataType(THREE.FloatType).loadAsync(url);
  const { width: w, height: h, data } = src.image;
  // mittlere Helligkeit aus einer Stichprobe (jedes 7. Pixel reicht für den Mittelwert)
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 28) { sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++; }
  const avg = sum / n;
  src.flipY = true; // Zeile 0 ist oben
  src.minFilter = src.magFilter = THREE.NearestFilter; // 1:1 abgetastet, keine Filterung von Float-Texturen nötig
  src.generateMipmaps = false;
  src.needsUpdate = true;

  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: src }, add: { value: 0 }, topGain: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D map; uniform float add; uniform float topGain; varying vec2 vUv;
      void main() {
        // Richtung nach oben aus der Bildhöhe: y = sin((v - 0.5) * π), weiche Softbox ab y 0.3
        float y = sin((vUv.y - 0.5) * 3.14159265);
        float extra = add + smoothstep(0.3, 0.9, y) * topGain;
        gl_FragColor = vec4(texture2D(map, vUv).rgb + extra, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const make = (add, topGain) => {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    mat.uniforms.add.value = add;
    mat.uniforms.topGain.value = topGain;
    const prevTarget = renderer.getRenderTarget(), prevTone = renderer.toneMapping, prevSpace = renderer.outputColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setRenderTarget(rt);
    renderer.render(quad, cam);
    renderer.setRenderTarget(prevTarget);
    renderer.toneMapping = prevTone;
    renderer.outputColorSpace = prevSpace;
    const t = rt.texture;
    t.colorSpace = THREE.LinearSRGBColorSpace;
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.userData.rt = rt;
    return t;
  };
  const raw = make(0, top);
  const tent = make(avg * lift, top * 0.5);
  quad.geometry.dispose(); mat.dispose(); src.dispose();
  return { raw, tent, avg };
}

export async function createViewer({
  hdrUrl,
  lift = 0.45,
  top = 3,
  envRotation = Math.PI,
  reducedMotion = false,
  bounces = window.innerWidth < 768 ? 4 : 5,
  pixelRatioCap = window.innerWidth < 768 ? 1.75 : 2,
  preserveDrawingBuffer = false,
  autoRotate = true,
} = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0xffffff, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab;outline:none;';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');

  const env = await loadEnvironment(renderer, hdrUrl, { lift, top });
  const pmrem = new THREE.PMREMGenerator(renderer);
  const ziel = await warmPMREM(renderer, pmrem, env.tent.image.width / 4); // Shader im Hintergrund übersetzen
  const envMap = pmrem.fromEquirectangular(env.tent, ziel).texture;
  pmrem.dispose();
  env.tent.userData.rt.dispose();

  const scene = new THREE.Scene();
  scene.environment = envMap;
  const mats = createMaterials(env.raw, { bounces });
  const setEnvRotation = (a) => {
    scene.environmentRotation.set(0, a, 0);
    mats.setEnvRotation(a);
  };
  setEnvRotation(envRotation);

  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 100);
  const pivot = new THREE.Group(); // dreht sich (Drehteller)
  scene.add(pivot);

  // ---------- Zustand ----------
  const pieces = new Map();
  let current = null;
  const view = {
    yaw: 0, yawT: 0, pitch: 0.2, pitchT: 0.2, zoom: 1, zoomT: 1,
    center: new THREE.Vector3(), radius: 1, focus: new THREE.Vector3(),
  };
  const ZMIN = 0.36, ZMAX = 1.45;
  let container = null;
  let visible = true;
  let running = false;
  let raf = 0;
  let last = 0;
  let lastInteract = -1e9;
  let auto = autoRotate && !reducedMotion;
  let firstFrame = [];
  const listeners = new Set();

  function build(id) {
    if (pieces.has(id)) return pieces.get(id);
    const def = BUILDERS[id](mats);
    const root = new THREE.Group();
    root.add(def.group);
    if (def.shadow) root.add(shadowPlane(def.shadow));
    let center, radius;
    if (def.frame) ({ center, radius } = def.frame);
    else {
      const sphere = new THREE.Box3().setFromObject(def.group).getBoundingSphere(new THREE.Sphere());
      center = sphere.center; radius = sphere.radius;
    }
    const item = { id, root, def, center: center.clone(), radius };
    pieces.set(id, item);
    return item;
  }

  function setPiece(id, { metal, instant = true } = {}) {
    const item = build(id);
    if (current) pivot.remove(current.root);
    pivot.add(item.root);
    current = item;
    if (metal) mats.setMetal(metal);
    view.center.copy(item.center);
    view.radius = item.radius;
    view.focus.copy(item.def.focus);
    reset({ instant });
    emit();
  }

  function reset({ instant = false } = {}) {
    if (!current) return;
    const v = current.def.view;
    view.yawT = v.yaw + Math.round((view.yawT - v.yaw) / (Math.PI * 2)) * Math.PI * 2;
    view.pitchT = v.pitch;
    view.zoomT = 1;
    if (instant || reducedMotion) { view.yaw = view.yawT; view.pitch = view.pitchT; view.zoom = view.zoomT; }
    kick();
  }

  // ---------- Kamera ----------
  const target = new THREE.Vector3();
  function placeCamera() {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const fit = Math.min(vFov, hFov);
    const base = (view.radius / Math.sin(fit / 2)) * 1.02;
    const close = 1 - smoothstep(view.zoom, ZMIN, 1); // 0 = ganzes Stück, 1 = Stein
    // Fokuspunkt dreht mit dem Drehteller mit
    const f = view.focus.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), view.yaw);
    target.copy(view.center).lerp(f, close);
    const dist = base * view.zoom;
    camera.position.set(
      target.x,
      target.y + Math.sin(view.pitch) * dist,
      target.z + Math.cos(view.pitch) * dist
    );
    camera.lookAt(target);
  }

  // ---------- Schleife ----------
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const idle = now - lastInteract > 3500;
    if (auto && idle && !drag) view.yawT += dt * 0.32;
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
    view.yaw += (view.yawT - view.yaw) * k;
    view.pitch += (view.pitchT - view.pitch) * k;
    view.zoom += (view.zoomT - view.zoom) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 6));
    pivot.rotation.y = view.yaw;
    placeCamera();
    renderer.render(scene, camera);
    if (firstFrame.length) { const cbs = firstFrame; firstFrame = []; cbs.forEach((cb) => cb()); }

    const moving = Math.abs(view.yawT - view.yaw) > 1e-4 || Math.abs(view.pitchT - view.pitch) > 1e-4
      || Math.abs(view.zoomT - view.zoom) > 1e-4;
    if (visible && container && (moving || (auto && !reducedMotion) || drag)) raf = requestAnimationFrame(frame);
    else running = false;
  }
  function kick() {
    if (running || !visible || !container) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // ---------- Größe & Sichtbarkeit ----------
  function resize() {
    if (!container) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    kick();
  }
  const ro = new ResizeObserver(resize);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && document.visibilityState === 'visible';
    if (visible) kick();
  });
  const onVis = () => {
    visible = document.visibilityState === 'visible';
    if (visible) kick();
  };
  document.addEventListener('visibilitychange', onVis);

  function mount(el) {
    if (container) { ro.unobserve(container); io.unobserve(container); }
    container = el;
    el.appendChild(canvas);
    ro.observe(el);
    io.observe(el);
    visible = true;
    resize();
    kick();
  }

  // ---------- Eingabe ----------
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  const touchNote = () => { lastInteract = performance.now(); };

  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    touchNote();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.zoomT };
      drag = null;
      return;
    }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: view.yawT, pitch: view.pitchT, mode: e.pointerType === 'mouse' ? 'rotate' : null };
    if (drag.mode) { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; }
    kick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      view.zoomT = clamp(pinch.z * (pinch.d / Math.max(d, 1)), ZMIN, ZMAX);
      touchNote(); kick();
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.mode && Math.hypot(dx, dy) > 6) {
      // Touch: waagerecht = drehen, senkrecht = Seite scrollen
      drag.mode = Math.abs(dx) > Math.abs(dy) ? 'rotate' : 'scroll';
      if (drag.mode === 'rotate') canvas.setPointerCapture(e.pointerId);
    }
    if (drag.mode === 'rotate') {
      const s = 5.2 / Math.max(320, canvas.clientWidth);
      view.yawT = drag.yaw + dx * s;
      view.pitchT = clamp(drag.pitch + dy * s * 0.7, -0.2, 1.15);
      touchNote(); kick();
    }
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && drag.id === e.pointerId) { drag = null; canvas.style.cursor = 'grab'; }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  // Trackpad-Pinch (ctrlKey) oder Strg+Mausrad zoomt; normales Scrollen bleibt der Seite
  canvas.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    view.zoomT = clamp(view.zoomT * Math.exp(e.deltaY * 0.01), ZMIN, ZMAX);
    touchNote(); kick();
  }, { passive: false });

  canvas.addEventListener('dblclick', () => toggleCloseup());
  canvas.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: [-0.3, 0], ArrowRight: [0.3, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
    if (step) {
      view.yawT += step[0];
      view.pitchT = clamp(view.pitchT + step[1], -0.2, 1.15);
      e.preventDefault();
    } else if (e.key === '+' || e.key === '=') zoomBy(0.8);
    else if (e.key === '-') zoomBy(1.25);
    else return;
    touchNote(); kick();
  });

  function zoomBy(f) {
    view.zoomT = clamp(view.zoomT * f, ZMIN, ZMAX);
    touchNote(); kick(); emit();
  }
  function toggleCloseup() {
    const closing = view.zoomT >= 0.6;
    view.zoomT = closing ? ZMIN : 1;
    // nah dran etwas mehr von oben – so zeigt der Brillant Tafel und Sterne
    if (closing) view.pitchT = Math.max(view.pitchT, 0.5);
    else if (current) view.pitchT = current.def.view.pitch;
    touchNote(); kick(); emit();
  }
  function setAutoRotate(on) { auto = on && !reducedMotion; kick(); emit(); }

  function emit() { listeners.forEach((fn) => fn({ piece: current?.id, zoom: view.zoomT, auto })); }

  // ---------- Standbild (für vorgerenderte Bilder) ----------
  async function snapshot({ width, height, yaw, pitch, zoom = 1, offsetY = 0, type = 'image/webp', quality = 0.92 }) {
    const prev = { w: canvas.width, h: canvas.height, pr: renderer.getPixelRatio() };
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    view.yaw = view.yawT = yaw ?? current.def.view.yaw;
    view.pitch = view.pitchT = pitch ?? current.def.view.pitch;
    view.zoom = view.zoomT = zoom;
    pivot.rotation.y = view.yaw;
    placeCamera();
    // Bildausschnitt verschieben (positiv = Motiv wandert nach unten)
    camera.position.y += offsetY;
    camera.lookAt(target.x, target.y + offsetY, target.z);
    renderer.render(scene, camera);
    const url = canvas.toDataURL(type, quality);
    renderer.setPixelRatio(prev.pr);
    resize();
    return url;
  }

  // Shader eines Stücks im Hintergrund übersetzen (KHR_parallel_shader_compile), bevor es zum ersten Mal
  // gezeichnet wird. Sonst übersetzt der erste Frame alles auf einmal und die Seite hängt kurz.
  async function prepare(id) {
    const item = build(id);
    const tmp = !item.root.parent;
    if (tmp) pivot.add(item.root);
    try { await renderer.compileAsync(scene, camera); } catch { /* ältere Browser: dann eben beim ersten Frame */ }
    if (tmp) pivot.remove(item.root);
  }

  return {
    canvas,
    mount,
    prepare,
    setPiece,
    setMetal: (key) => { mats.setMetal(key); kick(); },
    setEnvRotation: (a) => { setEnvRotation(a); kick(); },
    zoomBy,
    toggleCloseup,
    reset: () => { reset(); emit(); },
    setAutoRotate,
    get autoRotate() { return auto; },
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    whenRendered: () => new Promise((res) => { firstFrame.push(res); kick(); }),
    snapshot,
    renderer,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      renderer.dispose();
      canvas.remove();
    },
  };
}
