// Wiederverwendbare 3D-Bühne für die Muster-Websites:
// Renderer, weiches Licht, Drehteller (Ziehen zum Drehen), Rendern nur bei Bedarf.
// Touch: waagerecht ziehen dreht, senkrecht bleibt Scrollen der Seite.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const { clamp } = THREE.MathUtils;

export function createStage({
  container,
  reducedMotion = false,
  autoRotate = true,
  spin = 0.22,
  fov = 30,
  yaw = 0,
  pitch = 0.16,
  pitchRange = [-0.15, 0.85],
  exposure = 0.95,
  envIntensity = 0.22,
  margin = 1.04,
  shadows = false,
  lights = true,
  hdr = null, // { url, background: true, blur: 0.4, bgIntensity: 0.6, intensity: 1 }
  preserveDrawingBuffer = false,
  rotatable = true, // false: Ziehen dreht nicht (z. B. wenn die Szene eigene Eingaben hat)
} = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer });
  const dprCap = window.innerWidth < 768 ? 1.75 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.setClearColor(0xffffff, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = `display:block;width:100%;height:100%;touch-action:pan-y;cursor:${rotatable ? 'grab' : 'default'};outline:none;`;
  canvas.tabIndex = 0;
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = envIntensity;
  // optional: HDRI als Licht und weichgezeichneter Hintergrund (z. B. Bar-Atmosphäre)
  const ready = hdr
    ? new HDRLoader().loadAsync(hdr.url).then((tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = pmrem.fromEquirectangular(tex).texture;
      scene.environmentIntensity = hdr.intensity ?? 1;
      if (hdr.background !== false) {
        scene.background = tex;
        scene.backgroundBlurriness = hdr.blur ?? 0.4;
        scene.backgroundIntensity = hdr.bgIntensity ?? 0.6;
      }
      pmrem.dispose();
      kick();
    })
    : Promise.resolve(pmrem.dispose());

  const hemi = new THREE.HemisphereLight('#fffaf1', '#efe2d6', lights ? 0.75 : 0);
  const key = new THREE.DirectionalLight('#fff4e4', 1.5);
  key.position.set(-3, 5, 4);
  const rim = new THREE.DirectionalLight('#f3f6ff', 0.6);
  rim.position.set(4, 2, -4);
  const fill = new THREE.DirectionalLight('#fff8f0', 0.45);
  fill.position.set(0.5, 1.2, 6);
  if (lights) scene.add(hemi, key, rim, fill);
  if (shadows) {
    // weiche Schatten vom Hauptlicht: Objekte werfen Schatten aufeinander
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft gibt es in three r186 nicht mehr (wird beim ersten Bild umgestellt, vorab übersetzte Shader passten dann nicht)
    key.castShadow = true;
    const size = window.innerWidth < 768 ? 1024 : 2048;
    key.shadow.mapSize.set(size, size);
    Object.assign(key.shadow.camera, { left: -1.8, right: 1.8, top: 1.8, bottom: -1.8, near: 0.5, far: 16 });
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.015;
    key.shadow.radius = 4;
  }

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 100);
  const pivot = new THREE.Group();
  scene.add(pivot);

  const view = { yaw, yawT: yaw, pitch, pitchT: pitch, center: new THREE.Vector3(0, 0, 0), radius: 1 };
  let auto = autoRotate && !reducedMotion;
  let visible = true, running = false, raf = 0, last = 0, lastInteract = -1e9;
  const hooks = new Set();
  const late = new Set(); // läuft nach dem Platzieren der Kamera, direkt vor dem Rendern
  let waiters = [];

  function setFrame(center, radius) {
    view.center.copy(center);
    view.radius = radius;
    kick();
  }

  const target = new THREE.Vector3();
  function placeCamera() {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const fit = Math.min(vFov, hFov);
    const dist = (view.radius / Math.sin(fit / 2)) * margin;
    target.copy(view.center);
    camera.position.set(target.x, target.y + Math.sin(view.pitch) * dist, target.z + Math.cos(view.pitch) * dist);
    camera.lookAt(target);
  }

  // Vor dem ersten Bild die Shader im Hintergrund übersetzen; sonst blockiert das erste Bild auf Handys
  // die Seite für eine bis mehrere Sekunden (Scrollen hakt).
  let warm = !renderer.compileAsync, warmAgain = false;
  function frame(now) {
    if (!warm) {
      warm = 'pending';
      running = false;
      placeCamera();
      renderer.compileAsync(scene, camera).catch(() => {}).finally(() => {
        warm = warmAgain ? false : true; // Material hat sich währenddessen geändert: noch einmal
        warmAgain = false;
        // auf jeden Fall ein Bild zeichnen (wie früher das erste Bild): manche Seiten blenden die 3D-Ansicht
        // erst nach dem ersten Bild ein (whenRendered), vorher gilt sie als unsichtbar
        kick(true);
      });
      return;
    }
    if (warm === 'pending') { running = false; return; }
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (auto && !drag && now - lastInteract > 3500) view.yawT += dt * spin;
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
    view.yaw += (view.yawT - view.yaw) * k;
    view.pitch += (view.pitchT - view.pitch) * k;
    pivot.rotation.y = view.yaw;
    let busy = false;
    hooks.forEach((fn) => { if (fn(dt) === true) busy = true; });
    placeCamera();
    late.forEach((fn) => fn());
    renderer.render(scene, camera);
    if (waiters.length) { const w = waiters; waiters = []; w.forEach((fn) => fn()); }
    const moving = busy || Math.abs(view.yawT - view.yaw) > 1e-4 || Math.abs(view.pitchT - view.pitch) > 1e-4;
    if (visible && (moving || auto || drag)) raf = requestAnimationFrame(frame);
    else running = false;
  }
  function kick(force = false) {
    if (running || (!visible && !force)) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    kick();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && document.visibilityState === 'visible';
    if (visible) kick();
  });
  io.observe(container);
  const onVis = () => { visible = document.visibilityState === 'visible'; if (visible) kick(); };
  document.addEventListener('visibilitychange', onVis);

  // ---------- Eingabe ----------
  let drag = null;
  if (rotatable) {
    canvas.addEventListener('pointerdown', (e) => {
      lastInteract = performance.now();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: view.yawT, pitch: view.pitchT, mode: e.pointerType === 'mouse' ? 'rotate' : null };
      if (drag.mode) { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; }
      kick();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.mode && Math.hypot(dx, dy) > 6) {
        drag.mode = Math.abs(dx) > Math.abs(dy) ? 'rotate' : 'scroll';
        if (drag.mode === 'rotate') canvas.setPointerCapture(e.pointerId);
      }
      if (drag.mode !== 'rotate') return;
      const s = 5.2 / Math.max(320, canvas.clientWidth);
      view.yawT = drag.yaw + dx * s;
      view.pitchT = clamp(drag.pitch + dy * s * 0.6, pitchRange[0], pitchRange[1]);
      lastInteract = performance.now();
      kick();
    });
    const up = (e) => {
      if (drag && drag.id === e.pointerId) { drag = null; canvas.style.cursor = 'grab'; lastInteract = performance.now(); }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('keydown', (e) => {
      const step = { ArrowLeft: -0.3, ArrowRight: 0.3 }[e.key];
      if (step === undefined) return;
      view.yawT += step;
      lastInteract = performance.now();
      e.preventDefault();
      kick();
    });
  }

  resize();

  return {
    renderer, scene, camera, pivot, canvas, ready,
    lights: { hemi, key, rim, fill },
    setFrame,
    kick: () => kick(),
    /** Nach Material-Änderungen (z. B. nachgeladene Textur): Shader erst im Hintergrund übersetzen, dann zeichnen. */
    prepare: () => {
      if (warm === 'pending') warmAgain = true;
      else if (renderer.compileAsync) warm = false;
      kick();
    },
    onFrame: (fn) => { hooks.add(fn); kick(); return () => hooks.delete(fn); },
    onBeforeRender: (fn) => { late.add(fn); return () => late.delete(fn); },
    whenRendered: () => new Promise((res) => { waiters.push(res); kick(); }),
    setAutoRotate: (on) => { auto = on && !reducedMotion; kick(); },
    get autoRotate() { return auto; },
    nudge: (dYaw) => { view.yawT += dYaw; lastInteract = performance.now(); kick(); },
    /** Blickwinkel sofort setzen (ohne Nachlauf). */
    setView({ yaw: y = view.yawT, pitch: p = view.pitchT } = {}) {
      view.yaw = view.yawT = y;
      view.pitch = view.pitchT = p;
      kick();
    },
    /** Standbild in fester Größe (für Ersatzbilder ohne 3D). */
    snapshot({ width, height, type = 'image/png', quality }) {
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      pivot.rotation.y = view.yaw;
      hooks.forEach((fn) => fn(0));
      placeCamera();
      late.forEach((fn) => fn());
      renderer.render(scene, camera);
      const url = canvas.toDataURL(type, quality);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
      resize();
      return url;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      renderer.dispose();
      canvas.remove();
    },
  };
}
